from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_market_data_search():
    res = client.get("/api/market-data/search?q=nifty")
    assert res.status_code == 200
    data = res.json()
    assert "results" in data
    assert len(data["results"]) > 0
    symbols = [r["symbol"] for r in data["results"]]
    assert "^NSEI" in symbols or "^NSEBANK" in symbols


def test_market_data_quote():
    res = client.get("/api/market-data/quote/RELIANCE.NS")
    assert res.status_code == 200
    data = res.json()
    assert data["symbol"] == "RELIANCE.NS"
    assert "last_price" in data
    assert "change" in data
    assert "change_pct" in data


def test_market_data_batch_quotes():
    res = client.post("/api/market-data/quotes", json={"symbols": ["^NSEI", "TCS.NS"]})
    assert res.status_code == 200
    data = res.json()
    assert "quotes" in data
    assert len(data["quotes"]) == 2


def test_community_strategy_lifecycle():
    # 1. Publish
    payload = {
        "title": "Nifty Momentum 9/21",
        "description": "Clean intraday momentum strategy for Nifty 50 futures.",
        "author_name": "QuantRanger",
        "category": "Intraday",
        "tags": "nifty,momentum,scalping",
        "strategy": {
            "name": "Nifty Momentum 9/21",
            "fast_ema": 9,
            "slow_ema": 21,
            "use_rsi_filter": True,
            "rsi_period": 14,
            "rsi_min": 55,
            "stop_loss_pct": 0.5,
            "take_profit_pct": 1.0,
            "trading_start": "09:20",
            "trading_end": "15:10",
            "trade_direction": "LONG",
            "use_trailing_stop": False,
            "trailing_stop_pct": 0.5,
            "use_vwap_filter": False,
            "use_supertrend_filter": False,
            "supertrend_period": 10,
            "supertrend_multiplier": 3.0,
            "use_regulatory_charges": True,
            "brokerage_per_order": 20.0,
        },
        "verified_stats": {
            "symbol": "^NSEI",
            "return_pct": 18.5,
            "win_rate_pct": 62.0,
            "sharpe_ratio": 1.95,
            "max_drawdown_pct": -4.8,
        },
    }
    create_res = client.post("/api/community/strategies", json=payload)
    assert create_res.status_code == 200
    strat = create_res.json()["strategy"]
    strat_id = strat["id"]
    assert strat["title"] == "Nifty Momentum 9/21"

    # 2. List
    list_res = client.get("/api/community/strategies?tag=momentum")
    assert list_res.status_code == 200
    strats = list_res.json()["strategies"]
    assert any(s["id"] == strat_id for s in strats)

    # 3. Like
    like_res = client.post(f"/api/community/strategies/{strat_id}/like")
    assert like_res.status_code == 200
    assert like_res.json()["likes_count"] >= 1

    # 4. Fork
    fork_res = client.post(f"/api/community/strategies/{strat_id}/fork")
    assert fork_res.status_code == 200
    assert fork_res.json()["copies_count"] >= 1

    # 5. Comment
    comment_res = client.post(
        f"/api/community/strategies/{strat_id}/comments",
        json={"author_name": "Arjun", "comment": "Tested this on BankNifty with great results!"},
    )
    assert comment_res.status_code == 200
    assert comment_res.json()["comment"]["author_name"] == "Arjun"

    # 6. Detail
    detail_res = client.get(f"/api/community/strategies/{strat_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert len(detail["comments"]) >= 1
