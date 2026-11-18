import React, { useEffect, useRef, memo } from 'react';

interface TradingViewTickerTapeProps {
    theme?: 'dark' | 'light';
}

export const TradingViewTickerTape: React.FC<TradingViewTickerTapeProps> = memo(({ theme = 'dark' }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.innerHTML = '';

        const widgetWrap = document.createElement('div');
        widgetWrap.className = 'tradingview-widget-container__widget';
        container.appendChild(widgetWrap);

        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
        script.async = true;
        script.innerHTML = JSON.stringify({
            symbols: [
                { proName: 'INDEX:NIFTY', title: 'NIFTY 50' },
                { proName: 'INDEX:CNXBANK', title: 'BANK NIFTY' },
                { proName: 'BSE:SENSEX', title: 'SENSEX' },
                { proName: 'NSE:CNXIT', title: 'NIFTY IT' },
                { proName: 'NSE:RELIANCE', title: 'RELIANCE' },
                { proName: 'NSE:HDFCBANK', title: 'HDFC BANK' },
                { proName: 'NSE:TCS', title: 'TCS' },
                { proName: 'NSE:INFY', title: 'INFOSYS' },
                { proName: 'NSE:ICICIBANK', title: 'ICICI BANK' },
                { proName: 'NSE:SBIN', title: 'SBI' },
                { proName: 'NSE:BHARTIARTL', title: 'AIRTEL' },
                { proName: 'NSE:TATAMOTORS', title: 'TATA MOTORS' },
                { proName: 'NSE:ITC', title: 'ITC' },
                { proName: 'NSE:LT', title: 'L&T' },
            ],
            showSymbolLogo: true,
            isTransparent: true,
            displayMode: 'adaptive',
            colorTheme: theme === 'light' ? 'light' : 'dark',
            locale: 'in',
        });

        container.appendChild(script);

        return () => {
            if (container) {
                container.innerHTML = '';
            }
        };
    }, [theme]);

    return (
        <div
            className="tradingview-ticker-wrap"
            style={{
                width: '100%',
                overflow: 'hidden',
                borderBottom: '1px solid var(--border-subtle)',
                background: theme === 'light' ? '#ffffff' : '#080d16',
                minHeight: '46px',
            }}
        >
            <div ref={containerRef} className="tradingview-widget-container" />
        </div>
    );
});
