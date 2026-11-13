# Strategy Lab — Indian Markets MVP

A local-first prototype for deterministic historical backtesting with virtual capital. It uses synthetic sample candles by default; sample results are **not real market performance**. No broker orders are sent.

## Features
- FastAPI backend and React + TypeScript frontend.
- **Bi-directional trading**: Long Only, Short Only, and Both (Long & Short) execution modes.
- **Trailing Stop-Loss**: Dynamically trails peak favorable price by a configurable percentage.
- **Intraday VWAP indicator & filter**: Daily session reset at 09:15 IST (Long > VWAP, Short < VWAP).
- **Supertrend indicator & filter**: ATR-based trend identification (configurable period & multiplier).
- **Advanced Risk Metrics**: Annualized Sharpe Ratio, Sortino Ratio (downside deviation), and Max Consecutive Losses streak.
- **Fast Parameter Optimization & Grid Search**: Sweeps Fast EMA × Slow EMA matrix with in-memory data caching, identifying optimal parameter clusters by Sharpe Ratio or Net P&L.
- **Interactive Heatmap Matrix**: 2D clickable grid color-coding parameter performance; one-click load into single-run view.
- **Multi-Stock Portfolio Watchlist**: Simultaneous batch backtesting across multiple Indian equities and indices with consolidated portfolio P&L.
- **Live Indian market data fetching** (Yahoo Finance) for NIFTY 50, BANK NIFTY, and large-cap NSE/BSE stocks.
- **Interactive Candlestick Chart** with visual TradingView-style BUY, SHORT, and EXIT signal markers.
- **Database persistence** (PostgreSQL / SQLite auto-fallback) to save, compare, and reload historical backtests.
- Virtual cash and integer-share position sizing with complete margin and P&L accounting reconciliation.
- Trade ledger with SIDE indicator, win rate, net P&L, profit factor, max drawdown, and equity curve.
- Strategy spec is validated and echoed back; AI suggestions cannot change execution rules.
- CSV upload is supported for custom OHLCV data.

## Requirements
- Docker Desktop with Docker Compose, or Python 3.11+ and Node.js 20+.

## Run with Docker
```bash
docker compose up --build
```
Open http://localhost:5173. API docs: http://localhost:8000/docs. PostgreSQL runs on localhost:5432 (or localhost:5433 depending on port config). Runs are automatically saved and persisted to the database.

## Run without Docker
Backend:
```bash
cd backend
python -m venv .venv
# Windows PowerShell: .venv\\Scripts\\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Frontend in another terminal:
```bash
cd frontend
npm install
npm run dev
```
Vite proxies `/api` to `http://localhost:8000`.

## API quick start
`POST /api/backtest` accepts JSON:
```json
{
  "strategy": {
    "name": "EMA crossover + RSI",
    "fast_ema": 9,
    "slow_ema": 21,
    "rsi_period": 14,
    "rsi_min": 55,
    "use_rsi_filter": true,
    "stop_loss_pct": 0.5,
    "take_profit_pct": 1.0,
    "trading_start": "09:30",
    "trading_end": "14:30"
  },
  "initial_capital": 100000,
  "quantity": 1,
  "fee_per_order": 20,
  "slippage_bps": 2,
  "symbol": "DEMO"
}
```
Optional `csv_data` may be included as a CSV string with `timestamp,open,high,low,close,volume` columns. Otherwise synthetic demo candles are used. All timestamps should be ISO 8601; naïve timestamps are interpreted as Asia/Kolkata local time.

## Execution assumptions and limitations
- Signal is evaluated using completed candle data; entry is simulated at the next candle's open to reduce look-ahead bias.
- Stops/targets are checked using candle high/low. If both stop and target are hit in one candle, the stop is assumed to hit first (conservative assumption).
- Fees are charged per order; slippage is a configurable basis-point adjustment.
- Long-only, one open position at a time, integer quantity. This is a learning MVP, not a production execution simulator.
- Intraday session constraints use India time. No real orders are placed and no live feed is connected.

## Tests
```bash
cd backend
pip install -r requirements.txt
pytest -q
```

## Market-data provider recommendation
Start with synthetic CSV fixtures while developing. For a personal Indian-market prototype, compare broker APIs before paying:
- Zerodha Kite Connect documents historical candles and real-time WebSocket data; its official support page currently lists the Connect plan at ₹500/month per API key, with Personal free tier excluding market data. Check current terms before subscribing: https://support.zerodha.com/category/trading-and-markets/general-kite/kite-api/articles/what-are-the-charges-for-kite-apis
- DhanHQ documents live WebSocket feeds and historical data; its support page currently lists Data APIs at ₹499 + applicable taxes/month. Verify instrument coverage, expired derivatives history, retention, and redistribution rights before choosing it: https://dhan.co/support/platforms/dhanhq-api/how-to-access-dhan-api/
- Upstox provides market-stream and historical/intraday endpoints; check current access limits and entitlements: https://upstox.com/developer/api-documentation/

For a public commercial product, data licensing and redistribution rights are separate from simply having an API subscription. Review exchange/provider terms and applicable Indian regulations before offering data to other users.
