import React, { useState } from 'react';
import { Bot, Shield, Minus, X, Lightbulb, Zap, CheckCircle2, AlertTriangle, ChevronUp, Cpu } from 'lucide-react';
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
    const [isMinimized, setIsMinimized] = useState(false);

    if (!isOpen) return null;

    if (isMinimized) {
        return (
            <div
                className="ai-minimized-pill"
                onClick={() => setIsMinimized(false)}
                title="Click to restore AI Strategy Assistant"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
                <Bot size={16} />
                <span>AI Strategy Assistant</span>
                <span style={{ fontSize: '11px', opacity: 0.75, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    <ChevronUp size={12} /> Expand
                </span>
            </div>
        );
    }

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
        setIsMinimized(true); // minimize floating window so user sees the lab update!
    };

    return (
        <div className="ai-floating-window">
            {/* Floating Window Header */}
            <div className="ai-floating-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bot size={18} color="var(--brand-primary)" />
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            AI Strategy Assistant
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            Groq LPU + Gemini 2.5 Flash
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                        type="button"
                        className="ai-control-btn"
                        onClick={() => setIsMinimized(true)}
                        title="Minimize to floating pill"
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Minus size={13} />
                    </button>
                    <button
                        type="button"
                        className="ai-control-btn"
                        onClick={onClose}
                        title="Close assistant"
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <X size={13} />
                    </button>
                </div>
            </div>

            {/* Floating Window Body */}
            <div className="ai-floating-body">
                {/* Engine Protection Notice */}
                <div
                    style={{
                        background: 'rgba(99, 223, 176, 0.08)',
                        border: '1px solid rgba(99, 223, 176, 0.25)',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '11px',
                        color: 'var(--accent-positive)',
                        lineHeight: 1.35,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                    }}
                >
                    <Shield size={14} style={{ flexShrink: 0 }} />
                    <span><strong>Engine Locked:</strong> Natural language is compiled strictly into validated parameters without modifying backtest math.</span>
                </div>

                {/* Example Prompts */}
                <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>
                        Quick templates:
                    </div>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        {EXAMPLE_PROMPTS.map((ex, i) => (
                            <button
                                key={i}
                                type="button"
                                className="tag-badge"
                                style={{
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    fontSize: '10.5px',
                                    padding: '3px 7px',
                                    background: 'var(--surface-card)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                }}
                                onClick={() => {
                                    setPromptText(ex);
                                    handleCompile(ex);
                                }}
                            >
                                <Lightbulb size={11} color="var(--brand-primary)" /> {ex.length > 40 ? `${ex.substring(0, 40)}…` : ex}
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
                        style={{ width: '100%', resize: 'vertical', fontSize: '12px' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            15,900+ daily free compilations
                        </span>
                        <button
                            type="submit"
                            className="run"
                            disabled={loading || !promptText.trim()}
                            style={{ padding: '6px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            {loading ? (
                                <>
                                    <Cpu size={13} className="spin" /> Interpreting…
                                </>
                            ) : (
                                <>
                                    <Zap size={13} /> Compile
                                </>
                            )}
                        </button>
                    </div>
                </form>

                {error && (
                    <div style={{ color: 'var(--accent-negative)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={13} /> {error}
                    </div>
                )}

                {/* Reviewable Strategy Blueprint Card */}
                {compiledResult && (
                    <div
                        className="compiled-strategy-card"
                        style={{
                            background: 'var(--surface-card)',
                            border: '1px solid var(--brand-primary)',
                            borderRadius: '8px',
                            padding: '12px',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: 'var(--accent-positive)', fontWeight: 700, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <CheckCircle2 size={13} /> INTERPRETED BLUEPRINT
                                </span>
                                {compiledResult.provider && (
                                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', background: 'var(--surface-panel)', padding: '1px 5px', borderRadius: '4px' }}>
                                        {compiledResult.provider}
                                    </span>
                                )}
                            </div>
                            <span className="category-pill" style={{ fontSize: '9px' }}>
                                {compiledResult.strategy.trade_direction}
                            </span>
                        </div>

                        <div style={{ fontWeight: 700, fontSize: '13px', margin: '2px 0 4px' }}>
                            {compiledResult.strategy.name}
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.35, margin: '2px 0 8px' }}>
                            {compiledResult.explanation}
                        </p>

                        {/* Rules Grid */}
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: '6px',
                                background: 'var(--surface-panel)',
                                padding: '8px',
                                borderRadius: '6px',
                                fontSize: '10.5px',
                                marginBottom: '10px',
                            }}
                        >
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>EMA Crossover:</span>{' '}
                                <strong>{compiledResult.strategy.fast_ema} / {compiledResult.strategy.slow_ema}</strong>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>RSI Filter:</span>{' '}
                                <strong>{compiledResult.strategy.use_rsi_filter ? `> ${compiledResult.strategy.rsi_min}` : 'Off'}</strong>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>Stop Loss:</span>{' '}
                                <strong style={{ color: 'var(--accent-negative)' }}>{compiledResult.strategy.stop_loss_pct}%</strong>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>Profit Target:</span>{' '}
                                <strong style={{ color: 'var(--accent-positive)' }}>{compiledResult.strategy.take_profit_pct}%</strong>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>Supertrend:</span>{' '}
                                <strong>{compiledResult.strategy.use_supertrend_filter ? 'On' : 'Off'}</strong>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>VWAP Filter:</span>{' '}
                                <strong>{compiledResult.strategy.use_vwap_filter ? 'On' : 'Off'}</strong>
                            </div>
                            {compiledResult.suggested_symbol && (
                                <div style={{ gridColumn: 'span 2' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Target Stock:</span>{' '}
                                    <strong style={{ color: 'var(--brand-primary)' }}>{compiledResult.suggested_symbol}</strong>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                className="btn-outline"
                                onClick={() => setCompiledResult(null)}
                                style={{ padding: '6px 12px', fontSize: '11px' }}
                            >
                                Discard
                            </button>
                            <button
                                type="button"
                                className="run"
                                onClick={handleConfirm}
                                style={{ padding: '6px 16px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <Zap size={13} /> Load into Lab
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
