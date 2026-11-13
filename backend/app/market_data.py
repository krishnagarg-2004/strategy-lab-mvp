import time as _time
from zoneinfo import ZoneInfo
import pandas as pd
import yfinance as yf

IST = ZoneInfo("Asia/Kolkata")

# In-memory market data cache: (symbol, period, interval) -> (cached_at_epoch, csv_str, df)
_DATA_CACHE: dict[tuple[str, str, str], tuple[float, str, pd.DataFrame]] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes cache

POPULAR_INDIAN_SYMBOLS = [
    {"symbol": "^NSEI", "name": "NIFTY 50", "category": "Index"},
    {"symbol": "^NSEBANK", "name": "BANK NIFTY", "category": "Index"},
    {"symbol": "RELIANCE.NS", "name": "Reliance Industries", "category": "Stock"},
    {"symbol": "TCS.NS", "name": "Tata Consultancy Services", "category": "Stock"},
    {"symbol": "HDFCBANK.NS", "name": "HDFC Bank", "category": "Stock"},
    {"symbol": "INFY.NS", "name": "Infosys", "category": "Stock"},
    {"symbol": "TATAMOTORS.NS", "name": "Tata Motors", "category": "Stock"},
    {"symbol": "ICICIBANK.NS", "name": "ICICI Bank", "category": "Stock"},
    {"symbol": "SBIN.NS", "name": "State Bank of India", "category": "Stock"},
    {"symbol": "ITC.NS", "name": "ITC Ltd", "category": "Stock"},
]


def fetch_indian_market_data(
    symbol: str, period: str = "1mo", interval: str = "15m", force_refresh: bool = False
) -> tuple[str, pd.DataFrame]:
    """Fetch OHLCV data using yfinance with in-memory caching and return as CSV string and DataFrame."""
    symbol = symbol.strip().upper()
    cache_key = (symbol, period, interval)
    now = _time.time()

    if not force_refresh and cache_key in _DATA_CACHE:
        cached_time, csv_str, cached_df = _DATA_CACHE[cache_key]
        if now - cached_time < CACHE_TTL_SECONDS:
            return csv_str, cached_df.copy()

    ticker = yf.Ticker(symbol)
    df = ticker.history(period=period, interval=interval)

    if df is None or df.empty:
        raise ValueError(
            f"No market data found for '{symbol}'. Please ensure the symbol is valid on Yahoo Finance (e.g. RELIANCE.NS, ^NSEI)."
        )

    df = df.reset_index()
    time_col = "Datetime" if "Datetime" in df.columns else ("Date" if "Date" in df.columns else df.columns[0])

    col_map = {
        time_col: "timestamp",
        "Open": "open",
        "High": "high",
        "Low": "low",
        "Close": "close",
        "Volume": "volume",
    }
    df = df.rename(columns=col_map)

    for req in ["open", "high", "low", "close", "volume"]:
        if req not in df.columns:
            raise ValueError(f"Market data for '{symbol}' is missing required column '{req}'.")

    df["timestamp"] = pd.to_datetime(df["timestamp"])
    if df["timestamp"].dt.tz is None:
        df["timestamp"] = df["timestamp"].dt.tz_localize(IST)
    else:
        df["timestamp"] = df["timestamp"].dt.tz_convert(IST)

    df = df.sort_values("timestamp").reset_index(drop=True)
    df = df.drop_duplicates(subset=["timestamp"])

    csv_str = df[["timestamp", "open", "high", "low", "close", "volume"]].to_csv(index=False)
    _DATA_CACHE[cache_key] = (now, csv_str, df)
    return csv_str, df.copy()

