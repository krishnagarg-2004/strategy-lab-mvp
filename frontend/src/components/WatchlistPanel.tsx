import React, { useState, useEffect } from 'react';
import {
    Search,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    Zap,
    X,
    Plus,
    Check,
    Landmark,
    Building2,
    Laptop,
    Car,
    Flame,
    ShoppingBag,
    Pill,
    Pickaxe,
} from 'lucide-react';
import { TradingViewLiveChartModal } from './TradingViewLiveChartModal';

export interface WatchlistQuote {
    symbol: string;
    last_price: number | null;
    previous_close: number | null;
    change: number;
    change_pct: number;
    day_high: number | null;
    day_low: number | null;
    open: number | null;
    volume: number;
    last_updated: string;
}

export interface SearchResult {
    symbol: string;
    name: string;
    category: string;
    sector?: string;
}

interface WatchlistPanelProps {
    apiBase: string;
    onSelectSymbolForBacktest: (symbol: string) => void;
    theme?: 'dark' | 'light';
}

const DEFAULT_WATCHLIST = ['^NSEI', '^NSEBANK', 'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'TATAMOTORS.NS', 'SBIN.NS'];
type WatchlistSortKey = 'symbol' | 'price' | 'change' | 'volume';
type WatchlistSortDirection = 'asc' | 'desc';

const PRESET_PACKS: { name: string; icon: React.ReactNode; symbols: string[] }[] = [
    {
        name: 'NIFTY 50 Core',
        icon: <Landmark size={14} />,
        symbols: ['^NSEI', 'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS', 'ITC.NS', 'LT.NS', 'SBIN.NS', 'BHARTIARTL.NS'],
    },
    {
        name: 'Banking Leaders',
        icon: <Building2 size={14} />,
        symbols: ['^NSEBANK', 'HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS', 'KOTAKBANK.NS', 'AXISBANK.NS', 'INDUSINDBK.NS', 'CANBK.NS', 'PNB.NS'],
    },
    {
        name: 'IT & Tech',
        icon: <Laptop size={14} />,
        symbols: ['^CNXIT', 'TCS.NS', 'INFY.NS', 'HCLTECH.NS', 'WIPRO.NS', 'TECHM.NS', 'LTIM.NS', 'PERSISTENT.NS', 'COFORGE.NS'],
    },
    {
        name: 'Auto & EV',
        icon: <Car size={14} />,
        symbols: ['^CNXAUTO', 'TATAMOTORS.NS', 'MARUTI.NS', 'M&M.NS', 'BAJAJ-AUTO.NS', 'EICHERMOT.NS', 'HEROMOTOCO.NS', 'TVSMOTOR.NS'],
    },
    {
        name: 'Energy & Power',
        icon: <Flame size={14} />,
        symbols: ['^CNXENERGY', 'RELIANCE.NS', 'ONGC.NS', 'NTPC.NS', 'POWERGRID.NS', 'BPCL.NS', 'COALINDIA.NS', 'TATAPOWER.NS', 'GAIL.NS'],
    },
    {
        name: 'FMCG & Retail',
        icon: <ShoppingBag size={14} />,
        symbols: ['^CNXFMCG', 'ITC.NS', 'HINDUNILVR.NS', 'NESTLEIND.NS', 'BRITANNIA.NS', 'TATACONSUM.NS', 'VBL.NS', 'TRENT.NS', 'ZOMATO.NS'],
    },
    {
        name: 'Pharma & Health',
        icon: <Pill size={14} />,
        symbols: ['^CNXPHARMA', 'SUNPHARMA.NS', 'CIPLA.NS', 'DRREDDY.NS', 'APOLLOHOSP.NS', 'DIVISLAB.NS', 'LUPIN.NS', 'MANKIND.NS'],
    },
    {
        name: 'Metals & Mining',
        icon: <Pickaxe size={14} />,
        symbols: ['^CNXMETAL', 'TATASTEEL.NS', 'JSWSTEEL.NS', 'HINDALCO.NS', 'VEDL.NS', 'JINDALSTEL.NS', 'NMDC.NS', 'ADANIENT.NS'],
    },
];

const SECTOR_TABS = [
    'All',
    'Index',
    'Banking',
    'Technology',
    'Energy',
    'Automobile',
    'FMCG',
    'Metals',
    'Pharma',
    'Capital Goods',
];

export const WatchlistPanel: React.FC<WatchlistPanelProps> = ({
    apiBase,
    onSelectSymbolForBacktest,
    theme = 'dark',
}) => {
    const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('strategy_lab_user_watchlist');
            return saved ? JSON.parse(saved) : DEFAULT_WATCHLIST;
        } catch {
            return DEFAULT_WATCHLIST;
        }
    });

    const [quotes, setQuotes] = useState<Record<string, WatchlistQuote>>({});
    const [loading, setLoading] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [catalogResults, setCatalogResults] = useState<SearchResult[]>([]);
    const [selectedSectorTab, setSelectedSectorTab] = useState('All');
    const [searchLoading, setSearchLoading] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [liveChartSymbol, setLiveChartSymbol] = useState<string | null>(null);
    const [tableFilter, setTableFilter] = useState('');
    const [sort, setSort] = useState<{ key: WatchlistSortKey; direction: WatchlistSortDirection }>({ key: 'symbol', direction: 'asc' });

    useEffect(() => {
        localStorage.setItem('strategy_lab_user_watchlist', JSON.stringify(watchlistSymbols));
    }, [watchlistSymbols]);

    const refreshQuotes = async () => {
        if (watchlistSymbols.length === 0) return;
        setLoading(true);
        try {
            const res = await fetch(`${apiBase}/api/market-data/quotes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols: watchlistSymbols }),
            });
            const data = await res.json();
            if (data.quotes && Array.isArray(data.quotes)) {
                const map: Record<string, WatchlistQuote> = {};
                for (const q of data.quotes) {
                    map[q.symbol] = q;
                }
                setQuotes(map);
                setLastRefreshed(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }));
            }
        } catch (e) {
            console.error('Failed to refresh quotes:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshQuotes();
        const interval = setInterval(refreshQuotes, 45000); // 45s auto-refresh
        return () => clearInterval(interval);
    }, [watchlistSymbols]);

    // Fetch catalog when opening modal or changing sector tab
    const fetchCatalog = async (category: string = 'All') => {
        setSearchLoading(true);
        try {
            const catParam = category === 'All' ? '' : `&category=${encodeURIComponent(category)}`;
            const res = await fetch(`${apiBase}/api/market-data/search?q=${encodeURIComponent(searchQuery)}${catParam}`);
            const data = await res.json();
            const results = data.results || [];
            if (!searchQuery) {
                setCatalogResults(results);
            }
            setSearchResults(results);
        } catch (e) {
            console.error('Catalog fetch failed:', e);
        } finally {
            setSearchLoading(false);
        }
    };

    const handleOpenSearchModal = () => {
        setShowSearchModal(true);
        fetchCatalog(selectedSectorTab);
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setSearchResults(catalogResults);
            return;
        }
        setSearchLoading(true);
        try {
            const catParam = selectedSectorTab === 'All' ? '' : `&category=${encodeURIComponent(selectedSectorTab)}`;
            const res = await fetch(`${apiBase}/api/market-data/search?q=${encodeURIComponent(query)}${catParam}`);
            const data = await res.json();
            setSearchResults(data.results || []);
        } catch (e) {
            console.error('Search failed:', e);
        } finally {
            setSearchLoading(false);
        }
    };

    const handleSelectSectorTab = (tab: string) => {
        setSelectedSectorTab(tab);
        fetchCatalog(tab);
    };

    const addSymbol = (sym: string) => {
        if (!watchlistSymbols.includes(sym)) {
            setWatchlistSymbols((prev) => [...prev, sym]);
        }
    };

    const addCustomTicker = () => {
        if (!searchQuery.trim()) return;
        const clean = searchQuery.trim().toUpperCase().replace('.NS', '').replace('.BO', '');
        const customSymbol = clean.startsWith('^') ? clean : `${clean}.NS`;
        addSymbol(customSymbol);
        setSearchQuery('');
    };

    const addPresetPack = (symbols: string[]) => {
        setWatchlistSymbols((prev) => {
            const combined = [...prev];
            for (const s of symbols) {
                if (!combined.includes(s)) {
                    combined.push(s);
                }
            }
            return combined;
        });
    };

    const removeSymbol = (sym: string) => {
        setWatchlistSymbols((prev) => prev.filter((s) => s !== sym));
        setQuotes((prev) => {
            const copy = { ...prev };
            delete copy[sym];
            return copy;
        });
    };

    const handleClearAll = () => {
        if (window.confirm('Clear all instruments from your watchlist? You can re-add them or reset anytime.')) {
            setWatchlistSymbols([]);
            setQuotes({});
        }
    };

    const handleResetDefault = () => {
        setWatchlistSymbols(DEFAULT_WATCHLIST);
    };

    const toggleSort = (key: WatchlistSortKey) => {
        setSort((current) => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    // Client-side filter within existing watchlist
    const filteredSymbols = watchlistSymbols.filter((sym) => {
        if (!tableFilter.trim()) return true;
        const query = tableFilter.trim().toLowerCase();
        return sym.toLowerCase().includes(query);
    });

    const sortedSymbols = [...filteredSymbols].sort((left, right) => {
        const leftQuote = quotes[left];
        const rightQuote = quotes[right];
        let comparison = 0;
        if (sort.key === 'symbol') {
            comparison = left.localeCompare(right);
        } else if (sort.key === 'price') {
            const lv = leftQuote?.last_price ?? 0;
            const rv = rightQuote?.last_price ?? 0;
            comparison = lv - rv;
        } else if (sort.key === 'change') {
            const lv = leftQuote?.change_pct ?? 0;
            const rv = rightQuote?.change_pct ?? 0;
            comparison = lv - rv;
        } else if (sort.key === 'volume') {
            const lv = leftQuote?.volume ?? 0;
            const rv = rightQuote?.volume ?? 0;
            comparison = lv - rv;
        }
        return sort.direction === 'asc' ? comparison : -comparison;
    });

    return (
        <div className="watchlist-workspace animated-tab-enter">
            {/* Header Toolbar */}
            <div className="panel result-head">
                <div>
                    <span className="eyebrow">LIVE INDIAN MARKETS / WATCHLIST</span>
                    <h2>Authentic Indian Market Watchlist</h2>
                    <p>
                        Track real-time / delayed price fluctuations on the National Stock Exchange (NSE).
                        Click any stock to run an instant backtest against our deterministic quantitative engine.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        className="btn-outline"
                        onClick={handleOpenSearchModal}
                        style={{
                            padding: '8px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'rgba(99, 223, 176, 0.12)',
                            borderColor: 'var(--accent-positive)',
                            color: 'var(--accent-positive)',
                            fontWeight: 600,
                        }}
                    >
                        <Search size={14} /> Browse & Add Stocks
                    </button>
                    <button
                        className="btn-outline"
                        onClick={refreshQuotes}
                        disabled={loading}
                        style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <RefreshCw size={13} className={loading ? 'spin' : ''} /> {loading ? 'Refreshing…' : 'Refresh Quotes'}
                    </button>
                </div>
            </div>

            {/* Quick Indices Cards */}
            <div className="market-indices-grid" style={{ margin: '16px 0' }}>
                {['^NSEI', '^NSEBANK', 'RELIANCE.NS', 'TCS.NS'].map((sym) => {
                    const q = quotes[sym];
                    if (!q || q.last_price === null) return null;
                    const isPos = q.change >= 0;
                    return (
                        <div key={sym} className="index-card">
                            <div className="index-title-row">
                                <span className="index-name">
                                    {sym === '^NSEI' ? 'NIFTY 50' : sym === '^NSEBANK' ? 'BANK NIFTY' : sym.replace('.NS', '')}
                                </span>
                                <span className={`change-badge ${isPos ? 'pos' : 'neg'}`}>
                                    {isPos ? '+' : ''}{q.change_pct}%
                                </span>
                            </div>
                            <div className="index-price">₹{q.last_price.toLocaleString('en-IN')}</div>
                            <div className="index-sub" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {isPos ? <TrendingUp size={12} color="var(--accent-positive)" /> : <TrendingDown size={12} color="var(--accent-negative)" />} ₹{Math.abs(q.change).toFixed(2)} vs Prev Close
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Sector / Index Quick Packs */}
            <div className="panel" style={{ marginBottom: '16px', padding: '14px 18px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={14} color="#f59e0b" /> One-Click Curated Sector Packs:
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {PRESET_PACKS.map((pack) => (
                        <button
                            key={pack.name}
                            type="button"
                            className="chip-btn"
                            onClick={() => addPresetPack(pack.symbols)}
                            title={`Add ${pack.symbols.length} stocks from ${pack.name}`}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                fontSize: '11px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                            }}
                        >
                            <span>{pack.icon}</span>
                            <span>+ {pack.name}</span>
                            <span style={{ opacity: 0.6, fontSize: '10px' }}>({pack.symbols.length})</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Watchlist Table Panel */}
            <div className="panel" style={{ marginTop: '16px' }}>
                {/* Watchlist Controls Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="section-label" style={{ margin: 0 }}>
                            MY WATCHLIST ({watchlistSymbols.length} INSTRUMENTS)
                        </div>
                        {lastRefreshed && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                Updated: {lastRefreshed}
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {/* Live Filter in My Watchlist */}
                        <input
                            type="text"
                            placeholder="Filter my watchlist…"
                            value={tableFilter}
                            onChange={(e) => setTableFilter(e.target.value)}
                            style={{
                                padding: '5px 10px',
                                fontSize: '11px',
                                borderRadius: '4px',
                                width: '160px',
                                background: 'var(--surface-card)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)',
                            }}
                        />

                        {/* Reset / Clear Buttons */}
                        <button
                            type="button"
                            className="btn-outline"
                            onClick={handleResetDefault}
                            title="Reset to default benchmark watchlist"
                            style={{ padding: '5px 10px', fontSize: '11px' }}
                        >
                            Reset Default
                        </button>
                        <button
                            type="button"
                            className="btn-outline"
                            onClick={handleClearAll}
                            disabled={watchlistSymbols.length === 0}
                            title="Remove all stocks from watchlist"
                            style={{ padding: '5px 10px', fontSize: '11px', color: 'var(--accent-negative)' }}
                        >
                            Clear All
                        </button>
                    </div>
                </div>

                <div className="table-wrap">
                    <table className="watchlist-table">
                        <thead>
                            <tr>
                                <th aria-sort={sort.key === 'symbol' ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                                    <button type="button" className="watchlist-sort" onClick={() => toggleSort('symbol')}>SYMBOL {sort.key === 'symbol' ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</button>
                                </th>
                                <th aria-sort={sort.key === 'price' ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                                    <button type="button" className="watchlist-sort" onClick={() => toggleSort('price')}>LTP (₹) {sort.key === 'price' ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</button>
                                </th>
                                <th aria-sort={sort.key === 'change' ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                                    <button type="button" className="watchlist-sort" onClick={() => toggleSort('change')}>DAY CHANGE {sort.key === 'change' ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</button>
                                </th>
                                <th>DAY HIGH / LOW</th>
                                <th aria-sort={sort.key === 'volume' ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                                    <button type="button" className="watchlist-sort" onClick={() => toggleSort('volume')}>VOLUME {sort.key === 'volume' ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</button>
                                </th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedSymbols.map((sym) => {
                                const q = quotes[sym];
                                const isPos = q ? q.change >= 0 : true;

                                return (
                                    <tr key={sym} className="watchlist-row">
                                        <td>
                                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                                                {sym}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {sym.startsWith('^') ? 'Index' : 'NSE Equity'}
                                            </div>
                                        </td>
                                        <td>
                                            {q && q.last_price !== null ? (
                                                <span style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'var(--font-mono)' }}>
                                                    ₹{q.last_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </span>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
                                            )}
                                        </td>
                                        <td>
                                            {q && q.last_price !== null ? (
                                                <div className={`change-pill ${isPos ? 'pos' : 'neg'}`}>
                                                    {isPos ? '+' : ''}{q.change_pct}% ({isPos ? '+' : ''}₹{q.change.toFixed(2)})
                                                </div>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        <td>
                                            {q && q.day_high !== null && q.day_low !== null ? (
                                                <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                                                    H: ₹{q.day_high.toLocaleString('en-IN')} / L: ₹{q.day_low.toLocaleString('en-IN')}
                                                </span>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        <td>
                                            {q && q.volume ? (
                                                <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                                                    {q.volume.toLocaleString('en-IN')}
                                                </span>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <button
                                                    type="button"
                                                    className="btn-table-action"
                                                    onClick={() => setLiveChartSymbol(sym)}
                                                    title={`Open live TradingView candlestick chart for ${sym}`}
                                                    style={{
                                                        borderColor: 'rgba(99, 223, 176, 0.4)',
                                                        color: 'var(--accent-positive)',
                                                        fontWeight: 600,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                    }}
                                                >
                                                    <TrendingUp size={13} /> Live Chart
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-table-action run-backtest-btn"
                                                    onClick={() => onSelectSymbolForBacktest(sym)}
                                                    title={`Load ${sym} into Strategy Lab and run backtest`}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                    }}
                                                >
                                                    <Zap size={13} /> Backtest in Lab
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-table-action remove-btn"
                                                    onClick={() => removeSymbol(sym)}
                                                    title="Remove from Watchlist"
                                                    style={{
                                                        color: 'var(--accent-negative)',
                                                        borderColor: 'rgba(239, 68, 68, 0.3)',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        padding: '4px 8px',
                                                    }}
                                                >
                                                    <X size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {sortedSymbols.length === 0 && (
                                <tr>
                                    <td colSpan={6}>
                                        <div className="empty-table-state" style={{ padding: '24px', textAlign: 'center' }}>
                                            {tableFilter
                                                ? `No instruments match "${tableFilter}". Try clearing your filter.`
                                                : 'Your watchlist is empty. Click "+ One-Click Sector Packs" above or "Browse & Add Stocks" to add instruments.'}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Comprehensive Stock Catalog & Search Modal */}
            {showSearchModal && (
                <div className="modal-overlay" onClick={() => setShowSearchModal(false)}>
                    <div
                        className="modal-card"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: '720px', width: '95%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Search size={20} color="var(--brand-primary)" />
                                <div>
                                    <h3 style={{ margin: 0 }}>Indian Stock Directory & Catalog</h3>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        Browse over 80+ top liquid Indian indices and equities, or add any custom NSE ticker
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="close-btn"
                                onClick={() => setShowSearchModal(false)}
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Search Input Box */}
                        <div className="search-input-box" style={{ marginTop: '10px' }}>
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search by company or ticker (e.g. Zomato, Reliance, Tata, ^NSEI)…"
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '6px' }}
                            />
                        </div>

                        {/* Sector Categories Bar */}
                        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '10px 0 6px', scrollbarWidth: 'none' }}>
                            {SECTOR_TABS.map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    className={`chip-btn ${selectedSectorTab === tab ? 'active' : ''}`}
                                    onClick={() => handleSelectSectorTab(tab)}
                                    style={{
                                        fontSize: '11px',
                                        padding: '4px 10px',
                                        whiteSpace: 'nowrap',
                                        borderRadius: '16px',
                                    }}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Custom Ticker Direct Addition */}
                        {searchQuery.trim().length >= 2 && (
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '8px 12px',
                                    background: 'rgba(99, 223, 176, 0.08)',
                                    border: '1px dashed rgba(99, 223, 176, 0.4)',
                                    borderRadius: '6px',
                                    margin: '8px 0',
                                }}
                            >
                                <span style={{ fontSize: '11px', color: 'var(--text-primary)' }}>
                                    Add custom NSE ticker: <strong>{searchQuery.trim().toUpperCase().replace('.NS', '')}.NS</strong>
                                </span>
                                <button
                                    type="button"
                                    className="run"
                                    onClick={addCustomTicker}
                                    style={{ padding: '4px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                    <Plus size={12} /> Add Custom Ticker
                                </button>
                            </div>
                        )}

                        {/* Results Count & Quick Add All */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                            <span>Showing {searchResults.length} instruments in {selectedSectorTab}</span>
                            {searchResults.length > 0 && (
                                <button
                                    type="button"
                                    className="btn-outline"
                                    onClick={() => {
                                        for (const item of searchResults) {
                                            addSymbol(item.symbol);
                                        }
                                    }}
                                    style={{ fontSize: '10px', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                    <Plus size={11} /> Add All {searchResults.length} to Watchlist
                                </button>
                            )}
                        </div>

                        {/* Scrollable Results List */}
                        <div className="search-results-list" style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid var(--border-subtle)', marginTop: '4px' }}>
                            {searchLoading && <div style={{ padding: '16px', textAlign: 'center' }}>Searching market directory…</div>}
                            {!searchLoading && searchResults.length === 0 && (
                                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No direct matches found. You can add any stock using "+ Add Custom Ticker" above.
                                </div>
                            )}
                            {searchResults.map((item) => {
                                const isAdded = watchlistSymbols.includes(item.symbol);
                                return (
                                    <div
                                        key={item.symbol}
                                        className="search-item-row"
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '10px 12px',
                                            borderBottom: '1px solid var(--border-subtle)',
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {item.symbol} · {item.sector || item.category}
                                            </div>
                                        </div>
                                        {isAdded ? (
                                            <button
                                                type="button"
                                                className="btn-outline"
                                                onClick={() => removeSymbol(item.symbol)}
                                                style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--accent-negative)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                title="Remove from your Watchlist"
                                            >
                                                <X size={12} /> Remove
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                className="chip-btn active"
                                                onClick={() => addSymbol(item.symbol)}
                                                style={{ padding: '4px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                title="Add to your Watchlist"
                                            >
                                                <Plus size={12} /> Add
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Real-time TradingView Live Chart Modal */}
            <TradingViewLiveChartModal
                symbol={liveChartSymbol}
                onClose={() => setLiveChartSymbol(null)}
                theme={theme}
            />
        </div>
    );
};
