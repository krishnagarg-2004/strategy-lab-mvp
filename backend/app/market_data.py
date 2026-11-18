import time as _time
from zoneinfo import ZoneInfo
from typing import Any, Dict, List, Optional
import math
import pandas as pd
import yfinance as yf

IST = ZoneInfo("Asia/Kolkata")

# In-memory market data cache: (symbol, period, interval) -> (cached_at_epoch, csv_str, df)
_DATA_CACHE: dict[tuple[str, str, str], tuple[float, str, pd.DataFrame]] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes cache for historical candles

# In-memory real-time quote cache: symbol -> (cached_at_epoch, quote_dict)
_QUOTE_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
QUOTE_CACHE_TTL_SECONDS = 60  # 60 seconds cache for quotes to prevent API throttling

# Curated Indian Markets directory (Indices and top NSE liquid stocks)
SYMBOL_ALIAS_MAP: dict[str, str] = {
    "NIFTY": "^NSEI",
    "NIFTY 50": "^NSEI",
    "NIFTY50": "^NSEI",
    "^NSEI": "^NSEI",
    "BANKNIFTY": "^NSEBANK",
    "BANK NIFTY": "^NSEBANK",
    "NIFTY BANK": "^NSEBANK",
    "^NSEBANK": "^NSEBANK",
    "NIFTY IT": "^CNXIT",
    "^CNXIT": "^CNXIT",
    "FINNIFTY": "NIFTY_FIN_SERVICE.NS",
}


def normalize_indian_symbol(sym: str) -> str:
    """Normalize common Indian symbols and user inputs to valid Yahoo Finance tickers."""
    sym = sym.strip().upper()
    if sym in SYMBOL_ALIAS_MAP:
        return SYMBOL_ALIAS_MAP[sym]
    if not sym.startswith("^") and not sym.endswith(".NS") and not sym.endswith(".BO"):
        return f"{sym}.NS"
    return sym


