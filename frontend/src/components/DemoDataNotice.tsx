import React from 'react';

interface DemoDataNoticeProps {
    dataSource: string;
    isRealMarketData: boolean | null;
    symbol: string;
    onSwitchToRealData?: () => void;
}

export const DemoDataNotice: React.FC<DemoDataNoticeProps> = ({
    dataSource,
    isRealMarketData,
    symbol,
    onSwitchToRealData,
}) => {
    const isSynthetic = dataSource.includes('synthetic') || isRealMarketData === false;
    const isCsv = dataSource.includes('csv') || isRealMarketData === null;
    const isReal = isRealMarketData === true || dataSource.includes('market_data');

    if (isReal) {
        return (
            <div className="data-provenance-banner real-data-banner">
                <div className="banner-icon">🟢</div>
                <div className="banner-content">
                    <strong>REAL MARKET DATA ACTIVE:</strong> This backtest was executed against authentic historical candle data for <strong>{symbol}</strong> from National Stock Exchange (NSE).
                </div>
            </div>
        );
    }

    if (isCsv) {
        return (
            <div className="data-provenance-banner csv-data-banner">
                <div className="banner-icon">📁</div>
                <div className="banner-content">
                    <strong>USER-UPLOADED CSV DATA:</strong> Simulating against your custom uploaded candle dataset. Ensure timestamps, columns, and prices match NSE trade standards.
                </div>
            </div>
        );
    }

    if (isSynthetic) {
        return (
            <div className="data-provenance-banner synthetic-data-banner">
                <div className="banner-icon">⚠️</div>
                <div className="banner-content">
                    <div>
                        <strong>DEMO MODE (SYNTHETIC DATA):</strong> You are currently testing against a generated sinusoidal math wave for UI demonstration. <strong>Do NOT make financial decisions based on synthetic results.</strong>
                    </div>
                    {onSwitchToRealData && (
                        <button
                            type="button"
                            className="switch-real-btn"
                            onClick={onSwitchToRealData}
                        >
                            ⚡ Switch to Real NSE Indian Data
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return null;
};
