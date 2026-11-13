from __future__ import annotations

from datetime import time
from io import StringIO
from zoneinfo import ZoneInfo
import hashlib
import json
import math

import numpy as np
import pandas as pd

from .schemas import BacktestRequest, GridSearchRequest, PortfolioBacktestRequest, StrategySpec

IST = ZoneInfo("Asia/Kolkata")
REQUIRED = ["timestamp", "open", "high", "low", "close", "volume"]
PRICE_COLUMNS = ["open", "high", "low", "close"]
MAX_CSV_BYTES = 10 * 1024 * 1024


def demo_data() -> pd.DataFrame:
    """Generate deterministic synthetic OHLCV data, never real market data."""
    rng = np.random.default_rng(7)
    n = 900
    timestamps = []
    day = pd.Timestamp("2025-01-06", tz=IST)

    while len(timestamps) < n:
        session = pd.date_range(
            day + pd.Timedelta(hours=9, minutes=15),
            periods=75,
            freq="5min",
        )
        timestamps.extend(session.tolist())
        day += pd.Timedelta(days=1)

        while day.weekday() >= 5:
            day += pd.Timedelta(days=1)

    timestamps = pd.DatetimeIndex(timestamps[:n])

    drift = np.sin(np.arange(n) / 35) * 0.8 + rng.normal(0, 3.2, n)
    close = 22000 + np.cumsum(drift)
    open_ = np.r_[close[0], close[:-1]]
    high = np.maximum(open_, close) + rng.uniform(0.2, 4.0, n)
    low = np.minimum(open_, close) - rng.uniform(0.2, 4.0, n)
    volume = rng.integers(1000, 50000, n)

    return pd.DataFrame(
        {
            "timestamp": timestamps,
            "open": open_,
            "high": high,
            "low": low,
            "close": close,
            "volume": volume,
        }
    )


def load_candles(csv_data: str | None) -> pd.DataFrame:
    """Load and validate OHLCV candles."""
    if csv_data is None:
        return demo_data()

    if not csv_data.strip():
        raise ValueError("CSV data is empty.")

    if len(csv_data.encode("utf-8")) > MAX_CSV_BYTES:
        raise ValueError("CSV exceeds the 10 MB size limit.")

    try:
        df = pd.read_csv(StringIO(csv_data))
    except Exception as exc:
        raise ValueError(f"Could not parse CSV: {exc}") from exc

    df.columns = [str(column).strip().lower() for column in df.columns]

    if df.columns.duplicated().any():
        raise ValueError("CSV contains duplicate column names.")

    missing = set(REQUIRED) - set(df.columns)
    if missing:
        raise ValueError(
            f"CSV missing required columns: {', '.join(sorted(missing))}"
        )

    if df.empty:
        raise ValueError("CSV contains no candles.")

    df = df[REQUIRED].copy()

    try:
        df["timestamp"] = pd.to_datetime(
            df["timestamp"], errors="raise"
        )
    except Exception as exc:
        raise ValueError(
            "Invalid timestamps. Use a consistent date and time format."
        ) from exc

    if df["timestamp"].isna().any():
        raise ValueError("CSV contains missing timestamps.")

    try:
        if df["timestamp"].dt.tz is None:
            df["timestamp"] = df["timestamp"].dt.tz_localize(
                IST, ambiguous="raise", nonexistent="raise"
            )
        else:
            df["timestamp"] = df["timestamp"].dt.tz_convert(IST)
    except Exception as exc:
        raise ValueError(
            "Could not interpret timestamps in a consistent time zone."
        ) from exc

    for column in PRICE_COLUMNS + ["volume"]:
        try:
            df[column] = pd.to_numeric(df[column], errors="raise")
        except Exception as exc:
            raise ValueError(
                f"Column '{column}' contains non-numeric values."
            ) from exc

    numeric = df[PRICE_COLUMNS + ["volume"]].to_numpy(dtype=float)

    if not np.isfinite(numeric).all():
        raise ValueError(
            "OHLCV columns contain missing or non-finite values."
        )

    if (df[PRICE_COLUMNS] <= 0).any().any():
        raise ValueError("OHLC prices must be positive.")

    if (df["volume"] < 0).any():
        raise ValueError("Volume cannot be negative.")

    if (df["high"] < df[["open", "close", "low"]].max(axis=1)).any():
        raise ValueError("Each candle high must be >= open, close and low.")

    if (df["low"] > df[["open", "close", "high"]].min(axis=1)).any():
        raise ValueError("Each candle low must be <= open, close and high.")

    if df["timestamp"].duplicated().any():
        raise ValueError(
            "CSV contains duplicate timestamps. Resolve duplicates before uploading."
        )

    df = df.sort_values("timestamp").reset_index(drop=True)

    if len(df) < 2:
        raise ValueError("At least two candles are required for a backtest.")

    return df


