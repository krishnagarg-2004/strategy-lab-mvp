from contextlib import asynccontextmanager
import json
import logging
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .db import Base, engine, get_db
from .engine import run_backtest, run_grid_search, run_portfolio_backtest
from .market_data import POPULAR_INDIAN_SYMBOLS, fetch_indian_market_data
from .models import BacktestExperiment
from .schemas import (
    BacktestRequest,
    GridSearchRequest,
    MarketDataFetchRequest,
    PortfolioBacktestRequest,
    SaveExperimentRequest,
)

logger = logging.getLogger(__name__)

# Ensure tables exist on load
try:
    Base.metadata.create_all(bind=engine)
except Exception as exc:
    logger.warning("Could not auto-create tables on import: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:
        logger.warning("Could not auto-create tables on startup: %s", exc)
    yield


app = FastAPI(
    title="Strategy Lab API",
    version="0.2.0",
    description="Deterministic Indian markets strategy backtesting & research workspace.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "strategy-lab-api",
        "trading_mode": "simulation_only",
        "database": engine.dialect.name,
    }


@app.post("/api/backtest")
def backtest(request: BacktestRequest):
    try:
        return run_backtest(request)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/strategy-template")
def strategy_template():
    return {
        "strategy": {
            "name": "EMA crossover + RSI",
            "fast_ema": 9,
            "slow_ema": 21,
            "use_rsi_filter": True,
            "rsi_period": 14,
            "rsi_min": 55,
            "stop_loss_pct": 0.5,
            "take_profit_pct": 1.0,
            "trading_start": "09:30",
            "trading_end": "14:30",
        },
        "note": "This is a rule template, not a recommendation.",
    }


# ==========================================
# Market Data Endpoints (yfinance Indian Mkts)
# ==========================================


@app.get("/api/market-data/symbols")
def get_popular_symbols():
    """Return pre-configured list of popular Indian indices and large-cap stocks."""
    return {"symbols": POPULAR_INDIAN_SYMBOLS}


@app.post("/api/market-data/fetch")
def fetch_market_data(request: MarketDataFetchRequest):
    """Fetch candles for an Indian symbol and return validated CSV data and preview candles."""
    try:
        csv_str, df = fetch_indian_market_data(
            symbol=request.symbol,
            period=request.period,
            interval=request.interval,
        )
        return {
            "symbol": request.symbol.upper(),
            "period": request.period,
            "interval": request.interval,
            "candle_count": len(df),
            "csv_data": csv_str,
            "first_timestamp": df["timestamp"].iloc[0].isoformat() if not df.empty else None,
            "last_timestamp": df["timestamp"].iloc[-1].isoformat() if not df.empty else None,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch market data: {exc}") from exc


# ==========================================
# Phase 3: Grid Search & Portfolio Backtest
# ==========================================


@app.post("/api/grid-search")
def grid_search(request: GridSearchRequest):
    """Run parameter sweep across Fast and Slow EMA combinations."""
    try:
        return run_grid_search(request)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Grid search failed: {exc}") from exc


@app.post("/api/portfolio-backtest")
def portfolio_backtest(request: PortfolioBacktestRequest):
    """Run backtest across a watchlist of multiple Indian stocks."""
    try:
        return run_portfolio_backtest(request)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Portfolio backtest failed: {exc}") from exc


# ==========================================
# Database Persistence (Experiments)
# ==========================================


@app.get("/api/experiments")
def list_experiments(db: Session = Depends(get_db)):
    """List all saved backtest experiments ordered by most recent."""
    experiments = (
        db.query(BacktestExperiment)
        .order_by(BacktestExperiment.created_at.desc())
        .limit(100)
        .all()
    )
    return {"experiments": [exp.to_summary_dict() for exp in experiments]}


@app.get("/api/experiments/{experiment_id}")
def get_experiment(experiment_id: int, db: Session = Depends(get_db)):
    """Get the full backtest details, trades, and curves for a specific experiment."""
    exp = db.query(BacktestExperiment).filter(BacktestExperiment.id == experiment_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found.")
    return exp.to_detail_dict()


@app.post("/api/experiments")
def save_experiment(request: SaveExperimentRequest, db: Session = Depends(get_db)):
    """Save a backtest result as an experiment to compare later."""
    try:
        exp = BacktestExperiment(
            name=request.name,
            symbol=request.symbol,
            data_source=request.data_source,
            is_real_market_data=(
                "true" if request.is_real_market_data is True
                else ("false" if request.is_real_market_data is False else None)
            ),
            initial_capital=request.initial_capital,
            final_equity=request.final_equity,
            net_pnl=request.net_pnl,
            return_pct=request.return_pct,
            trade_count=request.trade_count,
            wins=request.wins,
            losses=request.losses,
            win_rate_pct=request.win_rate_pct,
            profit_factor=request.profit_factor,
            max_drawdown_pct=request.max_drawdown_pct,
            average_duration_minutes=request.average_duration_minutes,
            strategy_fingerprint=request.strategy_fingerprint,
            strategy_json=json.dumps(request.strategy),
            trades_json=json.dumps(request.trades),
            equity_curve_json=json.dumps(request.equity_curve),
            candles_json=json.dumps(request.candles or []),
            assumptions_json=json.dumps(request.assumptions or []),
        )
        db.add(exp)
        db.commit()
        db.refresh(exp)
        return {"status": "saved", "experiment": exp.to_summary_dict()}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Could not save experiment: {exc}") from exc


@app.delete("/api/experiments/{experiment_id}")
def delete_experiment(experiment_id: int, db: Session = Depends(get_db)):
    """Delete a saved backtest experiment."""
    exp = db.query(BacktestExperiment).filter(BacktestExperiment.id == experiment_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found.")
    db.delete(exp)
    db.commit()
    return {"status": "deleted", "id": experiment_id}
