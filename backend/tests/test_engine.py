
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import BacktestRequest, StrategySpec
from app.engine import load_candles, run_backtest

client = TestClient(app)


def make_csv(rows):
    """Build a minimal valid OHLCV CSV from candle dictionaries."""
    return pd.DataFrame(rows).to_csv(index=False)


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["trading_mode"] == "simulation_only"


def test_strategy_rejects_fast_ema_not_faster_than_slow():
    with pytest.raises(ValueError):
        StrategySpec(fast_ema=21, slow_ema=9)


def test_non_finite_capital_rejected():
    with pytest.raises(ValueError):
        BacktestRequest(initial_capital=float("inf"))


def test_invalid_trading_time_rejected():
    with pytest.raises(ValueError):
        StrategySpec(trading_start="25:00")


def test_invalid_ohlc_rejected():
    csv = (
        "timestamp,open,high,low,close,volume\n"
        "2025-01-01T09:15:00,100,90,95,101,1000"
    )
    with pytest.raises(ValueError):
        load_candles(csv)


def test_duplicate_timestamps_rejected():
    csv = (
        "timestamp,open,high,low,close,volume\n"
        "2025-01-01T09:15:00,100,105,95,102,1000\n"
        "2025-01-01T09:15:00,102,106,100,104,1100"
    )
    with pytest.raises(ValueError, match="duplicate timestamps"):
        load_candles(csv)


def test_missing_column_rejected():
    csv = (
        "timestamp,open,high,low,close\n"
        "2025-01-01T09:15:00,100,105,95,102"
    )
    with pytest.raises(ValueError, match="missing required columns"):
        load_candles(csv)


def test_negative_volume_rejected():
    csv = (
        "timestamp,open,high,low,close,volume\n"
        "2025-01-01T09:15:00,100,105,95,102,-1\n"
        "2025-01-01T09:20:00,102,106,100,104,1000"
    )
    with pytest.raises(ValueError, match="Volume cannot be negative"):
        load_candles(csv)


def test_backtest_returns_expected_contract():
    result = run_backtest(BacktestRequest())

    assert result["data_source"] == "synthetic_demo"
    assert result["is_real_market_data"] is False
    assert "trades" in result
    assert "equity_curve" in result
    assert result["initial_capital"] == 100000
    assert "No live orders are sent" in result["assumptions"][-1]


def test_accounting_reconciles_final_equity_and_net_pnl():
    result = run_backtest(BacktestRequest())

    assert result["final_equity"] == pytest.approx(
        result["initial_capital"] + result["net_pnl"], abs=0.011
    )


def test_trade_net_pnl_includes_fees():
    result = run_backtest(BacktestRequest())

    for trade in result["trades"]:
        expected = round(trade["gross_pnl"] - trade["fees"], 2)
        assert trade["net_pnl"] == pytest.approx(expected, abs=0.011)


def test_equity_curve_ends_at_final_equity():
    result = run_backtest(BacktestRequest())

    if result["equity_curve"]:
        assert result["equity_curve"][-1]["equity"] == pytest.approx(
            result["final_equity"], abs=0.011
        )


def test_uploaded_csv_marked_as_uploaded():
    csv = make_csv([
        {
            "timestamp": "2025-01-06T09:15:00",
            "open": 100,
            "high": 102,
            "low": 99,
            "close": 101,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:20:00",
            "open": 101,
            "high": 103,
            "low": 100,
            "close": 102,
            "volume": 1200,
        },
    ])

    result = run_backtest(BacktestRequest(csv_data=csv))

    assert result["data_source"] == "uploaded_csv"
    assert result["is_real_market_data"] is None


def test_api_backtest():
    response = client.post(
        "/api/backtest",
        json={"symbol": "DEMO", "initial_capital": 100000},
    )

    assert response.status_code == 200
    assert response.json()["symbol"] == "DEMO"


