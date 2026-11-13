from datetime import time
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrategySpec(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(default="EMA crossover", min_length=1, max_length=100)
    fast_ema: int = Field(default=9, ge=2, le=200)
    slow_ema: int = Field(default=21, ge=3, le=500)
    use_rsi_filter: bool = False
    rsi_period: int = Field(default=14, ge=2, le=100)
    rsi_min: float = Field(default=55, ge=0, le=100)
    stop_loss_pct: float = Field(default=0.5, gt=0, le=50, allow_inf_nan=False)
    take_profit_pct: float = Field(default=1.0, gt=0, le=100, allow_inf_nan=False)
    trading_start: str = "09:15"
    trading_end: str = "15:15"
    trade_direction: str = Field(default="LONG", pattern="^(LONG|SHORT|BOTH)$")
    use_trailing_stop: bool = False
    trailing_stop_pct: float = Field(default=0.5, gt=0, le=50, allow_inf_nan=False)
    use_vwap_filter: bool = False
    use_supertrend_filter: bool = False
    supertrend_period: int = Field(default=10, ge=2, le=100)
    supertrend_multiplier: float = Field(default=3.0, gt=0.1, le=20.0, allow_inf_nan=False)
    use_regulatory_charges: bool = True
    brokerage_per_order: float = Field(default=20.0, ge=0)

    @field_validator("trading_start", "trading_end")
    @classmethod
    def validate_time_format(cls, value: str) -> str:
        try:
            parsed = time.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("Time must use HH:MM format.") from exc

        if parsed.tzinfo is not None or parsed.second != 0 or parsed.microsecond != 0:
            raise ValueError("Time must use HH:MM format without a timezone.")

        if len(value) != 5:
            raise ValueError("Time must use HH:MM format.")

        return value

    @model_validator(mode="after")
    def validate_periods_and_times(self):
        if self.fast_ema >= self.slow_ema:
            raise ValueError("fast_ema must be smaller than slow_ema")

        if self.trading_start >= self.trading_end:
            raise ValueError("trading_start must be earlier than trading_end")

        return self


class BacktestRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    strategy: StrategySpec = Field(default_factory=StrategySpec)
    initial_capital: float = Field(default=100000, gt=0, allow_inf_nan=False)
    quantity: int = Field(default=1, ge=1, le=100000)
    fee_per_order: float = Field(default=20, ge=0, allow_inf_nan=False)
    slippage_bps: float = Field(default=2, ge=0, le=1000, allow_inf_nan=False)
    symbol: str = Field(default="DEMO", min_length=1, max_length=50)
    csv_data: Optional[str] = Field(default=None, max_length=10 * 1024 * 1024)
    market_symbol: Optional[str] = None
    market_period: Optional[str] = "1mo"
    market_interval: Optional[str] = "15m"

    @field_validator("symbol")
    @classmethod
    def validate_symbol(cls, value: str) -> str:
        if not value:
            raise ValueError("Instrument label cannot be empty.")
        return value

    @field_validator("csv_data")
    @classmethod
    def validate_csv_data(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and not value.strip():
            raise ValueError("CSV data cannot be empty.")
        return value


class MarketDataFetchRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    symbol: str = Field(default="^NSEI", min_length=1, max_length=50)
    period: str = Field(default="1mo", pattern="^(1d|5d|1mo|3mo|6mo|1y|2y|5y|max)$")
    interval: str = Field(default="15m", pattern="^(1m|2m|5m|15m|30m|60m|1h|1d)$")


class SaveExperimentRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: Optional[str] = Field(default=None, max_length=120)
    symbol: str
    data_source: str
    is_real_market_data: Optional[bool] = None
    strategy: Dict[str, Any]
    initial_capital: float
    final_equity: float
    net_pnl: float
    return_pct: float
    trade_count: int
    wins: int = 0
    losses: int = 0
    win_rate_pct: float
    profit_factor: Optional[float] = None
    max_drawdown_pct: float
    average_duration_minutes: float = 0.0
    strategy_fingerprint: Optional[str] = None
    trades: List[Dict[str, Any]] = Field(default_factory=list)
    equity_curve: List[Dict[str, Any]] = Field(default_factory=list)
    candles: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    assumptions: Optional[List[str]] = Field(default_factory=list)
    sharpe_ratio: Optional[float] = None
    sortino_ratio: Optional[float] = None
    max_consecutive_losses: int = 0


class GridSearchRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    fast_ema_values: List[int] = Field(default=[5, 9, 13, 21])
    slow_ema_values: List[int] = Field(default=[21, 34, 55, 89])
    base_strategy: StrategySpec = Field(default_factory=StrategySpec)
    initial_capital: float = Field(default=100000, gt=0)
    quantity: int = Field(default=1, ge=1)
    fee_per_order: float = Field(default=20, ge=0)
    slippage_bps: float = Field(default=2, ge=0)
    symbol: str = Field(default="DEMO")
    csv_data: Optional[str] = None
    market_symbol: Optional[str] = None
    market_period: Optional[str] = "1mo"
    market_interval: Optional[str] = "15m"


class MonteCarloRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    trades_pnl: List[float] = Field(..., min_length=2)
    initial_capital: float = Field(default=100000, gt=0)
    simulations: int = Field(default=1000, ge=100, le=5000)


class WalkForwardRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    strategy: StrategySpec = Field(default_factory=StrategySpec)
    initial_capital: float = Field(default=100000, gt=0)
    quantity: int = Field(default=1, ge=1)
    fee_per_order: float = Field(default=20, ge=0)
    slippage_bps: float = Field(default=2, ge=0)
    train_pct: float = Field(default=0.7, gt=0.2, lt=0.9)
    csv_data: Optional[str] = None
    market_symbol: Optional[str] = None
    market_period: Optional[str] = "3mo"
    market_interval: Optional[str] = "15m"



class PortfolioBacktestRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    symbols: List[str] = Field(default=["^NSEI", "RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS"])
    strategy: StrategySpec = Field(default_factory=StrategySpec)
    initial_capital_per_symbol: float = Field(default=100000, gt=0)
    quantity: int = Field(default=1, ge=1)
    fee_per_order: float = Field(default=20, ge=0)
    slippage_bps: float = Field(default=2, ge=0)
    market_period: Optional[str] = "1mo"
    market_interval: Optional[str] = "15m"



