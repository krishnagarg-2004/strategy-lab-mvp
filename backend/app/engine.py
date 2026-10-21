from __future__ import annotations
from io import StringIO
import hashlib
import json
from datetime import time
from zoneinfo import ZoneInfo
import numpy as np
import pandas as pd
from .schemas import StrategySpec, BacktestRequest

IST = ZoneInfo("Asia/Kolkata")
REQUIRED = ["timestamp", "open", "high", "low", "close", "volume"]

def demo_data() -> pd.DataFrame:
    """Deterministic synthetic OHLCV data; never real market data."""
    rng = np.random.default_rng(7)
    n = 900
    timestamps = pd.date_range("2025-01-06 09:15", periods=n, freq="5min", tz=IST)
    # Keep timestamps inside plausible sessions by constructing trading days.
    times = []
    day = pd.Timestamp("2025-01-06", tz=IST)
    while len(times) < n:
        session = pd.date_range(day + pd.Timedelta(hours=9, minutes=15), periods=75, freq="5min")
        times.extend(session.tolist())
        day += pd.Timedelta(days=1)
        while day.weekday() >= 5:
            day += pd.Timedelta(days=1)
    timestamps = pd.DatetimeIndex(times[:n])
    drift = np.sin(np.arange(n) / 35) * 0.8 + rng.normal(0, 3.2, n)
    close = 22000 + np.cumsum(drift)
    open_ = np.r_[close[0], close[:-1]]
    high = np.maximum(open_, close) + rng.uniform(0.2, 4.0, n)
    low = np.minimum(open_, close) - rng.uniform(0.2, 4.0, n)
    volume = rng.integers(1000, 50000, n)
    return pd.DataFrame({"timestamp": timestamps, "open": open_, "high": high, "low": low, "close": close, "volume": volume})

def load_candles(csv_data: str | None) -> pd.DataFrame:
    df = pd.read_csv(StringIO(csv_data)) if csv_data else demo_data()
    missing = set(REQUIRED) - set(df.columns)
    if missing:
        raise ValueError(f"CSV missing required columns: {', '.join(sorted(missing))}")
    df = df[REQUIRED].copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="raise")
    if df["timestamp"].dt.tz is None:
        df["timestamp"] = df["timestamp"].dt.tz_localize(IST)
    else:
        df["timestamp"] = df["timestamp"].dt.tz_convert(IST)
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="raise")
    if df.empty:
        raise ValueError("CSV contains no candles")
    if df[REQUIRED[1:5]].isna().any().any() or (df[["high", "low", "open", "close"]] <= 0).any().any():
        raise ValueError("OHLC prices must be positive and non-null")
    if (df["high"] < df[["open", "close", "low"]].max(axis=1)).any():
        raise ValueError("Each candle high must be >= open, close and low")
    if (df["low"] > df[["open", "close", "high"]].min(axis=1)).any():
        raise ValueError("Each candle low must be <= open, close and high")
    return df.sort_values("timestamp").drop_duplicates("timestamp").reset_index(drop=True)

def _rsi(series: pd.Series, period: int) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    rs = gain / loss.replace(0, np.nan)
    return (100 - 100 / (1 + rs)).fillna(50)