def test_api_rejects_invalid_strategy():
    response = client.post(
        "/api/backtest",
        json={
            "strategy": {"fast_ema": 21, "slow_ema": 9},
        },
    )

    assert response.status_code == 422

def test_stop_loss_closes_position_at_stop_price():
    rows = [
        {
            "timestamp": "2025-01-06T09:15:00",
            "open": 103, "high": 104, "low": 102, "close": 103,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:20:00",
            "open": 103, "high": 104, "low": 99, "close": 100,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:25:00",
            "open": 100, "high": 101, "low": 98, "close": 99,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:30:00",
            "open": 99, "high": 106, "low": 98, "close": 105,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:35:00",
            "open": 105, "high": 106, "low": 103, "close": 104,
            "volume": 1000,
        },
    ]

    strategy = StrategySpec(
        fast_ema=2,
        slow_ema=3,
        use_rsi_filter=False,
        stop_loss_pct=1.0,
        take_profit_pct=10.0,
        trading_start="09:15",
        trading_end="15:15",
    )

    request = BacktestRequest(
        csv_data=make_csv(rows),
        strategy=strategy,
        initial_capital=10000,
        quantity=1,
        fee_per_order=0,
        slippage_bps=0,
    )

    result = run_backtest(request)

    assert result["trade_count"] >= 1

    trade = result["trades"][0]

    assert trade["exit_reason"] == "stop_loss"
    assert trade["exit_price"] == pytest.approx(
        trade["entry_price"] * 0.99,
        abs=0.01,
    )

def test_take_profit_closes_position_at_target_price():
    rows = [
        {
            "timestamp": "2025-01-06T09:15:00",
            "open": 103, "high": 104, "low": 102, "close": 103,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:20:00",
            "open": 103, "high": 104, "low": 99, "close": 100,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:25:00",
            "open": 100, "high": 101, "low": 98, "close": 99,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:30:00",
            "open": 99, "high": 106, "low": 98, "close": 105,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:35:00",
            "open": 105, "high": 107, "low": 104, "close": 106,
            "volume": 1000,
        },
    ]

    strategy = StrategySpec(
        fast_ema=2,
        slow_ema=3,
        use_rsi_filter=False,
        stop_loss_pct=10.0,
        take_profit_pct=1.0,
        trading_start="09:15",
        trading_end="15:15",
    )

    request = BacktestRequest(
        csv_data=make_csv(rows),
        strategy=strategy,
        initial_capital=10000,
        quantity=1,
        fee_per_order=0,
        slippage_bps=0,
    )

    result = run_backtest(request)

    target_trades = [
        trade for trade in result["trades"]
        if trade["exit_reason"] == "take_profit"
    ]

    assert target_trades, "Expected at least one take-profit trade."

    trade = target_trades[0]

    assert trade["exit_price"] == pytest.approx(
        trade["entry_price"] * 1.01,
        abs=0.01,
    )

def test_open_position_closes_at_session_end():
    rows = [
        {
            "timestamp": "2025-01-06T09:15:00",
            "open": 100, "high": 101, "low": 99, "close": 100,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:20:00",
            "open": 100, "high": 101, "low": 99, "close": 100,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:25:00",
            "open": 100, "high": 101, "low": 97, "close": 98,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:30:00",
            "open": 98, "high": 103, "low": 97, "close": 102,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:35:00",
            "open": 102, "high": 103, "low": 101, "close": 102,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:40:00",
            "open": 102, "high": 103, "low": 101, "close": 102,
            "volume": 1000,
        },
    ]

    strategy = StrategySpec(
        fast_ema=2,
        slow_ema=3,
        use_rsi_filter=False,
        stop_loss_pct=10.0,
        take_profit_pct=10.0,
        trading_start="09:15",
        trading_end="09:35",
    )

    request = BacktestRequest(
        csv_data=make_csv(rows),
        strategy=strategy,
        initial_capital=10000,
        quantity=1,
        fee_per_order=0,
        slippage_bps=0,
    )

    result = run_backtest(request)

    session_trades = [
        trade for trade in result["trades"]
        if trade["exit_reason"] == "session_end"
    ]

    assert session_trades, "Expected the position to close at session end."

    trade = session_trades[0]

    assert trade["exit_time"].startswith("2025-01-06T09:35:00")
    assert trade["exit_price"] == pytest.approx(102.0, abs=0.01)


