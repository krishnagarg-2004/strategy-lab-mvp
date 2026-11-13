from datetime import datetime, timezone
import json
from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from .db import Base


class BacktestExperiment(Base):
    __tablename__ = "backtest_experiments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    name = Column(String(120), nullable=True)
    symbol = Column(String(50), nullable=False)
    data_source = Column(String(80), nullable=False)
    is_real_market_data = Column(String(20), nullable=True)
    initial_capital = Column(Float, nullable=False)
    final_equity = Column(Float, nullable=False)
    net_pnl = Column(Float, nullable=False)
    return_pct = Column(Float, nullable=False)
    trade_count = Column(Integer, nullable=False)
    wins = Column(Integer, nullable=False, default=0)
    losses = Column(Integer, nullable=False, default=0)
    win_rate_pct = Column(Float, nullable=False)
    profit_factor = Column(Float, nullable=True)
    max_drawdown_pct = Column(Float, nullable=False)
    average_duration_minutes = Column(Float, nullable=False, default=0.0)
    strategy_fingerprint = Column(String(32), nullable=True)
    strategy_json = Column(Text, nullable=False)
    trades_json = Column(Text, nullable=False)
    equity_curve_json = Column(Text, nullable=False)
    candles_json = Column(Text, nullable=True)
    assumptions_json = Column(Text, nullable=True)

    def to_summary_dict(self):
        strategy = json.loads(self.strategy_json) if self.strategy_json else {}
        return {
            "id": self.id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "name": self.name or f"{self.symbol} ({strategy.get('name', 'Strategy')})",
            "symbol": self.symbol,
            "data_source": self.data_source,
            "return_pct": self.return_pct,
            "net_pnl": self.net_pnl,
            "win_rate_pct": self.win_rate_pct,
            "trade_count": self.trade_count,
            "max_drawdown_pct": self.max_drawdown_pct,
            "profit_factor": self.profit_factor,
            "final_equity": self.final_equity,
            "initial_capital": self.initial_capital,
            "strategy": strategy,
        }

    def to_detail_dict(self):
        summary = self.to_summary_dict()
        summary.update({
            "wins": self.wins,
            "losses": self.losses,
            "average_duration_minutes": self.average_duration_minutes,
            "strategy_fingerprint": self.strategy_fingerprint,
            "is_real_market_data": (
                True if self.is_real_market_data == "true"
                else (False if self.is_real_market_data == "false" else None)
            ),
            "trades": json.loads(self.trades_json) if self.trades_json else [],
            "equity_curve": json.loads(self.equity_curve_json) if self.equity_curve_json else [],
            "candles": json.loads(self.candles_json) if self.candles_json else [],
            "assumptions": json.loads(self.assumptions_json) if self.assumptions_json else [],
        })
        return summary

