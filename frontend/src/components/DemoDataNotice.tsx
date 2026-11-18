import React from 'react';
import { CheckCircle2, FileSpreadsheet, AlertTriangle, Zap } from 'lucide-react';

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
                <div className="banner-icon" style={{ display: 'flex', alignItems: 'center' }}>
                    <CheckCircle2 size={16} color="var(--accent-positive)" />
                </div>
                <div className="banner-content">
                    <strong>REAL MARKET DATA ACTIVE:</strong> This backtest was executed against authentic historical candle data for <strong>{symbol}</strong> from National Stock Exchange (NSE).
                </div>
            </div>
        );
    }

    if (isCsv) {
        return (
            <div className="data-provenance-banner csv-data-banner">
                <div className="banner-icon" style={{ display: 'flex', alignItems: 'center' }}>
                    <FileSpreadsheet size={16} color="#38bdf8" />
                </div>
                <div className="banner-content">
                    <strong>USER-UPLOADED CSV DATA:</strong> Simulating against your custom uploaded candle dataset. Ensure timestamps, columns, and prices match NSE trade standards.
                </div>
            </div>
        );
    }

    if (isSynthetic) {
        return (
            <div className="data-provenance-banner synthetic-data-banner">
                <div className="banner-icon" style={{ display: 'flex', alignItems: 'center' }}>
                    <AlertTriangle size={16} color="#f59e0b" />
                </div>
                <div className="banner-content">
                    <div>
                        <strong>DEMO MODE (SYNTHETIC DATA):</strong> You are currently testing against a generated sinusoidal math wave for UI demonstration. <strong>Do NOT make financial decisions based on synthetic results.</strong>
                    </div>
                    {onSwitchToRealData && (
                        <button
                            type="button"
                            className="switch-real-btn"
                            onClick={onSwitchToRealData}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                            <Zap size={13} /> Switch to Real NSE Indian Data
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return null;
};
