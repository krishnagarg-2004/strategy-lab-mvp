from __future__ import annotations

from datetime import datetime, time
import logging
from typing import Any
from zoneinfo import ZoneInfo
import httpx
import pandas as pd

from .engine import _calculate_indian_taxes_and_charges, _rsi, _supertrend, _vwap
from .market_data import fetch_indian_market_data
from .schemas import StartPaperTradingRequest, StrategySpec, WebhookConfig

logger = logging.getLogger(__name__)
IST = ZoneInfo("Asia/Kolkata")


class PaperTradingSession:
    """Stateful, thread-safe session for Live Indian Markets Paper Trading."""

    def __init__(self):
        self.is_active: bool = False
        self.started_at: datetime | None = None
        self.symbol: str = "^NSEI"
        self.strategy: StrategySpec = StrategySpec()
        self.initial_capital: float = 100000.0
        self.cash: float = 100000.0
        self.quantity: int = 1
        self.webhook: WebhookConfig = WebhookConfig()

        # Active open position
        self.position: dict[str, Any] | None = None
        # Completed paper trades
        self.trades: list[dict[str, Any]] = []
        # Audit log of evaluations and alerts
        self.logs: list[dict[str, Any]] = []
        # Last evaluated candle time and price
        self.last_candle_time: str | None = None
        self.last_evaluated_price: float | None = None

    def start(self, req: StartPaperTradingRequest) -> dict[str, Any]:
        """Start a fresh live paper trading session."""
        self.is_active = True
        self.started_at = datetime.now(IST)
        self.symbol = req.symbol.strip().upper()
        self.strategy = req.strategy
        self.initial_capital = req.initial_capital
        self.cash = req.initial_capital
        self.quantity = req.quantity
        self.webhook = req.webhook or WebhookConfig()
        self.position = None
        self.trades = []
        self.logs = []
        self.last_candle_time = None
        self.last_evaluated_price = None

        self._log("SESSION_START", f"Paper trading started for {self.symbol} with initial cash ₹{self.initial_capital:,.2f}")
        self._dispatch_webhook(
            title=f"🟢 Paper Trading Started: {self.symbol}",
            description=f"Initial Capital: ₹{self.initial_capital:,.2f} | Strategy: {self.strategy.name} ({self.strategy.trade_direction})\nRules: Fast EMA {self.strategy.fast_ema} / Slow EMA {self.strategy.slow_ema} | SL {self.strategy.stop_loss_pct}% / TP {self.strategy.take_profit_pct}%",
            color=0x10B981,
        )
        return self.get_status()

    def stop(self) -> dict[str, Any]:
        """Stop the active paper trading session and square off any open position."""
        if not self.is_active:
            return self.get_status()

        if self.position is not None and self.last_evaluated_price is not None:
            self._close_position(
                exit_price=self.last_evaluated_price,
                reason="session_stopped",
                timestamp=datetime.now(IST).isoformat(),
            )

        self.is_active = False
        self._log("SESSION_STOP", f"Paper trading stopped for {self.symbol}. Total Trades: {len(self.trades)}")
        self._dispatch_webhook(
            title=f"🛑 Paper Trading Stopped: {self.symbol}",
            description=f"Session closed. Realized Net P&L: ₹{self.get_realized_pnl():,.2f} across {len(self.trades)} trades.",
            color=0xEF4444,
        )
        return self.get_status()

    def tick(self, manual_price: float | None = None) -> dict[str, Any]:
        """Evaluate latest market candle or manual price against strategy rules."""
        if not self.is_active:
            return {"error": "Paper trading is not currently active.", "status": self.get_status()}

        now = datetime.now(IST)
        local_time = now.time()
        start = time.fromisoformat(self.strategy.trading_start)
        end = time.fromisoformat(self.strategy.trading_end)
        in_session = start <= local_time <= end

        # 1. Fetch recent candles for technical indicator calculation
        try:
            _, df = fetch_indian_market_data(self.symbol, period="5d", interval="15m", force_refresh=True)
        except Exception as exc:
            self._log("DATA_FETCH_ERROR", str(exc))
            return {"error": f"Failed to fetch market tick: {exc}", "status": self.get_status()}

        if df.empty or len(df) < max(self.strategy.slow_ema, 25):
            return {"error": "Insufficient market candles to compute indicators.", "status": self.get_status()}

        # 2. Compute indicator series
        df["fast"] = df["close"].ewm(span=self.strategy.fast_ema, adjust=False).mean()
        df["slow"] = df["close"].ewm(span=self.strategy.slow_ema, adjust=False).mean()
        df["rsi"] = _rsi(df["close"], self.strategy.rsi_period)
        df["vwap"] = _vwap(df)
        st_dir, st_val = _supertrend(df, self.strategy.supertrend_period, self.strategy.supertrend_multiplier)
        df["supertrend_dir"] = st_dir

        latest = df.iloc[-1]
        prev = df.iloc[-2]
        curr_price = float(manual_price) if manual_price is not None else float(latest["close"])
        candle_ts = latest["timestamp"].isoformat()
        self.last_candle_time = candle_ts
        self.last_evaluated_price = curr_price

        # 3. Check exits for open position first
        if self.position is not None:
            pos = self.position
            side = pos["side"]

            # Update dynamic trailing stop
            if self.strategy.use_trailing_stop:
                trail_dist = self.strategy.trailing_stop_pct / 100.0
                if side == "LONG":
                    if curr_price > pos["highest_price"]:
                        pos["highest_price"] = curr_price
                        new_stop = curr_price * (1.0 - trail_dist)
                        if new_stop > pos["stop"]:
                            pos["stop"] = new_stop
                            pos["is_trailing"] = True
                else:  # SHORT
                    if curr_price < pos["lowest_price"]:
                        pos["lowest_price"] = curr_price
                        new_stop = curr_price * (1.0 + trail_dist)
                        if new_stop < pos["stop"]:
                            pos["stop"] = new_stop
                            pos["is_trailing"] = True

            # Check exit conditions
            exit_reason = None
            if side == "LONG":
                if curr_price <= pos["stop"]:
                    exit_reason = "trailing_stop" if pos.get("is_trailing") else "stop_loss"
                elif curr_price >= pos["target"]:
                    exit_reason = "take_profit"
                elif not in_session:
                    exit_reason = "session_end_squareoff"
            else:  # SHORT
                if curr_price >= pos["stop"]:
                    exit_reason = "trailing_stop" if pos.get("is_trailing") else "stop_loss"
                elif curr_price <= pos["target"]:
                    exit_reason = "take_profit"
                elif not in_session:
                    exit_reason = "session_end_squareoff"

            if exit_reason:
                self._close_position(curr_price, exit_reason, now.isoformat())

        # 4. If no position is open, check entry triggers (evaluating crossover between prev and latest)
        elif in_session:
            can_long = self.strategy.trade_direction in ("LONG", "BOTH")
            can_short = self.strategy.trade_direction in ("SHORT", "BOTH")

            cross_up = prev["fast"] <= prev["slow"] and latest["fast"] > latest["slow"]
            cross_down = prev["fast"] >= prev["slow"] and latest["fast"] < latest["slow"]

            rsi_val = float(latest["rsi"]) if pd.notna(latest["rsi"]) else 50.0
            rsi_long_ok = (not self.strategy.use_rsi_filter) or (rsi_val >= self.strategy.rsi_min)
            rsi_short_ok = (not self.strategy.use_rsi_filter) or (rsi_val <= (100 - self.strategy.rsi_min))

            vwap_val = float(latest["vwap"]) if pd.notna(latest["vwap"]) else curr_price
            vwap_long_ok = (not self.strategy.use_vwap_filter) or (curr_price >= vwap_val)
            vwap_short_ok = (not self.strategy.use_vwap_filter) or (curr_price <= vwap_val)

            st_val_dir = int(latest["supertrend_dir"])
            st_long_ok = (not self.strategy.use_supertrend_filter) or (st_val_dir == 1)
            st_short_ok = (not self.strategy.use_supertrend_filter) or (st_val_dir == -1)

            if can_long and cross_up and rsi_long_ok and vwap_long_ok and st_long_ok:
                self._open_position(side="LONG", fill_price=curr_price, timestamp=now.isoformat())
            elif can_short and cross_down and rsi_short_ok and vwap_short_ok and st_short_ok:
                self._open_position(side="SHORT", fill_price=curr_price, timestamp=now.isoformat())

        return self.get_status()

    def _open_position(self, side: str, fill_price: float, timestamp: str):
        qty = self.quantity
        if side == "LONG":
            cost = fill_price * qty
            if cost > self.cash:
                self._log("ENTRY_REJECTED", f"Insufficient cash ₹{self.cash:.2f} for Long entry cost ₹{cost:.2f}")
                return
            self.cash -= cost
            stop = fill_price * (1.0 - self.strategy.stop_loss_pct / 100.0)
            target = fill_price * (1.0 + self.strategy.take_profit_pct / 100.0)
            self.position = {
                "side": "LONG",
                "entry_time": timestamp,
                "entry_price": fill_price,
                "quantity": qty,
                "stop": round(stop, 2),
                "target": round(target, 2),
                "highest_price": fill_price,
                "is_trailing": False,
            }
        else:  # SHORT
            margin = fill_price * qty
            if margin > self.cash:
                self._log("ENTRY_REJECTED", f"Insufficient margin ₹{self.cash:.2f} for Short entry margin ₹{margin:.2f}")
                return
            self.cash -= margin
            stop = fill_price * (1.0 + self.strategy.stop_loss_pct / 100.0)
            target = fill_price * (1.0 - self.strategy.take_profit_pct / 100.0)
            self.position = {
                "side": "SHORT",
                "entry_time": timestamp,
                "entry_price": fill_price,
                "quantity": qty,
                "stop": round(stop, 2),
                "target": round(target, 2),
                "lowest_price": fill_price,
                "is_trailing": False,
            }

        self._log("ORDER_ENTRY", f"Opened {side} position in {self.symbol} at ₹{fill_price:,.2f} | Stop: ₹{stop:.2f}, Target: ₹{target:.2f}")
        self._dispatch_webhook(
            title=f"⚡ NEW SIGNAL: {side} {self.symbol}",
            description=f"Entry Fill: ₹{fill_price:,.2f}\nQuantity: {qty}\nStop Loss: ₹{stop:.2f}\nTarget: ₹{target:.2f}",
            color=0x38BDF8 if side == "LONG" else 0xFBBF24,
        )

    def _close_position(self, exit_price: float, reason: str, timestamp: str):
        if not self.position:
            return
        pos = self.position
        side = pos["side"]
        qty = pos["quantity"]
        entry_price = pos["entry_price"]

        if side == "LONG":
            points = exit_price - entry_price
            gross_pnl = points * qty
            buy_turnover = entry_price * qty
            sell_turnover = exit_price * qty
        else:  # SHORT
            points = entry_price - exit_price
            gross_pnl = points * qty
            buy_turnover = exit_price * qty
            sell_turnover = entry_price * qty

        tax_dict = _calculate_indian_taxes_and_charges(
            buy_turnover=buy_turnover,
            sell_turnover=sell_turnover,
            brokerage_per_order=self.strategy.brokerage_per_order,
            use_regulatory_charges=self.strategy.use_regulatory_charges,
        )
        total_fees = tax_dict["total_charges"]
        net_pnl = round(gross_pnl - total_fees, 2)

        if side == "LONG":
            self.cash += (exit_price * qty) - total_fees
        else:
            self.cash += (entry_price * qty) + gross_pnl - total_fees

        trade_record = {
            "id": len(self.trades) + 1,
            "side": side,
            "entry_time": pos["entry_time"],
            "exit_time": timestamp,
            "entry_price": round(entry_price, 2),
            "exit_price": round(exit_price, 2),
            "quantity": qty,
            "points": round(points, 2),
            "gross_pnl": round(gross_pnl, 2),
            "fees": total_fees,
            "net_pnl": net_pnl,
            "exit_reason": reason,
            "tax_breakdown": tax_dict,
        }
        self.trades.append(trade_record)
        self.position = None

        self._log("ORDER_EXIT", f"Closed {side} at ₹{exit_price:,.2f} ({reason}). Net P&L: ₹{net_pnl:,.2f}")
        self._dispatch_webhook(
            title=f"🔔 TRADE EXIT: {side} {self.symbol} ({reason})",
            description=f"Exit Price: ₹{exit_price:,.2f} (Entry: ₹{entry_price:,.2f})\nNet P&L: ₹{net_pnl:,.2f}\nTaxes & Charges: ₹{total_fees:.2f}",
            color=0x10B981 if net_pnl >= 0 else 0xEF4444,
        )

    def get_realized_pnl(self) -> float:
        return round(sum(t["net_pnl"] for t in self.trades), 2)

    def get_unrealized_pnl(self) -> float:
        if not self.position or self.last_evaluated_price is None:
            return 0.0
        pos = self.position
        curr = self.last_evaluated_price
        entry = pos["entry_price"]
        qty = pos["quantity"]
        if pos["side"] == "LONG":
            return round((curr - entry) * qty, 2)
        else:
            return round((entry - curr) * qty, 2)

    def get_status(self) -> dict[str, Any]:
        """Return full JSON-serializable snapshot of the live paper trading portfolio."""
        unrealized = self.get_unrealized_pnl()
        realized = self.get_realized_pnl()
        equity = round(self.cash + (self.position["entry_price"] * self.position["quantity"] + unrealized if self.position else 0.0), 2)

        return {
            "is_active": self.is_active,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "symbol": self.symbol,
            "initial_capital": round(self.initial_capital, 2),
            "cash_balance": round(self.cash, 2),
            "equity": equity,
            "realized_pnl": realized,
            "unrealized_pnl": unrealized,
            "total_return_pct": round(((equity - self.initial_capital) / self.initial_capital) * 100, 2) if self.initial_capital > 0 else 0.0,
            "open_position": self.position,
            "last_candle_time": self.last_candle_time,
            "last_evaluated_price": self.last_evaluated_price,
            "trades_count": len(self.trades),
            "trades": self.trades[-20:],  # latest 20 trades
            "logs": self.logs[-25:],  # latest 25 logs
            "webhook_enabled": bool(self.webhook and self.webhook.enabled),
        }

    def _log(self, event_type: str, message: str):
        record = {
            "time": datetime.now(IST).strftime("%H:%M:%S"),
            "event": event_type,
            "message": message,
        }
        self.logs.append(record)
        logger.info("[PAPER TRADING] %s: %s", event_type, message)

    def _dispatch_webhook(self, title: str, description: str, color: int = 0x63DFB0):
        if not self.webhook or not self.webhook.enabled or not self.webhook.webhook_url:
            return
        url = self.webhook.webhook_url.strip()
        platform = getattr(self.webhook, "platform", "generic")

        try:
            if platform == "discord" or "discord.com" in url:
                payload = {
                    "embeds": [
                        {
                            "title": title,
                            "description": description,
                            "color": color,
                            "footer": {"text": "Strategy Lab · Live Paper Trading Engine"},
                            "timestamp": datetime.now(IST).isoformat(),
                        }
                    ]
                }
            elif platform == "telegram":
                # Expects a telegram sendMessage URL or bot format
                payload = {"text": f"*{title}*\n\n{description}"}
            else:
                payload = {
                    "event": "strategy_lab_alert",
                    "title": title,
                    "description": description,
                    "timestamp": datetime.now(IST).isoformat(),
                }

            # Fire and forget HTTP request
            with httpx.Client(timeout=4.0) as client:
                client.post(url, json=payload)
        except Exception as exc:
            self._log("WEBHOOK_FAILED", f"Could not post to webhook: {exc}")


# Global singleton paper trading session
paper_session = PaperTradingSession()
