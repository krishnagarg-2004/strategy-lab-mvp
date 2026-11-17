import React, { useState } from 'react';
import type { StrategyConfig } from './StrategyPresets';

export interface AICompileResponse {
    strategy: StrategyConfig;
    suggested_symbol?: string | null;
    explanation: string;
    provider?: string;
}

interface AIChatDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    apiBase: string;
    onApplyStrategy: (strategy: StrategyConfig, symbol?: string) => void;
}

const EXAMPLE_PROMPTS = [
    'Buy Nifty when 9 EMA crosses 21 EMA with RSI above 55. Stop loss 0.5% and target 1.2%.',
    'Run a classic Golden Cross (50 and 200 EMA) on Reliance with a 2% stop loss and 5% target.',
    'Intraday short-only breakdown when fast 8 EMA crosses below 20 EMA with Supertrend filter.',
    'Trend follower on BankNifty using Supertrend and VWAP with a 0.75% trailing stop loss.',
];

export const AIChatDrawer: React.FC<AIChatDrawerProps> = ({
    isOpen,
    onClose,
    apiBase,
    onApplyStrategy,
}) => {
    const [promptText, setPromptText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [compiledResult, setCompiledResult] = useState<AICompileResponse | null>(null);

    if (!isOpen) return null;

    const handleCompile = async (textToCompile?: string) => {
        const text = (textToCompile || promptText).trim();
        if (!text) return;

        setLoading(true);
        setError('');
        setCompiledResult(null);

        try {
            const res = await fetch(`${apiBase}/api/ai/compile-strategy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: text }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Failed to interpret strategy');
            }

            const data = await res.json();
            setCompiledResult(data as AICompileResponse);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error interpreting strategy');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = () => {
        if (!compiledResult) return;
        onApplyStrategy(compiledResult.strategy, compiledResult.suggested_symbol || undefined);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-card ai-drawer-card"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '640px', width: '95%' }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>🤖</span>
                        <div>
                            <h3 style={{ margin: 0 }}>AI Strategy Assistant</h3>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                Natural Language to Deterministic Engine Compiler
                            </div>
                        </div>
                    </div>
                    <button type="button" className="close-btn" onClick={onClose}>
                        ✕
                    </button>
                </div>

                {/* Engine Protection Notice */}
                <div
                    style={{
                        background: 'rgba(99, 223, 176, 0.08)',
                        border: '1px solid rgba(99, 223, 176, 0.25)',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '11px',
                        color: 'var(--accent-positive)',
                        margin: '12px 0',
                    }}
                >
                    🛡️ <strong>Engine Integrity Active:</strong> The AI cannot tamper with or hallucinate backtest calculations. It strictly interprets your prompt into validated parameters for your review.
                </div>

                {/* Example Prompts */}
                <div style={{ margin: '8px 0 14px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                        Try an example:
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {EXAMPLE_PROMPTS.map((ex, i) => (
                            <button
                                key={i}
                                type="button"
                                className="tag-badge"
                                style={{ cursor: 'pointer', textAlign: 'left', fontSize: '11px', padding: '4px 8px' }}
                                onClick={() => {
                                    setPromptText(ex);
                                    handleCompile(ex);
                                }}
                            >
                                💡 {ex.length > 55 ? `${ex.substring(0, 55)}…` : ex}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Input Form */}
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleCompile();
                    }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                >
                    <textarea
                        rows={3}
                        placeholder="Describe your strategy in ordinary English (e.g. 'Buy Nifty when 9 EMA crosses above 21 EMA with RSI above 55. Stop loss 0.5% and target 1.2%')…"
                        value={promptText}
                        onChange={(e) => setPromptText(e.target.value)}
                        style={{ width: '100%', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Powered by Groq LPU + Google Gemini 2.5 Flash
                        </span>
                        <button
                            type="submit"
                            className="run"
                            disabled={loading || !promptText.trim()}
                            style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            {loading ? '🧠 Interpreting…' : '⚡ Compile Strategy'}
                        </button>
                    </div>
                </form>

                {error && (
                    <div style={{ color: 'var(--accent-negative)', fontSize: '12px', marginTop: '10px' }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* Reviewable Strategy Blueprint Card */}
                {compiledResult && (
                    <div
                        className="compiled-strategy-card"
                        style={{
                            marginTop: '16px',
                            background: 'var(--surface-card)',
                            border: '1px solid var(--brand-primary)',
                            borderRadius: '8px',
                            padding: '16px',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: 'var(--accent-positive)', fontWeight: 700, fontSize: '12px' }}>
                                    ✓ INTERPRETED STRATEGY BLUEPRINT
                                </span>
                                {compiledResult.provider && (
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--surface-panel)', padding: '2px 6px', borderRadius: '4px' }}>
                                        {compiledResult.provider}
                                    </span>
                                )}
                            </div>
                            <span className="category-pill">{compiledResult.strategy.trade_direction}</span>
                        </div>

                        <h4 style={{ margin: '4px 0 8px', fontSize: '15px' }}>{compiledResult.strategy.name}</h4>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4, margin: '4px 0 12px' }}>
                            {compiledResult.explanation}
                        </p>

                        {/* Rules Grid */}
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                                gap: '8px',
                                background: 'var(--surface-panel)',
                                padding: '10px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                marginBottom: '14px',
                            }}
                        >
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>Crossover:</span>{' '}
                                <strong>{compiledResult.strategy.fast_ema} / {compiledResult.strategy.slow_ema} EMA</strong>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>RSI Filter:</span>{' '}
                                <strong>{compiledResult.strategy.use_rsi_filter ? `> ${compiledResult.strategy.rsi_min}` : 'Disabled'}</strong>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>Stop Loss:</span>{' '}
                                <strong style={{ color: 'var(--accent-negative)' }}>{compiledResult.strategy.stop_loss_pct}%</strong>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>Target:</span>{' '}
                                <strong style={{ color: 'var(--accent-positive)' }}>{compiledResult.strategy.take_profit_pct}%</strong>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>Supertrend:</span>{' '}
                                <strong>{compiledResult.strategy.use_supertrend_filter ? 'Active' : 'Off'}</strong>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>VWAP Filter:</span>{' '}
                                <strong>{compiledResult.strategy.use_vwap_filter ? 'Active' : 'Off'}</strong>
                            </div>
                            {compiledResult.suggested_symbol && (
                                <div>
                                    <span style={{ color: 'var(--text-muted)' }}>Target Stock:</span>{' '}
                                    <strong style={{ color: 'var(--brand-primary)' }}>{compiledResult.suggested_symbol}</strong>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                className="btn-outline"
                                onClick={() => setCompiledResult(null)}
                                style={{ padding: '8px 16px' }}
                            >
                                Discard & Revise
                            </button>
                            <button
                                type="button"
                                className="run"
                                onClick={handleConfirm}
                                style={{ padding: '8px 22px', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                ⚡ Confirm & Load into Lab
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
