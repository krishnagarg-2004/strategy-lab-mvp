from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .schemas import BacktestRequest
from .engine import run_backtest

app = FastAPI(title="Strategy Lab API", version="0.1.0", description="Deterministic strategy backtesting MVP; no real orders.")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "strategy-lab-api", "trading_mode": "simulation_only"}

@app.post("/api/backtest")
def backtest(request: BacktestRequest):
    try:
        return run_backtest(request)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

@app.get("/api/strategy-template")
def strategy_template():
    return {"strategy": {"name": "EMA crossover + RSI", "fast_ema": 9, "slow_ema": 21, "use_rsi_filter": True, "rsi_period": 14, "rsi_min": 55, "stop_loss_pct": 0.5, "take_profit_pct": 1.0, "trading_start": "09:30", "trading_end": "14:30"}, "note": "This is a rule template, not a recommendation."}
