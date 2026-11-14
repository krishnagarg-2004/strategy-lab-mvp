# Strategy Lab — Quantitative Research & Backtesting Workspace for Indian Markets

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/krishnagarg-2004/strategy-lab-mvp)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%2019%20%7C%20TypeScript-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![Docker](https://img.shields.io/badge/Container-Docker%20Compose-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com)
[![PostgreSQL](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-336791.svg?logo=postgresql&logoColor=white)](https://supabase.com)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB.svg?logo=python&logoColor=white)](https://www.python.org)

**Strategy Lab** is a professional-grade, quantitative algorithmic trading research terminal and deterministic backtesting laboratory engineered specifically for Indian equities and indices (NSE / BSE).

It equips quantitative analysts, systematic retail traders, and financial engineers with institutional-grade strategy evaluation: zero look-ahead bias next-bar execution, multi-indicator filtering (EMA, VWAP, Supertrend, RSI), real Indian statutory charges modeling (STT, GST, Stamp Duty, SEBI turnover fees), parameter optimization heatmaps, multi-stock portfolio testing, Monte Carlo sequence risk stress testing, Walk-Forward out-of-sample validation, and live forward paper trading with Discord/Telegram alert webhooks.

---

## 📑 Table of Contents

1. [🌐 Live Cloud Access (Render)](#-live-cloud-access-render)
2. [🎯 Target Audience](#-target-audience)
3. [🔄 Architecture & Data Flow Diagram](#-architecture--data-flow-diagram)
   * [Visual Pipeline Flowchart](#visual-pipeline-flowchart)
   * [Mermaid Architecture Diagram](#mermaid-architecture-diagram)
4. [⚡ Key Features](#-key-features)
5. [🎨 Human-Engineered Institutional Design System](#-human-engineered-institutional-design-system)
6. [📂 Project Directory Structure](#-project-directory-structure)
7. [🚀 Quick Start Guide](#-quick-start-guide)
   * [Option 1: Run with Docker Compose](#option-1-run-with-docker-compose-recommended)
   * [Option 2: Run Locally (Without Docker)](#option-2-run-locally-without-docker)
8. [⚙️ Environment Variables Configuration](#️-environment-variables-configuration)
9. [📖 How to Use Strategy Lab](#-how-to-use-strategy-lab)
10. [📐 Quantitative Methodology & Risk Metrics](#-quantitative-methodology--risk-metrics)
11. [🛠️ API Reference](#️-api-reference)
12. [📊 CSV Upload Specification](#-csv-upload-specification)
13. [❓ Troubleshooting & FAQ](#-troubleshooting--faq)
14. [🗺️ Roadmap & Future Enhancements](#️-roadmap--future-enhancements)
15. [🧪 Testing](#-testing)
16. [⚠️ Important Assumptions & Disclaimers](#️-important-assumptions--disclaimers)
17. [📄 License](#-license)

---

## 🌐 Live Cloud Access (Render)

Strategy Lab is configured and deployed live on Render with connected Supabase cloud PostgreSQL.

| Service | Component | Access Link | Description |
| :--- | :--- | :--- | :--- |
| **Frontend Web App** | React + Vite UI | [https://strategy-lab-frontend.onrender.com](https://strategy-lab-frontend.onrender.com) | Institutional trading terminal with TradingView charts, custom toggle switches, and soft-slate light / dark obsidian modes |
| **Backend API** | FastAPI Service | [https://strategy-lab-backend-dj9l.onrender.com](https://strategy-lab-backend-dj9l.onrender.com) | Deterministic event-driven simulation engine, mathematical risk analytics, and REST API |
| **API Documentation** | OpenAPI / Swagger | [https://strategy-lab-backend-dj9l.onrender.com/docs](https://strategy-lab-backend-dj9l.onrender.com/docs) | Interactive API exploration and JSON payload schema documentation |
| **Database** | Managed PostgreSQL | Supabase Cloud Pooler (`aws-1-ap-northeast-1.pooler.supabase.com:6543`) | High-concurrency persistent store for backtest experiments with local SQLite fallback |

> **1-Click Cloud Deployment**: You can deploy your own private instance on Render in under 3 minutes by clicking the **Deploy to Render** button above or visiting [https://render.com/deploy?repo=https://github.com/krishnagarg-2004/strategy-lab-mvp](https://render.com/deploy?repo=https://github.com/krishnagarg-2004/strategy-lab-mvp).

---

## 🎯 Target Audience

1. **Systematic & Quantitative Traders**:
   * Algorithmic traders designing rule-based intraday or swing strategies who need to verify edge before committing real capital.
   * Traders who need bi-directional backtesting (Long, Short, or Both) with dynamic Trailing Stops.
2. **Indian Equities & Derivatives Market Participants**:
   * Traders trading NIFTY 50, BANK NIFTY, FINNIFTY, and large-cap NSE/BSE equities who require accurate Indian statutory transaction costs (STT, GST, Stamp Duty, and exchange turnover charges) factored into net P&L.
3. **Risk Managers & Researchers**:
   * Analysts looking to quantify catastrophic tail risks, sequence risk, and maximum drawdown probability through 1,000+ path Monte Carlo bootstrap resampling.
   * Researchers seeking to detect curve-fitting through Walk-Forward (Train/Test Out-of-Sample) efficiency validation.
4. **Trading System Developers**:
   * Developers prototyping signal engines, webhook alert dispatchers (Discord/Telegram), and quantitative analytics backends.

---

## 🔄 Architecture & Data Flow Diagram

The diagram below illustrates the end-to-end architecture and execution pipeline across both visual ASCII and interactive Mermaid formats:

### Visual Pipeline Flowchart

```text
+-----------------------------------------------------------------------------------------+
|                              1. MARKET DATA INGESTION                                   |
|   [ Yahoo Finance API (NSE/BSE) ]   [ Custom CSV (6-col OHLCV) ]   [ Synthetic Demo ]   |
+-----------------------------------------------------------------------------------------+
                                             │
                                             ▼
+-----------------------------------------------------------------------------------------+
|                     2. QUANTITATIVE SIMULATION ENGINE (FastAPI)                         |
|   • Candle Normalization & IST Timezone Validation (Asia/Kolkata)                       |
|   • Technical Indicators: Fast/Slow EMA, RSI Momentum, Intraday VWAP, Supertrend       |
|   • Execution Simulator: Zero Look-Ahead Next-Bar Open Fill, Trailing Stop, Slippage   |
+-----------------------------------------------------------------------------------------+
                                             │
                                             ▼
+-----------------------------------------------------------------------------------------+
|                     3. ACCOUNTING & INDIAN STATUTORY CHARGES                            |
|   • STT (0.025% on Intraday Sell)  • GST (18%)  • Stamp Duty & SEBI/Exchange Levies     |
|   • Flat Brokerage per Order Leg   • Mark-to-Market Equity Ledger & Drawdown Tracking   |
+-----------------------------------------------------------------------------------------+
                                             │
                                             ▼
+-----------------------------------------------------------------------------------------+
|                         4. ADVANCED ROBUSTNESS ENGINES                                  |
|   [ Grid Search Optimizer ]  [ Portfolio Watchlist ]  [ Monte Carlo Bootstrap (1000+) ] |
|   [ Walk-Forward OOS Test ]  [ Live Paper Trading ]   [ Discord / Telegram Alert Hub ]  |
+-----------------------------------------------------------------------------------------+
                                     │                 │
                    ┌────────────────┘                 └────────────────┐
                    │                                                   │
                    ▼                                                   ▼
+------------------------------------+               +------------------------------------+
|         5. STORAGE LAYER           | ◄───────────► |    6. INSTITUTIONAL WORKSPACE      |
|   Supabase PostgreSQL / SQLite     |               |   React 19 + TypeScript + Inter    |
|   • Persist & Restore Experiments  |               |   • TradingView Lightweight-Charts |
|   • Historical Comparison & Audit  |               |   • Recharts Equity & Fan Charts   |
+------------------------------------+               +------------------------------------+
```

### Mermaid Architecture Diagram

```mermaid
flowchart TD
    subgraph DataIngestion["1. Market Data Ingestion"]
        YF["Yahoo Finance API<br/>(Live NSE / BSE Tickers)"]
        CSV["Custom CSV Upload<br/>(6-Column OHLCV)"]
        SYN["Synthetic IST Engine<br/>(5-min Demo Candles)"]
    end

    subgraph CoreEngine["2. Quantitative Simulation Engine (FastAPI)"]
        NORM["Candle Normalization & Validation<br/>(Asia/Kolkata IST Timezone)"]
        IND["Technical Indicator Engine<br/>• Fast/Slow EMA<br/>• RSI Momentum Filter<br/>• Intraday Session VWAP (09:15 Reset)<br/>• Supertrend (ATR Bands)"]
        EXEC["Execution & Fill Simulator<br/>• Zero Look-Ahead Next-Bar Open Fill<br/>• Conservative High/Low Stop Check<br/>• Trailing Stop-Loss Ratchet<br/>• Slippage & Basis Point Model"]
    end

    subgraph Accounting["3. Accounting & Indian Statutory Charges"]
        TAX["Statutory Charges Calculator<br/>• STT (0.025% on Intraday Sell)<br/>• GST (18% on Brokerage & Charges)<br/>• Stamp Duty & SEBI Turnover Fees<br/>• Flat Brokerage per Order Leg"]
        LEDGER["Ledger & Equity Curve Reconciliation<br/>(Cash + Realized Mark-to-Market)"]
    end

    subgraph AdvancedAnalytics["4. Advanced Robustness Engines"]
        GRID["Grid Search Optimizer<br/>(EMA Matrix × Sharpe/PnL Heatmap)"]
        PORT["Portfolio Watchlist Runner<br/>(Multi-Stock Simultaneous Batch Test)"]
        MC["Monte Carlo Engine<br/>(1000+ Bootstrap Sequences & Fan Charts)"]
        WF["Walk-Forward Out-of-Sample<br/>(Train/Test In-Sample vs OOS Ratio)"]
        PAPER["Live Paper Trading Hub<br/>(Real-Time Ticks & Webhook Dispatcher)"]
    end

    subgraph Persistence["5. Storage Layer"]
        DB[("Supabase PostgreSQL / SQLite<br/>Saved Experiments Database")]
    end

    subgraph Presentation["6. Institutional Trading Terminal (React 19 + TS)"]
        UI["High-Density Trading Terminal<br/>• Calibrated Soft-Slate Light / Dark Obsidian<br/>• Right-Pinned iOS/Linear Toggle Switches<br/>• TradingView Candlestick & Marker Chart<br/>• Performance Metrics & Interactive Tables"]
        WEBHOOK["External Alerts<br/>(Discord / Telegram Channels)"]
    end

    DataIngestion --> NORM
    NORM --> IND
    IND --> EXEC
    EXEC --> TAX
    TAX --> LEDGER
    LEDGER --> AdvancedAnalytics
    AdvancedAnalytics --> DB
    AdvancedAnalytics --> UI
    PAPER --> WEBHOOK
    DB <--> UI
```

---

## ⚡ Key Features

### 1. Robust Indicator & Signal Suite
* **Dual Exponential Moving Average (EMA)**: Configurable Fast and Slow EMA crossover trigger with mathematical precision.
* **Intraday VWAP (Volume-Weighted Average Price)**: Automatically resets every morning at 09:15 IST. Enforces Long above VWAP and Short below VWAP to maintain institutional trend alignment.
* **Supertrend Filter**: Volatility-based trend direction filter utilizing Average True Range (ATR) with custom periods and multipliers.
* **RSI Momentum Filter**: Relative Strength Index threshold gate to filter out low-momentum false breakouts.

### 2. Execution Realism & Risk Safeguards
* **Bi-Directional Trading**: Execute Long Only, Short Only, or Both directions seamlessly.
* **Dynamic Trailing Stop-Loss**: Dynamically trails peak favorable market prices by a configurable percentage, locking in gains during sustained trends.
* **Fixed Stop Loss & Take Profit**: Strict percentage-based exits evaluated on intraday high and low bars.
* **Zero Look-Ahead Bias**: Signals are evaluated only after candle close; execution is modeled strictly at the subsequent candle's open price.
* **Conservative Intrabar Resolution**: If both stop-loss and take-profit thresholds are breached within the same candle, the engine assumes the stop-loss was hit first.
* **Execution Slippage**: Configurable basis-point slippage adjustment subtracted from trade execution prices.

### 3. Indian Statutory Charges & Tax Engine
Unlike generic backtesters, Strategy Lab accurately calculates and deducts actual Indian trading expenses:
* **Securities Transaction Tax (STT)**: 0.025% on intraday equity sell turnover.
* **Brokerage**: Configurable flat brokerage per executed leg (e.g., ₹20 for Zerodha, Groww, AngelOne).
* **Goods and Services Tax (GST)**: 18% applied to brokerage and exchange transaction turnover fees.
* **Exchange Turnover Charges & SEBI Charges**: Regulatory transaction fees accurately deducted per crore of turnover.
* **Stamp Duty**: State-level stamp charges deducted on buy orders.

### 4. Advanced Quantitative Workspaces
* **Parameter Grid Search & 2D Heatmap**:
  * Sweeps Fast EMA $\times$ Slow EMA parameter spaces with in-memory candle caching.
  * Interactive 2D color-coded matrix highlighting parameter stability clusters by Sharpe Ratio or Net P&L.
  * One-click loading of any grid parameter cell back into the single-run workspace.
* **Multi-Stock Portfolio Watchlist**:
  * Execute your strategy simultaneously across multiple Indian blue chips (RELIANCE, TCS, INFY, HDFCBANK, ICICIBANK, SBIN, etc.) and indices (NIFTY 50, BANK NIFTY).
  * Consolidates total equity curves, aggregate drawdowns, and portfolio-wide win rates.
* **Monte Carlo Sequence Risk Analysis**:
  * Reshuffles trade returns across 1,000 to 5,000 bootstrap simulations.
  * Calculates Risk of Ruin probability, maximum drawdown confidence intervals (95th, 75th, 50th median, 25th, and 5th percentiles), and interactive equity fan charts.
* **Walk-Forward (Out-of-Sample) Validation**:
  * Chronologically segments data into In-Sample (Train) and Out-of-Sample (Test) intervals (e.g., 70% / 30%).
  * Compares In-Sample vs. Out-of-Sample Sharpe, Annualized Return, and Win Rate to calculate Walk-Forward Efficiency (WFE %) and flag curve-fitting.
* **Live Paper Trading Simulation & Webhook Hub**:
  * Forward simulate trade signals in real-time without risking real funds.
  * Trigger real-time evaluation ticks and dispatch instant formatted trade notifications to **Discord** and **Telegram** webhooks.
* **Saved Experiments Database**:
  * Persist backtest runs in Supabase PostgreSQL (or SQLite local fallback).
  * Review, restore, compare, and delete historical configurations and performance reports.

---

## 🎨 Human-Engineered Institutional Design System

Strategy Lab was redesigned from scratch to eliminate generic AI-template cliches and deliver a calm, high-density financial workstation:

* **Calibrated Soft-Slate Light Mode**: Replaced blinding pure-white screens with a soothing neutral canvas (`#f0f2f5`), crisp solid `#ffffff` cards, distinct 1px dividers (`#cbd5e1`), and rich high-contrast Slate-900 typography (`#0f172a`).
* **Dark Obsidian Mode**: Matte obsidian backdrop (`#090d16`) with solid surfaces (`#0f1523`), clean 1px borders, and restrained emerald/ruby accents (zero radioactive neon glows).
* **Right-Pinned iOS/Linear Toggle Switches**: Setting cards feature modern hardware-accelerated switch toggles pinned permanently to the far-right edge with fluid state animations.
* **Financial Typography**: Strict pairing of **Inter** (headings, labels, and metrics with tabular numbers `tnum`) and **DM Mono** (prices, quantities, timestamps, and parameters).
* **Purposeful Status Strip**: Replaced marketing slogans and decorative CSS bars with a functional workspace summary strip displaying active instrument, timeframe, starting capital, and engine execution mode.
* **Zero Cartoon Navigation Emojis**: Clean, professional segmented controls and dedicated stock chips (`.chip-btn`).

---

## 📂 Project Directory Structure

```text
strategy-lab-mvp/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── db.py                 # SQLAlchemy engine & PostgreSQL/SQLite auto-fallback
│   │   ├── engine.py             # Backtest core, Grid Search, Monte Carlo & Walk-Forward
│   │   ├── main.py               # FastAPI routers, lifespan setup, and REST controllers
│   │   ├── market_data.py        # Yahoo Finance loader & NSE/BSE popular symbols
│   │   ├── models.py             # PostgreSQL experiment database schema
│   │   ├── paper_trading.py      # Live forward paper trading session & alert webhooks
│   │   ├── schemas.py            # Pydantic v2 request/response validation contracts
│   │   └── taxes.py              # Indian statutory charges calculator (STT, GST, SEBI)
│   ├── tests/                    # Pytest backend test suite (30/30 passing)
│   ├── Dockerfile                # Production backend container build
│   └── requirements.txt          # Python dependencies (FastAPI, Pandas, NumPy, etc.)
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Main research workspace & 6 quantitative modules
│   │   ├── CandlestickChart.tsx  # TradingView Lightweight-Charts with theme adaptation
│   │   ├── main.tsx              # React DOM initialization
│   │   ├── styles.css            # Bespoke institutional design system
│   │   └── vite-env.d.ts         # TypeScript environment declarations
│   ├── dist/                     # Optimized production bundle assets
│   ├── Dockerfile                # Production multi-stage build (serve -s dist -l 5173)
│   ├── package.json              # Frontend dependencies (React 19, Recharts, Vite)
│   └── vite.config.ts            # Vite build & proxy settings
├── docker-compose.yml            # Multi-container orchestration (DB, API, Web)
├── render.yaml                   # 1-Click Render Cloud Blueprint configuration
└── README.md                     # Comprehensive project documentation
```

---

## 🚀 Quick Start Guide

### Option 1: Run with Docker Compose (Recommended)

Make sure [Docker Desktop](https://www.docker.com/products/docker-desktop/) is installed and running.

```bash
# 1. Clone the repository
git clone https://github.com/krishnagarg-2004/strategy-lab-mvp.git
cd strategy-lab-mvp

# 2. Build and run containers (Frontend, Backend, and PostgreSQL)
docker compose up --build
```

Access the services:
* **Frontend UI**: [http://localhost:5173](http://localhost:5173)
* **Backend API Docs**: [http://localhost:8001/docs](http://localhost:8001/docs)
* **PostgreSQL Database**: `localhost:5433` (maps internally to `5432`)

To stop the containers:
```bash
docker compose down
```

---

### Option 2: Run Locally (Without Docker)

#### Prerequisites
* **Python 3.11+**
* **Node.js 20+** and `npm`

#### 1. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv .venv

# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server
uvicorn app.main:app --reload --port 8000
```
The backend will run on `http://localhost:8000` (auto-falling back to SQLite if PostgreSQL is not active).

#### 2. Frontend Setup
In a separate terminal:
```bash
cd frontend

# Install npm packages
npm install

# Start Vite development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## ⚙️ Environment Variables Configuration

| Variable | Scope | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Backend | `sqlite:///./strategy_lab.db` | PostgreSQL connection string (`postgresql://user:pass@host:5432/dbname`). Automatically falls back to local SQLite if unset or unreachable. |
| `PYTHONUNBUFFERED` | Backend | `1` | Forces Python stdout/stderr streams to be unbuffered for real-time Docker logging. |
| `VITE_BACKEND_URL` | Frontend | `''` (auto-detects Render backend URL in cloud) | Explicit backend API URL for cross-origin production hosting. |
| `PORT` | Cloud / Render | `8000` / `5173` | Port assigned dynamically by Render or local container runner. |

---

## 📖 How to Use Strategy Lab

### 1. Single Run Backtest
1. Open the **Single Run** tab.
2. Select your **Trade Direction** (`Long Only`, `Short Only`, or `Both`).
3. Choose a **Data Source**:
   * **Indian Mkts**: Pick from major NSE/BSE tickers (NIFTY 50, BANKNIFTY, RELIANCE, TCS, etc.) and click **Fetch & Load Candles**.
   * **Upload CSV**: Upload your own 6-column OHLCV dataset.
   * **Demo Data**: Test instantly with synthetic candles.
4. Configure **Technical Indicators** (Fast/Slow EMA, RSI filter, Intraday VWAP, Supertrend).
5. Set **Risk Management & Taxes** (Stop Loss %, Take Profit %, Trailing Stop-Loss %, Indian STT & GST toggle, Brokerage per leg).
6. Click **Run Backtest**.
7. Analyze the **Performance Report**:
   * Net P&L, Win Rate %, Profit Factor, Max Drawdown %, Sharpe Ratio, Sortino Ratio, and Max Consecutive Losses.
   * Switch between the **TradingView Candlestick Chart** (with BUY/EXIT signal markers) and the **Cumulative Equity Curve**.
   * Review the trade ledger table with duration, exit reason, and net P&L.
8. Click **Save Run to Database** to preserve the experiment or **Export trades CSV** to download the ledger.

### 2. Parameter Optimization (Grid Search)
1. Switch to the **Grid Search** tab.
2. Enter the parameter ranges (e.g., Fast EMAs: `5, 9, 13, 21` and Slow EMAs: `21, 34, 55, 89`).
3. Click **Run Grid Search**.
4. Inspect the interactive 2D Heatmap. Green cells represent profitable/high-Sharpe regions, while red cells indicate drawdown areas.
5. Click any cell to inspect its exact metrics or automatically load those parameters into the Single Run tab.

### 3. Multi-Stock Portfolio Batch Test
1. Switch to the **Portfolio Watchlist** tab.
2. Toggle on the instruments you want in your portfolio basket (e.g., RELIANCE, HDFCBANK, INFY, TCS).
3. Click **Run Portfolio Test**.
4. View the consolidated portfolio return, total trades, average win rate, and cross-asset performance comparison table.

### 4. Monte Carlo Sequence Stress Test
1. Switch to the **Monte Carlo** tab.
2. Enter the number of simulation iterations (e.g., `1000` to `5000`).
3. Click **Run Monte Carlo**.
4. Review the **Risk of Ruin %**, 95th percentile worst-case drawdown, and the multi-path percentile fan chart to evaluate sequence-of-returns vulnerability.

### 5. Walk-Forward Out-of-Sample Validation
1. Switch to the **Walk-Forward (OOS)** tab.
2. Choose your In-Sample Train % (default: `70%`).
3. Click **Run Walk-Forward Split**.
4. Compare In-Sample vs Out-of-Sample Sharpe, Net P&L, and Win Rate. Inspect the Walk-Forward Efficiency (WFE %) score to detect if a strategy is overfitted.

### 6. Live Paper Trading & Real-Time Alerts
1. Switch to the **Live Paper Trading** tab.
2. Optional: Paste your **Discord** or **Telegram** webhook URL and toggle **Enable Live Webhook Alerts** (test via **Send Test Ping**).
3. Click **Start Live Paper Session**.
4. Click **Trigger Live Tick** to forward-simulate incoming market quotes, update trailing stops in real-time, and broadcast signal alerts.
5. Click **Stop Session** when completed.

---

## 📐 Quantitative Methodology & Risk Metrics

Strategy Lab computes quantitative risk statistics formulated specifically for trading system evaluation:

### 1. Annualized Sharpe Ratio
Measures risk-adjusted excess return per unit of total portfolio volatility.
$$\text{Sharpe Ratio} = \frac{\bar{R}_p - R_f}{\sigma_p} \times \sqrt{252}$$
* $\bar{R}_p$: Mean trade return.
* $R_f$: Benchmark Indian risk-free rate (defaults to 6.5% RBI repo rate).
* $\sigma_p$: Sample standard deviation of returns.

### 2. Annualized Sortino Ratio
Measures risk-adjusted return penalizing **only downside volatility** (losses), ignoring upside volatility.
$$\text{Sortino Ratio} = \frac{\bar{R}_p - R_f}{\sigma_{\text{downside}}} \times \sqrt{252}$$
$$\sigma_{\text{downside}} = \sqrt{\frac{1}{N} \sum_{i=1}^{N} \min(0, R_i - \text{MAR})^2}$$

### 3. Profit Factor
Ratio of gross profits to gross absolute losses.
$$\text{Profit Factor} = \frac{\sum \text{Profits}}{\sum |\text{Losses}|}$$

### 4. Maximum Drawdown (MDD)
The maximum observed peak-to-trough decline of the portfolio equity curve:
$$\text{MDD} = \max_{t} \left( \frac{\text{Peak}_t - \text{Equity}_t}{\text{Peak}_t} \right) \times 100\%$$

### 5. Walk-Forward Efficiency (WFE %)
Evaluates whether in-sample optimization holds up out-of-sample:
$$\text{WFE} = \left( \frac{\text{Annualized Return}_{\text{Out-of-Sample}}}{\text{Annualized Return}_{\text{In-Sample}}} \right) \times 100\%$$
* $\text{WFE} \ge 60\%$: Strategy demonstrates robust predictive edge.
* $\text{WFE} < 40\%$: Strategy exhibits severe parameter over-optimization (curve-fitting).

---

## 🛠️ API Reference

FastAPI automatically generates interactive documentation at `/docs` (Swagger UI) and `/redoc`.

### Key Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/backtest` | Executes a deterministic single strategy backtest |
| `POST` | `/api/market-data/fetch` | Fetches historical intraday/daily OHLCV candles from Yahoo Finance |
| `POST` | `/api/grid-search` | Performs multi-parameter grid sweep with in-memory caching |
| `POST` | `/api/portfolio-backtest` | Runs batch backtesting across a watchlist of multiple symbols |
| `POST` | `/api/monte-carlo` | Performs bootstrap resampled Monte Carlo sequence simulation |
| `POST` | `/api/walk-forward` | Performs chronological In-Sample vs Out-of-Sample Walk-Forward validation |
| `POST` | `/api/paper-trading/start` | Initializes a live simulated paper trading session |
| `POST` | `/api/paper-trading/tick` | Evaluates a simulated tick against strategy rules and trailing stops |
| `POST` | `/api/paper-trading/stop` | Terminates an active paper trading session |
| `POST` | `/api/paper-trading/webhook-test` | Sends a formatted test alert to Discord or Telegram webhooks |
| `GET` | `/api/experiments` | Lists all saved backtest experiments from the database |
| `POST` | `/api/experiments` | Saves a backtest result to the database |
| `GET` | `/api/experiments/{id}` | Loads full experiment details and chart candles by ID |
| `DELETE` | `/api/experiments/{id}` | Deletes an experiment from the database |

#### Sample Single Backtest Payload (`POST /api/backtest`)
```json
{
  "strategy": {
    "name": "Intraday EMA + Supertrend + VWAP",
    "fast_ema": 9,
    "slow_ema": 21,
    "trade_direction": "BOTH",
    "use_rsi_filter": true,
    "rsi_period": 14,
    "rsi_min": 50,
    "use_vwap_filter": true,
    "use_supertrend_filter": true,
    "supertrend_period": 10,
    "supertrend_multiplier": 3.0,
    "stop_loss_pct": 0.5,
    "take_profit_pct": 1.5,
    "use_trailing_stop": true,
    "trailing_stop_pct": 0.4,
    "trading_start": "09:30",
    "trading_end": "15:00",
    "use_regulatory_charges": true,
    "brokerage_per_order": 20
  },
  "initial_capital": 100000,
  "quantity": 10,
  "fee_per_order": 20,
  "slippage_bps": 2,
  "symbol": "RELIANCE.NS"
}
```

---

## 📊 CSV Upload Specification

You can upload custom historical market data in CSV format. The CSV must include a header row with the following column names (case-insensitive):

| Column | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `timestamp` | String / ISO 8601 | Date and time (Asia/Kolkata timezone supported) | `2026-03-01T09:15:00` |
| `open` | Float | Candle open price | `2450.50` |
| `high` | Float | Candle highest price | `2465.00` |
| `low` | Float | Candle lowest price | `2448.20` |
| `close` | Float | Candle close price | `2460.10` |
| `volume` | Float / Int | Traded volume | `125400` |

---

## ❓ Troubleshooting & FAQ

### Q1: I get a connection error connecting to PostgreSQL.
* **Answer**: Strategy Lab features **automatic database fallback**. If PostgreSQL is offline or unreachable, the backend automatically boots a local SQLite database (`strategy_lab.db`) with zero manual configuration. In production on Render, Strategy Lab connects directly to Supabase cloud PostgreSQL.

### Q2: What ticker format should I use for Indian stocks?
* **NSE Stocks**: Append `.NS` (e.g., `RELIANCE.NS`, `TCS.NS`, `INFY.NS`, `HDFCBANK.NS`).
* **BSE Stocks**: Append `.BO` (e.g., `RELIANCE.BO`).
* **Indices**: Use `^NSEI` for NIFTY 50 and `^NSEBANK` for BANK NIFTY.

### Q3: How do Discord and Telegram Webhooks work?
* **Discord**: Create a Webhook URL in your Discord Channel Settings (`Integrations -> Webhooks`), paste it into the webhook input, and click **Send Test Ping**.
* **Telegram**: Use standard Telegram Bot API webhook endpoints (`https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>`).

### Q4: Port conflict on localhost (e.g., port 5432 or 8000 already in use).
* In `docker-compose.yml`, the host ports are mapped to avoid standard conflicts:
  * PostgreSQL: `5433:5432` (Host port 5433)
  * Backend API: `8001:8000` (Host port 8001)
  * Frontend: `5173:5173` (Host port 5173)

---

## 🗺️ Roadmap & Future Enhancements

- [ ] **Options Greeks & Multi-Leg Payoffs**: Straddle / Strangle intraday backtesting with Black-Scholes implied volatility modeling.
- [ ] **Broker WebSocket Live Feeds**: Direct real-time streaming integration with Zerodha Kite Connect, DhanHQ, and Upstox APIs.
- [ ] **Multi-Timeframe Confirmation (MTF)**: Filter 5-minute entries against 1-hour higher timeframe trend structure.
- [ ] **Automated Strategy Synthesis**: Genetic algorithms to evolve indicator parameter combinations automatically based on Sharpe ratio optimization.

---

## 🧪 Testing

Strategy Lab includes unit and integration tests covering the simulation engine, indicator calculations, tax logic, and API endpoints (30/30 passing):

```bash
cd backend
pytest -v tests
```

---

## ⚠️ Important Assumptions & Disclaimers

1. **Virtual & Deterministic Simulation Only**: Strategy Lab is a quantitative research and educational platform. It does not connect to live broker execution APIs and places **no real financial orders**.
2. **Execution Modeling Assumptions**:
   * Fills are simulated at the open price of the bar following a signal.
   * Liquidity is assumed sufficient to fill specified order quantities.
   * Actual live market fills may experience wider slippage, partial fills, exchange latency, and order rejection.
3. **Past Performance vs Future Results**: Historical backtests, Walk-Forward efficiency scores, and Monte Carlo probabilities are theoretical models. They do not guarantee future profitability in live market conditions.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
