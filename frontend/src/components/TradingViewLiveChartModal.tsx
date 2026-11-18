import React, { useEffect, useRef } from 'react';
import { TrendingUp, X } from 'lucide-react';

interface TradingViewLiveChartModalProps {
    symbol: string | null;
    onClose: () => void;
    theme?: 'dark' | 'light';
}

function toTradingViewSymbol(sym: string): string {
    const clean = sym.trim().toUpperCase();
    if (clean === '^NSEI' || clean === 'NIFTY' || clean === 'NIFTY 50') return 'NSE:NIFTY';
    if (clean === '^NSEBANK' || clean === 'BANKNIFTY' || clean === 'BANK NIFTY') return 'NSE:BANKNIFTY';
    if (clean === '^CNXIT' || clean === 'NIFTY IT') return 'NSE:CNXIT';
    if (clean === 'BSE:SENSEX' || clean === 'SENSEX') return 'BSE:SENSEX';
    if (clean.endsWith('.NS')) return `NSE:${clean.replace('.NS', '')}`;
    if (clean.endsWith('.BO')) return `BSE:${clean.replace('.BO', '')}`;
    return `NSE:${clean}`;
}

export const TradingViewLiveChartModal: React.FC<TradingViewLiveChartModalProps> = ({
    symbol,
    onClose,
    theme = 'dark',
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!symbol || !containerRef.current) return;
        const container = containerRef.current;
        container.innerHTML = '';

        const tvSymbol = toTradingViewSymbol(symbol);

        const widgetWrap = document.createElement('div');
        widgetWrap.className = 'tradingview-widget-container__widget';
        widgetWrap.style.height = 'calc(100% - 32px)';
        widgetWrap.style.width = '100%';
        container.appendChild(widgetWrap);

        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
        script.async = true;
        script.innerHTML = JSON.stringify({
            autosize: true,
            symbol: tvSymbol,
            interval: '15',
            timezone: 'Asia/Kolkata',
            theme: theme === 'light' ? 'light' : 'dark',
            style: '1',
            locale: 'in',
            enable_publishing: false,
            allow_symbol_change: true,
            calendar: false,
            hide_volume: false,
            support_host: 'https://www.tradingview.com',
        });

        container.appendChild(script);

        return () => {
            if (container) {
                container.innerHTML = '';
            }
        };
    }, [symbol, theme]);

    if (!symbol) return null;

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
            <div
                className="modal-card"
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '92vw',
                    maxWidth: '1200px',
                    height: '82vh',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '16px',
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingUp size={20} color="var(--accent-positive)" />
                        <div>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>
                                Real-Time TradingView Terminal &mdash; {symbol}
                            </h3>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                Live Level-1 Candlesticks with Volume, Indicators & Timeframe Controls
                            </div>
                        </div>
                    </div>
                    <button type="button" className="close-btn" onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Chart Container */}
                <div
                    ref={containerRef}
                    className="tradingview-widget-container"
                    style={{ flex: 1, width: '100%', height: '100%', minHeight: '400px' }}
                />
            </div>
        </div>
    );
};
