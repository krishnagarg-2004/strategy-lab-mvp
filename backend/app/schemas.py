from pydantic import BaseModel, Field, model_validator
from typing import Optional

class StrategySpec(BaseModel):
    name: str = "EMA crossover"
    fast_ema: int = Field(default=9, ge=2, le=200)
    slow_ema: int = Field(default=21, ge=3, le=500)
    use_rsi_filter: bool = False
    rsi_period: int = Field(default=14, ge=2, le=100)
    rsi_min: float = Field(default=55, ge=0, le=100)
    stop_loss_pct: float = Field(default=0.5, gt=0, le=50)
    take_profit_pct: float = Field(default=1.0, gt=0, le=100)
    trading_start: str = "09:15"
    trading_end: str = "15:15"

    @model_validator(mode="after")
    def validate_periods(self):
        if self.fast_ema >= self.slow_ema:
            raise ValueError("fast_ema must be smaller than slow_ema")
        for field in ("trading_start", "trading_end"):
            value = getattr(self, field)
            try:
                hour, minute = map(int, value.split(":"))
                if not (0 <= hour <= 23 and 0 <= minute <= 59):
                    raise ValueError
            except Exception:
                raise ValueError(f"{field} must be HH:MM")
        if self.trading_start >= self.trading_end:
            raise ValueError("trading_start must be earlier than trading_end")
        return self

class BacktestRequest(BaseModel):
    strategy: StrategySpec = Field(default_factory=StrategySpec)
    initial_capital: float = Field(default=100000, gt=0)
    quantity: int = Field(default=1, ge=1, le=100000)
    fee_per_order: float = Field(default=20, ge=0)
    slippage_bps: float = Field(default=2, ge=0, le=1000)
    symbol: str = "DEMO"
    csv_data: Optional[str] = None
