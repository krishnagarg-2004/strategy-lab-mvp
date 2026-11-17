import React from 'react';

interface MetricCardProps {
    label: string;
    value: string;
    sub?: string;
    positive?: boolean;
    tooltip?: string;
    ratingBadge?: {
        text: string;
        tone: 'good' | 'warning' | 'bad' | 'neutral';
    };
}

export const MetricCard: React.FC<MetricCardProps> = ({
    label,
    value,
    sub,
    positive,
    tooltip,
    ratingBadge,
}) => {
    const toneClass = ratingBadge
        ? ratingBadge.tone === 'good'
            ? 'badge-good'
            : ratingBadge.tone === 'bad'
            ? 'badge-bad'
            : ratingBadge.tone === 'warning'
            ? 'badge-warning'
            : 'badge-neutral'
        : '';

    return (
        <div className="metric card-enhanced" title={tooltip || ''}>
            <div className="metric-header-row">
                <span className="metric-label">{label}</span>
                {ratingBadge && (
                    <span className={`metric-rating-badge ${toneClass}`}>
                        {ratingBadge.text}
                    </span>
                )}
            </div>
            <div className={`val ${positive === true ? 'pos' : positive === false ? 'neg' : ''}`}>
                {value}
            </div>
            {sub && <div className="sub">{sub}</div>}
        </div>
    );
};

export function getSharpeRating(sharpe: number | null | undefined): { text: string; tone: 'good' | 'warning' | 'bad' | 'neutral' } {
    if (sharpe === null || sharpe === undefined) return { text: 'N/A', tone: 'neutral' };
    if (sharpe >= 2.0) return { text: '🟢 Institutional', tone: 'good' };
    if (sharpe >= 1.0) return { text: '🟢 Viable Edge', tone: 'good' };
    if (sharpe >= 0.0) return { text: '🟡 Marginal', tone: 'warning' };
    return { text: '🔴 Negative Return', tone: 'bad' };
}

export function getProfitFactorRating(pf: number | null | undefined): { text: string; tone: 'good' | 'warning' | 'bad' | 'neutral' } {
    if (pf === null || pf === undefined) return { text: 'N/A', tone: 'neutral' };
    if (pf >= 1.75) return { text: '🟢 Strong Edge', tone: 'good' };
    if (pf >= 1.25) return { text: '🟢 Profitable', tone: 'good' };
    if (pf >= 1.0) return { text: '🟡 Break-even', tone: 'warning' };
    return { text: '🔴 Losing Rule', tone: 'bad' };
}

export function getDrawdownRating(ddPct: number | null | undefined): { text: string; tone: 'good' | 'warning' | 'bad' | 'neutral' } {
    if (ddPct === null || ddPct === undefined) return { text: 'N/A', tone: 'neutral' };
    const absDd = Math.abs(ddPct);
    if (absDd <= 10.0) return { text: '🟢 Low Risk', tone: 'good' };
    if (absDd <= 20.0) return { text: '🟡 Moderate Risk', tone: 'warning' };
    return { text: '🔴 High Drawdown', tone: 'bad' };
}
