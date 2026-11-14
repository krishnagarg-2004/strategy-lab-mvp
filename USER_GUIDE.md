# 📘 Strategy Lab — Trader's Handbook & User Guide

Welcome to the **Strategy Lab User Guide**. This handbook is written in plain, practical language to help you master every feature of Strategy Lab, design robust algorithmic strategies, and interpret quantitative performance metrics like a professional.

> 🛠️ **Looking for technical architecture, Docker setup, or API documentation?**  
> Check out the [README.md](README.md) for developer guides, system flowcharts, and REST endpoint specs.

---

## 📑 Table of Contents

1. [🚀 2-Minute Quickstart](#-2-minute-quickstart)
2. [🧭 Understanding the Workspaces](#-understanding-the-workspaces)
   * [1. Single Run (Core Backtesting)](#1-single-run-core-backtesting)
   * [2. Grid Search (Parameter Optimization Heatmap)](#2-grid-search-parameter-optimization-heatmap)
   * [3. Portfolio Watchlist (Multi-Asset Basket Testing)](#3-portfolio-watchlist-multi-asset-basket-testing)
   * [4. Monte Carlo (Sequence Risk & Ruin Analysis)](#4-monte-carlo-sequence-risk--ruin-analysis)
   * [5. Walk-Forward (Overfitting & Curve-Fitting Detection)](#5-walk-forward-overfitting--curve-fitting-detection)
   * [6. Live Paper Trading & Real-Time Alerts](#6-live-paper-trading--real-time-alerts)
3. [📊 Metrics Demystified (How to Read Your Report)](#-metrics-demystified-how-to-read-your-report)
4. [💰 Indian Statutory Charges Explained](#-indian-statutory-charges-explained)
5. [📁 CSV Upload Guide (Zerodha Kite & TradingView)](#-csv-upload-guide-zerodha-kite--tradingview)
6. [🔔 Discord & Telegram Webhook Setup](#-discord--telegram-webhook-setup)
7. [❓ Frequently Asked Questions (FAQ)](#-frequently-asked-questions-faq)

---

## 🚀 2-Minute Quickstart

Want to see how your first strategy performs in under 60 seconds?

1. Open the live app: **[https://strategy-lab-frontend.onrender.com](https://strategy-lab-frontend.onrender.com)**.
2. Under **01 / CONFIGURE** on the left sidebar:
   * Keep **Trade Direction** set to `Both` (trades Long and Short).
   * Under **Data Source**, select `Indian Mkts`. Pick `NIFTY 50` or `RELIANCE.NS`.
   * Click **⚡ Fetch & Load Candles**.
3. Scroll down and click the green **▶ Run Backtest** button.
4. **Done!** Your comprehensive report will render immediately:
   * Review your **Net Return %**, **Win Rate**, and **Max Drawdown**.
   * Toggle between the **Candlesticks & Signals** chart (with buy/sell markers) and the **Equity Curve**.
   * Inspect the **Trade Ledger** table and **Indian Statutory Tax Breakdown**.

---

## 🧭 Understanding the Workspaces

Strategy Lab is divided into 6 specialized quantitative research tabs:

```text
[ Single Run ]  [ Grid Search ]  [ Portfolio Watchlist ]  [ Monte Carlo ]  [ Walk-Forward ]  [ Paper Trading ]
```

---

### 1. Single Run (Core Backtesting)

The Single Run tab is your primary strategy testing ground. It executes a candle-by-candle deterministic simulation without look-ahead bias.

#### A. Trade Direction
* **Long Only:** Only buys when the fast line crosses above the slow line. Exits on opposite signals or stops.
* **Short Only:** Only shorts when the fast line crosses below the slow line (intraday intraday shorting).
* **Both:** Reverses positions automatically when opposite signals occur.

#### B. Indicators & Filters
* **Fast EMA & Slow EMA:** The core crossover engine (e.g. 9 EMA and 21 EMA). When the 9 EMA crosses above the 21 EMA, a Long signal is generated.
* **RSI Filter (Toggle):** Restricts entries to periods of sustained momentum. For example, setting RSI > 50 prevents buying into weak, stagnant chop.
* **Intraday VWAP Filter (Toggle):** Resets automatically every morning at 09:15 IST. Only permits Long trades when price is trading *above* VWAP, and Short trades *below* VWAP.
* **Supertrend Filter (Toggle):** Volatility-based trend confirmation using Average True Range (ATR). Keeps you trading in the direction of the dominant market regime.

#### C. Risk Management & Exit Controls
* **Stop Loss (%):** Automatically exits a trade if the price moves against you by this percentage.
* **Take Profit (%):** Automatically locks in gains if the price reaches your target profit percentage.
* **Trailing Stop-Loss (Toggle):** Instead of a stationary stop-loss, a trailing stop dynamically ratchets upward as profits accumulate. If price peaks at +3% and pulls back by your trailing distance (e.g. 0.5%), you exit with locked-in profits.
* **Trading Window (IST):** Set session boundaries (e.g. `09:30` to `15:15`). All open positions are auto-squared-off at session end to avoid overnight gap risk.

---

### 2. Grid Search (Parameter Optimization Heatmap)

*Ever wondered: "Would my strategy perform better with an 8/20 EMA or a 13/34 EMA?"*

Grid Search removes the guesswork by systematically testing an entire matrix of Fast EMA vs Slow EMA combinations.

1. Switch to the **Grid Search** tab.
2. Enter your candidate values separated by commas:
   * Fast EMAs: `5, 9, 13, 21`
   * Slow EMAs: `21, 34, 55, 89`
3. Click **Run Grid Search**.
4. **How to Read the Heatmap:**
   * **Vibrant Green Cells:** High-profit / high-Sharpe combinations.
   * **Red Cells:** Unprofitable parameter combinations.
   * **Look for "Parameter Plateaus":** Avoid isolated green cells surrounded by red (which indicate fluke luck). Instead, look for clusters of green where nearby settings are also profitable—this indicates a genuine, robust edge.
5. Click on any cell in the heatmap to inspect its exact metrics or load those parameters directly back into the Single Run tab!

---

### 3. Portfolio Watchlist (Multi-Asset Basket Testing)

A strategy that works well on NIFTY 50 might fail on individual volatile mid-caps. The Portfolio Watchlist tests your strategy across multiple assets simultaneously.

1. Switch to the **Portfolio Watchlist** tab.
2. Select the instruments you want to include in your basket (e.g. `NIFTY 50`, `RELIANCE`, `TCS`, `INFY`, `HDFCBANK`).
3. Set your **Virtual Capital Per Stock** (e.g. ₹50,000 per symbol).
4. Click **Run Portfolio Test**.
5. **What You Get:**
   * Consolidated portfolio return and combined equity curve.
   * Asset-by-asset comparison table showing which stocks performed best and which dragged down performance.
   * Diversification benefit: See how combining non-correlated stocks smooths out overall account drawdowns.

---

### 4. Monte Carlo (Sequence Risk & Ruin Analysis)

*Even a winning strategy can blow up an account if all its losing trades happen to occur back-to-back.*

Monte Carlo stress-testing randomly reshuffles the order of your historical trades over 1,000 to 5,000 simulated alternative realities.

1. Run a backtest in Single Run that generates at least 5–10 trades.
2. Switch to the **Monte Carlo** tab.
3. Choose the number of simulations (e.g. `1,000`).
4. Click **Run Monte Carlo Simulation**.
5. **What to Look For:**
   * **Probability of Unprofitable Run:** The chance of your account ending in the negative simply due to bad sequence luck.
   * **Tail Max Drawdown (95th & 99th Percentile):** The worst-case drawdown you should prepare for psychologically.
   * **Fan Chart:** The spread between the 5th percentile (unlucky path) and 95th percentile (lucky path) gives you realistic expectations of account volatility.

---

### 5. Walk-Forward (Overfitting & Curve-Fitting Detection)

Curve-fitting happens when you tweak parameters until a strategy looks artificially perfect on historical data, only for it to fail when used in real trading.

Walk-Forward analysis prevents this by splitting your historical data chronologically into:
* **In-Sample Period (Training):** Used to see how the strategy performed initially (e.g. 70% of historical candles).
* **Out-of-Sample Period (Testing):** Forward unseen data that the strategy has never witnessed before (the remaining 30%).

1. Switch to the **Walk-Forward (OOS)** tab.
2. Set your **In-Sample Training Split** (70% is standard).
3. Click **Run Walk-Forward Split**.
4. **How to Interpret the Result:**
   * **Walk-Forward Efficiency (WFE %):** Measures whether profits held up out-of-sample:
     * **WFE > 60%:** ✅ **Robust Strategy.** The edge generalizes well to new market conditions.
     * **WFE < 40%:** ⚠️ **Overfitted Warning.** The strategy was likely over-tuned to past noise and may struggle forward.

---

### 6. Live Paper Trading & Real-Time Alerts

Practice forward-testing your strategy without risking real capital.

1. Switch to the **Paper Trading** tab.
2. Verify your active trading symbol and starting paper capital.
3. Optional: Paste your **Discord** or **Telegram** webhook URL to receive instant push alerts whenever a signal triggers.
4. Click **Start Live Paper Session**.
5. Click **Trigger Live Tick** to simulate incoming market price bars.
6. The engine will:
   * Evaluate crossover conditions in real time.
   * Automatically manage trailing stops as prices advance.
   * Log all fills in the **Live Event & Alert Audit Log**.
   * Dispatch instant alert notifications directly to your Discord or Telegram channel!
7. When finished, click **Stop Session**.

---

## 📊 Metrics Demystified (How to Read Your Report)

When you run a backtest, Strategy Lab generates an institutional performance dashboard. Here is how to interpret each number:

| Metric | What It Means | What is a "Good" Value? |
| :--- | :--- | :--- |
| **Net P&L (₹)** | Total rupees made or lost after subtracting all simulated broker fees, taxes, and slippage. | Positive (> ₹0) |
| **Return (%)** | Percentage gain or loss relative to your starting virtual capital. | Higher than benchmark NIFTY 50 return |
| **Win Rate (%)** | Percentage of completed trades that closed with a positive net profit. | 40%–60% (Trend-following strategies often have a 45% win rate but large wins!) |
| **Profit Factor** | Ratio of gross profits to gross losses ($\frac{\text{Total Gains}}{\text{Total Losses}}$). | **> 1.5** is good; **> 2.0** is excellent |
| **Max Drawdown (%)** | The largest peak-to-valley percentage drop in your account equity. | Lower is better (ideally **< 15%**) |
| **Sharpe Ratio** | Risk-adjusted return comparing excess profit to account volatility. | **> 1.0** is acceptable; **> 1.5** is strong |
| **Sortino Ratio** | Like Sharpe, but only penalizes *downside* volatility (bad losses), ignoring upside surges. | **> 1.5** is good; **> 2.0** is institutional quality |
| **Max Consecutive Losses** | The longest losing streak experienced during the backtest. | Prepare your position sizing so this streak cannot wipe out your account |

---

## 💰 Indian Statutory Charges Explained

Most generic backtesting tools show unrealistic profits because they omit regulatory costs. In intraday Indian trading, taxes and turnover fees can consume 20% to 50% of gross profits.

Strategy Lab models the exact Indian fee schedule:

1. **Securities Transaction Tax (STT):**
   * Charged at **0.025%** on the turnover of the sell leg for intraday equity trades.
2. **Brokerage per Order Leg:**
   * Configurable flat fee per execution (defaults to **₹20** per order, matching discount brokers like Zerodha, Groww, and Angel One).
3. **Goods and Services Tax (GST):**
   * **18%** applied on the sum of Brokerage + Exchange Transaction Charges.
4. **Exchange Turnover Charges:**
   * Levied by NSE/BSE per transaction turnover (approx. 0.00345%).
5. **SEBI Turnover Charges:**
   * Regulatory levy of ₹10 per crore of turnover.
6. **Stamp Duty:**
   * Levied by state governments at 0.003% on buy orders.

> 💡 **Tip:** Always keep the **Real Indian Charges** switch turned ON. If a strategy cannot remain profitable after Indian taxes and brokerage, it will not survive live trading!

---

## 📁 CSV Upload Guide (Zerodha Kite & TradingView)

You can backtest your own historical data exported from your charting platform or broker.

### Supported CSV Format
Your CSV file must have a header row with the following 6 columns:

```csv
timestamp,open,high,low,close,volume
2026-01-05T09:15:00,2450.00,2455.50,2448.00,2452.10,85400
2026-01-05T09:20:00,2452.10,2460.00,2451.00,2458.75,124300
```

* **timestamp:** Date and time in ISO format (`YYYY-MM-DDTHH:MM:SS`) or standard `YYYY-MM-DD HH:MM:SS`.
* **open, high, low, close:** Decimal numeric prices.
* **volume:** Integer or float share volume.

#### How to Export:
* **From TradingView:** Open any chart → Click the top-bar dropdown next to the symbol → Click **Export chart data…** → Choose CSV.
* **From Zerodha Kite:** Open Kite Chart → Historical Data → Export CSV.

---

## 🔔 Discord & Telegram Webhook Setup

Strategy Lab can send instant notifications to your chat channels when signals fire during Paper Trading:

### Discord Setup
1. In Discord, go to **Server Settings** → **Integrations** → **Webhooks**.
2. Click **New Webhook**, name it "Strategy Lab Alerts", and choose your alert channel.
3. Click **Copy Webhook URL**.
4. In Strategy Lab, navigate to **Paper Trading** → paste the URL → click **Send Test Ping**.
5. You will see an immediate green confirmation ping in your Discord channel!

### Telegram Setup
1. Create a Telegram Bot via [@BotFather](https://t.me/botfather) and copy your **Bot Token**.
2. Get your **Chat ID** (or channel ID).
3. Enter your Telegram endpoint URL:
   `https://api.telegram.org/bot<YOUR_TOKEN>/sendMessage?chat_id=<YOUR_CHAT_ID>`
4. Toggle **Enable Live Webhook Alerts**.

---

## ❓ Frequently Asked Questions (FAQ)

### Q: Does Strategy Lab execute real orders with real money?
**No.** Strategy Lab is strictly a simulation, backtesting, and quantitative research laboratory. It does not connect to broker trading accounts and places zero real financial trades.

### Q: Why does the app show different results than TradingView?
TradingView backtests often use simple end-of-bar assumptions or ignore slippage and statutory taxes. Strategy Lab factors in:
1. **Next-bar open execution** (zero look-ahead bias).
2. **Indian statutory taxes (STT, GST, Stamp duty, SEBI)**.
3. **Execution slippage in basis points**.
4. **Intrabar conservative stop resolution**.
These factors make Strategy Lab's results significantly closer to actual live market reality.

### Q: Where are my saved experiments stored?
When you click **Save Run to Database**, your experiment is persisted in high-concurrency cloud PostgreSQL (hosted on Supabase) or local SQLite. You can load or delete saved experiments anytime from the top-bar **Experiments** drawer.

### Q: How do I switch between Dark and Light mode?
Click the **Light Mode / Dark Mode** button in the top right header. Strategy Lab uses a calibrated soft-slate light mode that prevents eye strain. Your preference is automatically saved in your browser.

---

*Happy systematic trading! For technical queries, contributions, or architecture details, refer to [README.md](README.md).*
