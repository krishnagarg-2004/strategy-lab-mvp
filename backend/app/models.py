from datetime import datetime, timezone
import json
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
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


class CommunityStrategy(Base):
    __tablename__ = "community_strategies"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    title = Column(String(140), nullable=False)
    description = Column(Text, nullable=False)
    author_name = Column(String(80), default="Anonymous Quant", nullable=False)
    category = Column(String(50), default="Intraday", nullable=False)
    tags = Column(String(255), default="momentum,nifty", nullable=False)
    strategy_json = Column(Text, nullable=False)
    verified_stats_json = Column(Text, nullable=True)
    likes_count = Column(Integer, default=0, nullable=False)
    copies_count = Column(Integer, default=0, nullable=False)

    comments = relationship("StrategyComment", back_populates="strategy", cascade="all, delete-orphan")

    def to_summary_dict(self):
        strategy = json.loads(self.strategy_json) if self.strategy_json else {}
        verified_stats = json.loads(self.verified_stats_json) if self.verified_stats_json else None
        tag_list = [t.strip() for t in self.tags.split(",") if t.strip()]
        return {
            "id": self.id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "title": self.title,
            "description": self.description,
            "author_name": self.author_name,
            "category": self.category,
            "tags": tag_list,
            "strategy": strategy,
            "verified_stats": verified_stats,
            "likes_count": self.likes_count,
            "copies_count": self.copies_count,
            "comment_count": len(self.comments) if self.comments else 0,
        }

    def to_detail_dict(self):
        summary = self.to_summary_dict()
        summary["comments"] = [c.to_dict() for c in sorted(self.comments, key=lambda x: x.created_at or datetime.min, reverse=True)]
        return summary


class StrategyComment(Base):
    __tablename__ = "strategy_comments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    strategy_id = Column(Integer, ForeignKey("community_strategies.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    author_name = Column(String(80), default="Trader", nullable=False)
    comment = Column(Text, nullable=False)

    strategy = relationship("CommunityStrategy", back_populates="comments")

    def to_dict(self):
        return {
            "id": self.id,
            "strategy_id": self.strategy_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "author_name": self.author_name,
            "comment": self.comment,
        }
