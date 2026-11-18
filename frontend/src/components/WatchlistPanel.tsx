import React, { useState, useEffect } from 'react';
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
    const [searchLoading, setSearchLoading] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [liveChartSymbol, setLiveChartSymbol] = useState<string | null>(null);

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

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }
        setSearchLoading(true);
        try {
            const res = await fetch(`${apiBase}/api/market-data/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            setSearchResults(data.results || []);
        } catch (e) {
            console.error('Search failed:', e);
        } finally {
            setSearchLoading(false);
        }
    };

    const addSymbol = (sym: string) => {
        if (!watchlistSymbols.includes(sym)) {
            setWatchlistSymbols((prev) => [...prev, sym]);
        }
        setSearchQuery('');
        setSearchResults([]);
        setShowSearchModal(false);
    };

    const removeSymbol = (sym: string) => {
        setWatchlistSymbols((prev) => prev.filter((s) => s !== sym));
        setQuotes((prev) => {
            const copy = { ...prev };
            delete copy[sym];
            return copy;
        });
    };

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
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                        className="btn-outline"
                        onClick={() => setShowSearchModal(true)}
                        style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <span>🔍</span> Add Stock / Index
                    </button>
                    <button
                        className="btn-outline"
                        onClick={refreshQuotes}
                        disabled={loading}
                        style={{ padding: '8px 16px' }}
                    >
                        {loading ? 'Refreshing…' : '↻ Refresh Quotes'}
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
                            <div className="index-sub">
                                {isPos ? '▲' : '▼'} ₹{Math.abs(q.change).toFixed(2)} vs Prev Close
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Watchlist Table */}
            <div className="panel" style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div className="section-label">MY WATCHLIST ({watchlistSymbols.length} INSTRUMENTS)</div>
                    {lastRefreshed && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Last updated: {lastRefreshed}
                        </span>
                    )}
                </div>

                <div className="table-wrap">
                    <table className="watchlist-table">
                        <thead>
                            <tr>
                                <th>SYMBOL</th>
                                <th>LTP (₹)</th>
                                <th>DAY CHANGE</th>
                                <th>DAY HIGH / LOW</th>
                                <th>VOLUME</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {watchlistSymbols.map((sym) => {
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
                                                <span style={{ fontWeight: 600, fontSize: '14px' }}>
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
                                                <span style={{ fontSize: '12px' }}>
                                                    H: ₹{q.day_high.toLocaleString('en-IN')} / L: ₹{q.day_low.toLocaleString('en-IN')}
                                                </span>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        <td>
                                            {q && q.volume ? (
                                                <span style={{ fontSize: '12px' }}>
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
                                                    📈 Live Chart
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-table-action run-backtest-btn"
                                                    onClick={() => onSelectSymbolForBacktest(sym)}
                                                    title={`Load ${sym} into Strategy Lab and run backtest`}
                                                >
                                                    ⚡ Backtest in Lab
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-table-action remove-btn"
                                                    onClick={() => removeSymbol(sym)}
                                                    title="Remove from Watchlist"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Stock Search Modal */}
            {showSearchModal && (
                <div className="modal-overlay" onClick={() => setShowSearchModal(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3>Add Stock or Index to Watchlist</h3>
                            <button
                                type="button"
                                className="close-btn"
                                onClick={() => setShowSearchModal(false)}
                            >
                                ✕
                            </button>
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0 16px' }}>
                            Search across NIFTY 50, BANKNIFTY, and all National Stock Exchange (NSE) equities.
                        </p>

                        <div className="search-input-box">
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search by name or ticker (e.g., RELIANCE, ZOMATO, ^NSEI)…"
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '6px' }}
                            />
                        </div>

                        <div className="search-results-list" style={{ maxHeight: '280px', overflowY: 'auto', marginTop: '12px' }}>
                            {searchLoading && <div style={{ padding: '12px', textAlign: 'center' }}>Searching market directory…</div>}
                            {!searchLoading && searchResults.length === 0 && searchQuery && (
                                <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No direct matches. You can enter any valid NSE ticker symbol.
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
                                            borderBottom: '1px solid var(--border-color)',
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{item.name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {item.symbol} · {item.sector || item.category}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className={`chip-btn ${isAdded ? 'active' : ''}`}
                                            disabled={isAdded}
                                            onClick={() => addSymbol(item.symbol)}
                                            style={{ padding: '6px 12px' }}
                                        >
                                            {isAdded ? '✓ Added' : '+ Add to Watchlist'}
                                        </button>
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