POPULAR_INDIAN_SYMBOLS = [
    # --- Major Indices ---
    {"symbol": "^NSEI", "name": "NIFTY 50", "category": "Index", "sector": "Benchmark"},
    {"symbol": "^NSEBANK", "name": "BANK NIFTY", "category": "Index", "sector": "Banking"},
    {"symbol": "^CNXIT", "name": "NIFTY IT", "category": "Index", "sector": "Technology"},
    {"symbol": "^BSESN", "name": "SENSEX", "category": "Index", "sector": "Benchmark"},
    {"symbol": "NIFTY_FIN_SERVICE.NS", "name": "FINNIFTY", "category": "Index", "sector": "Financial Services"},
    {"symbol": "^CNXAUTO", "name": "NIFTY AUTO", "category": "Index", "sector": "Automobile"},
    {"symbol": "^CNXFMCG", "name": "NIFTY FMCG", "category": "Index", "sector": "Consumer Goods"},
    {"symbol": "^CNXPHARMA", "name": "NIFTY PHARMA", "category": "Index", "sector": "Healthcare"},
    {"symbol": "^CNXMETAL", "name": "NIFTY METAL", "category": "Index", "sector": "Metals"},
    {"symbol": "^CNXENERGY", "name": "NIFTY ENERGY", "category": "Index", "sector": "Energy"},

    # --- Banking & Financial Services ---
    {"symbol": "HDFCBANK.NS", "name": "HDFC Bank", "category": "Stock", "sector": "Banking"},
    {"symbol": "ICICIBANK.NS", "name": "ICICI Bank", "category": "Stock", "sector": "Banking"},
    {"symbol": "SBIN.NS", "name": "State Bank of India", "category": "Stock", "sector": "Banking"},
    {"symbol": "KOTAKBANK.NS", "name": "Kotak Mahindra Bank", "category": "Stock", "sector": "Banking"},
    {"symbol": "AXISBANK.NS", "name": "Axis Bank", "category": "Stock", "sector": "Banking"},
    {"symbol": "INDUSINDBK.NS", "name": "IndusInd Bank", "category": "Stock", "sector": "Banking"},
    {"symbol": "BAJFINANCE.NS", "name": "Bajaj Finance", "category": "Stock", "sector": "Financial Services"},
    {"symbol": "BAJAJFINSV.NS", "name": "Bajaj Finserv", "category": "Stock", "sector": "Financial Services"},
    {"symbol": "CHOLAFIN.NS", "name": "Cholamandalam Inv", "category": "Stock", "sector": "Financial Services"},
    {"symbol": "LICI.NS", "name": "Life Insurance Corp (LIC)", "category": "Stock", "sector": "Financial Services"},
    {"symbol": "JIOFIN.NS", "name": "Jio Financial Services", "category": "Stock", "sector": "Financial Services"},
    {"symbol": "CANBK.NS", "name": "Canara Bank", "category": "Stock", "sector": "Banking"},
    {"symbol": "PNB.NS", "name": "Punjab National Bank", "category": "Stock", "sector": "Banking"},

    # --- IT & Technology ---
    {"symbol": "TCS.NS", "name": "Tata Consultancy Services", "category": "Stock", "sector": "Technology"},
    {"symbol": "INFY.NS", "name": "Infosys Ltd", "category": "Stock", "sector": "Technology"},
    {"symbol": "HCLTECH.NS", "name": "HCL Technologies", "category": "Stock", "sector": "Technology"},
    {"symbol": "WIPRO.NS", "name": "Wipro Ltd", "category": "Stock", "sector": "Technology"},
    {"symbol": "TECHM.NS", "name": "Tech Mahindra", "category": "Stock", "sector": "Technology"},
    {"symbol": "LTIM.NS", "name": "LTIMindtree Ltd", "category": "Stock", "sector": "Technology"},
    {"symbol": "PERSISTENT.NS", "name": "Persistent Systems", "category": "Stock", "sector": "Technology"},
    {"symbol": "COFORGE.NS", "name": "Coforge Ltd", "category": "Stock", "sector": "Technology"},

    # --- Energy, Oil & Utilities ---
    {"symbol": "RELIANCE.NS", "name": "Reliance Industries", "category": "Stock", "sector": "Energy"},
    {"symbol": "ONGC.NS", "name": "Oil & Natural Gas Corp", "category": "Stock", "sector": "Energy"},
    {"symbol": "NTPC.NS", "name": "NTPC Ltd", "category": "Stock", "sector": "Energy"},
    {"symbol": "POWERGRID.NS", "name": "Power Grid Corp", "category": "Stock", "sector": "Energy"},
    {"symbol": "BPCL.NS", "name": "Bharat Petroleum", "category": "Stock", "sector": "Energy"},
    {"symbol": "COALINDIA.NS", "name": "Coal India Ltd", "category": "Stock", "sector": "Energy"},
    {"symbol": "IOC.NS", "name": "Indian Oil Corp", "category": "Stock", "sector": "Energy"},
    {"symbol": "GAIL.NS", "name": "GAIL (India) Ltd", "category": "Stock", "sector": "Energy"},
    {"symbol": "TATAPOWER.NS", "name": "Tata Power", "category": "Stock", "sector": "Energy"},
    {"symbol": "ADANIGREEN.NS", "name": "Adani Green Energy", "category": "Stock", "sector": "Energy"},

    # --- Automobile & Components ---
    {"symbol": "TATAMOTORS.NS", "name": "Tata Motors", "category": "Stock", "sector": "Automobile"},
    {"symbol": "MARUTI.NS", "name": "Maruti Suzuki", "category": "Stock", "sector": "Automobile"},
    {"symbol": "M&M.NS", "name": "Mahindra & Mahindra", "category": "Stock", "sector": "Automobile"},
    {"symbol": "BAJAJ-AUTO.NS", "name": "Bajaj Auto", "category": "Stock", "sector": "Automobile"},
    {"symbol": "EICHERMOT.NS", "name": "Eicher Motors", "category": "Stock", "sector": "Automobile"},
    {"symbol": "HEROMOTOCO.NS", "name": "Hero MotoCorp", "category": "Stock", "sector": "Automobile"},
    {"symbol": "TVSMOTOR.NS", "name": "TVS Motor Company", "category": "Stock", "sector": "Automobile"},

    # --- FMCG & Retail ---
    {"symbol": "ITC.NS", "name": "ITC Ltd", "category": "Stock", "sector": "FMCG"},
    {"symbol": "HINDUNILVR.NS", "name": "Hindustan Unilever", "category": "Stock", "sector": "FMCG"},
    {"symbol": "NESTLEIND.NS", "name": "Nestle India", "category": "Stock", "sector": "FMCG"},
    {"symbol": "BRITANNIA.NS", "name": "Britannia Industries", "category": "Stock", "sector": "FMCG"},
    {"symbol": "TATACONSUM.NS", "name": "Tata Consumer Products", "category": "Stock", "sector": "FMCG"},
    {"symbol": "VBL.NS", "name": "Varun Beverages", "category": "Stock", "sector": "FMCG"},
    {"symbol": "DABUR.NS", "name": "Dabur India", "category": "Stock", "sector": "FMCG"},
    {"symbol": "MARICO.NS", "name": "Marico Ltd", "category": "Stock", "sector": "FMCG"},
    {"symbol": "DMART.NS", "name": "Avenue Supermarts (DMart)", "category": "Stock", "sector": "Retail"},
    {"symbol": "TRENT.NS", "name": "Trent Ltd", "category": "Stock", "sector": "Retail"},
    {"symbol": "ZOMATO.NS", "name": "Zomato Ltd", "category": "Stock", "sector": "Consumer Tech"},

    # --- Metals & Mining ---
    {"symbol": "TATASTEEL.NS", "name": "Tata Steel", "category": "Stock", "sector": "Metals"},
    {"symbol": "JSWSTEEL.NS", "name": "JSW Steel", "category": "Stock", "sector": "Metals"},
    {"symbol": "HINDALCO.NS", "name": "Hindalco Industries", "category": "Stock", "sector": "Metals"},
    {"symbol": "VEDL.NS", "name": "Vedanta Ltd", "category": "Stock", "sector": "Metals"},
    {"symbol": "JINDALSTEL.NS", "name": "Jindal Steel & Power", "category": "Stock", "sector": "Metals"},
    {"symbol": "NMDC.NS", "name": "NMDC Ltd", "category": "Stock", "sector": "Metals"},
    {"symbol": "ADANIENT.NS", "name": "Adani Enterprises", "category": "Stock", "sector": "Metals & Mining"},

    # --- Pharmaceuticals & Healthcare ---
    {"symbol": "SUNPHARMA.NS", "name": "Sun Pharmaceutical", "category": "Stock", "sector": "Pharma"},
    {"symbol": "CIPLA.NS", "name": "Cipla Ltd", "category": "Stock", "sector": "Pharma"},
    {"symbol": "DRREDDY.NS", "name": "Dr Reddy's Laboratories", "category": "Stock", "sector": "Pharma"},
    {"symbol": "APOLLOHOSP.NS", "name": "Apollo Hospitals", "category": "Stock", "sector": "Healthcare"},
    {"symbol": "DIVISLAB.NS", "name": "Divi's Laboratories", "category": "Stock", "sector": "Pharma"},
    {"symbol": "LUPIN.NS", "name": "Lupin Ltd", "category": "Stock", "sector": "Pharma"},
    {"symbol": "MANKIND.NS", "name": "Mankind Pharma", "category": "Stock", "sector": "Pharma"},

    # --- Infrastructure, Defense & Construction ---
    {"symbol": "LT.NS", "name": "Larsen & Toubro", "category": "Stock", "sector": "Capital Goods"},
    {"symbol": "BEL.NS", "name": "Bharat Electronics", "category": "Stock", "sector": "Defense"},
    {"symbol": "HAL.NS", "name": "Hindustan Aeronautics", "category": "Stock", "sector": "Defense"},
    {"symbol": "SIEMENS.NS", "name": "Siemens India", "category": "Stock", "sector": "Capital Goods"},
    {"symbol": "ABB.NS", "name": "ABB India", "category": "Stock", "sector": "Capital Goods"},
    {"symbol": "BHEL.NS", "name": "Bharat Heavy Electricals", "category": "Stock", "sector": "Capital Goods"},
    {"symbol": "ULTRACEMCO.NS", "name": "UltraTech Cement", "category": "Stock", "sector": "Cement"},
    {"symbol": "GRASIM.NS", "name": "Grasim Industries", "category": "Stock", "sector": "Cement"},
    {"symbol": "DLF.NS", "name": "DLF Ltd", "category": "Stock", "sector": "Real Estate"},
    {"symbol": "TITAN.NS", "name": "Titan Company", "category": "Stock", "sector": "Consumer Goods"},
    {"symbol": "ADANIPORTS.NS", "name": "Adani Ports & SEZ", "category": "Stock", "sector": "Infrastructure"},
    {"symbol": "BHARTIARTL.NS", "name": "Bharti Airtel", "category": "Stock", "sector": "Telecom"},
]


