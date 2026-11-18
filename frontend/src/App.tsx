import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer,
    CartesianGrid,
} from 'recharts';
import CandlestickChart from './CandlestickChart';
import type { CandleData } from './CandlestickChart';
import { STRATEGY_PRESETS } from './components/StrategyPresets';
import type { StrategyConfig } from './components/StrategyPresets';
import { MetricCard, getSharpeRating, getProfitFactorRating, getDrawdownRating } from './components/MetricCard';
import { DemoDataNotice } from './components/DemoDataNotice';
import { WatchlistPanel } from './components/WatchlistPanel';
import { CommunityHub } from './components/CommunityHub';
import { AIChatDrawer } from './components/AIChatDrawer';
import { AuthModal } from './components/AuthModal';
import { LiveMarketTickerTape } from './components/LiveMarketTickerTape';
import { generateInstitutionalPDFReport } from './components/PDFReportGenerator';
import { getStoredUserProfile, type UserProfile } from './lib/supabase';

// In production on Render, direct API calls to the live backend URL
const API_BASE = (import.meta as any).env?.VITE_BACKEND_URL || (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com') ? 'https://strategy-lab-backend-dj9l.onrender.com' : '');

type Strategy = {
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
};

type Trade = {
    entry_time: string;
    exit_time: string;
    side?: 'LONG' | 'SHORT';
    entry_price: number;
    exit_price: number;
    quantity: number;
    points: number;
    net_pnl: number;
    duration_minutes: number;
    exit_reason: string;
};

type Result = {
    symbol: string;
    data_source: string;
    is_real_market_data: boolean | null;
    strategy: Strategy;
    strategy_fingerprint: string;
    initial_capital: number;
    final_equity: number;
    net_pnl: number;
    return_pct: number;
    trade_count: number;
    wins: number;
    losses: number;
    win_rate_pct: number;
    profit_factor: number | null;
    max_drawdown_pct: number;
    sharpe_ratio?: number | null;
    sortino_ratio?: number | null;
    max_consecutive_losses?: number;
    total_taxes_and_charges?: number;
    tax_summary?: {
        brokerage: number;
        stt: number;
        gst: number;
        exchange_charges: number;
        stamp_duty: number;
        sebi_charges: number;
        total: number;
    };
    average_duration_minutes: number;
    trades: Trade[];
    equity_curve: { timestamp: string; equity: number }[];
    candles?: CandleData[];
    assumptions: string[];
};

type ExperimentSummary = {
    id: number;
    created_at: string;
    name: string;
    symbol: string;
    data_source: string;
    return_pct: number;
    net_pnl: number;
    win_rate_pct: number;
    trade_count: number;
    max_drawdown_pct: number;
    profit_factor: number | null;
    final_equity: number;
    initial_capital: number;
    strategy: Strategy;
};

type PopularSymbol = {
    symbol: string;
    name: string;
    category: string;
};

type GridSearchResult = {
    fast_ema: number;
    slow_ema: number;
    net_pnl: number;
    return_pct: number;
    trade_count: number;
    win_rate_pct: number;
    profit_factor: number | null;
    max_drawdown_pct: number;
    sharpe_ratio: number | null;
    sortino_ratio: number | null;
};

type GridSearchData = {
    symbol: string;
    data_source: string;
    is_real_market_data: boolean;
    total_combinations: number;
    results: GridSearchResult[];
    best_by_pnl: GridSearchResult | null;
    best_by_sharpe: GridSearchResult | null;
    best_by_win_rate: GridSearchResult | null;
};

type PortfolioSymbolResult = {
    symbol: string;
    net_pnl: number;
    return_pct: number;
    trade_count: number;
    win_rate_pct: number;
    profit_factor: number | null;
    max_drawdown_pct: number;
    sharpe_ratio: number | null;
    error?: string;
};

type PortfolioBacktestData = {
    portfolio_symbols: string[];
    total_initial_capital: number;
    total_final_equity: number;
    portfolio_net_pnl: number;
    portfolio_return_pct: number;
    total_trades: number;
    wins: number;
    losses: number;
    win_rate_pct: number;
    symbol_breakdown: PortfolioSymbolResult[];
};

type MonteCarloData = {
    simulations_count: number;
    trades_count: number;
    initial_capital: number;
    median_final_equity: number;
    p05_final_equity: number;
    p95_final_equity: number;
    median_max_drawdown_pct: number;
    p95_max_drawdown_pct: number;
    p99_max_drawdown_pct: number;
    prob_unprofitable_pct: number;
    prob_drawdown_over_10_pct: number;
    prob_drawdown_over_20_pct: number;
    prob_drawdown_over_30_pct: number;
    fan_chart: {
        trade_step: number;
        p05: number;
        p25: number;
        p50_median: number;
        p75: number;
        p95: number;
    }[];
};

type WalkForwardData = {
    symbol: string;
    data_source: string;
    total_candles: number;
    train_candles: number;
    test_candles: number;
    train_date_range: { start: string; end: string };
    test_date_range: { start: string; end: string };
    in_sample: {
        return_pct: number;
        net_pnl: number;
        win_rate_pct: number;
        trade_count: number;
        profit_factor: number | null;
        max_drawdown_pct: number;
        sharpe_ratio: number | null;
        sortino_ratio: number | null;
    };
    out_of_sample: {
        return_pct: number;
        net_pnl: number;
        win_rate_pct: number;
        trade_count: number;
        profit_factor: number | null;
        max_drawdown_pct: number;
        sharpe_ratio: number | null;
        sortino_ratio: number | null;
    };
    robustness_ratio: number | null;
    is_overfitted: boolean;
};

type PaperTradingStatus = {
    is_active: boolean;
    started_at: string | null;
    symbol: string;
    initial_capital: number;
    cash_balance: number;
    equity: number;
    realized_pnl: number;
    unrealized_pnl: number;
    total_return_pct: number;
    open_position: {
        side: 'LONG' | 'SHORT';
        entry_time: string;
        entry_price: number;
        quantity: number;
        stop: number;
        target: number;
        highest_price?: number;
        lowest_price?: number;
        is_trailing?: boolean;
    } | null;
    last_candle_time: string | null;
    last_evaluated_price: number | null;
    trades_count: number;
    trades: any[];
    logs: { time: string; event: string; message: string }[];
    webhook_enabled: boolean;
};




const defaults: Strategy = {
    name: 'EMA crossover + Multi-Indicator',
    fast_ema: 9,
    slow_ema: 21,
    use_rsi_filter: true,
    rsi_period: 14,
    rsi_min: 55,
    stop_loss_pct: 0.5,
    take_profit_pct: 1,
    trading_start: '09:30',
    trading_end: '14:30',
    trade_direction: 'LONG',
    use_trailing_stop: false,
    trailing_stop_pct: 0.5,
    use_vwap_filter: false,
    use_supertrend_filter: false,
    supertrend_period: 10,
    supertrend_multiplier: 3.0,
    use_regulatory_charges: true,
    brokerage_per_order: 20.0,
};

const money = (n: number) =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
    }).format(n);

async function parseJsonResponse(response: Response) {
    const text = await response.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(
            `Backend returned an empty or invalid response (HTTP ${response.status} ${response.statusText}). Please verify the backend service is running.`,
        );
    }
    if (!response.ok) {
        throw new Error(
            typeof data?.detail === 'string'
                ? data.detail
                : `Request failed (HTTP ${response.status}): ${response.statusText || 'Backend error'}`,
        );
    }
    return data;
}

