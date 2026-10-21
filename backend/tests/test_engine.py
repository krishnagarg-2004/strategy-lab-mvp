import pandas as pd
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas import BacktestRequest, StrategySpec
from app.engine import load_candles, run_backtest

client = TestClient(app)

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["trading_mode"] == "simulation_only"

def test_strategy_rejects_fast_ema_not_faster_than_slow():
    with pytest.raises(ValueError):
        StrategySpec(fast_ema=21, slow_ema=9)

def test_invalid_ohlc_rejected():
    csv = "timestamp,open,high,low,close,volume\n2025-01-01T09:15:00,100,90,95,101,1000"
    with pytest.raises(ValueError):
        load_candles(csv)

def test_backtest_returns_expected_contract():
    result = run_backtest(BacktestRequest())
    assert result["data_source"] == "synthetic_demo"
    assert result["is_real_market_data"] is False
    assert "trades" in result and "equity_curve" in result
    assert result["initial_capital"] == 100000
    assert "No live orders are sent" in result["assumptions"][-1]

def test_api_backtest():
    response = client.post("/api/backtest", json={"symbol": "DEMO", "initial_capital": 100000})
    assert response.status_code == 200
    assert response.json()["symbol"] == "DEMO"