def _rsi(series: pd.Series, period: int) -> pd.Series:
    """Calculate RSI using exponentially smoothed gains and losses."""
    delta = series.diff()

    gain = delta.clip(lower=0).ewm(
        alpha=1 / period,
        adjust=False,
        min_periods=period,
    ).mean()

    loss = (-delta.clip(upper=0)).ewm(
        alpha=1 / period,
        adjust=False,
        min_periods=period,
    ).mean()

    rs = gain / loss.replace(0, np.nan)
    rsi = 100 - 100 / (1 + rs)

    flat = (gain == 0) & (loss == 0)
    rsi = rsi.mask(flat, 50)
    rsi = rsi.mask((loss == 0) & (gain > 0), 100)
    rsi = rsi.mask((gain == 0) & (loss > 0), 0)

    # Preserve unavailable early RSI values rather than treating them
    # as neutral signals before enough observations exist.
    return rsi


def _vwap(df: pd.DataFrame) -> pd.Series:
    """Calculate intraday Volume-Weighted Average Price resetting each session."""
    tp = (df["high"] + df["low"] + df["close"]) / 3
    tp_vol = tp * df["volume"]
    dates = df["timestamp"].dt.date
    cum_tp_vol = tp_vol.groupby(dates).cumsum()
    cum_vol = df["volume"].groupby(dates).cumsum()
    return cum_tp_vol / cum_vol.replace(0, np.nan)


def _calculate_advanced_metrics(
    equity_curve: list[dict],
    trades: list[dict],
    initial_capital: float,
) -> tuple[float | None, float | None, int]:
    """Calculate Sharpe Ratio, Sortino Ratio, and Max Consecutive Losses."""
    # Max consecutive losses
    max_consec_losses = 0
    curr_losses = 0
    for t in trades:
        if t["net_pnl"] < 0:
            curr_losses += 1
            if curr_losses > max_consec_losses:
                max_consec_losses = curr_losses
        else:
            curr_losses = 0

    if not equity_curve or len(equity_curve) < 2:
        return None, None, max_consec_losses

    equities = np.array([point["equity"] for point in equity_curve], dtype=float)
    # Candle-to-candle returns
    returns = np.diff(equities) / equities[:-1]
    returns = returns[np.isfinite(returns)]

    if len(returns) == 0:
        return None, None, max_consec_losses

    mean_ret = np.mean(returns)
    std_ret = np.std(returns)

    # Annualization factor for intraday Indian market (approx 75 5-min bars/day, 250 days = ~18,750 bars/yr)
    ann_factor = np.sqrt(18750)

    # Sharpe Ratio (assumes 0% risk free intraday)
    sharpe = round(float((mean_ret / std_ret) * ann_factor), 2) if std_ret > 1e-8 else None

    # Sortino Ratio (downside deviation only)
    downside_returns = returns[returns < 0]
    if len(downside_returns) > 0:
        downside_std = np.std(downside_returns)
        sortino = round(float((mean_ret / downside_std) * ann_factor), 2) if downside_std > 1e-8 else None
    else:
        sortino = round(float(sharpe), 2) if sharpe is not None else None

    return sharpe, sortino, max_consec_losses