def run_backtest(request: BacktestRequest) -> dict:
    df = load_candles(request.csv_data)
    s: StrategySpec = request.strategy
    df["fast"] = df.close.ewm(span=s.fast_ema, adjust=False, min_periods=s.fast_ema).mean()
    df["slow"] = df.close.ewm(span=s.slow_ema, adjust=False, min_periods=s.slow_ema).mean()
    df["rsi"] = _rsi(df.close, s.rsi_period)
    df["cross_up"] = (df.fast > df.slow) & (df.fast.shift(1) <= df.slow.shift(1))
    df["cross_down"] = (df.fast < df.slow) & (df.fast.shift(1) >= df.slow.shift(1))
    capital = float(request.initial_capital)
    cash = capital
    position = None
    trades = []
    equity_curve = []
    slippage = request.slippage_bps / 10000
    start = time.fromisoformat(s.trading_start)
    end = time.fromisoformat(s.trading_end)

    for i, row in df.iterrows():
        ts = row.timestamp
        local_time = ts.timetz().replace(tzinfo=None)
        in_session = start <= local_time <= end
        # Exits use current candle OHLC; stop wins if both levels touched.
        if position is not None:
            exit_price = None
            reason = None
            if row.low <= position["stop"]:
                exit_price, reason = position["stop"], "stop_loss"
            elif row.high >= position["target"]:
                exit_price, reason = position["target"], "take_profit"
            elif bool(row.cross_down):
                exit_price, reason = float(row.close), "opposite_signal"
            elif not in_session and local_time > end:
                exit_price, reason = float(row.close), "session_end"
            if exit_price is not None:
                entry = position["entry_price"]
                qty = position["quantity"]
                fill = exit_price * (1 - slippage)
                gross = (fill - entry) * qty
                exit_fee = request.fee_per_order
                net = gross - position["entry_fee"] - exit_fee
                cash += fill * qty - exit_fee
                trades.append({
                    "entry_time": position["entry_time"].isoformat(), "exit_time": ts.isoformat(),
                    "side": "LONG", "entry_price": round(entry, 4), "exit_price": round(fill, 4),
                    "quantity": qty, "points": round(fill - entry, 4), "gross_pnl": round(gross, 2),
                    "fees": round(position["entry_fee"] + exit_fee, 2), "net_pnl": round(net, 2),
                    "duration_minutes": round((ts - position["entry_time"]).total_seconds() / 60, 2),
                    "entry_volume": int(position["entry_volume"]), "exit_reason": reason,
                })
                position = None
        # Signal is known only after candle close; fill next candle open.
        if position is None and i + 1 < len(df) and in_session and bool(row.cross_up) and (not s.use_rsi_filter or row.rsi >= s.rsi_min):
            next_row = df.iloc[i + 1]
            next_time = next_row.timestamp.timetz().replace(tzinfo=None)
            if start <= next_time <= end:
                raw_entry = float(next_row.open)
                entry = raw_entry * (1 + slippage)
                qty = min(request.quantity, int(cash // entry))
                if qty > 0:
                    fee = request.fee_per_order
                    cash -= entry * qty + fee
                    position = {"entry_time": next_row.timestamp, "entry_price": entry, "quantity": qty,
                                "stop": entry * (1 - s.stop_loss_pct / 100),
                                "target": entry * (1 + s.take_profit_pct / 100),
                                "entry_fee": fee, "entry_volume": next_row.volume}
        market_value = position["quantity"] * float(row.close) if position else 0.0
        equity_curve.append({"timestamp": ts.isoformat(), "equity": round(cash + market_value, 2)})
    # Close any remaining position on final candle close.
    if position is not None:
        row = df.iloc[-1]
        fill = float(row.close) * (1 - slippage)
        qty = position["quantity"]
        gross = (fill - position["entry_price"]) * qty
        exit_fee = request.fee_per_order
        net = gross - position["entry_fee"] - exit_fee
        cash += fill * qty - exit_fee
        trades.append({"entry_time": position["entry_time"].isoformat(), "exit_time": row.timestamp.isoformat(),
                       "side": "LONG", "entry_price": round(position["entry_price"], 4), "exit_price": round(fill, 4),
                       "quantity": qty, "points": round(fill - position["entry_price"], 4), "gross_pnl": round(gross, 2),
                       "fees": round(position["entry_fee"] + exit_fee, 2), "net_pnl": round(net, 2),
                       "duration_minutes": round((row.timestamp - position["entry_time"]).total_seconds() / 60, 2),
                       "entry_volume": int(position["entry_volume"]), "exit_reason": "end_of_data"})
        if equity_curve:
            equity_curve[-1]["equity"] = round(cash, 2)
    total_net = round(sum(t["net_pnl"] for t in trades), 2)
    wins = [t for t in trades if t["net_pnl"] > 0]
    losses = [t for t in trades if t["net_pnl"] < 0]
    gross_wins = sum(t["net_pnl"] for t in wins)
    gross_losses = abs(sum(t["net_pnl"] for t in losses))
    values = [p["equity"] for p in equity_curve] or [capital]
    peaks = np.maximum.accumulate(values)
    drawdowns = [(v - p) / p for v, p in zip(values, peaks) if p]
    max_dd = abs(min(drawdowns, default=0)) * 100
    final_equity = values[-1] if not position else values[-1]
    return {
        "symbol": request.symbol, "data_source": "synthetic_demo" if not request.csv_data else "uploaded_csv",
        "is_real_market_data": False if not request.csv_data else None,
        "strategy": s.model_dump(), "strategy_fingerprint": hashlib.sha256(json.dumps(s.model_dump(), sort_keys=True).encode()).hexdigest()[:16],
        "initial_capital": round(capital, 2), "final_equity": round(final_equity, 2),
        "net_pnl": total_net, "return_pct": round(total_net / capital * 100, 2),
        "trade_count": len(trades), "wins": len(wins), "losses": len(losses),
        "win_rate_pct": round(len(wins) / len(trades) * 100, 2) if trades else 0,
        "profit_factor": round(gross_wins / gross_losses, 3) if gross_losses else (None if gross_wins else 0),
        "max_drawdown_pct": round(max_dd, 2),
        "average_duration_minutes": round(float(np.mean([t["duration_minutes"] for t in trades])), 2) if trades else 0,
        "trades": trades, "equity_curve": equity_curve,
        "assumptions": ["Long-only; one position at a time", "Signal evaluated at candle close; entry at next candle open",
                        "If stop and target are both touched in one candle, stop-loss is assumed first",
                        "Fees charged per order; slippage applied to simulated fills", "No live orders are sent"],
    }
