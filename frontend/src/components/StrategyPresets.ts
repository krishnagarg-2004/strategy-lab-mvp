export interface StrategyConfig {
    name: string;
    fast_ema: number;
    slow_ema: number;
    use_rsi_filter: boolean;
    rsi_period: number;
    rsi_min: number;
    stop_loss_pct: number;
    take_profit_pct: number;
    trading_start: string;
    trading_end: string;
    trade_direction: 'LONG' | 'SHORT' | 'BOTH';
    use_trailing_stop: boolean;
    trailing_stop_pct: number;
    use_vwap_filter: boolean;
    use_supertrend_filter: boolean;
    supertrend_period: number;
    supertrend_multiplier: number;
    use_regulatory_charges: boolean;
    brokerage_per_order: number;
}

export interface PresetDefinition {
    id: string;
    title: string;
    tagline: string;
    description: string;
    badge: string;
    config: Partial<StrategyConfig>;
}

export const STRATEGY_PRESETS: PresetDefinition[] = [
    {
        id: 'intraday_momentum',
        title: 'Intraday 9/21 Momentum Scalp',
        tagline: 'Fast EMA crossover + RSI confirmation for active intraday trends.',
        description: 'Enters when 9 EMA crosses 21 EMA with RSI > 55 confirmation. Uses tight 0.5% stop loss and 1.0% profit target with NSE regulatory cost deductions.',
        badge: 'Beginner Friendly',
        config: {
            name: 'Intraday 9/21 Momentum Scalp',
            fast_ema: 9,
            slow_ema: 21,
            use_rsi_filter: true,
            rsi_period: 14,
            rsi_min: 55,
            stop_loss_pct: 0.5,
            take_profit_pct: 1.0,
            trading_start: '09:20',
            trading_end: '15:10',
            trade_direction: 'LONG',
            use_trailing_stop: false,
            use_vwap_filter: false,
            use_supertrend_filter: false,
            use_regulatory_charges: true,
            brokerage_per_order: 20.0,
        },
    },
    {
        id: 'supertrend_trend_follower',
        title: 'Supertrend + VWAP Institutional Filter',
        tagline: 'Ride high-conviction trends above session VWAP with trailing stop.',
        description: 'Combines Supertrend (10, 3.0) direction with intraday VWAP. Only buys when price is above VWAP with a dynamic 0.75% trailing stop.',
        badge: 'Trend Following',
        config: {
            name: 'Supertrend + VWAP Trend Follower',
            fast_ema: 9,
            slow_ema: 21,
            use_rsi_filter: false,
            use_vwap_filter: true,
            use_supertrend_filter: true,
            supertrend_period: 10,
            supertrend_multiplier: 3.0,
            stop_loss_pct: 0.75,
            take_profit_pct: 2.0,
            trading_start: '09:30',
            trading_end: '15:15',
            trade_direction: 'LONG',
            use_trailing_stop: true,
            trailing_stop_pct: 0.75,
            use_regulatory_charges: true,
            brokerage_per_order: 20.0,
        },
    },
    {
        id: 'golden_cross',
        title: 'Classic 50/200 Swing Trend',
        tagline: 'The time-tested institutional trend-following benchmark.',
        description: 'Designed for multi-day swing holding. Enters when the 50-period EMA crosses above the 200-period EMA. Employs a wider 2.0% stop and 5.0% profit target.',
        badge: 'Swing Trading',
        config: {
            name: 'Classic 50/200 Swing Trend',
            fast_ema: 50,
            slow_ema: 200,
            use_rsi_filter: false,
            use_vwap_filter: false,
            use_supertrend_filter: false,
            stop_loss_pct: 2.0,
            take_profit_pct: 5.0,
            trading_start: '09:15',
            trading_end: '15:30',
            trade_direction: 'LONG',
            use_trailing_stop: false,
            use_regulatory_charges: true,
            brokerage_per_order: 20.0,
        },
    },
    {
        id: 'bidirectional_breakout',
        title: 'Bi-Directional Long & Short Scalper',
        tagline: 'Captures both bullish expansions and bearish intraday selloffs.',
        description: 'Trades both LONG on bullish crossovers and SHORT on bearish breakdowns. Ideal for volatile index options or future proxy intraday testing.',
        badge: 'Advanced',
        config: {
            name: 'Bi-Directional Long & Short Scalper',
            fast_ema: 8,
            slow_ema: 20,
            use_rsi_filter: true,
            rsi_period: 14,
            rsi_min: 50,
            stop_loss_pct: 0.6,
            take_profit_pct: 1.2,
            trading_start: '09:20',
            trading_end: '15:10',
            trade_direction: 'BOTH',
            use_trailing_stop: true,
            trailing_stop_pct: 0.5,
            use_regulatory_charges: true,
            brokerage_per_order: 20.0,
        },
    },
];