def _supertrend(
    df: pd.DataFrame, period: int = 10, multiplier: float = 3.0
) -> tuple[pd.Series, pd.Series]:
    """Calculate Supertrend direction (1 = Bullish, -1 = Bearish) and value."""
    high = df["high"]
    low = df["low"]
    close = df["close"]

    tr1 = high - low
    tr2 = (high - close.shift(1)).abs()
    tr3 = (low - close.shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

    atr = tr.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()

    hl2 = (high + low) / 2
    upper_basic = hl2 + multiplier * atr
    lower_basic = hl2 - multiplier * atr

    n = len(df)
    upper_band = np.zeros(n)
    lower_band = np.zeros(n)
    trend = np.zeros(n, dtype=int)

    for i in range(n):
        if i == 0:
            upper_band[i] = upper_basic.iloc[i]
            lower_band[i] = lower_basic.iloc[i]
            trend[i] = 1
            continue

        if lower_basic.iloc[i] > lower_band[i - 1] or close.iloc[i - 1] < lower_band[i - 1]:
            lower_band[i] = lower_basic.iloc[i]
        else:
            lower_band[i] = lower_band[i - 1]

        if upper_basic.iloc[i] < upper_band[i - 1] or close.iloc[i - 1] > upper_band[i - 1]:
            upper_band[i] = upper_basic.iloc[i]
        else:
            upper_band[i] = upper_band[i - 1]

        if trend[i - 1] == 1:
            trend[i] = -1 if close.iloc[i] < lower_band[i] else 1
        else:
            trend[i] = 1 if close.iloc[i] > upper_band[i] else -1

    st_values = pd.Series(
        np.where(trend == 1, lower_band, upper_band), index=df.index
    )
    return pd.Series(trend, index=df.index), st_values


def run_backtest(request: BacktestRequest) -> dict:
    """Run a long-only, single-position historical candle simulation."""
    data_source = "synthetic_demo"
    is_real = False

    if request.csv_data is not None:
        df = load_candles(request.csv_data)
        data_source = "uploaded_csv"
        is_real = None
    elif getattr(request, "market_symbol", None):
        from .market_data import fetch_indian_market_data
        csv_str, _ = fetch_indian_market_data(
            request.market_symbol,
            period=request.market_period or "1mo",
            interval=request.market_interval or "15m",
        )
        df = load_candles(csv_str)
        data_source = f"market_data:{request.market_symbol}"
        is_real = True
    else:
        df = load_candles(None)

    s: StrategySpec = request.strategy

    if not request.symbol.strip():
        raise ValueError("Instrument label cannot be empty.")

    capital = float(request.initial_capital)
    quantity_requested = int(request.quantity)
    fee_per_order = float(request.fee_per_order)
    slippage = float(request.slippage_bps) / 10000

    if not all(
        math.isfinite(value)
        for value in (capital, fee_per_order, slippage)
    ):
        raise ValueError("Capital, fees and slippage must be finite numbers.")

    df["fast"] = df["close"].ewm(
        span=s.fast_ema,
        adjust=False,
        min_periods=s.fast_ema,
    ).mean()

    df["slow"] = df["close"].ewm(
        span=s.slow_ema,
        adjust=False,
        min_periods=s.slow_ema,
    ).mean()

    df["rsi"] = _rsi(df["close"], s.rsi_period)
    df["vwap"] = _vwap(df)
    st_dir, st_val = _supertrend(
        df,
        period=getattr(s, "supertrend_period", 10),
        multiplier=getattr(s, "supertrend_multiplier", 3.0),
    )
    df["supertrend_dir"] = st_dir
    df["supertrend_val"] = st_val

    df["cross_up"] = (
        (df["fast"] > df["slow"])
        & (df["fast"].shift(1) <= df["slow"].shift(1))
    )

    df["cross_down"] = (
        (df["fast"] < df["slow"])
        & (df["fast"].shift(1) >= df["slow"].shift(1))
    )

    start = time.fromisoformat(s.trading_start)
    end = time.fromisoformat(s.trading_end)

    def is_in_session(timestamp) -> bool:
        local_time = timestamp.timetz().replace(tzinfo=None)
        return start <= local_time <= end

    # Identify the final available in-session candle of each session.
    # This also handles datasets that jump directly to the next trading day.
    last_in_session = []

    for i, row in df.iterrows():
        ts = row["timestamp"]

        if not is_in_session(ts):
            last_in_session.append(False)
            continue

        if i + 1 >= len(df):
            last_in_session.append(True)
            continue

        next_ts = df.iloc[i + 1]["timestamp"]

        ends_session = (
            next_ts.date() != ts.date()
            or not is_in_session(next_ts)
        )
        last_in_session.append(ends_session)

    cash = capital
    position = None
    pending_entry = None
    trades = []
    equity_curve = []

    def close_position(timestamp, reference_price, reason):
        """Close the open position and record realized P&L."""
        nonlocal cash, position

        if position is None:
            return

        exit_reference = float(reference_price)
        side = position["side"]
        qty = position["quantity"]
        entry_fill = position["entry_price"]
        exit_fee = fee_per_order
        total_fees = position["entry_fee"] + exit_fee

        if side == "LONG":
            exit_fill = exit_reference * (1 - slippage)
            points = exit_fill - entry_fill
            gross_pnl = points * qty
            cash += exit_fill * qty - exit_fee
        else:  # SHORT
            exit_fill = exit_reference * (1 + slippage)
            points = entry_fill - exit_fill
            gross_pnl = points * qty
            # Return margin reserve and book P&L
            cash += (entry_fill * qty) + gross_pnl - exit_fee

        net_pnl = gross_pnl - total_fees

        trades.append(
            {
                "entry_time": position["entry_time"].isoformat(),
                "exit_time": timestamp.isoformat(),
                "side": side,
                "entry_price": round(entry_fill, 4),
                "exit_price": round(exit_fill, 4),
                "quantity": qty,
                "points": round(points, 4),
                "gross_pnl": round(gross_pnl, 2),
                "fees": round(total_fees, 2),
                "net_pnl": round(net_pnl, 2),
                "duration_minutes": round(
                    (
                        timestamp - position["entry_time"]
                    ).total_seconds() / 60,
                    2,
                ),
                "entry_volume": int(position["entry_volume"]),
                "exit_reason": reason,
            }
        )

        position = None

    for i, row in df.iterrows():
        ts = row["timestamp"]
        in_session = is_in_session(ts)

        # 1. Enter Pending Entry at candle open
        if pending_entry and position is None and in_session:
            raw_entry = float(row["open"])
            affordable_qty = int(max(0, cash - fee_per_order) // raw_entry)
            qty = min(quantity_requested, affordable_qty)

            if qty > 0:
                entry_fee = fee_per_order
                if pending_entry == "LONG":
                    entry_fill = raw_entry * (1 + slippage)
                    cash -= entry_fill * qty + entry_fee
                    position = {
                        "side": "LONG",
                        "entry_time": ts,
                        "entry_price": entry_fill,
                        "quantity": qty,
                        "stop": entry_fill * (1 - s.stop_loss_pct / 100),
                        "target": entry_fill * (1 + s.take_profit_pct / 100),
                        "highest_price": entry_fill,
                        "is_trailing": False,
                        "entry_fee": entry_fee,
                        "entry_volume": row["volume"],
                    }
                else:  # SHORT
                    entry_fill = raw_entry * (1 - slippage)
                    cash -= entry_fill * qty + entry_fee
                    position = {
                        "side": "SHORT",
                        "entry_time": ts,
                        "entry_price": entry_fill,
                        "quantity": qty,
                        "stop": entry_fill * (1 + s.stop_loss_pct / 100),
                        "target": entry_fill * (1 - s.take_profit_pct / 100),
                        "lowest_price": entry_fill,
                        "is_trailing": False,
                        "entry_fee": entry_fee,
                        "entry_volume": row["volume"],
                    }

            pending_entry = None

        # 2. Update Trailing Stop for open position
        if position is not None and getattr(s, "use_trailing_stop", False):
            if position["side"] == "LONG":
                position["highest_price"] = max(
                    position.get("highest_price", position["entry_price"]),
                    float(row["high"]),
                )
                trail_stop = position["highest_price"] * (
                    1 - s.trailing_stop_pct / 100
                )
                if trail_stop > position["stop"]:
                    position["stop"] = trail_stop
                    position["is_trailing"] = True
            else:  # SHORT
                position["lowest_price"] = min(
                    position.get("lowest_price", position["entry_price"]),
                    float(row["low"]),
                )
                trail_stop = position["lowest_price"] * (
                    1 + s.trailing_stop_pct / 100
                )
                if trail_stop < position["stop"]:
                    position["stop"] = trail_stop
                    position["is_trailing"] = True

        # 3. Check position exits
        if position is not None:
            side = position["side"]
            stop = position["stop"]
            target = position["target"]
            candle_open = float(row["open"])
            candle_low = float(row["low"])
            candle_high = float(row["high"])
            stop_reason = (
                "trailing_stop"
                if position.get("is_trailing")
                else "stop_loss"
            )

            if side == "LONG":
                if candle_open <= stop:
                    close_position(ts, candle_open, stop_reason)
                elif candle_open >= target:
                    close_position(ts, candle_open, "take_profit")
                elif candle_low <= stop:
                    close_position(ts, stop, stop_reason)
                elif candle_high >= target:
                    close_position(ts, target, "take_profit")
                elif bool(row["cross_down"]):
                    close_position(ts, float(row["close"]), "opposite_signal")
                elif last_in_session[i]:
                    close_position(ts, float(row["close"]), "session_end")
            else:  # SHORT
                if candle_open >= stop:
                    close_position(ts, candle_open, stop_reason)
                elif candle_open <= target:
                    close_position(ts, candle_open, "take_profit")
                elif candle_high >= stop:
                    close_position(ts, stop, stop_reason)
                elif candle_low <= target:
                    close_position(ts, target, "take_profit")
                elif bool(row["cross_up"]):
                    close_position(ts, float(row["close"]), "opposite_signal")
                elif last_in_session[i]:
                    close_position(ts, float(row["close"]), "session_end")

        # 4. Generate Signal on Candle Close
        if (
            position is None
            and not pending_entry
            and i + 1 < len(df)
            and in_session
            and is_in_session(df.iloc[i + 1]["timestamp"])
            and df.iloc[i + 1]["timestamp"].date() == ts.date()
        ):
            trade_dir = getattr(s, "trade_direction", "LONG")
            can_long = trade_dir in ("LONG", "BOTH")
            can_short = trade_dir in ("SHORT", "BOTH")

            # Filters
            vwap_long_ok = (not getattr(s, "use_vwap_filter", False)) or (
                pd.notna(row["vwap"]) and row["close"] > row["vwap"]
            )
            vwap_short_ok = (not getattr(s, "use_vwap_filter", False)) or (
                pd.notna(row["vwap"]) and row["close"] < row["vwap"]
            )

            st_long_ok = (not getattr(s, "use_supertrend_filter", False)) or (
                row["supertrend_dir"] == 1
            )
            st_short_ok = (not getattr(s, "use_supertrend_filter", False)) or (
                row["supertrend_dir"] == -1
            )

            rsi_long_ok = (not s.use_rsi_filter) or (
                pd.notna(row["rsi"]) and row["rsi"] >= s.rsi_min
            )
            rsi_short_ok = (not s.use_rsi_filter) or (
                pd.notna(row["rsi"]) and row["rsi"] <= (100 - s.rsi_min)
            )

            if (
                can_long
                and bool(row["cross_up"])
                and rsi_long_ok
                and vwap_long_ok
                and st_long_ok
            ):
                pending_entry = "LONG"
            elif (
                can_short
                and bool(row["cross_down"])
                and rsi_short_ok
                and vwap_short_ok
                and st_short_ok
            ):
                pending_entry = "SHORT"

        # 5. Mark to Market Equity
        if position is not None:
            if position["side"] == "LONG":
                market_val = position["quantity"] * float(row["close"])
            else:  # SHORT
                unrealized = position["quantity"] * (
                    position["entry_price"] - float(row["close"])
                )
                margin = position["quantity"] * position["entry_price"]
                market_val = margin + unrealized
        else:
            market_val = 0.0

        equity_curve.append(
            {
                "timestamp": ts.isoformat(),
                "equity": round(cash + market_val, 2),
            }
        )

    # Any remaining position is closed at the final available candle close.
    # This is a fallback for unusual timestamp/session layouts.
    if position is not None:
        last = df.iloc[-1]
        close_position(
            last["timestamp"],
            float(last["close"]),
            "end_of_data",
        )
        equity_curve[-1]["equity"] = round(cash, 2)

    final_equity = cash
    total_net = round(final_equity - capital, 2)

    wins = [trade for trade in trades if trade["net_pnl"] > 0]
    losses = [trade for trade in trades if trade["net_pnl"] < 0]

    gross_wins = sum(trade["net_pnl"] for trade in wins)
    gross_losses = abs(sum(trade["net_pnl"] for trade in losses))

    # Include starting capital when calculating drawdown, so losses from
    # the original balance are not hidden by the first recorded candle.
    values = [capital] + [point["equity"] for point in equity_curve]
    peaks = np.maximum.accumulate(values)

    drawdowns = [
        (value - peak) / peak
        for value, peak in zip(values, peaks)
        if peak > 0
    ]

    max_drawdown = abs(min(drawdowns, default=0.0)) * 100

    sharpe_ratio, sortino_ratio, max_consecutive_losses = _calculate_advanced_metrics(
        equity_curve, trades, capital
    )

    chart_candles = [
        {
            "time": int(row["timestamp"].timestamp()),
            "timestamp": row["timestamp"].isoformat(),
            "open": round(float(row["open"]), 2),
            "high": round(float(row["high"]), 2),
            "low": round(float(row["low"]), 2),
            "close": round(float(row["close"]), 2),
            "volume": int(row["volume"]),
        }
        for _, row in df.iterrows()
    ]

    effective_symbol = (
        request.market_symbol
        if getattr(request, "market_symbol", None)
        else request.symbol
    )

    return {
        "symbol": effective_symbol,
        "data_source": data_source,
        "is_real_market_data": is_real,
        "strategy": s.model_dump(),
        "strategy_fingerprint": hashlib.sha256(
            json.dumps(
                s.model_dump(),
                sort_keys=True,
            ).encode()
        ).hexdigest()[:16],
        "initial_capital": round(capital, 2),
        "final_equity": round(final_equity, 2),
        "net_pnl": total_net,
        "return_pct": round(total_net / capital * 100, 2),
        "trade_count": len(trades),
        "wins": len(wins),
        "losses": len(losses),
        "win_rate_pct": (
            round(len(wins) / len(trades) * 100, 2)
            if trades
            else 0
        ),
        "profit_factor": (
            round(gross_wins / gross_losses, 3)
            if gross_losses
            else (None if gross_wins else 0)
        ),
        "max_drawdown_pct": round(max_drawdown, 2),
        "sharpe_ratio": sharpe_ratio,
        "sortino_ratio": sortino_ratio,
        "max_consecutive_losses": max_consecutive_losses,
        "average_duration_minutes": (
            round(
                float(
                    np.mean(
                        [trade["duration_minutes"] for trade in trades]
                    )
                ),
                2,
            )
            if trades
            else 0
        ),
        "trades": trades,
        "equity_curve": equity_curve,
        "candles": chart_candles,
        "assumptions": [
            "Long-only; one position at a time",
            "Signals are evaluated at candle close; entries use the next candle open",
            "Stop-loss is assumed first if both stop and target are touched in one candle",
            "Gap exits use the candle open when it crosses a stop or target level",
            "Slippage is applied adversely to entry and exit fills",
            "Fees are charged on both entry and exit",
            "Open positions are closed at the final available in-session candle close",
            "Intrabar price ordering is unknown; candle-based fills are approximations",
            "No live orders are sent",
        ],
    }


def run_grid_search(request: GridSearchRequest) -> dict:
    """Run parameter optimization sweeping Fast and Slow EMA values on the same data."""
    # 1. Fetch or prepare candle dataframe once
    if request.csv_data:
        df = load_candles(request.csv_data)
        data_source = "csv"
        is_real = False
    elif request.market_symbol:
        from .market_data import fetch_indian_market_data

        _, df = fetch_indian_market_data(
            request.market_symbol,
            period=request.market_period or "1mo",
            interval=request.market_interval or "15m",
        )
        data_source = f"yfinance:{request.market_symbol}"
        is_real = True
    else:
        df = load_candles(None)
        data_source = "synthetic_demo"
        is_real = False

    csv_cached = df.to_csv(index=False)
    results = []
    base_dict = request.base_strategy.model_dump()

    for fast in request.fast_ema_values:
        for slow in request.slow_ema_values:
            if fast >= slow:
                continue

            strat_dict = dict(base_dict)
            strat_dict["fast_ema"] = fast
            strat_dict["slow_ema"] = slow

            try:
                strat = StrategySpec(**strat_dict)
                bt_req = BacktestRequest(
                    strategy=strat,
                    initial_capital=request.initial_capital,
                    quantity=request.quantity,
                    fee_per_order=request.fee_per_order,
                    slippage_bps=request.slippage_bps,
                    symbol=request.market_symbol or request.symbol,
                    csv_data=csv_cached,
                    market_symbol=request.market_symbol,
                    market_period=request.market_period,
                    market_interval=request.market_interval,
                )
                bt_res = run_backtest(bt_req)

                results.append(
                    {
                        "fast_ema": fast,
                        "slow_ema": slow,
                        "net_pnl": bt_res["net_pnl"],
                        "return_pct": bt_res["return_pct"],
                        "trade_count": bt_res["trade_count"],
                        "win_rate_pct": bt_res["win_rate_pct"],
                        "profit_factor": bt_res["profit_factor"],
                        "max_drawdown_pct": bt_res["max_drawdown_pct"],
                        "sharpe_ratio": bt_res.get("sharpe_ratio"),
                        "sortino_ratio": bt_res.get("sortino_ratio"),
                    }
                )
            except Exception:
                continue

    # Identify best parameter sets
    best_pnl = max(results, key=lambda x: x["net_pnl"], default=None)
    best_sharpe = max(
        results,
        key=lambda x: (x["sharpe_ratio"] if x["sharpe_ratio"] is not None else -999),
        default=None,
    )
    best_winrate = max(results, key=lambda x: x["win_rate_pct"], default=None)

    return {
        "symbol": request.market_symbol or request.symbol,
        "data_source": data_source,
        "is_real_market_data": is_real,
        "total_combinations": len(results),
        "results": results,
        "best_by_pnl": best_pnl,
        "best_by_sharpe": best_sharpe,
        "best_by_win_rate": best_winrate,
    }


def run_portfolio_backtest(request: PortfolioBacktestRequest) -> dict:
    """Run the strategy across multiple watchlist symbols and aggregate overall portfolio performance."""
    from .market_data import fetch_indian_market_data

    symbol_results = []
    all_trades = []
    total_initial_capital = 0.0
    total_final_equity = 0.0

    for sym in request.symbols:
        sym_clean = sym.strip().upper()
        try:
            csv_str, _ = fetch_indian_market_data(
                sym_clean,
                period=request.market_period or "1mo",
                interval=request.market_interval or "15m",
            )
            bt_req = BacktestRequest(
                strategy=request.strategy,
                initial_capital=request.initial_capital_per_symbol,
                quantity=request.quantity,
                fee_per_order=request.fee_per_order,
                slippage_bps=request.slippage_bps,
                symbol=sym_clean,
                csv_data=csv_str,
                market_symbol=sym_clean,
                market_period=request.market_period,
                market_interval=request.market_interval,
            )
            res = run_backtest(bt_req)

            total_initial_capital += res["initial_capital"]
            total_final_equity += res["final_equity"]

            for t in res["trades"]:
                t_copy = dict(t)
                t_copy["symbol"] = sym_clean
                all_trades.append(t_copy)

            symbol_results.append(
                {
                    "symbol": sym_clean,
                    "net_pnl": res["net_pnl"],
                    "return_pct": res["return_pct"],
                    "trade_count": res["trade_count"],
                    "win_rate_pct": res["win_rate_pct"],
                    "profit_factor": res["profit_factor"],
                    "max_drawdown_pct": res["max_drawdown_pct"],
                    "sharpe_ratio": res.get("sharpe_ratio"),
                }
            )
        except Exception as exc:
            symbol_results.append(
                {
                    "symbol": sym_clean,
                    "error": str(exc),
                    "trade_count": 0,
                    "net_pnl": 0.0,
                    "return_pct": 0.0,
                }
            )

    portfolio_net_pnl = round(total_final_equity - total_initial_capital, 2)
    portfolio_return_pct = (
        round((portfolio_net_pnl / total_initial_capital) * 100, 2)
        if total_initial_capital > 0
        else 0.0
    )

    all_wins = [t for t in all_trades if t["net_pnl"] > 0]
    all_losses = [t for t in all_trades if t["net_pnl"] < 0]

    return {
        "portfolio_symbols": request.symbols,
        "total_initial_capital": round(total_initial_capital, 2),
        "total_final_equity": round(total_final_equity, 2),
        "portfolio_net_pnl": portfolio_net_pnl,
        "portfolio_return_pct": portfolio_return_pct,
        "total_trades": len(all_trades),
        "wins": len(all_wins),
        "losses": len(all_losses),
        "win_rate_pct": (
            round((len(all_wins) / len(all_trades)) * 100, 2)
            if all_trades
            else 0.0
        ),
        "symbol_breakdown": symbol_results,
    }
