from contextlib import asynccontextmanager
import json
import logging
from typing import List, Optional
from dotenv import load_dotenv

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

# Load environment secrets
load_dotenv()

from .ai_assistant import compile_strategy_from_natural_language
from .db import Base, engine, get_db
from .engine import (
    run_backtest,
    run_grid_search,
    run_monte_carlo,
    run_portfolio_backtest,
    run_walk_forward,
)
from .market_data import (
    POPULAR_INDIAN_SYMBOLS,
    fetch_indian_market_data,
    fetch_quotes_batch,
    fetch_symbol_quote,
    search_indian_symbols,
)
from .models import BacktestExperiment, CommunityStrategy, StrategyComment
from .paper_trading import paper_session
from .schemas import (
    AddCommentRequest,
    AIStrategyCompileRequest,
    BacktestRequest,
    BatchQuotesRequest,
    GridSearchRequest,
    MarketDataFetchRequest,
    MonteCarloRequest,
    PaperTradingTickRequest,
    PortfolioBacktestRequest,
    PublishCommunityStrategyRequest,
    SaveExperimentRequest,
    StartPaperTradingRequest,
    WalkForwardRequest,
    WebhookTestRequest,
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


@app.post("/api/ai/compile-strategy")
def compile_strategy(request: AIStrategyCompileRequest):
    """Translate natural language trading rules into validated StrategySpec."""
    try:
        return compile_strategy_from_natural_language(request.prompt)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ==========================================
# Market Data Endpoints (yfinance Indian Mkts)
# ==========================================


@app.get("/api/market-data/symbols")
def get_popular_symbols():
    """Return pre-configured list of popular Indian indices and large-cap stocks."""
    return {"symbols": POPULAR_INDIAN_SYMBOLS}


@app.get("/api/market-data/search")
def search_symbols(q: str = "", category: str = ""):
    """Search Indian indices and stocks by name, ticker, or sector."""
    return {"results": search_indian_symbols(q, category)}


@app.get("/api/market-data/quote/{symbol}")
def get_quote(symbol: str):
    """Get current/delayed quote for an Indian stock or index."""
    try:
        quote = fetch_symbol_quote(symbol)
        return quote
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch quote: {exc}") from exc


@app.post("/api/market-data/quotes")
def get_batch_quotes(request: BatchQuotesRequest):
    """Get current/delayed quotes for multiple watchlist symbols in batch."""
    try:
        quotes = fetch_quotes_batch(request.symbols)
        return {"quotes": quotes}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch batch quotes: {exc}") from exc


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


@app.post("/api/monte-carlo")
def monte_carlo(request: MonteCarloRequest):
    """Run bootstrap resampling of historical trades to assess tail risk and drawdown distribution."""
    try:
        return run_monte_carlo(request)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Monte Carlo simulation failed: {exc}") from exc


@app.post("/api/walk-forward")
def walk_forward(request: WalkForwardRequest):
    """Run train/test split to evaluate out-of-sample performance and overfitting."""
    try:
        return run_walk_forward(request)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Walk-forward analysis failed: {exc}") from exc



# ==========================================
# Advanced: Live Paper Trading & Webhook Hub
# ==========================================


@app.get("/api/paper-trading/status")
def get_paper_trading_status():
    """Get active live paper trading session state, open position, and recent trades."""
    return paper_session.get_status()


@app.post("/api/paper-trading/start")
def start_paper_trading(request: StartPaperTradingRequest):
    """Start live paper trading on an Indian market symbol with active strategy rules."""
    return paper_session.start(request)


@app.post("/api/paper-trading/stop")
def stop_paper_trading():
    """Stop live paper trading session and square off any open position."""
    return paper_session.stop()


@app.post("/api/paper-trading/tick")
def paper_trading_tick(request: Optional[PaperTradingTickRequest] = None):
    """Evaluate strategy rules against the latest market candle or manual price."""
    manual_price = request.manual_price if request else None
    return paper_session.tick(manual_price=manual_price)


@app.post("/api/paper-trading/webhook-test")
def test_webhook(request: WebhookTestRequest):
    """Send a test notification to a Discord, Telegram, or generic webhook endpoint."""
    import httpx

    msg = request.message or "Strategy Lab Live Webhook Integration Test — OK!"
    url = request.webhook_url.strip()

    try:
        if request.platform == "discord" or "discord.com" in url:
            payload = {
                "embeds": [
                    {
                        "title": "🟢 Strategy Lab Webhook Test",
                        "description": msg,
                        "color": 0x63DFB0,
                        "footer": {"text": "Strategy Lab · Advanced Alert Engine"},
                    }
                ]
            }
        elif request.platform == "telegram":
            payload = {"text": f"*Strategy Lab Webhook Test*\n\n{msg}"}
        else:
            payload = {"event": "test_ping", "message": msg}

        with httpx.Client(timeout=5.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code >= 400:
                raise HTTPException(status_code=400, detail=f"Webhook server returned HTTP {resp.status_code}: {resp.text}")

        return {"status": "ok", "message": "Test ping successfully delivered to webhook."}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Webhook test failed: {exc}") from exc


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


# ==========================================
# Community Strategy Sharing & Collaboration
# ==========================================


@app.get("/api/community/strategies")
def list_community_strategies(
    category: Optional[str] = None,
    tag: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List published community strategies with optional category, tag, or text filtering."""
    query = db.query(CommunityStrategy).order_by(CommunityStrategy.likes_count.desc(), CommunityStrategy.created_at.desc())

    if category and category.lower() != "all":
        query = query.filter(CommunityStrategy.category.ilike(f"%{category}%"))

    if tag:
        query = query.filter(CommunityStrategy.tags.ilike(f"%{tag}%"))

    if q:
        query = query.filter(
            (CommunityStrategy.title.ilike(f"%{q}%"))
            | (CommunityStrategy.description.ilike(f"%{q}%"))
            | (CommunityStrategy.author_name.ilike(f"%{q}%"))
        )

    strategies = query.limit(50).all()
    return {"strategies": [s.to_summary_dict() for s in strategies]}


@app.post("/api/community/strategies")
def publish_community_strategy(
    request: PublishCommunityStrategyRequest,
    db: Session = Depends(get_db),
):
    """Publish a trading strategy with verified metrics to the community gallery."""
    try:
        strat = CommunityStrategy(
            title=request.title,
            description=request.description,
            author_name=request.author_name,
            category=request.category,
            tags=request.tags,
            strategy_json=json.dumps(request.strategy.model_dump()),
            verified_stats_json=json.dumps(request.verified_stats) if request.verified_stats else None,
            likes_count=0,
            copies_count=0,
        )
        db.add(strat)
        db.commit()
        db.refresh(strat)
        return {"status": "published", "strategy": strat.to_summary_dict()}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Could not publish strategy: {exc}") from exc


@app.get("/api/community/strategies/{strategy_id}")
def get_community_strategy(strategy_id: int, db: Session = Depends(get_db)):
    """Get full details and comments of a shared community strategy."""
    strat = db.query(CommunityStrategy).filter(CommunityStrategy.id == strategy_id).first()
    if not strat:
        raise HTTPException(status_code=404, detail="Community strategy not found.")
    return strat.to_detail_dict()


@app.post("/api/community/strategies/{strategy_id}/like")
def like_community_strategy(strategy_id: int, db: Session = Depends(get_db)):
    """Increment like count for a community strategy."""
    strat = db.query(CommunityStrategy).filter(CommunityStrategy.id == strategy_id).first()
    if not strat:
        raise HTTPException(status_code=404, detail="Community strategy not found.")
    strat.likes_count += 1
    db.commit()
    return {"status": "liked", "likes_count": strat.likes_count}


@app.post("/api/community/strategies/{strategy_id}/fork")
def fork_community_strategy(strategy_id: int, db: Session = Depends(get_db)):
    """Increment copy/fork count when a user imports a shared strategy to their workspace."""
    strat = db.query(CommunityStrategy).filter(CommunityStrategy.id == strategy_id).first()
    if not strat:
        raise HTTPException(status_code=404, detail="Community strategy not found.")
    strat.copies_count += 1
    db.commit()
    return {"status": "forked", "copies_count": strat.copies_count}


@app.post("/api/community/strategies/{strategy_id}/comments")
def add_strategy_comment(
    strategy_id: int,
    request: AddCommentRequest,
    db: Session = Depends(get_db),
):
    """Add a review or comment to a published strategy."""
    strat = db.query(CommunityStrategy).filter(CommunityStrategy.id == strategy_id).first()
    if not strat:
        raise HTTPException(status_code=404, detail="Community strategy not found.")
    try:
        comment = StrategyComment(
            strategy_id=strategy_id,
            author_name=request.author_name,
            comment=request.comment,
        )
        db.add(comment)
        db.commit()
        db.refresh(comment)
        return {"status": "added", "comment": comment.to_dict()}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Could not post comment: {exc}") from exc