export default function App() {
    const [strategy, setStrategy] = useState<Strategy>(defaults);
    const [capital, setCapital] = useState(100000);
    const [qty, setQty] = useState(1);
    const [fee, setFee] = useState(20);
    const [slippage, setSlippage] = useState(2);
    const [symbol, setSymbol] = useState('NIFTY 50');
    const [result, setResult] = useState<Result | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    // Data Source State
    const [dataSourceMode, setDataSourceMode] = useState<
        'indian_market' | 'upload_csv' | 'synthetic_demo'
    >('indian_market');
    const [popularSymbols, setPopularSymbols] = useState<PopularSymbol[]>([
        { symbol: '^NSEI', name: 'NIFTY 50', category: 'Index' },
        { symbol: '^NSEBANK', name: 'BANK NIFTY', category: 'Index' },
        { symbol: 'RELIANCE.NS', name: 'Reliance Industries', category: 'Stock' },
        { symbol: 'TCS.NS', name: 'Tata Consultancy Services', category: 'Stock' },
        { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', category: 'Stock' },
        { symbol: 'INFY.NS', name: 'Infosys', category: 'Stock' },
        { symbol: 'TATAMOTORS.NS', name: 'Tata Motors', category: 'Stock' },
    ]);
    const [marketSymbol, setMarketSymbol] = useState('^NSEI');
    const [marketPeriod, setMarketPeriod] = useState('1mo');
    const [marketInterval, setMarketInterval] = useState('15m');
    const [marketFetching, setMarketFetching] = useState(false);
    const [marketFetchSuccess, setMarketFetchSuccess] = useState('');

    // CSV State
    const [csvData, setCsvData] = useState('');
    const [csvFileName, setCsvFileName] = useState('');

    // Chart View State
    const [activeChartTab, setActiveChartTab] = useState<'candlestick' | 'equity'>(
        'candlestick',
    );
    const [activeChartRange, setActiveChartRange] = useState<'1w' | '1m' | '3m' | 'all'>('all');
    const [showBuyHoldBenchmark, setShowBuyHoldBenchmark] = useState(false);

    // Theme Mode State ('dark' | 'light')
    const [theme, setTheme] = useState<'dark' | 'light'>(() => {
        return (localStorage.getItem('strategy_lab_theme') as 'dark' | 'light') || 'dark';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('strategy_lab_theme', theme);
    }, [theme]);

    // Collapsible Strategy Config Sections
    const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
        direction: true,
        dataSource: true,
        indicators: true,
        risk: true,
        taxes: true,
        account: true,
    });

    const toggleSection = (section: string) => {
        setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    // Database Experiments State
    const [experiments, setExperiments] = useState<ExperimentSummary[]>([]);
    const [showExperiments, setShowExperiments] = useState(false);
    const [compareExperimentIds, setCompareExperimentIds] = useState<number[]>([]);
    const [experimentName, setExperimentName] = useState('');
    const [saveStatus, setSaveStatus] = useState('');

    // Workspace View Tab & State (Phase 1, 2, 4 + Advanced)
    const [workspaceTab, setWorkspaceTab] = useState<'single' | 'watchlist' | 'community' | 'grid_search' | 'portfolio' | 'monte_carlo' | 'walk_forward' | 'paper_trading'>('single');
    const [selectedPresetId, setSelectedPresetId] = useState<string>('intraday_momentum');
    const [showAIChat, setShowAIChat] = useState(false);
    const [aiLoadedNotice, setAiLoadedNotice] = useState('');

    // User Authentication State (Supabase Auth)
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(getStoredUserProfile);
    const [showAuthModal, setShowAuthModal] = useState(false);

    const handleDownloadPDF = () => {
        if (!result) return;
        generateInstitutionalPDFReport({
            symbol: result.symbol,
            dataSource: result.data_source,
            isRealMarketData: result.is_real_market_data,
            strategy: result.strategy,
            initialCapital: result.initial_capital,
            finalEquity: result.final_equity,
            netPnl: result.net_pnl,
            returnPct: result.return_pct,
            tradeCount: result.trade_count,
            wins: result.wins,
            losses: result.losses,
            winRatePct: result.win_rate_pct,
            profitFactor: result.profit_factor,
            maxDrawdownPct: result.max_drawdown_pct,
            sharpeRatio: result.sharpe_ratio,
            sortinoRatio: result.sortino_ratio,
            maxConsecutiveLosses: result.max_consecutive_losses,
            totalTaxesAndCharges: result.total_taxes_and_charges,
            taxSummary: result.tax_summary,
            trades: result.trades,
            userName: currentUser?.name,
            userEmail: currentUser?.email,
        });
    };

    const handleSelectPreset = (presetId: string) => {
        setSelectedPresetId(presetId);
        if (presetId === 'custom') return;
        const found = STRATEGY_PRESETS.find((p) => p.id === presetId);
        if (found && found.config) {
            setStrategy((prev) => ({
                ...prev,
                ...found.config,
            }));
        }
    };

    const handleWatchlistSelectForBacktest = (sym: string) => {
        setMarketSymbol(sym);
        setSymbol(sym);
        setDataSourceMode('indian_market');
        setCsvData('');
        setCsvFileName('');
        setWorkspaceTab('single');
        // Trigger backtest with this symbol
        setTimeout(() => {
            fetchMarketDataAndRun(sym);
        }, 50);
    };

    const handleCopyStrategyToLab = (copiedStrat: StrategyConfig, sym?: string) => {
        setStrategy(copiedStrat);
        if (sym) {
            setMarketSymbol(sym);
            setSymbol(sym);
            setDataSourceMode('indian_market');
        }
        setWorkspaceTab('single');
    };

    const handleApplyAIStrategy = (compiledStrat: StrategyConfig, sym?: string) => {
        setStrategy(compiledStrat);
        setSelectedPresetId('custom');
        if (sym) {
            setMarketSymbol(sym);
            setSymbol(sym);
            setDataSourceMode('indian_market');
        }
        setWorkspaceTab('single');
        setAiLoadedNotice(`✓ AI Strategy "${compiledStrat.name}" loaded into Lab! Review settings and click Run Backtest.`);
        setTimeout(() => setAiLoadedNotice(''), 8000);
    };

    async function fetchMarketDataAndRun(sym: string) {
        setBusy(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/api/market-data/fetch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: sym,
                    period: marketPeriod,
                    interval: marketInterval,
                }),
            });
            const data = await parseJsonResponse(res);
            setCsvData(data.csv_data);
            setSymbol(data.symbol);
            setMarketFetchSuccess(`✓ Loaded ${data.candle_count} candles for ${data.symbol}`);

            const backtestRes = await fetch(`${API_BASE}/api/backtest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    strategy,
                    initial_capital: capital,
                    quantity: qty,
                    fee_per_order: fee,
                    slippage_bps: slippage,
                    symbol: data.symbol,
                    csv_data: data.csv_data,
                    market_period: marketPeriod,
                    market_interval: marketInterval,
                }),
            });
            const resultData = await parseJsonResponse(backtestRes);
            setResult(resultData as Result);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error testing symbol');
        } finally {
            setBusy(false);
        }
    }

    // Live Paper Trading State
    const [paperStatus, setPaperStatus] = useState<PaperTradingStatus | null>(null);
    const [paperBusy, setPaperBusy] = useState(false);
    const [webhookUrl, setWebhookUrl] = useState('');
    const [webhookEnabled, setWebhookEnabled] = useState(false);
    const [webhookPlatform, setWebhookPlatform] = useState<'generic' | 'discord' | 'telegram'>('discord');
    const [webhookTestStatus, setWebhookTestStatus] = useState('');


    // Monte Carlo State
    const [mcSimulations, setMcSimulations] = useState(1000);
    const [mcResults, setMcResults] = useState<MonteCarloData | null>(null);
    const [mcBusy, setMcBusy] = useState(false);

    // Walk Forward State
    const [wfTrainPct, setWfTrainPct] = useState(70);
    const [wfResults, setWfResults] = useState<WalkForwardData | null>(null);
    const [wfBusy, setWfBusy] = useState(false);


    // Grid Search State
    const [gridFastEmas, setGridFastEmas] = useState('5, 9, 13, 21');
    const [gridSlowEmas, setGridSlowEmas] = useState('21, 34, 55, 89');
    const [gridMetric, setGridMetric] = useState<'net_pnl' | 'sharpe_ratio' | 'win_rate_pct'>('sharpe_ratio');
    const [gridResults, setGridResults] = useState<GridSearchData | null>(null);
    const [gridBusy, setGridBusy] = useState(false);

    // Portfolio Watchlist State
    const [portfolioSelectedSymbols, setPortfolioSelectedSymbols] = useState<string[]>([
        '^NSEI',
        'RELIANCE.NS',
        'TCS.NS',
        'INFY.NS',
        'HDFCBANK.NS',
    ]);
    const [portfolioCapitalPerSymbol, setPortfolioCapitalPerSymbol] = useState(100000);
    const [portfolioResults, setPortfolioResults] = useState<PortfolioBacktestData | null>(null);
    const [portfolioBusy, setPortfolioBusy] = useState(false);


    // Fetch initial popular symbols & experiments list
    useEffect(() => {
        fetch(`${API_BASE}/api/market-data/symbols`)
            .then((res) => res.json())
            .then((data) => {
                if (data.symbols && Array.isArray(data.symbols)) {
                    setPopularSymbols(data.symbols);
                }
            })
            .catch(() => {});

        loadExperimentsList();
        loadPaperTradingStatus();
    }, []);

    async function loadPaperTradingStatus() {
        try {
            const res = await fetch(`${API_BASE}/api/paper-trading/status`);
            const data = await res.json();
            setPaperStatus(data as PaperTradingStatus);
        } catch {
            // non-blocking
        }
    }

    async function loadExperimentsList() {
        try {
            const res = await fetch(`${API_BASE}/api/experiments`);
            const data = await res.json();
            if (data.experiments && Array.isArray(data.experiments)) {
                setExperiments(data.experiments);
            }
        } catch {
            // non-blocking
        }
    }

    const update = (
        key: keyof Strategy,
        value: string | number | boolean,
    ) => {
        setStrategy((current) => ({ ...current, [key]: value }));
    };

    async function handleCsvUpload(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        event.target.value = '';

        if (!file.name.toLowerCase().endsWith('.csv')) {
            setError('Please select a CSV file.');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            setError('The CSV file must be smaller than 10 MB.');
            return;
        }

        try {
            const contents = await file.text();
            if (!contents.trim()) {
                throw new Error('The selected CSV file is empty.');
            }
            setCsvData(contents);
            setCsvFileName(file.name);
            setError('');
            setResult(null);
        } catch (e) {
            setError(
                e instanceof Error ? e.message : 'Could not read the CSV file.',
            );
        }
    }

    function clearCsv() {
        setCsvData('');
        setCsvFileName('');
        setError('');
        setResult(null);
    }

    async function handleFetchMarketData() {
        setMarketFetching(true);
        setError('');
        setMarketFetchSuccess('');

        try {
            const res = await fetch(`${API_BASE}/api/market-data/fetch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: marketSymbol,
                    period: marketPeriod,
                    interval: marketInterval,
                }),
            });

            const data = await parseJsonResponse(res);

            setCsvData(data.csv_data);
            setSymbol(data.symbol);
            setMarketFetchSuccess(
                `✓ Loaded ${data.candle_count} candles for ${data.symbol} (${data.period}, ${data.interval})`,
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error fetching market data.');
        } finally {
            setMarketFetching(false);
        }
    }

    async function run() {
        if (busy) return;

        setBusy(true);
        setError('');
        setSaveStatus('');

        try {
            let activeCsv = null;
            let activeMarketSymbol = null;

            if (dataSourceMode === 'upload_csv') {
                if (!csvData) {
                    throw new Error('Please select a CSV file to run backtest with.');
                }
                activeCsv = csvData;
            } else if (dataSourceMode === 'indian_market') {
                if (csvData) {
                    activeCsv = csvData;
                } else {
                    activeMarketSymbol = marketSymbol;
                }
            } // synthetic_demo passes null csv_data

            const response = await fetch(`${API_BASE}/api/backtest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    strategy,
                    initial_capital: capital,
                    quantity: qty,
                    fee_per_order: fee,
                    slippage_bps: slippage,
                    symbol: symbol || marketSymbol,
                    csv_data: activeCsv,
                    market_symbol: activeMarketSymbol,
                    market_period: marketPeriod,
                    market_interval: marketInterval,
                }),
            });

            const data = await parseJsonResponse(response);
            setResult(data as Result);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setBusy(false);
        }
    }

    async function runGridSearch() {
        setGridBusy(true);
        setError('');
        try {
            const fastList = gridFastEmas
                .split(',')
                .map((s) => parseInt(s.trim(), 10))
                .filter((n) => !isNaN(n) && n >= 2);
            const slowList = gridSlowEmas
                .split(',')
                .map((s) => parseInt(s.trim(), 10))
                .filter((n) => !isNaN(n) && n >= 3);

            if (fastList.length === 0 || slowList.length === 0) {
                throw new Error('Please enter valid numeric EMA lists.');
            }

            const response = await fetch(`${API_BASE}/api/grid-search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fast_ema_values: fastList,
                    slow_ema_values: slowList,
                    base_strategy: strategy,
                    initial_capital: capital,
                    quantity: qty,
                    fee_per_order: fee,
                    slippage_bps: slippage,
                    symbol: symbol || marketSymbol,
                    csv_data: dataSourceMode === 'upload_csv' ? csvData : (dataSourceMode === 'indian_market' && csvData ? csvData : null),
                    market_symbol: dataSourceMode === 'indian_market' && !csvData ? marketSymbol : null,
                    market_period: marketPeriod,
                    market_interval: marketInterval,
                }),
            });

            const data = await parseJsonResponse(response);
            setGridResults(data as GridSearchData);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Grid search failed');
        } finally {
            setGridBusy(false);
        }
    }

    async function runPortfolioBacktest() {
        setPortfolioBusy(true);
        setError('');
        try {
            if (portfolioSelectedSymbols.length === 0) {
                throw new Error('Please select at least one symbol for the portfolio.');
            }

            const response = await fetch(`${API_BASE}/api/portfolio-backtest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbols: portfolioSelectedSymbols,
                    strategy,
                    initial_capital_per_symbol: portfolioCapitalPerSymbol,
                    quantity: qty,
                    fee_per_order: fee,
                    slippage_bps: slippage,
                    market_period: marketPeriod,
                    market_interval: marketInterval,
                }),
            });

            const data = await parseJsonResponse(response);
            setPortfolioResults(data as PortfolioBacktestData);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Portfolio backtest failed');
        } finally {
            setPortfolioBusy(false);
        }
    }

    async function runMonteCarlo() {
        if (!result || result.trades.length < 2) {
            setError('Please run a backtest first that produces at least 2 trades before running Monte Carlo.');
            return;
        }
        setMcBusy(true);
        setError('');
        try {
            const tradePnls = result.trades.map((t) => t.net_pnl);
            const response = await fetch(`${API_BASE}/api/monte-carlo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trades_pnl: tradePnls,
                    initial_capital: capital,
                    simulations: mcSimulations,
                }),
            });
            const data = await parseJsonResponse(response);
            setMcResults(data as MonteCarloData);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Monte Carlo simulation failed');
        } finally {
            setMcBusy(false);
        }
    }

    async function runWalkForward() {
        setWfBusy(true);
        setError('');
        try {
            const response = await fetch(`${API_BASE}/api/walk-forward`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    strategy,
                    initial_capital: capital,
                    quantity: qty,
                    fee_per_order: fee,
                    slippage_bps: slippage,
                    train_pct: wfTrainPct / 100,
                    csv_data: dataSourceMode === 'upload_csv' ? csvData : (dataSourceMode === 'indian_market' && csvData ? csvData : null),
                    market_symbol: dataSourceMode === 'indian_market' && !csvData ? marketSymbol : null,
                    market_period: marketPeriod,
                    market_interval: marketInterval,
                }),
            });
            const data = await parseJsonResponse(response);
            setWfResults(data as WalkForwardData);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Walk-forward analysis failed');
        } finally {
            setWfBusy(false);
        }
    }

    async function handleStartPaperTrading() {
        setPaperBusy(true);
        setError('');
        try {
            const response = await fetch(`${API_BASE}/api/paper-trading/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: marketSymbol || symbol,
                    strategy,
                    initial_capital: capital,
                    quantity: qty,
                    webhook: {
                        webhook_url: webhookUrl,
                        enabled: webhookEnabled,
                        platform: webhookPlatform,
                    },
                }),
            });
            const data = await parseJsonResponse(response);
            setPaperStatus(data as PaperTradingStatus);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to start paper trading');
        } finally {
            setPaperBusy(false);
        }
    }

    async function handleStopPaperTrading() {
        setPaperBusy(true);
        try {
            const response = await fetch(`${API_BASE}/api/paper-trading/stop`, { method: 'POST' });
            const data = await parseJsonResponse(response);
            setPaperStatus(data as PaperTradingStatus);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to stop paper trading');
        } finally {
            setPaperBusy(false);
        }
    }

    async function handlePaperTradingTick(manualPrice?: number) {
        setPaperBusy(true);
        try {
            const response = await fetch(`${API_BASE}/api/paper-trading/tick`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ manual_price: manualPrice }),
            });
            const data = await parseJsonResponse(response);
            setPaperStatus(data as PaperTradingStatus);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Tick evaluation failed');
        } finally {
            setPaperBusy(false);
        }
    }

    async function handleTestWebhook() {
        if (!webhookUrl) {
            setWebhookTestStatus('Please enter a webhook URL first.');
            return;
        }
        setWebhookTestStatus('Sending test ping…');
        try {
            const res = await fetch(`${API_BASE}/api/paper-trading/webhook-test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    webhook_url: webhookUrl,
                    platform: webhookPlatform,
                    message: `Strategy Lab Webhook Verification: Connected to ${marketSymbol || symbol}`,
                }),
            });
            if (!res.ok) throw new Error('Webhook test ping failed.');
            setWebhookTestStatus('✓ Webhook ping delivered successfully!');
        } catch (e) {
            setWebhookTestStatus(`❌ Error: ${e instanceof Error ? e.message : 'Failed'}`);
        }
    }

    async function handleSaveExperiment() {
        if (!result) return;
        const nameToSave =
            experimentName.trim() ||
            `${result.symbol} ${result.strategy.fast_ema}/${result.strategy.slow_ema} (${result.return_pct}%)`;

        try {
            const res = await fetch(`${API_BASE}/api/experiments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: nameToSave,
                    symbol: result.symbol,
                    data_source: result.data_source,
                    is_real_market_data: result.is_real_market_data,
                    strategy: result.strategy,
                    initial_capital: result.initial_capital,
                    final_equity: result.final_equity,
                    net_pnl: result.net_pnl,
                    return_pct: result.return_pct,
                    trade_count: result.trade_count,
                    wins: result.wins,
                    losses: result.losses,
                    win_rate_pct: result.win_rate_pct,
                    profit_factor: result.profit_factor,
                    max_drawdown_pct: result.max_drawdown_pct,
                    average_duration_minutes: result.average_duration_minutes,
                    strategy_fingerprint: result.strategy_fingerprint,
                    trades: result.trades,
                    equity_curve: result.equity_curve,
                    candles: result.candles || [],
                    assumptions: result.assumptions,
                }),
            });

            if (!res.ok) throw new Error('Could not save experiment.');
            setSaveStatus('✓ Saved to database!');
            setExperimentName('');
            loadExperimentsList();
            setTimeout(() => setSaveStatus(''), 3000);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save experiment.');
        }
    }

    async function handleLoadExperiment(id: number) {
        try {
            const res = await fetch(`${API_BASE}/api/experiments/${id}`);
            if (!res.ok) throw new Error('Could not load experiment.');
            const data = await res.json();
            setResult(data as Result);
            if (data.strategy) {
                setStrategy(data.strategy);
            }
            if (data.symbol) {
                setSymbol(data.symbol);
            }
            if (data.initial_capital) {
                setCapital(data.initial_capital);
            }
            setShowExperiments(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load experiment.');
        }
    }

    async function handleDeleteExperiment(id: number, event: React.MouseEvent) {
        event.stopPropagation();
        try {
            const res = await fetch(`${API_BASE}/api/experiments/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Could not delete experiment.');
            setExperiments((prev) => prev.filter((exp) => exp.id !== id));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete experiment.');
        }
    }

    function exportTrades() {
        if (!result) return;

        const headers = [
            'side',
            'entry_time',
            'exit_time',
            'entry_price',
            'exit_price',
            'quantity',
            'points',
            'net_pnl',
            'duration_minutes',
            'exit_reason',
        ];

        const escapeCsv = (value: string | number) => {
            const text = String(value);
            return `"${text.replace(/"/g, '""')}"`;
        };

        const rows = [
            headers,
            ...result.trades.map((trade) => [
                trade.side || 'LONG',
                trade.entry_time,
                trade.exit_time,
                trade.entry_price,
                trade.exit_price,
                trade.quantity,
                trade.points,
                trade.net_pnl,
                trade.duration_minutes,
                trade.exit_reason,
            ]),
        ];

        const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
        const url = URL.createObjectURL(
            new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
        );
        const link = document.createElement('a');

        link.href = url;
        link.download = `strategy-lab-${result.symbol}-trades.csv`;
        link.click();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    const chartCandles = result?.candles ?? [];
    const latestChartTime = chartCandles.length
        ? chartCandles[chartCandles.length - 1].time
        : result?.equity_curve.length
            ? Math.floor(new Date(result.equity_curve[result.equity_curve.length - 1].timestamp).getTime() / 1000)
            : Math.floor(Date.now() / 1000);
    const chartRangeDays = activeChartRange === '1w' ? 7 : activeChartRange === '1m' ? 30 : activeChartRange === '3m' ? 90 : null;
    const chartCutoff = chartRangeDays === null ? -Infinity : latestChartTime - chartRangeDays * 86400;
    const visibleChartCandles = chartCandles.filter((candle) => candle.time >= chartCutoff);
    const visibleChartTrades = result?.trades.filter((trade) => Math.floor(new Date(trade.exit_time).getTime() / 1000) >= chartCutoff) ?? [];
    const visibleEquityCurve = result?.equity_curve.filter((point) => Math.floor(new Date(point.timestamp).getTime() / 1000) >= chartCutoff) ?? [];
    const visibleChartFirstClose = visibleChartCandles[0]?.close ?? 0;
    const visibleEquityStart = visibleEquityCurve[0]?.equity ?? 0;
    const chartCandleByTimestamp = new Map(visibleChartCandles.map((candle) => [candle.timestamp, candle]));
    const equityChartData = visibleEquityCurve.map((point) => {
        const candle = chartCandleByTimestamp.get(point.timestamp);
        return {
            ...point,
            equity: showBuyHoldBenchmark && visibleEquityStart > 0
                ? (result?.initial_capital ?? 0) * point.equity / visibleEquityStart
                : point.equity,
            benchmark: showBuyHoldBenchmark && candle && visibleChartFirstClose > 0
                ? (result?.initial_capital ?? 0) * candle.close / visibleChartFirstClose
                : undefined,
        };
    });
    const comparedExperiments = experiments.filter((experiment) => compareExperimentIds.includes(experiment.id));

    return (
        <main className="shell">
            <LiveMarketTickerTape
                apiBase={API_BASE}
                onSelectSymbol={handleWatchlistSelectForBacktest}
                theme={theme}
            />
            <header className="top">
                <div className="brand">
                    <div className="logo">SL</div>
                    <div>
                        <div className="brand-name">Strategy Lab</div>
                        <div className="sub">Quantitative Research & Execution Workspace</div>
                    </div>
                </div>
                <div className="top-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                        type="button"
                        className="ai-assistant-btn"
                        onClick={() => setShowAIChat(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'rgba(99, 223, 176, 0.12)',
                            border: '1px solid rgba(99, 223, 176, 0.35)',
                            color: 'var(--accent-positive)',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            fontWeight: 600,
                            fontSize: '12px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        <span>🤖</span> AI Strategy Assistant
                    </button>

                    <button
                        className="exp-badge"
                        onClick={() => setShowExperiments(true)}
                        title="View and restore saved backtest experiments"
                    >
                        Experiments ({experiments.length})
                    </button>

                    {currentUser ? (
                        <button
                            type="button"
                            className="auth-profile-btn"
                            onClick={() => setShowAuthModal(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'rgba(16, 185, 129, 0.12)',
                                border: '1px solid rgba(16, 185, 129, 0.35)',
                                color: 'var(--accent-positive)',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontWeight: 600,
                                fontSize: '12px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                            title={`Signed in as ${currentUser.email}`}
                        >
                            <span>✓</span> {currentUser.name || currentUser.email.split('@')[0]}
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="btn-outline"
                            onClick={() => setShowAuthModal(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                fontSize: '12px',
                                borderRadius: '6px',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <span>👤</span> Sign In
                        </button>
                    )}
                    <button
                        type="button"
                        className="theme-toggle-btn"
                        onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                        title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
                        aria-label="Toggle theme"
                    >
                        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </button>
                    <div className="status">
                        <span className="dot" /> SIMULATION
                    </div>
                </div>
            </header>

            {/* Dedicated Workspace Navigation Sub-Bar */}
            <nav className="workspace-nav-bar">
                <div className="tab-group" style={{ margin: 0 }}>
                    <button
                        type="button"
                        className={`tab-btn ${workspaceTab === 'single' ? 'active' : ''}`}
                        onClick={() => setWorkspaceTab('single')}
                    >
                        Single Run
                    </button>
                    <button
                        type="button"
                        className={`tab-btn ${workspaceTab === 'watchlist' ? 'active' : ''}`}
                        onClick={() => setWorkspaceTab('watchlist')}
                    >
                        Live Watchlist
                    </button>
                    <button
                        type="button"
                        className={`tab-btn ${workspaceTab === 'community' ? 'active' : ''}`}
                        onClick={() => setWorkspaceTab('community')}
                    >
                        Community Hub
                    </button>
                    <button
                        type="button"
                        className={`tab-btn ${workspaceTab === 'grid_search' ? 'active' : ''}`}
                        onClick={() => setWorkspaceTab('grid_search')}
                    >
                        Grid Search
                    </button>
                    <button
                        type="button"
                        className={`tab-btn ${workspaceTab === 'portfolio' ? 'active' : ''}`}
                        onClick={() => setWorkspaceTab('portfolio')}
                    >
                        Multi-Asset Batch
                    </button>
                    <button
                        type="button"
                        className={`tab-btn ${workspaceTab === 'monte_carlo' ? 'active' : ''}`}
                        onClick={() => setWorkspaceTab('monte_carlo')}
                    >
                        Monte Carlo
                    </button>
                    <button
                        type="button"
                        className={`tab-btn ${workspaceTab === 'walk_forward' ? 'active' : ''}`}
                        onClick={() => setWorkspaceTab('walk_forward')}
                    >
                        Walk-Forward (OOS)
                    </button>
                    <button
                        type="button"
                        className={`tab-btn ${workspaceTab === 'paper_trading' ? 'active' : ''}`}
                        onClick={() => setWorkspaceTab('paper_trading')}
                        style={{ borderColor: paperStatus?.is_active ? 'var(--emerald-primary)' : undefined }}
                    >
                        {paperStatus?.is_active ? '● Live Paper' : 'Paper Trading'}
                    </button>
                </div>
            </nav>

            <section className="workspace-strip">
                <div className="strip-title-group">
                    <h1 className="strip-title">Strategy Research & Execution Lab</h1>
                    <span className="strip-subtitle">Event-Driven Backtesting & Quantitative Risk Modeling · Indian Equities & Indices</span>
                </div>

                <div className="strip-badges">
                    <div className="strip-badge">
                        <span className="strip-badge-label">Active Symbol</span>
                        <span className="strip-badge-val">{symbol || marketSymbol || 'NIFTY 50'}</span>
                    </div>
                    <div className="strip-badge">
                        <span className="strip-badge-label">Timeframe</span>
                        <span className="strip-badge-val">{marketInterval} · {marketPeriod}</span>
                    </div>
                    <div className="strip-badge">
                        <span className="strip-badge-label">Starting Capital</span>
                        <span className="strip-badge-val">{money(capital)}</span>
                    </div>
                    <div className="strip-badge">
                        <span className="strip-badge-label">Engine Mode</span>
                        <span className="strip-badge-val highlight">Deterministic · SEBI Charges</span>
                    </div>
                </div>
            </section>

            {workspaceTab === 'single' && (
            <div className="layout animated-tab-enter">
                <aside className="panel config">
                    <div className="panel-heading">
                        <div>
                            <span className="eyebrow">01 / CONFIGURE</span>
                            <h2>Strategy rules</h2>
                        </div>
                        <span className="lock">RULES LOCKED TO INPUT</span>
                    </div>

                    <div className="strategy-preset-card">
                        <div className="preset-title-row">
                            <span className="eyebrow" style={{ fontSize: '10px' }}>CURATED STRATEGY PRESETS</span>
                            <span className="badge-good" style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}>
                                {STRATEGY_PRESETS.find((p) => p.id === selectedPresetId)?.badge || 'Curated'}
                            </span>
                        </div>
                        <select
                            value={selectedPresetId}
                            onChange={(e) => handleSelectPreset(e.target.value)}
                            style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px' }}
                        >
                            <option value="custom">⚙ Custom Parameters</option>
                            {STRATEGY_PRESETS.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.title}
                                </option>
                            ))}
                        </select>
                        {selectedPresetId !== 'custom' && (
                            <div className="preset-desc">
                                {STRATEGY_PRESETS.find((p) => p.id === selectedPresetId)?.tagline}
                            </div>
                        )}
                        <button
                            type="button"
                            className="btn-outline"
                            style={{
                                width: '100%',
                                marginTop: '10px',
                                padding: '6px 12px',
                                fontSize: '11px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                borderColor: 'rgba(99, 223, 176, 0.4)',
                                color: 'var(--accent-positive)',
                                fontWeight: 600,
                            }}
                            onClick={() => setShowAIChat(true)}
                        >
                            <span>🤖</span> Describe in Natural Language
                        </button>
                    </div>

                    {aiLoadedNotice && (
                        <div
                            style={{
                                background: 'rgba(99, 223, 176, 0.12)',
                                border: '1px solid rgba(99, 223, 176, 0.35)',
                                color: 'var(--accent-positive)',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                marginBottom: '14px',
                                lineHeight: 1.4,
                            }}
                        >
                            {aiLoadedNotice}
                        </div>
                    )}

                    <label>
                        Instrument label
                        <input
                            value={symbol}
                            onChange={(event) => setSymbol(event.target.value)}
                            placeholder="e.g. NIFTY 50, RELIANCE"
                        />
                    </label>

                    <div className="section-label">
                        <button
                            type="button"
                            className="section-header-btn"
                            onClick={() => toggleSection('direction')}
                            aria-expanded={openSections.direction}
                        >
                            <span>Trade Direction</span>
                            <span className={`chevron ${openSections.direction ? 'open' : ''}`}>▾</span>
                        </button>
                    </div>
                    {openSections.direction && (
                        <div className="section-content-animated">
                            <div className="tab-group">
                                <button
                                    type="button"
                                    className={`tab-btn ${strategy.trade_direction === 'LONG' ? 'active' : ''}`}
                                    onClick={() => update('trade_direction', 'LONG')}
                                >
                                    Long Only
                                </button>
                                <button
                                    type="button"
                                    className={`tab-btn ${strategy.trade_direction === 'SHORT' ? 'active' : ''}`}
                                    onClick={() => update('trade_direction', 'SHORT')}
                                >
                                    Short Only
                                </button>
                                <button
                                    type="button"
                                    className={`tab-btn ${strategy.trade_direction === 'BOTH' ? 'active' : ''}`}
                                    onClick={() => update('trade_direction', 'BOTH')}
                                >
                                    Both
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="section-label">
                        <button
                            type="button"
                            className="section-header-btn"
                            onClick={() => toggleSection('dataSource')}
                            aria-expanded={openSections.dataSource}
                        >
                            <span>Data Source</span>
                            <span className={`chevron ${openSections.dataSource ? 'open' : ''}`}>▾</span>
                        </button>
                    </div>

                    {openSections.dataSource && (
                        <div className="section-content-animated">
                            <div className="tab-group">
                                <button
                                    type="button"
                                    className={`tab-btn ${dataSourceMode === 'indian_market' ? 'active' : ''}`}
                                    onClick={() => {
                                        setDataSourceMode('indian_market');
                                        setCsvData('');
                                        setMarketFetchSuccess('');
                                    }}
                                >
                                    Indian Mkts
                                </button>
                                <button
                                    type="button"
                                    className={`tab-btn ${dataSourceMode === 'upload_csv' ? 'active' : ''}`}
                                    onClick={() => {
                                        setDataSourceMode('upload_csv');
                                        setMarketFetchSuccess('');
                                    }}
                                >
                                    Upload CSV
                                </button>
                                <button
                                    type="button"
                                    className={`tab-btn ${dataSourceMode === 'synthetic_demo' ? 'active' : ''}`}
                                    onClick={() => {
                                        setDataSourceMode('synthetic_demo');
                                        clearCsv();
                                        setMarketFetchSuccess('');
                                    }}
                                >
                                    Demo Data
                                </button>
                            </div>

                            {dataSourceMode === 'indian_market' && (
                                <div>
                                    <label>
                                        Select Indian Ticker
                                        <select
                                            className="market-select"
                                            value={marketSymbol}
                                            onChange={(e) => {
                                                setMarketSymbol(e.target.value);
                                                const found = popularSymbols.find(
                                                    (s) => s.symbol === e.target.value,
                                                );
                                                if (found) setSymbol(found.name);
                                            }}
                                        >
                                            {popularSymbols.map((item) => (
                                                <option key={item.symbol} value={item.symbol}>
                                                    {item.name} ({item.symbol})
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label style={{ marginTop: '8px' }}>
                                        Or Custom Symbol
                                        <input
                                            value={marketSymbol}
                                            onChange={(e) => setMarketSymbol(e.target.value)}
                                            placeholder="e.g. INFY.NS, ^NSEBANK"
                                        />
                                    </label>

                                    <div className="two" style={{ marginTop: '8px' }}>
                                        <label>
                                            Period
                                            <select
                                                className="market-select"
                                                value={marketPeriod}
                                                onChange={(e) => setMarketPeriod(e.target.value)}
                                            >
                                                <option value="5d">5 Days</option>
                                                <option value="1mo">1 Month</option>
                                                <option value="3mo">3 Months</option>
                                                <option value="6mo">6 Months</option>
                                                <option value="1y">1 Year</option>
                                            </select>
                                        </label>
                                        <label>
                                            Timeframe
                                            <select
                                                className="market-select"
                                                value={marketInterval}
                                                onChange={(e) => setMarketInterval(e.target.value)}
                                            >
                                                <option value="5m">5 Min</option>
                                                <option value="15m">15 Min</option>
                                                <option value="30m">30 Min</option>
                                                <option value="1h">1 Hour</option>
                                                <option value="1d">Daily</option>
                                            </select>
                                        </label>
                                    </div>

                                    <button
                                        type="button"
                                        className="fetch-btn"
                                        onClick={handleFetchMarketData}
                                        disabled={marketFetching}
                                    >
                                        {marketFetching
                                            ? 'Fetching from Yahoo Finance…'
                                            : '⚡ Fetch & Load Candles'}
                                    </button>

                                    {marketFetchSuccess && (
                                        <div className="rule-note" style={{ marginTop: '10px' }}>
                                            <span>✓</span>
                                            <p>{marketFetchSuccess}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {dataSourceMode === 'upload_csv' && (
                                <div>
                                    <label>
                                        Upload OHLCV CSV
                                        <input
                                            type="file"
                                            accept=".csv,text/csv"
                                            onChange={handleCsvUpload}
                                            disabled={busy}
                                        />
                                    </label>

                                    {csvFileName && (
                                        <div className="rule-note">
                                            <span>✓</span>
                                            <div>
                                                <p>
                                                    Selected: <b>{csvFileName}</b>
                                                </p>
                                                <button
                                                    type="button"
                                                    className="secondary"
                                                    onClick={clearCsv}
                                                    disabled={busy}
                                                >
                                                    Clear file
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <p className="metric-sub">
                                        Required columns: timestamp, open, high, low, close, volume.
                                    </p>
                                </div>
                            )}

                            {dataSourceMode === 'synthetic_demo' && (
                                <div className="rule-note">
                                    <span>i</span>
                                    <p>
                                        Using synthetic 5-minute demo candles across simulated IST sessions.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="section-label">
                        <button
                            type="button"
                            className="section-header-btn"
                            onClick={() => toggleSection('indicators')}
                            aria-expanded={openSections.indicators}
                        >
                            <span>Technical Indicators</span>
                            <span className={`chevron ${openSections.indicators ? 'open' : ''}`}>▾</span>
                        </button>
                    </div>

                    {openSections.indicators && (
                        <div className="section-content-animated">
                            <div className="two">
                                <label>
                                    Fast EMA
                                    <input
                                        type="number"
                                        min="2"
                                        value={strategy.fast_ema}
                                        onChange={(event) =>
                                            update('fast_ema', Number(event.target.value))
                                        }
                                    />
                                </label>
                                <label>
                                    Slow EMA
                                    <input
                                        type="number"
                                        min="3"
                                        value={strategy.slow_ema}
                                        onChange={(event) =>
                                            update('slow_ema', Number(event.target.value))
                                        }
                                    />
                                </label>
                            </div>

                            <label className="toggle-row">
                                <span>
                                    <b>RSI filter</b>
                                    <small>Only enter when RSI meets threshold</small>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={strategy.use_rsi_filter}
                                    onChange={(event) =>
                                        update('use_rsi_filter', event.target.checked)
                                    }
                                />
                            </label>

                            {strategy.use_rsi_filter && (
                                <div className="two">
                                    <label>
                                        RSI period
                                        <input
                                            type="number"
                                            min="2"
                                            value={strategy.rsi_period}
                                            onChange={(event) =>
                                                update('rsi_period', Number(event.target.value))
                                            }
                                        />
                                    </label>
                                    <label>
                                        Minimum RSI
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={strategy.rsi_min}
                                            onChange={(event) =>
                                                update('rsi_min', Number(event.target.value))
                                            }
                                        />
                                    </label>
                                </div>
                            )}

                            <label className="toggle-row" style={{ marginTop: '10px' }}>
                                <span>
                                    <b>Intraday VWAP filter</b>
                                    <small>Long above VWAP, Short below VWAP</small>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={strategy.use_vwap_filter}
                                    onChange={(event) =>
                                        update('use_vwap_filter', event.target.checked)
                                    }
                                />
                            </label>

                            <label className="toggle-row" style={{ marginTop: '10px' }}>
                                <span>
                                    <b>Supertrend filter</b>
                                    <small>Align with ATR trend direction</small>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={strategy.use_supertrend_filter}
                                    onChange={(event) =>
                                        update('use_supertrend_filter', event.target.checked)
                                    }
                                />
                            </label>

                            {strategy.use_supertrend_filter && (
                                <div className="two" style={{ marginTop: '8px' }}>
                                    <label>
                                        ATR Period
                                        <input
                                            type="number"
                                            min="2"
                                            value={strategy.supertrend_period}
                                            onChange={(event) =>
                                                update('supertrend_period', Number(event.target.value))
                                            }
                                        />
                                    </label>
                                    <label>
                                        Multiplier
                                        <input
                                            type="number"
                                            min="0.5"
                                            step="0.5"
                                            value={strategy.supertrend_multiplier}
                                            onChange={(event) =>
                                                update('supertrend_multiplier', Number(event.target.value))
                                            }
                                        />
                                    </label>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="section-label">
                        <button
                            type="button"
                            className="section-header-btn"
                            onClick={() => toggleSection('risk')}
                            aria-expanded={openSections.risk}
                        >
                            <span>Risk & Execution</span>
                            <span className={`chevron ${openSections.risk ? 'open' : ''}`}>▾</span>
                        </button>
                    </div>

                    {openSections.risk && (
                        <div className="section-content-animated">
                            <div className="two">
                                <label>
                                    Stop loss (%)
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.1"
                                        value={strategy.stop_loss_pct}
                                        onChange={(event) =>
                                            update('stop_loss_pct', Number(event.target.value))
                                        }
                                    />
                                </label>
                                <label>
                                    Take profit (%)
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.1"
                                        value={strategy.take_profit_pct}
                                        onChange={(event) =>
                                            update('take_profit_pct', Number(event.target.value))
                                        }
                                    />
                                </label>
                            </div>

                            <label className="toggle-row" style={{ marginTop: '10px' }}>
                                <span>
                                    <b>Trailing Stop-Loss</b>
                                    <small>Trail stop price behind peak favorable price</small>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={strategy.use_trailing_stop}
                                    onChange={(event) =>
                                        update('use_trailing_stop', event.target.checked)
                                    }
                                />
                            </label>

                            {strategy.use_trailing_stop && (
                                <label style={{ marginTop: '8px' }}>
                                    Trailing distance (%)
                                    <input
                                        type="number"
                                        min="0.05"
                                        step="0.1"
                                        value={strategy.trailing_stop_pct}
                                        onChange={(event) =>
                                            update('trailing_stop_pct', Number(event.target.value))
                                        }
                                    />
                                </label>
                            )}

                            <div className="two">
                                <label>
                                    Start time (IST)
                                    <input
                                        type="time"
                                        value={strategy.trading_start}
                                        onChange={(event) =>
                                            update('trading_start', event.target.value)
                                        }
                                    />
                                </label>
                                <label>
                                    End time (IST)
                                    <input
                                        type="time"
                                        value={strategy.trading_end}
                                        onChange={(event) =>
                                            update('trading_end', event.target.value)
                                        }
                                    />
                                </label>
                            </div>
                        </div>
                    )}

                    <div className="section-label">
                        <button
                            type="button"
                            className="section-header-btn"
                            onClick={() => toggleSection('taxes')}
                            aria-expanded={openSections.taxes}
                        >
                            <span>Indian Taxes & Charges</span>
                            <span className={`chevron ${openSections.taxes ? 'open' : ''}`}>▾</span>
                        </button>
                    </div>

                    {openSections.taxes && (
                        <div className="section-content-animated">
                            <label className="toggle-row">
                                <span>
                                    <b>Real Indian Charges (STT & GST)</b>
                                    <small>SEBI, STT (0.025%), GST (18%), Stamp Duty</small>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={strategy.use_regulatory_charges}
                                    onChange={(event) =>
                                        update('use_regulatory_charges', event.target.checked)
                                    }
                                />
                            </label>

                            <label style={{ marginTop: '8px' }}>
                                Brokerage per order leg (₹)
                                <input
                                    type="number"
                                    min="0"
                                    value={strategy.brokerage_per_order}
                                    onChange={(event) =>
                                        update('brokerage_per_order', Number(event.target.value))
                                    }
                                    placeholder="20 (e.g. Zerodha/Groww)"
                                />
                            </label>
                        </div>
                    )}

                    <div className="section-label">
                        <button
                            type="button"
                            className="section-header-btn"
                            onClick={() => toggleSection('account')}
                            aria-expanded={openSections.account}
                        >
                            <span>Virtual Account Capital</span>
                            <span className={`chevron ${openSections.account ? 'open' : ''}`}>▾</span>
                        </button>
                    </div>

                    {openSections.account && (
                        <div className="section-content-animated">
                            <label>
                                Starting capital (₹)
                                <input
                                    type="number"
                                    min="1"
                                    value={capital}
                                    onChange={(event) => setCapital(Number(event.target.value))}
                                />
                            </label>

                            <div className="two">
                                <label>
                                    Quantity (shares)
                                    <input
                                        type="number"
                                        min="1"
                                        value={qty}
                                        onChange={(event) => setQty(Number(event.target.value))}
                                    />
                                </label>
                                <label>
                                    Fee per order (₹)
                                    <input
                                        type="number"
                                        min="0"
                                        value={fee}
                                        onChange={(event) => setFee(Number(event.target.value))}
                                    />
                                </label>
                            </div>

                            <label>
                                Slippage (basis points)
                                <input
                                    type="number"
                                    min="0"
                                    value={slippage}
                                    onChange={(event) => setSlippage(Number(event.target.value))}
                                />
                            </label>
                        </div>
                    )}

                    <div className="rule-note">
                        <span>i</span>
                        <p>
                            Execution rules are deterministic. The engine will not add
                            indicators or alter your settings.
                        </p>
                    </div>

                    <button className="run" onClick={run} disabled={busy}>
                        {busy ? 'Running simulation…' : '▶  Run backtest'}
                    </button>

                    {error && <div className="error">{error}</div>}
                </aside>

                <section className="results">
                    <div className="panel result-head">
                        <div>
                            <span className="eyebrow">02 / RESULTS</span>
                            <h2>{result ? result.symbol : 'Your performance report'}</h2>
                            <p>
                                {result
                                    ? `${result.trade_count} completed trades · ${result.data_source}`
                                    : 'Run a backtest to generate your report.'}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="btn-outline"
                                disabled={!result}
                                onClick={handleDownloadPDF}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    borderColor: 'var(--brand-primary)',
                                    color: 'var(--brand-primary)',
                                    fontWeight: 600,
                                }}
                                title="Download institutional-grade PDF research fact sheet"
                            >
                                <span>📄</span> Download Fact Sheet (PDF)
                            </button>
                            <button
                                className="secondary"
                                disabled={!result}
                                onClick={exportTrades}
                            >
                                ↓ Export trades CSV
                            </button>
                        </div>
                    </div>

                    {result && (
                        <div className="save-exp-box" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <input
                                className="save-exp-input"
                                placeholder={`Name this run (e.g. ${result.symbol} Fast ${result.strategy.fast_ema})`}
                                value={experimentName}
                                onChange={(e) => setExperimentName(e.target.value)}
                            />
                            <button
                                className="secondary"
                                style={{
                                    background: 'var(--emerald-surface)',
                                    color: 'var(--emerald-primary)',
                                    borderColor: 'var(--emerald-border)',
                                    fontWeight: 600,
                                }}
                                onClick={handleSaveExperiment}
                            >
                                Save Run to Database
                            </button>
                            <button
                                type="button"
                                className="btn-outline"
                                style={{ borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)', fontWeight: 600 }}
                                onClick={() => setWorkspaceTab('community')}
                                title="Share this verified backtest with the community"
                            >
                                🚀 Share to Community
                            </button>
                            {saveStatus && (
                                <span
                                    style={{
                                        color: 'var(--emerald-primary)',
                                        fontSize: '11px',
                                        alignSelf: 'center',
                                    }}
                                >
                                    {saveStatus}
                                </span>
                            )}
                        </div>
                    )}

                    {result && (
                        <DemoDataNotice
                            dataSource={result.data_source}
                            isRealMarketData={result.is_real_market_data}
                            symbol={result.symbol}
                            onSwitchToRealData={() => {
                                setDataSourceMode('indian_market');
                                setCsvData('');
                                setCsvFileName('');
                                handleFetchMarketData();
                            }}
                        />
                    )}

                    <div className="metrics">
                        <MetricCard
                            label="Net P&L"
                            value={result ? money(result.net_pnl) : '—'}
                            sub={result ? `${result.return_pct}% return` : 'Waiting for run'}
                            positive={!!result && result.net_pnl >= 0}
                            ratingBadge={result ? { text: result.net_pnl >= 0 ? '🟢 Profit' : '🔴 Net Loss', tone: result.net_pnl >= 0 ? 'good' : 'bad' } : undefined}
                        />
                        <MetricCard
                            label="Win rate"
                            value={result ? `${result.win_rate_pct}%` : '—'}
                            sub={
                                result
                                    ? `${result.wins}W / ${result.losses}L`
                                    : 'Awaiting trades'
                            }
                            positive={!!result && result.win_rate_pct >= 50}
                        />
                        <MetricCard
                            label="Profit factor"
                            value={
                                result
                                    ? result.profit_factor !== null
                                        ? String(result.profit_factor)
                                        : '∞'
                                    : '—'
                            }
                            sub={
                                result
                                    ? result.profit_factor && result.profit_factor >= 1.5
                                        ? 'Healthy Edge'
                                        : 'Caution'
                                    : 'Gross Win / Gross Loss'
                            }
                            ratingBadge={result ? getProfitFactorRating(result.profit_factor) : undefined}
                        />
                        <MetricCard
                            label="Max drawdown"
                            value={result ? `${result.max_drawdown_pct}%` : '—'}
                            sub={result ? 'Peak-to-trough drop' : 'Risk metric'}
                            positive={!!result && result.max_drawdown_pct < 10}
                            ratingBadge={result ? getDrawdownRating(result.max_drawdown_pct) : undefined}
                        />
                        <MetricCard
                            label="Sharpe Ratio"
                            value={result && result.sharpe_ratio !== undefined && result.sharpe_ratio !== null ? String(result.sharpe_ratio) : '—'}
                            sub={result ? 'Risk-adjusted annual return' : 'Annualized'}
                            positive={!!result && (result.sharpe_ratio ?? 0) >= 1.0}
                            ratingBadge={result ? getSharpeRating(result.sharpe_ratio) : undefined}
                        />
                        <MetricCard
                            label="Sortino / Consec"
                            value={result && result.sortino_ratio !== undefined && result.sortino_ratio !== null ? `${result.sortino_ratio} / ${result.max_consecutive_losses ?? 0}` : '—'}
                            sub={result ? `Downside risk / Max L streak: ${result.max_consecutive_losses ?? 0}` : 'Sortino / Max L streak'}
                            positive={!!result && (result.sortino_ratio ?? 0) >= 1.5}
                        />
                        <MetricCard
                            label="Taxes & Charges"
                            value={result && result.total_taxes_and_charges !== undefined ? money(result.total_taxes_and_charges) : '—'}
                            sub={result?.tax_summary ? `STT: ${money(result.tax_summary.stt)} | GST: ${money(result.tax_summary.gst)}` : 'Govt & exchange levies'}
                            positive={false}
                        />
                    </div>

                    <div className="panel chart-panel">
                        <div className="chart-header-row">
                            <div className="chart-title">
                                <div>
                                    <h3>
                                        {activeChartTab === 'candlestick'
                                            ? 'Candlestick Chart & Trade Signals'
                                            : 'Simulated Equity Curve'}
                                    </h3>
                                    <p>
                                        {activeChartTab === 'candlestick'
                                            ? 'Interactive TradingView price action with BUY & EXIT markers'
                                            : showBuyHoldBenchmark
                                                ? 'Strategy equity indexed to range start · benchmark excludes fees'
                                                : 'Cash plus closed-trade mark-to-market'}
                                    </p>
                                </div>
                            </div>
                            <div className="chart-tabs">
                                <button
                                    className={`chart-tab-btn ${activeChartTab === 'candlestick' ? 'active' : ''}`}
                                    onClick={() => setActiveChartTab('candlestick')}
                                >
                                    Candlesticks & Signals
                                </button>
                                <button
                                    className={`chart-tab-btn ${activeChartTab === 'equity' ? 'active' : ''}`}
                                    onClick={() => setActiveChartTab('equity')}
                                >
                                    Equity Curve
                                </button>
                            </div>
                            <div className="chart-range" role="group" aria-label="Chart date range">
                                {(['1w', '1m', '3m', 'all'] as const).map((range) => (
                                    <button
                                        key={range}
                                        type="button"
                                        className={`chart-range-btn ${activeChartRange === range ? 'active' : ''}`}
                                        aria-pressed={activeChartRange === range}
                                        onClick={() => setActiveChartRange(range)}
                                    >
                                        {range === 'all' ? 'All' : range.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                            {activeChartTab === 'equity' && (
                                <button
                                    type="button"
                                    className={`benchmark-toggle ${showBuyHoldBenchmark ? 'active' : ''}`}
                                    aria-pressed={showBuyHoldBenchmark}
                                    disabled={!visibleChartCandles.length}
                                    title={visibleChartCandles.length ? 'Compare with a buy-and-hold return using the selected range; excludes trading charges' : 'Benchmark requires candlestick data'}
                                    onClick={() => setShowBuyHoldBenchmark((value) => !value)}
                                >
                                    Buy &amp; hold
                                </button>
                            )}
                        </div>

                        {result ? (
                            activeChartTab === 'candlestick' &&
                            visibleChartCandles.length > 0 ? (
                                <CandlestickChart
                                    candles={visibleChartCandles}
                                    trades={visibleChartTrades}
                                    theme={theme}
                                />
                            ) : (
                                <div className="chart">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart
                                            data={equityChartData.filter(
                                                (_, index, array) =>
                                                    index %
                                                        Math.max(
                                                            1,
                                                            Math.floor(array.length / 180),
                                                        ) ===
                                                    0,
                                            )}
                                            margin={{ top: 8, right: 10, bottom: 0, left: 0 }}
                                        >
                                            <CartesianGrid
                                                strokeDasharray="3 3"
                                                stroke="#243044"
                                            />
                                            <XAxis
                                                dataKey="timestamp"
                                                tickFormatter={(value) =>
                                                    new Date(value).toLocaleDateString(
                                                        'en-IN',
                                                        {
                                                            day: '2-digit',
                                                            month: 'short',
                                                        },
                                                    )
                                                }
                                                tick={{ fill: '#8390a5', fontSize: 11 }}
                                                minTickGap={28}
                                            />
                                            <YAxis
                                                domain={['auto', 'auto']}
                                                tick={{ fill: '#8390a5', fontSize: 11 }}
                                                tickFormatter={(value) =>
                                                    `₹${Math.round(value / 1000)}k`
                                                }
                                                width={54}
                                            />
                                            <Tooltip
                                                labelFormatter={(value) =>
                                                    new Date(String(value)).toLocaleString(
                                                        'en-IN',
                                                    )
                                                }
                                                formatter={(value, name) => [
                                                    money(Number(value)),
                                                    name === 'Buy & hold (price only)' ? 'Buy & hold (price only)' : 'Strategy equity',
                                                ]}
                                                contentStyle={{
                                                    background: 'var(--surface-dropdown)',
                                                    border: '1px solid var(--border-panel)',
                                                    borderRadius: 8,
                                                    color: 'var(--text-primary)',
                                                    boxShadow: 'var(--shadow-md)',
                                                }}
                                            />
                                            {showBuyHoldBenchmark && <Legend />}
                                            <Line
                                                type="monotone"
                                                dataKey="equity"
                                                name="Strategy equity"
                                                stroke="#63dfb0"
                                                strokeWidth={2}
                                                dot={false}
                                                activeDot={{ r: 4 }}
                                            />
                                            {showBuyHoldBenchmark && (
                                                <Line
                                                    type="monotone"
                                                    dataKey="benchmark"
                                                    name="Buy & hold (price only)"
                                                    stroke="#38bdf8"
                                                    strokeWidth={1.5}
                                                    strokeDasharray="5 4"
                                                    dot={false}
                                                    activeDot={{ r: 3 }}
                                                />
                                            )}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )
                        ) : (
                            <div className={`empty-chart ${busy ? 'is-running' : ''}`} aria-live="polite">
                                <div className={`chart-placeholder ${busy ? 'is-running' : ''}`} aria-hidden="true">
                                    {Array.from({ length: 12 }, (_, index) => (
                                        <span key={index} />
                                    ))}
                                </div>
                                <p>{busy ? 'Running your simulation…' : 'Your first performance report starts here'}</p>
                                <small>{busy ? 'Evaluating candles and applying fees' : 'Review your data and strategy settings, then generate a report'}</small>
                                {!busy && (
                                    <button type="button" className="btn-outline empty-chart-action" onClick={run}>
                                        Run first backtest
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bottom-grid">
                        <div className="panel">
                            <div className="table-head">
                                <div>
                                    <h3>Trade ledger</h3>
                                    <p>Every simulated entry and exit</p>
                                </div>
                                <span className="count">
                                    {result?.trades.length ?? 0} TRADES
                                </span>
                            </div>

                            <div className="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>SIDE</th>
                                            <th>ENTRY</th>
                                            <th>EXIT</th>
                                            <th>ENTRY PRICE</th>
                                            <th>NET P&L</th>
                                            <th>EXIT REASON</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result?.trades
                                            .slice(-12)
                                            .reverse()
                                            .map((trade, index) => (
                                                <tr key={trade.entry_time + index}>
                                                    <td>
                                                        <span
                                                            className={
                                                                trade.side === 'SHORT'
                                                                    ? 'badge-short'
                                                                    : 'badge-long'
                                                            }
                                                        >
                                                            {trade.side || 'LONG'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {new Date(trade.entry_time).toLocaleString(
                                                            'en-IN',
                                                            {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            },
                                                        )}
                                                    </td>
                                                    <td>
                                                        {new Date(trade.exit_time).toLocaleString(
                                                            'en-IN',
                                                            {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            },
                                                        )}
                                                    </td>
                                                    <td>₹{trade.entry_price.toFixed(2)}</td>
                                                    <td
                                                        className={
                                                            trade.net_pnl >= 0 ? 'good' : 'bad'
                                                        }
                                                    >
                                                        {money(trade.net_pnl)}
                                                    </td>
                                                    <td>
                                                        <span className="reason">
                                                            {trade.exit_reason.replace('_', ' ')}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>

                                {result && result.trades.length === 0 && (
                                    <div className="no-trades">
                                        No trades were triggered with these settings and data.
                                    </div>
                                )}

                                {!result && (
                                    <div className="no-trades">
                                        Your trades will appear after the first run.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="panel summary">
                            <h3>Run details</h3>
                            <p>Exact configuration and assumptions used by the engine.</p>

                            {result ? (
                                <>
                                    <div className="detail">
                                        <span>Strategy</span>
                                        <b>{result.strategy.name}</b>
                                    </div>
                                    <div className="detail">
                                        <span>EMA crossover</span>
                                        <b>
                                            {result.strategy.fast_ema} /{' '}
                                            {result.strategy.slow_ema}
                                        </b>
                                    </div>
                                    <div className="detail">
                                        <span>RSI filter</span>
                                        <b>
                                            {result.strategy.use_rsi_filter
                                                ? `On · ≥ ${result.strategy.rsi_min}`
                                                : 'Off'}
                                        </b>
                                    </div>
                                    <div className="detail">
                                        <span>Avg. duration</span>
                                        <b>{result.average_duration_minutes} min</b>
                                    </div>
                                    <div className="detail">
                                        <span>Final equity</span>
                                        <b>{money(result.final_equity)}</b>
                                    </div>
                                    {result.tax_summary && (
                                        <div style={{ marginTop: '12px', padding: '10px', background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                                            <b style={{ color: 'var(--text-secondary)', fontSize: '11px', display: 'block', marginBottom: '6px' }}>
                                                Statutory Indian Tax Breakdown
                                            </b>
                                            <div className="detail"><span>Brokerage</span><b>{money(result.tax_summary.brokerage)}</b></div>
                                            <div className="detail"><span>STT / CTT (0.025%)</span><b>{money(result.tax_summary.stt)}</b></div>
                                            <div className="detail"><span>GST (18%)</span><b>{money(result.tax_summary.gst)}</b></div>
                                            <div className="detail"><span>Exchange Charges</span><b>{money(result.tax_summary.exchange_charges)}</b></div>
                                            <div className="detail"><span>Stamp Duty</span><b>{money(result.tax_summary.stamp_duty)}</b></div>
                                            <div className="detail"><span>SEBI Turnover</span><b>{money(result.tax_summary.sebi_charges)}</b></div>
                                            <div className="detail" style={{ borderBottom: 0, fontWeight: 700, color: 'var(--rose-primary)' }}>
                                                <span>Total Taxes Paid</span>
                                                <b>{money(result.tax_summary.total)}</b>
                                            </div>
                                        </div>
                                    )}
                                    <div className="assumptions">
                                        <b>Execution assumptions</b>
                                        <ul>
                                            {result.assumptions.map((assumption) => (
                                                <li key={assumption}>{assumption}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </>
                            ) : (
                                <div className="no-trades">
                                    The engine assumptions and run details will be displayed
                                    here.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="integrity">
                        <span className="integrity-icon">✓</span>
                        <div>
                            <b>Strategy integrity enabled</b>
                            <p>
                                AI recommendations are not connected to execution. Only the
                                validated strategy configuration above is run.
                            </p>
                        </div>
                    </div>
                </section>
            </div>
            )}

            {/* Live Indian Markets Watchlist View */}
            {workspaceTab === 'watchlist' && (
                <WatchlistPanel
                    apiBase={API_BASE}
                    onSelectSymbolForBacktest={handleWatchlistSelectForBacktest}
                    theme={theme}
                />
            )}

            {/* Community Strategy Sharing & Exploration View */}
            {workspaceTab === 'community' && (
                <CommunityHub
                    apiBase={API_BASE}
                    currentStrategy={strategy}
                    currentUser={currentUser}
                    onOpenAuth={() => setShowAuthModal(true)}
                    latestVerifiedStats={
                        result
                            ? {
                                  symbol: result.symbol,
                                  return_pct: result.return_pct,
                                  win_rate_pct: result.win_rate_pct,
                                  sharpe_ratio: result.sharpe_ratio,
                                  max_drawdown_pct: result.max_drawdown_pct,
                              }
                            : null
                    }
                    onCopyStrategyToLab={handleCopyStrategyToLab}
                />
            )}

            {/* Phase 3: Grid Search Optimization View */}
            {workspaceTab === 'grid_search' && (
                <section className="results animated-tab-enter" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
                    <div className="panel result-head">
                        <div>
                            <span className="eyebrow">PHASE 3 / PARAMETER OPTIMIZATION</span>
                            <h2>Fast EMA × Slow EMA Optimization Grid</h2>
                            <p>Sweep parameter combinations on {dataSourceMode === 'indian_market' ? marketSymbol : (symbol || 'Demo Data')} to identify robust parameter clusters.</p>
                        </div>
                        <button className="run" onClick={runGridSearch} disabled={gridBusy} style={{ padding: '10px 24px' }}>
                            {gridBusy ? 'Sweeping parameter grid…' : '⚡ Run Grid Search'}
                        </button>
                    </div>

                    <div className="panel" style={{ marginTop: '16px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 240px' }}>
                            <label>
                                Fast EMA candidate values (comma-separated)
                                <input
                                    value={gridFastEmas}
                                    onChange={(e) => setGridFastEmas(e.target.value)}
                                    placeholder="5, 9, 13, 21"
                                />
                            </label>
                        </div>
                        <div style={{ flex: '1 1 240px' }}>
                            <label>
                                Slow EMA candidate values (comma-separated)
                                <input
                                    value={gridSlowEmas}
                                    onChange={(e) => setGridSlowEmas(e.target.value)}
                                    placeholder="21, 34, 55, 89"
                                />
                            </label>
                        </div>
                        <div style={{ flex: '1 1 200px' }}>
                            <label>
                                Heatmap Metric
                                <select
                                    value={gridMetric}
                                    onChange={(e) => setGridMetric(e.target.value as any)}
                                >
                                    <option value="sharpe_ratio">Sharpe Ratio (Risk-Adjusted)</option>
                                    <option value="net_pnl">Net P&L (₹)</option>
                                    <option value="win_rate_pct">Win Rate (%)</option>
                                </select>
                            </label>
                        </div>
                    </div>

                    {gridResults && (
                        <>
                            <div className="metrics" style={{ marginTop: '16px' }}>
                                <Metric
                                    label="Best by Sharpe Ratio"
                                    value={gridResults.best_by_sharpe ? `${gridResults.best_by_sharpe.fast_ema} / ${gridResults.best_by_sharpe.slow_ema}` : '—'}
                                    sub={gridResults.best_by_sharpe?.sharpe_ratio ? `Sharpe ${gridResults.best_by_sharpe.sharpe_ratio}` : 'No positive Sharpe'}
                                    positive={true}
                                />
                                <Metric
                                    label="Best by Net P&L"
                                    value={gridResults.best_by_pnl ? money(gridResults.best_by_pnl.net_pnl) : '—'}
                                    sub={gridResults.best_by_pnl ? `Fast ${gridResults.best_by_pnl.fast_ema} / Slow ${gridResults.best_by_pnl.slow_ema}` : '—'}
                                    positive={!!gridResults.best_by_pnl && gridResults.best_by_pnl.net_pnl >= 0}
                                />
                                <Metric
                                    label="Best Win Rate"
                                    value={gridResults.best_by_win_rate ? `${gridResults.best_by_win_rate.win_rate_pct}%` : '—'}
                                    sub={gridResults.best_by_win_rate ? `Fast ${gridResults.best_by_win_rate.fast_ema} / Slow ${gridResults.best_by_win_rate.slow_ema}` : '—'}
                                    positive={true}
                                />
                                <Metric
                                    label="Permutations Tested"
                                    value={String(gridResults.total_combinations)}
                                    sub={gridResults.symbol}
                                    positive={true}
                                />
                            </div>

                            <div className="panel" style={{ marginTop: '16px' }}>
                                <h3>Parameter Heatmap Matrix</h3>
                                <p style={{ fontSize: '12px', color: '#8594a8', marginBottom: '16px' }}>
                                    Green indicates higher performance; red/dark indicates underperformance or losses.
                                </p>
                                <div className="table-wrap">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Fast \ Slow EMA</th>
                                                {Array.from(new Set(gridResults.results.map((r) => r.slow_ema)))
                                                    .sort((a, b) => a - b)
                                                    .map((s) => (
                                                        <th key={s}>Slow {s}</th>
                                                    ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Array.from(new Set(gridResults.results.map((r) => r.fast_ema)))
                                                .sort((a, b) => a - b)
                                                .map((f) => {
                                                    const slowCols = Array.from(
                                                        new Set(gridResults.results.map((r) => r.slow_ema)),
                                                    ).sort((a, b) => a - b);
                                                    return (
                                                        <tr key={f}>
                                                            <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Fast {f}</td>
                                                            {slowCols.map((s) => {
                                                                const cell = gridResults.results.find(
                                                                    (r) => r.fast_ema === f && r.slow_ema === s,
                                                                );
                                                                if (!cell) {
                                                                    return (
                                                                        <td key={s} style={{ color: '#4b5563' }}>
                                                                            —
                                                                        </td>
                                                                    );
                                                                }
                                                                const val =
                                                                    gridMetric === 'sharpe_ratio'
                                                                        ? cell.sharpe_ratio ?? 0
                                                                        : gridMetric === 'net_pnl'
                                                                        ? cell.net_pnl
                                                                        : cell.win_rate_pct;
                                                                const isGood =
                                                                    gridMetric === 'sharpe_ratio'
                                                                        ? (cell.sharpe_ratio ?? 0) > 0
                                                                        : gridMetric === 'net_pnl'
                                                                        ? cell.net_pnl > 0
                                                                        : cell.win_rate_pct >= 50;

                                                                return (
                                                                    <td
                                                                        key={s}
                                                                        style={{
                                                                            backgroundColor: isGood
                                                                                ? 'rgba(99, 223, 176, 0.12)'
                                                                                : 'rgba(239, 68, 68, 0.12)',
                                                                            color: isGood ? '#63dfb0' : '#f87171',
                                                                            fontWeight: 600,
                                                                            cursor: 'pointer',
                                                                        }}
                                                                        onClick={() => {
                                                                            update('fast_ema', cell.fast_ema);
                                                                            update('slow_ema', cell.slow_ema);
                                                                            setWorkspaceTab('single');
                                                                        }}
                                                                        title={`Click to load into Single Run: Fast ${cell.fast_ema}, Slow ${cell.slow_ema}\nNet P&L: ₹${cell.net_pnl}\nTrades: ${cell.trade_count}\nWin Rate: ${cell.win_rate_pct}%`}
                                                                    >
                                                                        {gridMetric === 'net_pnl'
                                                                            ? money(cell.net_pnl)
                                                                            : gridMetric === 'sharpe_ratio'
                                                                            ? cell.sharpe_ratio !== null
                                                                                ? String(cell.sharpe_ratio)
                                                                                : '—'
                                                                            : `${cell.win_rate_pct}%`}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </section>
            )}

            {workspaceTab === 'portfolio' && (
                <section className="results animated-tab-enter" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
                    <div className="panel result-head">
                        <div>
                            <span className="eyebrow">PHASE 3 / PORTFOLIO WATCHLIST</span>
                            <h2>Indian Market Watchlist Batch Backtest</h2>
                            <p>Run your strategy simultaneously across multiple Indian equities to evaluate overall portfolio diversification and returns.</p>
                        </div>
                        <button className="run" onClick={runPortfolioBacktest} disabled={portfolioBusy} style={{ padding: '10px 24px' }}>
                            {portfolioBusy ? 'Simulating portfolio…' : '⚡ Run Portfolio Test'}
                        </button>
                    </div>

                    <div className="panel" style={{ marginTop: '16px' }}>
                        <div className="section-label">SELECT PORTFOLIO STOCKS & INDICES</div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '12px 0' }}>
                            {popularSymbols.map((item) => {
                                const selected = portfolioSelectedSymbols.includes(item.symbol);
                                return (
                                    <button
                                        key={item.symbol}
                                        type="button"
                                        className={`chip-btn ${selected ? 'active' : ''}`}
                                        style={{ padding: '6px 14px' }}
                                        onClick={() => {
                                            if (selected) {
                                                setPortfolioSelectedSymbols((prev) =>
                                                    prev.filter((s) => s !== item.symbol),
                                                );
                                            } else {
                                                setPortfolioSelectedSymbols((prev) => [...prev, item.symbol]);
                                            }
                                        }}
                                    >
                                        {selected ? '✓ ' : '+ '}
                                        {item.name} ({item.symbol})
                                    </button>
                                );
                            })}
                        </div>

                        <div className="two" style={{ marginTop: '16px' }}>
                            <label>
                                Virtual Capital Per Stock (₹)
                                <input
                                    type="number"
                                    value={portfolioCapitalPerSymbol}
                                    onChange={(e) => setPortfolioCapitalPerSymbol(Number(e.target.value))}
                                />
                            </label>
                            <label>
                                Active Strategy Configuration
                                <input
                                    disabled
                                    value={`${strategy.trade_direction} | Fast EMA ${strategy.fast_ema} / Slow ${strategy.slow_ema} | SL ${strategy.stop_loss_pct}% / TP ${strategy.take_profit_pct}%`}
                                />
                            </label>
                        </div>
                    </div>

                    {portfolioResults && (
                        <>
                            <div className="metrics" style={{ marginTop: '16px' }}>
                                <Metric
                                    label="Portfolio Net P&L"
                                    value={money(portfolioResults.portfolio_net_pnl)}
                                    sub={`${portfolioResults.portfolio_return_pct}% Total Return`}
                                    positive={portfolioResults.portfolio_net_pnl >= 0}
                                />
                                <Metric
                                    label="Portfolio Win Rate"
                                    value={`${portfolioResults.win_rate_pct}%`}
                                    sub={`${portfolioResults.wins}W / ${portfolioResults.losses}L`}
                                    positive={portfolioResults.win_rate_pct >= 50}
                                />
                                <Metric
                                    label="Total Trades"
                                    value={String(portfolioResults.total_trades)}
                                    sub={`Across ${portfolioResults.portfolio_symbols.length} tickers`}
                                    positive={true}
                                />
                                <Metric
                                    label="Total Portfolio Equity"
                                    value={money(portfolioResults.total_final_equity)}
                                    sub={`From ${money(portfolioResults.total_initial_capital)}`}
                                    positive={portfolioResults.total_final_equity >= portfolioResults.total_initial_capital}
                                />
                            </div>

                            <div className="panel" style={{ marginTop: '16px' }}>
                                <h3>Per-Symbol Breakdown</h3>
                                <div className="table-wrap">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>SYMBOL</th>
                                                <th>TRADES</th>
                                                <th>WIN RATE</th>
                                                <th>PROFIT FACTOR</th>
                                                <th>MAX DD</th>
                                                <th>SHARPE</th>
                                                <th>NET P&L</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {portfolioResults.symbol_breakdown.map((row) => (
                                                <tr key={row.symbol}>
                                                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{row.symbol}</td>
                                                    <td>{row.trade_count}</td>
                                                    <td>{row.win_rate_pct}%</td>
                                                    <td>{row.profit_factor !== null && row.profit_factor !== undefined ? String(row.profit_factor) : '—'}</td>
                                                    <td>{row.max_drawdown_pct}%</td>
                                                    <td>{row.sharpe_ratio !== null && row.sharpe_ratio !== undefined ? String(row.sharpe_ratio) : '—'}</td>
                                                    <td className={row.net_pnl >= 0 ? 'good' : 'bad'} style={{ fontWeight: 700 }}>
                                                        {money(row.net_pnl)} ({row.return_pct}%)
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </section>
            )}

            {/* Advanced: Live Paper Trading & Real-Time Alert Engine */}
            {workspaceTab === 'monte_carlo' && (
                <section className="results animated-tab-enter" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
                    <div className="panel result-head">
                        <div>
                            <span className="eyebrow">ROBUSTNESS / MONTE CARLO STRESS TEST</span>
                            <h2>Sequence Risk & Risk of Ruin Analysis</h2>
                            <p>Bootstrap resamples trade returns across thousands of random sequences to uncover catastrophic tail risk and clustering drawdowns.</p>
                        </div>
                        <button className="run" onClick={runMonteCarlo} disabled={mcBusy} style={{ padding: '10px 24px' }}>
                            {mcBusy ? 'Simulating paths…' : 'Run Monte Carlo'}
                        </button>
                    </div>

                    <div className="panel" style={{ marginTop: '16px', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ flex: '1 1 200px' }}>
                            <label>
                                Number of Simulated Paths
                                <input
                                    type="number"
                                    min="100"
                                    max="5000"
                                    value={mcSimulations}
                                    onChange={(e) => setMcSimulations(Number(e.target.value))}
                                />
                            </label>
                        </div>
                        <div style={{ flex: '2 1 300px' }}>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                                Based on trades from the active backtest run:{' '}
                                <b style={{ color: 'var(--emerald-primary)' }}>
                                    {result ? `${result.trades.length} completed trades (${result.symbol})` : 'No backtest run yet. Run a single test first!'}
                                </b>
                            </p>
                        </div>
                    </div>

                    {mcResults && (
                        <>
                            <div className="metrics" style={{ marginTop: '16px' }}>
                                <Metric
                                    label="Median Final Equity (P50)"
                                    value={money(mcResults.median_final_equity)}
                                    sub={`Range: ${money(mcResults.p05_final_equity)} (P5) — ${money(mcResults.p95_final_equity)} (P95)`}
                                    positive={mcResults.median_final_equity >= mcResults.initial_capital}
                                />
                                <Metric
                                    label="Tail Max DD (P95 / P99)"
                                    value={`${mcResults.p95_max_drawdown_pct}% / ${mcResults.p99_max_drawdown_pct}%`}
                                    sub={`Median DD: ${mcResults.median_max_drawdown_pct}%`}
                                    positive={mcResults.p95_max_drawdown_pct < 20}
                                />
                                <Metric
                                    label="Prob. of Unprofitable Run"
                                    value={`${mcResults.prob_unprofitable_pct}%`}
                                    sub="Chance of ending below starting capital"
                                    positive={mcResults.prob_unprofitable_pct < 15}
                                />
                                <Metric
                                    label="Risk of Severe DD (>20%)"
                                    value={`${mcResults.prob_drawdown_over_20_pct}%`}
                                    sub={`>10% DD: ${mcResults.prob_drawdown_over_10_pct}% | >30% DD: ${mcResults.prob_drawdown_over_30_pct}%`}
                                    positive={mcResults.prob_drawdown_over_20_pct < 5}
                                />
                            </div>

                            <div className="panel chart-panel" style={{ marginTop: '16px' }}>
                                <div className="chart-title">
                                    <div>
                                        <h3>Simulated Monte Carlo Fan Chart</h3>
                                        <p>Percentile equity bands over trade sequence: P95 (Optimistic), P50 (Median), P05 (Conservative Tail Risk)</p>
                                    </div>
                                </div>
                                <div className="chart" style={{ height: '320px', marginTop: '16px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={mcResults.fan_chart}>
                                            <CartesianGrid stroke="#1e2c3d" strokeDasharray="3 3" />
                                            <XAxis dataKey="trade_step" stroke="#5a6c82" tick={{ fontSize: 10 }} />
                                            <YAxis stroke="#5a6c82" domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'var(--surface-dropdown)', borderColor: 'var(--border-panel)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                                formatter={(val: any) => [money(Number(val)), '']}
                                            />
                                            <Line type="monotone" dataKey="p95" stroke="#38bdf8" strokeWidth={1.5} dot={false} name="95th Percentile" />
                                            <Line type="monotone" dataKey="p75" stroke="#63dfb0" strokeWidth={1} dot={false} name="75th Percentile" />
                                            <Line type="monotone" dataKey="p50_median" stroke="#10b981" strokeWidth={2.5} dot={false} name="50th Median" />
                                            <Line type="monotone" dataKey="p25" stroke="#fbbf24" strokeWidth={1} dot={false} name="25th Percentile" />
                                            <Line type="monotone" dataKey="p05" stroke="#ef4444" strokeWidth={1.5} dot={false} name="5th Percentile (Tail)" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </>
                    )}
                </section>
            )}

            {workspaceTab === 'walk_forward' && (
                <section className="results animated-tab-enter" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
                    <div className="panel result-head">
                        <div>
                            <span className="eyebrow">OVERFITTING DETECTION / WALK-FORWARD</span>
                            <h2>In-Sample (Train) vs. Out-of-Sample (Test) Validation</h2>
                            <p>Splits historical candles into a training period and a forward unseen test period to prove whether rules generalize or are overfitted.</p>
                        </div>
                        <button className="run" onClick={runWalkForward} disabled={wfBusy} style={{ padding: '10px 24px' }}>
                            {wfBusy ? 'Testing unseen data…' : 'Run Walk-Forward Split'}
                        </button>
                    </div>

                    <div className="panel" style={{ marginTop: '16px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 200px' }}>
                            <label>
                                In-Sample Training Split ({wfTrainPct}% Train / {100 - wfTrainPct}% Test)
                                <input
                                    type="range"
                                    min="30"
                                    max="85"
                                    step="5"
                                    value={wfTrainPct}
                                    onChange={(e) => setWfTrainPct(Number(e.target.value))}
                                />
                            </label>
                        </div>
                        <div style={{ flex: '2 1 300px' }}>
                            <p style={{ fontSize: '12px', color: '#8594a8', margin: 0 }}>
                                Evaluating instrument: <b style={{ color: '#63dfb0' }}>{dataSourceMode === 'indian_market' ? marketSymbol : (symbol || 'Demo Data')}</b>
                                <br />
                                Parameter configuration: Fast {strategy.fast_ema} / Slow {strategy.slow_ema} ({strategy.trade_direction})
                            </p>
                        </div>
                    </div>

                    {wfResults && (
                        <>
                            <div className="metrics" style={{ marginTop: '16px' }}>
                                <Metric
                                    label="Overfitting Diagnosis"
                                    value={wfResults.is_overfitted ? '⚠️ OVERFITTED' : '✓ ROBUST'}
                                    sub={wfResults.is_overfitted ? 'Degrades severely on unseen data' : 'Positive performance sustained'}
                                    positive={!wfResults.is_overfitted}
                                />
                                <Metric
                                    label="Walk-Forward Efficiency (WFE)"
                                    value={wfResults.robustness_ratio !== null ? `${(wfResults.robustness_ratio * 100).toFixed(1)}%` : '—'}
                                    sub="Out-of-sample return ÷ In-sample return"
                                    positive={wfResults.robustness_ratio !== null && wfResults.robustness_ratio >= 0.5}
                                />
                                <Metric
                                    label="In-Sample Return (Train)"
                                    value={`${wfResults.in_sample.return_pct}%`}
                                    sub={`${money(wfResults.in_sample.net_pnl)} (${wfResults.train_candles} candles)`}
                                    positive={wfResults.in_sample.net_pnl >= 0}
                                />
                                <Metric
                                    label="Out-of-Sample Return (Test)"
                                    value={`${wfResults.out_of_sample.return_pct}%`}
                                    sub={`${money(wfResults.out_of_sample.net_pnl)} (${wfResults.test_candles} candles)`}
                                    positive={wfResults.out_of_sample.net_pnl >= 0}
                                />
                            </div>

                            <div className="two" style={{ marginTop: '16px' }}>
                                <div className="panel" style={{ padding: '20px' }}>
                                    <h3 style={{ color: '#93c5fd', margin: '0 0 4px' }}>In-Sample Period (Training)</h3>
                                    <p style={{ fontSize: '11px', color: '#8594a8', marginBottom: '14px' }}>
                                        {new Date(wfResults.train_date_range.start).toLocaleDateString()} to {new Date(wfResults.train_date_range.end).toLocaleDateString()}
                                    </p>
                                    <div className="detail"><span>Net P&L</span><b>{money(wfResults.in_sample.net_pnl)}</b></div>
                                    <div className="detail"><span>Return</span><b>{wfResults.in_sample.return_pct}%</b></div>
                                    <div className="detail"><span>Win Rate</span><b>{wfResults.in_sample.win_rate_pct}%</b></div>
                                    <div className="detail"><span>Total Trades</span><b>{wfResults.in_sample.trade_count}</b></div>
                                    <div className="detail"><span>Profit Factor</span><b>{wfResults.in_sample.profit_factor ?? '—'}</b></div>
                                    <div className="detail"><span>Max Drawdown</span><b>{wfResults.in_sample.max_drawdown_pct}%</b></div>
                                    <div className="detail"><span>Sharpe Ratio</span><b>{wfResults.in_sample.sharpe_ratio ?? '—'}</b></div>
                                </div>

                                <div className="panel" style={{ padding: '20px', borderColor: wfResults.is_overfitted ? '#ef4444' : '#22c55e' }}>
                                    <h3 style={{ color: wfResults.is_overfitted ? '#f87171' : '#63dfb0', margin: '0 0 4px' }}>
                                        Out-of-Sample Period (Unseen Test)
                                    </h3>
                                    <p style={{ fontSize: '11px', color: '#8594a8', marginBottom: '14px' }}>
                                        {new Date(wfResults.test_date_range.start).toLocaleDateString()} to {new Date(wfResults.test_date_range.end).toLocaleDateString()}
                                    </p>
                                    <div className="detail"><span>Net P&L</span><b>{money(wfResults.out_of_sample.net_pnl)}</b></div>
                                    <div className="detail"><span>Return</span><b>{wfResults.out_of_sample.return_pct}%</b></div>
                                    <div className="detail"><span>Win Rate</span><b>{wfResults.out_of_sample.win_rate_pct}%</b></div>
                                    <div className="detail"><span>Total Trades</span><b>{wfResults.out_of_sample.trade_count}</b></div>
                                    <div className="detail"><span>Profit Factor</span><b>{wfResults.out_of_sample.profit_factor ?? '—'}</b></div>
                                    <div className="detail"><span>Max Drawdown</span><b>{wfResults.out_of_sample.max_drawdown_pct}%</b></div>
                                    <div className="detail"><span>Sharpe Ratio</span><b>{wfResults.out_of_sample.sharpe_ratio ?? '—'}</b></div>
                                </div>
                            </div>
                        </>
                    )}
                </section>
            )}

            {/* Advanced: Live Paper Trading & Real-Time Alert Engine */}
            {workspaceTab === 'paper_trading' && (
                <section className="results animated-tab-enter" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
                    <div className="panel result-head">
                        <div>
                            <span className="eyebrow">ADVANCED / LIVE PAPER TRADING ENGINE</span>
                            <h2>Live Indian Markets Paper Portfolio & Alert Hub</h2>
                            <p>Forward simulate signals in real-time, execute simulated orders with live trailing stops, and stream alerts to Discord/Telegram.</p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {paperStatus?.is_active ? (
                                <>
                                    <button className="run" onClick={() => handlePaperTradingTick()} disabled={paperBusy} style={{ padding: '9px 18px', background: 'var(--surface-card)' }}>
                                        {paperBusy ? 'Evaluating…' : '⚡ Trigger Live Tick'}
                                    </button>
                                    <button className="run" onClick={handleStopPaperTrading} disabled={paperBusy} style={{ padding: '9px 18px', background: 'var(--rose-primary)', color: '#fff' }}>
                                        Stop Session
                                    </button>
                                </>
                            ) : (
                                <button className="run" onClick={handleStartPaperTrading} disabled={paperBusy} style={{ padding: '9px 24px' }}>
                                    {paperBusy ? 'Starting…' : '▶ Start Live Paper Session'}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="panel" style={{ marginTop: '16px', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ flex: '1 1 200px' }}>
                            <label>
                                Active Trading Symbol
                                <input disabled value={marketSymbol || symbol} />
                            </label>
                        </div>
                        <div style={{ flex: '1 1 200px' }}>
                            <label>
                                Current Status
                                <div style={{ padding: '8px', fontWeight: 700, color: paperStatus?.is_active ? 'var(--emerald-primary)' : 'var(--text-muted)' }}>
                                    {paperStatus?.is_active ? '● LIVE PAPER ACTIVE' : '○ SESSION STOPPED'}
                                </div>
                            </label>
                        </div>
                        <div style={{ flex: '1 1 200px' }}>
                            <label>
                                Last Evaluated Price
                                <div style={{ padding: '8px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {paperStatus?.last_evaluated_price ? `₹${paperStatus.last_evaluated_price.toFixed(2)}` : 'Awaiting tick'}
                                </div>
                            </label>
                        </div>
                    </div>

                    {paperStatus && (
                        <>
                            <div className="metrics" style={{ marginTop: '16px' }}>
                                <Metric
                                    label="Paper Equity"
                                    value={money(paperStatus.equity)}
                                    sub={`Cash: ${money(paperStatus.cash_balance)}`}
                                    positive={paperStatus.equity >= paperStatus.initial_capital}
                                />
                                <Metric
                                    label="Realized P&L"
                                    value={money(paperStatus.realized_pnl)}
                                    sub={`${paperStatus.trades_count} closed paper trades`}
                                    positive={paperStatus.realized_pnl >= 0}
                                />
                                <Metric
                                    label="Unrealized P&L"
                                    value={money(paperStatus.unrealized_pnl)}
                                    sub={paperStatus.open_position ? `Open ${paperStatus.open_position.side} @ ₹${paperStatus.open_position.entry_price}` : 'No open position'}
                                    positive={paperStatus.unrealized_pnl >= 0}
                                />
                                <Metric
                                    label="Total Paper Return"
                                    value={`${paperStatus.total_return_pct}%`}
                                    sub={`From ${money(paperStatus.initial_capital)}`}
                                    positive={paperStatus.total_return_pct >= 0}
                                />
                            </div>

                            <div className="two" style={{ marginTop: '16px' }}>
                                {/* Open Position Card */}
                                <div className="panel" style={{ padding: '20px' }}>
                                    <h3>Active Position</h3>
                                    {paperStatus.open_position ? (
                                        <div style={{ marginTop: '12px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                <span className={paperStatus.open_position.side === 'SHORT' ? 'badge-short' : 'badge-long'} style={{ fontSize: '11px', padding: '4px 10px' }}>
                                                    {paperStatus.open_position.side} {paperStatus.symbol}
                                                </span>
                                                <b style={{ color: paperStatus.unrealized_pnl >= 0 ? 'var(--emerald-primary)' : 'var(--rose-primary)', fontSize: '15px' }}>
                                                    {money(paperStatus.unrealized_pnl)}
                                                </b>
                                            </div>
                                            <div className="detail"><span>Entry Price</span><b>₹{paperStatus.open_position.entry_price.toFixed(2)}</b></div>
                                            <div className="detail"><span>Quantity</span><b>{paperStatus.open_position.quantity} shares</b></div>
                                            <div className="detail"><span>Stop Loss</span><b>₹{paperStatus.open_position.stop.toFixed(2)} {paperStatus.open_position.is_trailing ? '(Trailing)' : ''}</b></div>
                                            <div className="detail"><span>Take Profit</span><b>₹{paperStatus.open_position.target.toFixed(2)}</b></div>
                                            <div className="detail"><span>Entry Timestamp</span><b>{new Date(paperStatus.open_position.entry_time).toLocaleTimeString()}</b></div>
                                        </div>
                                    ) : (
                                        <div className="no-trades" style={{ padding: '30px 10px' }}>
                                            No open position. The engine is monitoring candle closes for crossovers.
                                        </div>
                                    )}
                                </div>

                                {/* Webhook Configuration Card */}
                                <div className="panel" style={{ padding: '20px' }}>
                                    <h3>Real-Time Webhook Alert Hub</h3>
                                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                        Stream execution signals instantly to Discord, Telegram, or custom webhooks.
                                    </p>
                                    <label className="toggle-row" style={{ marginBottom: '10px' }}>
                                        <span><b>Enable Live Webhook Alerts</b></span>
                                        <input
                                            type="checkbox"
                                            checked={webhookEnabled}
                                            onChange={(e) => setWebhookEnabled(e.target.checked)}
                                        />
                                    </label>
                                    <div className="two" style={{ marginBottom: '10px' }}>
                                        <label>
                                            Platform
                                            <select
                                                className="market-select" value={webhookPlatform}
                                                onChange={(e) => setWebhookPlatform(e.target.value as any)}
                                            >
                                                <option value="discord">Discord Webhook</option>
                                                <option value="telegram">Telegram Bot</option>
                                                <option value="generic">Generic JSON Webhook</option>
                                            </select>
                                        </label>
                                        <label>
                                            Webhook URL
                                            <input
                                                value={webhookUrl}
                                                onChange={(e) => setWebhookUrl(e.target.value)}
                                                placeholder="https://discord.com/api/webhooks/..."
                                            />
                                        </label>
                                    </div>
                                    <button
                                        type="button"
                                        className="secondary"
                                        style={{ width: '100%', marginTop: '4px' }}
                                        onClick={handleTestWebhook}
                                    >
                                        Send Test Ping
                                    </button>
                                    {webhookTestStatus && (
                                        <p style={{ fontSize: '11px', color: 'var(--emerald-primary)', margin: '8px 0 0' }}>
                                            {webhookTestStatus}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Live Engine Event Log */}
                            <div className="panel" style={{ marginTop: '16px' }}>
                                <div className="table-head">
                                    <h3>Live Event & Alert Audit Log</h3>
                                    <span className="count">{paperStatus.logs.length} EVENTS</span>
                                </div>
                                <div className="table-wrap">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>TIME</th>
                                                <th>EVENT</th>
                                                <th>MESSAGE</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paperStatus.logs.slice().reverse().map((log, idx) => (
                                                <tr key={idx}>
                                                    <td style={{ color: 'var(--text-muted)' }}>{log.time}</td>
                                                    <td style={{ fontWeight: 700, color: log.event.includes('ERROR') ? 'var(--rose-primary)' : 'var(--emerald-primary)' }}>
                                                        {log.event}
                                                    </td>
                                                    <td>{log.message}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </section>
            )}





            {/* Saved Experiments Modal / Drawer */}
            {showExperiments && (
                <div
                    className="exp-modal-backdrop"
                    onClick={() => setShowExperiments(false)}
                >
                    <div className="exp-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="exp-modal-header">
                            <div>
                                <h3>Saved Experiments Database</h3>
                                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '3px 0 0' }}>
                                    Persisted in PostgreSQL / SQLite for historical review and comparison.
                                </p>
                            </div>
                            <button
                                className="close-btn"
                                onClick={() => setShowExperiments(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="exp-list">
                            {experiments.length === 0 ? (
                                <div
                                    style={{
                                        textAlign: 'center',
                                        padding: '40px 20px',
                                        color: 'var(--text-muted)',
                                    }}
                                >
                                    No experiments saved yet. Run a backtest and click "Save
                                    Run to Database" to preserve your results.
                                </div>
                            ) : (
                                experiments.map((exp) => (
                                    <div key={exp.id} className="exp-card">
                                        <div className="exp-card-info">
                                            <h4>{exp.name}</h4>
                                            <div className="exp-card-meta">
                                                <span>
                                                    Return:{' '}
                                                    <b
                                                        style={{
                                                            color:
                                                                exp.net_pnl >= 0
                                                                    ? '#63dfb0'
                                                                    : '#f87171',
                                                        }}
                                                    >
                                                        {exp.return_pct}% ({money(exp.net_pnl)})
                                                    </b>
                                                </span>
                                                <span>
                                                    Win Rate: <b>{exp.win_rate_pct}%</b>
                                                </span>
                                                <span>
                                                    Trades: <b>{exp.trade_count}</b>
                                                </span>
                                                <span>
                                                    Max DD: <b>{exp.max_drawdown_pct}%</b>
                                                </span>
                                                <span>
                                                    Date:{' '}
                                                    <b>
                                                        {exp.created_at
                                                            ? new Date(exp.created_at).toLocaleDateString(
                                                                  'en-IN',
                                                                  {
                                                                      day: '2-digit',
                                                                      month: 'short',
                                                                      hour: '2-digit',
                                                                      minute: '2-digit',
                                                                  },
                                                              )
                                                            : '—'}
                                                    </b>
                                                </span>
                                            </div>
                                        </div>
                                        <div className="exp-card-actions">
                                            <button
                                                className={`btn-sm btn-compare ${compareExperimentIds.includes(exp.id) ? 'selected' : ''}`}
                                                aria-pressed={compareExperimentIds.includes(exp.id)}
                                                onClick={() => setCompareExperimentIds((current) =>
                                                    current.includes(exp.id)
                                                        ? current.filter((id) => id !== exp.id)
                                                        : current.length >= 2
                                                            ? [...current.slice(1), exp.id]
                                                            : [...current, exp.id],
                                                )}
                                                title="Select up to two saved runs to compare"
                                            >
                                                {compareExperimentIds.includes(exp.id) ? 'Selected' : 'Compare'}
                                            </button>
                                            <button
                                                className="btn-sm btn-load"
                                                onClick={() => handleLoadExperiment(exp.id)}
                                            >
                                                Load View
                                            </button>
                                            <button
                                                className="btn-sm btn-del"
                                                onClick={(e) => handleDeleteExperiment(exp.id, e)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                            {comparedExperiments.length > 0 && (
                                <section className="compare-panel" aria-live="polite">
                                    <div className="compare-panel-header">
                                        <div>
                                            <h4>Compare saved runs</h4>
                                            <p>Select up to two runs. Selecting a third replaces the oldest selection.</p>
                                        </div>
                                        <span>{comparedExperiments.length} / 2 selected</span>
                                    </div>
                                    {comparedExperiments.length === 2 ? (
                                        <div className="compare-grid">
                                            {comparedExperiments.map((exp) => (
                                                <div className="compare-column" key={exp.id}>
                                                    <strong>{exp.name}</strong>
                                                    <span>{exp.symbol} · {exp.data_source}</span>
                                                    <div className="detail"><span>Return</span><b className={exp.net_pnl >= 0 ? 'good' : 'bad'}>{exp.return_pct}% ({money(exp.net_pnl)})</b></div>
                                                    <div className="detail"><span>Win rate</span><b>{exp.win_rate_pct}%</b></div>
                                                    <div className="detail"><span>Trades</span><b>{exp.trade_count}</b></div>
                                                    <div className="detail"><span>Max drawdown</span><b>{exp.max_drawdown_pct}%</b></div>
                                                    <div className="detail"><span>Profit factor</span><b>{exp.profit_factor ?? '—'}</b></div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="compare-hint">Choose one more saved run to see a side-by-side comparison.</p>
                                    )}
                                </section>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* AI Strategy Assistant Drawer */}
            <AIChatDrawer
                isOpen={showAIChat}
                onClose={() => setShowAIChat(false)}
                apiBase={API_BASE}
                onApplyStrategy={handleApplyAIStrategy}
            />

            {/* Supabase User Authentication Modal */}
            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                currentUser={currentUser}
                onAuthSuccess={(profile) => setCurrentUser(profile)}
            />

            <footer>
                STRATEGY LAB · MVP 0.2 · INDIAN MARKETS BACKTESTING WORKSPACE
                <span>Deterministic simulation · No real orders sent</span>
            </footer>
        </main>
    );
}

function Metric({
    label,
    value,
    sub,
    positive,
}: {
    label: string;
    value: string;
    sub: string;
    positive?: boolean;
}) {
    return (
        <div className="panel metric">
            <div className="metric-label">{label}</div>
            <div
                className={`metric-value ${
                    positive === undefined ? '' : positive ? 'good' : 'bad'
                }`}
            >
                {value}
            </div>
            <div className="metric-sub">{sub}</div>
        </div>
    );
}
