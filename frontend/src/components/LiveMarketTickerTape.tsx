import React, { useState, useEffect } from 'react';

export interface TickerQuote {
    symbol: string;
    displayName: string;
    last_price: number | null;
    change: number;
    change_pct: number;
}

interface LiveMarketTickerTapeProps {
    apiBase: string;
    onSelectSymbol?: (symbol: string) => void;
    theme?: 'dark' | 'light';
}

const TRACKED_SYMBOLS: { symbol: string; displayName: string }[] = [
    { symbol: '^NSEI', displayName: 'NIFTY 50' },
    { symbol: '^NSEBANK', displayName: 'BANK NIFTY' },
    { symbol: '^BSESN', displayName: 'SENSEX' },
    { symbol: 'RELIANCE.NS', displayName: 'RELIANCE' },
    { symbol: 'HDFCBANK.NS', displayName: 'HDFC BANK' },
    { symbol: 'TCS.NS', displayName: 'TCS' },
    { symbol: 'INFY.NS', displayName: 'INFOSYS' },
    { symbol: 'ICICIBANK.NS', displayName: 'ICICI BANK' },
    { symbol: 'SBIN.NS', displayName: 'SBI' },
    { symbol: 'BHARTIARTL.NS', displayName: 'AIRTEL' },
    { symbol: 'TATAMOTORS.NS', displayName: 'TATA MOTORS' },
    { symbol: 'ITC.NS', displayName: 'ITC' },
    { symbol: 'LT.NS', displayName: 'L&T' },
];

function isMarketOpenIST(): boolean {
    const now = new Date();
    // Convert to IST (UTC + 5:30)
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 5.5 * 3600000);
    const day = ist.getDay(); // 0 is Sunday, 6 is Saturday
    if (day === 0 || day === 6) return false;

    const hours = ist.getHours();
    const minutes = ist.getMinutes();
    const currentMins = hours * 60 + minutes;

    // 09:15 IST = 555 mins, 15:30 IST = 930 mins
    return currentMins >= 555 && currentMins <= 930;
}

export const LiveMarketTickerTape: React.FC<LiveMarketTickerTapeProps> = ({
    apiBase,
    onSelectSymbol,
    theme = 'dark',
}) => {
    const [quotes, setQuotes] = useState<Record<string, TickerQuote>>({});
    const [marketOpen, setMarketOpen] = useState(isMarketOpenIST());
    const [quoteLoading, setQuoteLoading] = useState(true);
    const [quoteError, setQuoteError] = useState(false);

    useEffect(() => {
        setMarketOpen(isMarketOpenIST());
        const timer = setInterval(() => setMarketOpen(isMarketOpenIST()), 60000);
        return () => clearInterval(timer);
    }, []);

    const fetchQuotes = async () => {
        try {
            const symbols = TRACKED_SYMBOLS.map((s) => s.symbol);
            const res = await fetch(`${apiBase}/api/market-data/quotes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols }),
            });
            if (!res.ok) throw new Error(`Quote request failed (${res.status})`);
            const data = await res.json();
            if (data.quotes && Array.isArray(data.quotes)) {
                const map: Record<string, TickerQuote> = {};
                for (const q of data.quotes) {
                    const match = TRACKED_SYMBOLS.find((s) => s.symbol === q.symbol);
                    map[q.symbol] = {
                        symbol: q.symbol,
                        displayName: match ? match.displayName : q.symbol,
                        last_price: q.last_price,
                        change: q.change,
                        change_pct: q.change_pct,
                    };
                }
                setQuotes(map);
                setQuoteError(false);
            } else {
                setQuoteError(true);
            }
        } catch (e) {
            setQuoteError(true);
            console.error('Failed to update live ticker tape:', e);
        } finally {
            setQuoteLoading(false);
        }
    };

    useEffect(() => {
        fetchQuotes();
        // Refresh every 30s during market hours, 90s after hours
        const interval = setInterval(fetchQuotes, marketOpen ? 30000 : 90000);
        return () => clearInterval(interval);
    }, [apiBase, marketOpen]);

    const isLight = theme === 'light';

    return (
        <div
            className="live-ticker-strip"
            style={{
                width: '100%',
                background: 'var(--surface-panel)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                height: '38px',
                fontSize: '12px',
                userSelect: 'none',
                position: 'relative',
                zIndex: 100,
            }}
        >
            {/* Market Status Pill */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 14px',
                    height: '100%',
                    background: 'var(--surface-card)',
                    borderRight: '1px solid var(--border-subtle)',
                    whiteSpace: 'nowrap',
                    fontWeight: 700,
                    fontSize: '11px',
                    letterSpacing: '0.04em',
                    flexShrink: 0,
                    color: marketOpen ? 'var(--accent-positive)' : 'var(--accent-warning)',
                }}
                title={marketOpen ? 'Indian Market is Open (09:15 - 15:30 IST)' : 'Market Closed (Showing Official Closing LTP)'}
            >
                <span
                    style={{
                        display: 'inline-block',
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: marketOpen ? 'var(--accent-positive)' : 'var(--accent-warning)',
                        boxShadow: marketOpen ? '0 0 8px var(--accent-positive)' : 'none',
                    }}
                />
                {marketOpen ? 'NSE/BSE LIVE' : 'NSE CLOSED'}
            </div>

            {/* Continuous Marquee Ticker Track */}
            <div
                className="ticker-track"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                    paddingLeft: '16px',
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    whiteSpace: 'nowrap',
                    flex: 1,
                }}
                aria-label="Market quotes. Scroll horizontally to see more symbols."
                tabIndex={0}
            >
                {TRACKED_SYMBOLS.map((item) => {
                    const q = quotes[item.symbol];
                    const isPos = q ? q.change >= 0 : true;
                    const priceFormatted = q && q.last_price !== null
                        ? `₹${q.last_price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : quoteLoading ? 'Loading…' : quoteError ? 'Unavailable' : '—';
                    const pctFormatted = q && q.last_price !== null ? `${isPos ? '+' : ''}${q.change_pct.toFixed(2)}%` : '';

                    return (
                        <button
                            type="button"
                            key={item.symbol}
                            onClick={() => onSelectSymbol && onSelectSymbol(item.symbol)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                cursor: onSelectSymbol ? 'pointer' : 'default',
                                transition: 'background 0.15s ease',
                                border: 0,
                                background: 'transparent',
                                font: 'inherit',
                            }}
                            className="ticker-item-hover"
                            title={`Click to analyze ${item.displayName} in Strategy Lab`}
                        >
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                                {item.displayName}
                            </span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                {priceFormatted}
                            </span>
                            {pctFormatted && (
                                <span
                                    style={{
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        color: isPos ? 'var(--accent-positive)' : 'var(--accent-negative)',
                                    }}
                                >
                                    {pctFormatted}
                                </span>
                            )}
                            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>•</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
