from fastapi.testclient import TestClient
from app.main import app
from app.ai_assistant import compile_strategy_from_natural_language, _local_regex_compiler

client = TestClient(app)


def test_local_regex_compiler():
    prompt = "Buy Reliance when 9 EMA crosses 21 EMA with 1% stop loss and 2% target"
    res = _local_regex_compiler(prompt)
    strat = res["strategy"]
    assert strat["fast_ema"] == 9
    assert strat["slow_ema"] == 21
    assert strat["stop_loss_pct"] == 1.0
    assert strat["take_profit_pct"] == 2.0
    assert res["suggested_symbol"] == "RELIANCE.NS"


def test_golden_cross_local():
    prompt = "Run golden cross on Nifty with trailing stop"
    res = _local_regex_compiler(prompt)
    strat = res["strategy"]
    assert strat["fast_ema"] == 50
    assert strat["slow_ema"] == 200
    assert strat["use_trailing_stop"] is True
    assert res["suggested_symbol"] == "^NSEI"


def test_ai_compile_endpoint():
    res = client.post(
        "/api/ai/compile-strategy",
        json={"prompt": "Buy when 8 EMA crosses above 20 EMA and RSI is above 50 with 0.5% stop loss"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "strategy" in data
    assert "explanation" in data
    strat = data["strategy"]
    assert strat["fast_ema"] == 8
    assert strat["slow_ema"] == 20
    assert strat["use_rsi_filter"] is True
    assert strat["stop_loss_pct"] == 0.5