def test_popular_symbols_endpoint():
    response = client.get("/api/market-data/symbols")
    assert response.status_code == 200
    data = response.json()
    assert "symbols" in data
    assert any(s["symbol"] == "^NSEI" for s in data["symbols"])


def test_experiments_crud():
    # 1. Run a backtest
    backtest_resp = client.post("/api/backtest", json={
        "strategy": {
            "name": "Test Strategy",
            "fast_ema": 9,
            "slow_ema": 21,
            "use_rsi_filter": False,
            "stop_loss_pct": 0.5,
            "take_profit_pct": 1.0,
            "trading_start": "09:30",
            "trading_end": "14:30"
        },
        "initial_capital": 100000,
        "quantity": 1,
        "fee_per_order": 20,
        "slippage_bps": 2,
        "symbol": "EXP-TEST"
    })
    assert backtest_resp.status_code == 200
    result = backtest_resp.json()

    # 2. Save experiment
    save_resp = client.post("/api/experiments", json={
        "name": "My EMA Run",
        "symbol": result["symbol"],
        "data_source": result["data_source"],
        "strategy": result["strategy"],
        "initial_capital": result["initial_capital"],
        "final_equity": result["final_equity"],
        "net_pnl": result["net_pnl"],
        "return_pct": result["return_pct"],
        "trade_count": result["trade_count"],
        "wins": result["wins"],
        "losses": result["losses"],
        "win_rate_pct": result["win_rate_pct"],
        "profit_factor": result["profit_factor"],
        "max_drawdown_pct": result["max_drawdown_pct"],
        "average_duration_minutes": result["average_duration_minutes"],
        "trades": result["trades"],
        "equity_curve": result["equity_curve"],
        "candles": result.get("candles", []),
        "assumptions": result["assumptions"]
    })
    assert save_resp.status_code == 200
    saved = save_resp.json()
    assert saved["status"] == "saved"
    exp_id = saved["experiment"]["id"]

    # 3. List experiments
    list_resp = client.get("/api/experiments")
    assert list_resp.status_code == 200
    experiments = list_resp.json()["experiments"]
    assert any(exp["id"] == exp_id for exp in experiments)

    # 4. Get experiment detail
    detail_resp = client.get(f"/api/experiments/{exp_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["name"] == "My EMA Run"
    assert "trades" in detail
    assert "equity_curve" in detail

    # 5. Delete experiment
    del_resp = client.delete(f"/api/experiments/{exp_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "deleted"

    # 6. Verify deleted
    not_found = client.get(f"/api/experiments/{exp_id}")
    assert not_found.status_code == 404


def test_short_selling_execution():
    rows = [
        {
            "timestamp": "2025-01-06T09:15:00",
            "open": 100, "high": 101, "low": 99, "close": 100,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:20:00",
            "open": 100, "high": 103, "low": 100, "close": 102,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:25:00",
            "open": 102, "high": 106, "low": 102, "close": 105,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:30:00",
            "open": 105, "high": 105, "low": 94, "close": 95,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:35:00",
            "open": 95, "high": 96, "low": 80, "close": 82,
            "volume": 1000,
        },
    ]

    strategy = StrategySpec(
        fast_ema=2,
        slow_ema=3,
        use_rsi_filter=False,
        trade_direction="SHORT",
        stop_loss_pct=10.0,
        take_profit_pct=10.0,
        trading_start="09:15",
        trading_end="15:15",
    )

    request = BacktestRequest(
        csv_data=make_csv(rows),
        strategy=strategy,
        initial_capital=10000,
        quantity=1,
        fee_per_order=0,
        slippage_bps=0,
    )

    result = run_backtest(request)
    assert result["trade_count"] >= 1
    trade = result["trades"][0]
    assert trade["side"] == "SHORT"
    assert trade["net_pnl"] > 0


def test_trailing_stop_execution():
    rows = [
        {
            "timestamp": "2025-01-06T09:15:00",
            "open": 105, "high": 106, "low": 104, "close": 105,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:20:00",
            "open": 105, "high": 105, "low": 102, "close": 103,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:25:00",
            "open": 103, "high": 103, "low": 99, "close": 100,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:30:00",
            "open": 100, "high": 116, "low": 100, "close": 115,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:35:00",
            "open": 115, "high": 125, "low": 114, "close": 124,
            "volume": 1000,
        },
        {
            "timestamp": "2025-01-06T09:40:00",
            "open": 124, "high": 124, "low": 110, "close": 112,
            "volume": 1000,
        },
    ]

    strategy = StrategySpec(
        fast_ema=2,
        slow_ema=3,
        use_rsi_filter=False,
        trade_direction="LONG",
        use_trailing_stop=True,
        trailing_stop_pct=5.0,  # 5% trailing from peak 125 is 118.75
        stop_loss_pct=20.0,
        take_profit_pct=50.0,
        trading_start="09:15",
        trading_end="15:15",
    )

    request = BacktestRequest(
        csv_data=make_csv(rows),
        strategy=strategy,
        initial_capital=10000,
        quantity=1,
        fee_per_order=0,
        slippage_bps=0,
    )

    result = run_backtest(request)
    assert result["trade_count"] >= 1
    assert any(trade["exit_reason"] == "trailing_stop" for trade in result["trades"])


def test_vwap_and_supertrend_filters():
    # Verify that backtest runs without error when filters are active
    strategy = StrategySpec(
        fast_ema=9,
        slow_ema=21,
        use_vwap_filter=True,
        use_supertrend_filter=True,
        supertrend_period=10,
        supertrend_multiplier=3.0,
    )
    request = BacktestRequest(strategy=strategy)
    result = run_backtest(request)
    assert "trades" in result
    assert result["initial_capital"] == 100000


def test_advanced_risk_metrics_computed():
    """Verify Sharpe, Sortino, and consecutive losses are returned in backtest output."""
    request = BacktestRequest()
    result = run_backtest(request)
    assert "sharpe_ratio" in result
    assert "sortino_ratio" in result
    assert "max_consecutive_losses" in result
    assert isinstance(result["max_consecutive_losses"], int)


def test_grid_search_api():
    """Verify Grid Search endpoint returns parameter matrix and best combinations."""
    grid_req = {
        "fast_ema_values": [5, 9],
        "slow_ema_values": [15, 21],
        "base_strategy": {
            "name": "Grid Test",
            "fast_ema": 9,
            "slow_ema": 21,
            "trading_start": "09:15",
            "trading_end": "15:15",
        },
        "initial_capital": 100000,
        "quantity": 1,
    }
    response = client.post("/api/grid-search", json=grid_req)
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert data["total_combinations"] == 4  # (5,15), (5,21), (9,15), (9,21)
    assert len(data["results"]) == 4
    for r in data["results"]:
        assert "fast_ema" in r
        assert "slow_ema" in r
        assert "net_pnl" in r
        assert "win_rate_pct" in r
    assert "best_by_pnl" in data
    assert "best_by_sharpe" in data


def test_market_data_cache():
    """Verify that repeat calls to fetch_indian_market_data hit cache."""
    from backend.app.market_data import fetch_indian_market_data, _DATA_CACHE
    sym = "^NSEI"
    csv1, df1 = fetch_indian_market_data(sym, period="5d", interval="15m")
    assert (sym, "5d", "15m") in _DATA_CACHE
    csv2, df2 = fetch_indian_market_data(sym, period="5d", interval="15m")
    assert len(df1) == len(df2)