def search_indian_symbols(query: str = "", category: str = "") -> List[Dict[str, str]]:
    """Search pre-configured and common Indian equities and indices by ticker, name, or sector."""
    q = query.strip().lower()
    cat = category.strip().lower()

    results = []
    for item in POPULAR_INDIAN_SYMBOLS:
        match_query = not q or (q in item["symbol"].lower() or q in item["name"].lower() or q in item.get("sector", "").lower())
        match_cat = not cat or (cat == item["category"].lower() or cat in item.get("sector", "").lower())
        if match_query and match_cat:
            results.append(item)

    # If the user searched for an exact NSE ticker not in directory (e.g. SUZLON)
    if not results and len(q) >= 2:
        clean = q.upper().replace(".NS", "")
        results.append({
            "symbol": f"{clean}.NS",
            "name": f"{clean} (NSE)",
            "category": "Stock",
            "sector": "NSE Equity",
        })

    return results


def fetch_symbol_quote(symbol: str, force_refresh: bool = False) -> Dict[str, Any]:
    """Fetch current/delayed market quote (LTP, Day Change, High, Low, Volume) with caching."""
    symbol = symbol.strip().upper()
    resolved_symbol = normalize_indian_symbol(symbol)
    now = _time.time()

    if not force_refresh and symbol in _QUOTE_CACHE:
        cached_time, cached_quote = _QUOTE_CACHE[symbol]
        if now - cached_time < QUOTE_CACHE_TTL_SECONDS:
            return cached_quote.copy()

    try:
        ticker = yf.Ticker(resolved_symbol)
        fi = ticker.fast_info

        last_price = getattr(fi, "last_price", None)
        prev_close = getattr(fi, "previous_close", None)
        day_high = getattr(fi, "day_high", None)
        day_low = getattr(fi, "day_low", None)
        open_price = getattr(fi, "open", None)
        volume = getattr(fi, "last_volume", 0) or 0
        year_high = getattr(fi, "year_high", None)
        year_low = getattr(fi, "year_low", None)

        # Fallback to history if fast_info missing prices
        if last_price is None or math.isnan(last_price):
            hist = ticker.history(period="2d", interval="1d")
            if not hist.empty:
                last_price = float(hist["Close"].iloc[-1])
                prev_close = float(hist["Close"].iloc[-2]) if len(hist) > 1 else last_price
                day_high = float(hist["High"].iloc[-1])
                day_low = float(hist["Low"].iloc[-1])
                open_price = float(hist["Open"].iloc[-1])
                volume = int(hist["Volume"].iloc[-1])

        if last_price is None or math.isnan(last_price):
            raise ValueError(f"Could not retrieve live price for {symbol}")

        last_price = round(float(last_price), 2)
        prev_close = round(float(prev_close), 2) if prev_close else last_price
        change = round(last_price - prev_close, 2)
        change_pct = round((change / prev_close) * 100, 2) if prev_close > 0 else 0.0

        quote = {
            "symbol": symbol,
            "last_price": last_price,
            "previous_close": prev_close,
            "change": change,
            "change_pct": change_pct,
            "day_high": round(float(day_high), 2) if day_high else last_price,
            "day_low": round(float(day_low), 2) if day_low else last_price,
            "open": round(float(open_price), 2) if open_price else last_price,
            "volume": int(volume) if volume else 0,
            "year_high": round(float(year_high), 2) if year_high and not math.isnan(year_high) else None,
            "year_low": round(float(year_low), 2) if year_low and not math.isnan(year_low) else None,
            "currency": "INR",
            "last_updated": _time.strftime("%Y-%m-%d %H:%M:%S IST", _time.localtime(now)),
        }

        _QUOTE_CACHE[symbol] = (now, quote)
        return quote.copy()
    except Exception as exc:
        # Return fallback record rather than crashing entire batch
        return {
            "symbol": symbol,
            "last_price": None,
            "previous_close": None,
            "change": 0.0,
            "change_pct": 0.0,
            "day_high": None,
            "day_low": None,
            "open": None,
            "volume": 0,
            "error": str(exc),
            "currency": "INR",
            "last_updated": _time.strftime("%Y-%m-%d %H:%M:%S IST", _time.localtime(now)),
        }


def fetch_quotes_batch(symbols: List[str]) -> List[Dict[str, Any]]:
    """Fetch quotes for a list of symbols in batch."""
    return [fetch_symbol_quote(sym) for sym in symbols]


def fetch_indian_market_data(
    symbol: str, period: str = "1mo", interval: str = "15m", force_refresh: bool = False
) -> tuple[str, pd.DataFrame]:
    """Fetch OHLCV data using yfinance with in-memory caching and return as CSV string and DataFrame."""
    symbol = symbol.strip().upper()
    resolved_symbol = normalize_indian_symbol(symbol)
    cache_key = (resolved_symbol, period, interval)
    now = _time.time()

    if not force_refresh and cache_key in _DATA_CACHE:
        cached_time, csv_str, cached_df = _DATA_CACHE[cache_key]
        if now - cached_time < CACHE_TTL_SECONDS:
            return csv_str, cached_df.copy()

    ticker = yf.Ticker(resolved_symbol)
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
