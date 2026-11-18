import React, { useState, useEffect } from 'react';
import {
    Share2,
    Heart,
    MessageSquare,
    GitFork,
    Zap,
    X,
    CheckCircle2,
    FlaskConical,
    SlidersHorizontal,
    Search,
} from 'lucide-react';
import type { StrategyConfig } from './StrategyPresets';
import type { UserProfile } from '../lib/supabase';

export interface VerifiedStats {
    symbol: string;
    return_pct: number;
    win_rate_pct: number;
    sharpe_ratio?: number | null;
    max_drawdown_pct: number;
}

export interface CommunityStrategyItem {
    id: number;
    created_at: string;
    title: string;
    description: string;
    author_name: string;
    category: string;
    tags: string[];
    strategy: StrategyConfig;
    verified_stats?: VerifiedStats | null;
    likes_count: number;
    copies_count: number;
    comment_count: number;
}

export interface StrategyCommentItem {
    id: number;
    strategy_id: number;
    created_at: string;
    author_name: string;
    comment: string;
}

interface CommunityHubProps {
    apiBase: string;
    currentStrategy: StrategyConfig;
    latestVerifiedStats?: VerifiedStats | null;
    currentUser?: UserProfile | null;
    onOpenAuth?: () => void;
    onCopyStrategyToLab: (strategy: StrategyConfig, symbol?: string) => void;
}

export const CommunityHub: React.FC<CommunityHubProps> = ({
    apiBase,
    currentStrategy,
    latestVerifiedStats,
    currentUser,
    onOpenAuth,
    onCopyStrategyToLab,
}) => {
    const [strategies, setStrategies] = useState<CommunityStrategyItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [showPublishModal, setShowPublishModal] = useState(false);

    // Publish form state
    const [publishTitle, setPublishTitle] = useState('');
    const [publishDesc, setPublishDesc] = useState('');
    const [publishAuthor, setPublishAuthor] = useState(() => currentUser?.name || currentUser?.email || '');
    const [publishCategory, setPublishCategory] = useState('Intraday');
    const [publishTags, setPublishTags] = useState('momentum,nifty');
    const [includeVerifiedStats, setIncludeVerifiedStats] = useState(true);
    const [publishStatus, setPublishStatus] = useState('');

    // Comments modal state
    const [activeCommentsStrategy, setActiveCommentsStrategy] = useState<CommunityStrategyItem | null>(null);
    const [commentsList, setCommentsList] = useState<StrategyCommentItem[]>([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [newCommentAuthor, setNewCommentAuthor] = useState(() => currentUser?.name || currentUser?.email || '');
    const [newCommentText, setNewCommentText] = useState('');

    useEffect(() => {
        if (currentUser) {
            setPublishAuthor(currentUser.name || currentUser.email);
            setNewCommentAuthor(currentUser.name || currentUser.email);
        }
    }, [currentUser]);

    const fetchStrategies = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedCategory !== 'All') params.append('category', selectedCategory);
            if (searchQuery.trim()) params.append('q', searchQuery.trim());

            const res = await fetch(`${apiBase}/api/community/strategies?${params.toString()}`);
            const data = await res.json();
            if (data.strategies && Array.isArray(data.strategies)) {
                setStrategies(data.strategies);
            }
        } catch (e) {
            console.error('Failed to load community strategies:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStrategies();
    }, [selectedCategory]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchStrategies();
    };

    const handleLike = async (id: number) => {
        try {
            const res = await fetch(`${apiBase}/api/community/strategies/${id}/like`, { method: 'POST' });
            const data = await res.json();
            setStrategies((prev) =>
                prev.map((s) => (s.id === id ? { ...s, likes_count: data.likes_count } : s)),
            );
        } catch (e) {
            console.error('Like failed:', e);
        }
    };

    const handleFork = async (strat: CommunityStrategyItem) => {
        try {
            await fetch(`${apiBase}/api/community/strategies/${strat.id}/fork`, { method: 'POST' });
            setStrategies((prev) =>
                prev.map((s) => (s.id === strat.id ? { ...s, copies_count: s.copies_count + 1 } : s)),
            );
        } catch {
            // non-blocking
        }
        onCopyStrategyToLab(strat.strategy, strat.verified_stats?.symbol);
    };

    const openComments = async (strat: CommunityStrategyItem) => {
        setActiveCommentsStrategy(strat);
        setCommentsLoading(true);
        try {
            const res = await fetch(`${apiBase}/api/community/strategies/${strat.id}`);
            const data = await res.json();
            setCommentsList(data.comments || []);
        } catch (e) {
            console.error('Failed to fetch comments:', e);
        } finally {
            setCommentsLoading(false);
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeCommentsStrategy || !newCommentText.trim()) return;

        try {
            const res = await fetch(`${apiBase}/api/community/strategies/${activeCommentsStrategy.id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    author_name: newCommentAuthor.trim() || 'Trader',
                    comment: newCommentText.trim(),
                }),
            });
            const data = await res.json();
            if (data.comment) {
                setCommentsList((prev) => [data.comment, ...prev]);
                setNewCommentText('');
                // update comment count on card
                setStrategies((prev) =>
                    prev.map((s) =>
                        s.id === activeCommentsStrategy.id
                            ? { ...s, comment_count: s.comment_count + 1 }
                            : s,
                    ),
                );
            }
        } catch (e) {
            console.error('Post comment failed:', e);
        }
    };

    const handlePublish = async (e: React.FormEvent) => {
        e.preventDefault();
        setPublishStatus('Publishing strategy…');
        try {
            const payload = {
                title: publishTitle.trim(),
                description: publishDesc.trim(),
                author_name: publishAuthor.trim() || 'Anonymous Quant',
                category: publishCategory,
                tags: publishTags,
                strategy: currentStrategy,
                verified_stats: includeVerifiedStats && latestVerifiedStats ? latestVerifiedStats : null,
            };

            const res = await fetch(`${apiBase}/api/community/strategies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Failed to publish');
            }

            setPublishStatus('Published successfully to community gallery!');
            setTimeout(() => {
                setShowPublishModal(false);
                setPublishStatus('');
                setPublishTitle('');
                setPublishDesc('');
                fetchStrategies();
            }, 1200);
        } catch (err) {
            setPublishStatus(err instanceof Error ? err.message : 'Error publishing strategy');
        }
    };

    const categories = ['All', 'Intraday', 'Swing', 'Momentum', 'Mean Reversion'];

    return (
        <div className="community-workspace animated-tab-enter">
            {/* Header / Intro */}
            <div className="panel result-head">
                <div>
                    <span className="eyebrow">COMMUNITY / STRATEGY SHARING</span>
                    <h2>Quantitative Strategy Showcase & Exchange</h2>
                    <p>
                        Discover, test, and discuss trading strategies published by fellow quantitative traders.
                        Every strategy can be copied directly into your personal workspace with a single click.
                    </p>
                </div>
                <button
                    className="run"
                    onClick={() => setShowPublishModal(true)}
                    style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Share2 size={15} /> Share My Strategy
                </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="community-toolbar" style={{ margin: '16px 0', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            type="button"
                            className={`chip-btn ${selectedCategory === cat ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        placeholder="Search strategies, tags, authors…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ padding: '6px 12px', minWidth: '240px' }}
                    />
                    <button type="submit" className="btn-outline" style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Search size={13} /> Search
                    </button>
                </form>
            </div>

            {/* Strategies Grid */}
            {loading && <div style={{ textAlign: 'center', padding: '32px' }}>Loading community strategies…</div>}

            {!loading && strategies.length === 0 && (
                <div className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                        <FlaskConical size={36} color="var(--brand-primary)" />
                    </div>
                    <h3>No strategies found</h3>
                    <p style={{ color: 'var(--text-muted)', maxWidth: '420px', margin: '8px auto' }}>
                        Be the first to publish your trading strategy! Run a backtest in the Single Run tab and share it with the community.
                    </p>
                    <button
                        className="run"
                        onClick={() => setShowPublishModal(true)}
                        style={{ marginTop: '16px', padding: '8px 20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                        <Share2 size={14} /> Share Your Active Strategy
                    </button>
                </div>
            )}

            <div className="community-grid">
                {strategies.map((strat) => {
                    const stats = strat.verified_stats;
                    return (
                        <div key={strat.id} className="strategy-community-card">
                            <div className="card-top-row">
                                <span className="category-pill">{strat.category}</span>
                                <span className="author-name">By {strat.author_name}</span>
                            </div>

                            <h3 className="strategy-card-title">{strat.title}</h3>
                            <p className="strategy-card-desc">{strat.description}</p>

                            {/* Tags */}
                            <div className="strategy-tags-row">
                                {strat.tags.map((tag) => (
                                    <span key={tag} className="tag-badge">
                                        #{tag}
                                    </span>
                                ))}
                            </div>

                            {/* Verified Performance Banner */}
                            {stats && (
                                <div className="verified-performance-box">
                                    <div className="verified-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <CheckCircle2 size={12} /> Verified Engine Backtest
                                    </div>
                                    <div className="verified-stats-row">
                                        <div>
                                            <div className="stat-label">Return</div>
                                            <div className={`stat-val ${stats.return_pct >= 0 ? 'pos' : 'neg'}`}>
                                                {stats.return_pct > 0 ? '+' : ''}{stats.return_pct}%
                                            </div>
                                        </div>
                                        <div>
                                            <div className="stat-label">Win Rate</div>
                                            <div className="stat-val">{stats.win_rate_pct}%</div>
                                        </div>
                                        <div>
                                            <div className="stat-label">Sharpe</div>
                                            <div className="stat-val">{stats.sharpe_ratio ?? 'N/A'}</div>
                                        </div>
                                        <div>
                                            <div className="stat-label">Max DD</div>
                                            <div className="stat-val neg">{stats.max_drawdown_pct}%</div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        Tested on {stats.symbol} with statutory frictions
                                    </div>
                                </div>
                            )}

                            {/* Rules Summary Card */}
                            <div className="strategy-rules-pill" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <SlidersHorizontal size={12} style={{ flexShrink: 0 }} />
                                <span>{strat.strategy.trade_direction} · Fast EMA {strat.strategy.fast_ema} / Slow {strat.strategy.slow_ema} · SL {strat.strategy.stop_loss_pct}% / TP {strat.strategy.take_profit_pct}
                                {strat.strategy.use_rsi_filter ? ` · RSI > ${strat.strategy.rsi_min}` : ''}
                                {strat.strategy.use_supertrend_filter ? ' · Supertrend' : ''}</span>
                            </div>

                            {/* Actions Footer */}
                            <div className="card-footer-row">
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <button
                                        type="button"
                                        className="btn-icon-count"
                                        onClick={() => handleLike(strat.id)}
                                        title="Like this strategy"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        <Heart size={13} color="var(--accent-negative)" /> {strat.likes_count}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-icon-count"
                                        onClick={() => openComments(strat)}
                                        title="View discussion & comments"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        <MessageSquare size={13} /> {strat.comment_count}
                                    </button>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <GitFork size={13} /> {strat.copies_count} forks
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    className="btn-fork-strategy"
                                    onClick={() => handleFork(strat)}
                                    title="Copy this strategy into your workspace to test"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                    <Zap size={13} /> Copy to My Lab
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Publish Strategy Modal */}
            {showPublishModal && (
                <div className="modal-overlay" onClick={() => setShowPublishModal(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3>Share Strategy to Community</h3>
                            <button
                                type="button"
                                className="close-btn"
                                onClick={() => setShowPublishModal(false)}
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0 16px' }}>
                            Publish your strategy configuration so traders across the community can study, test, and discuss it.
                        </p>

                        <form onSubmit={handlePublish} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {currentUser ? (
                                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', padding: '8px 12px', fontSize: '11px', color: 'var(--accent-positive)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <CheckCircle2 size={13} /> Publishing as Verified Trader: <strong>{currentUser.name}</strong> ({currentUser.email})
                                </div>
                            ) : (
                                <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Publishing as Guest Trader</span>
                                    {onOpenAuth && (
                                        <button type="button" className="btn-outline" style={{ fontSize: '10px', padding: '2px 8px' }} onClick={onOpenAuth}>
                                            Sign In for Verified Badge
                                        </button>
                                    )}
                                </div>
                            )}

                            <label>
                                Strategy Title *
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g., BankNifty 9/21 RSI Breakout"
                                    value={publishTitle}
                                    onChange={(e) => setPublishTitle(e.target.value)}
                                />
                            </label>

                            <label>
                                Description & Trade Rationale *
                                <textarea
                                    required
                                    rows={3}
                                    placeholder="Explain how this strategy enters, manages risk, and in what market conditions it thrives…"
                                    value={publishDesc}
                                    onChange={(e) => setPublishDesc(e.target.value)}
                                    style={{ width: '100%', resize: 'vertical' }}
                                />
                            </label>

                            <div className="two">
                                <label>
                                    Your Handle / Author Name
                                    <input
                                        type="text"
                                        placeholder="e.g., ArjunQuant"
                                        value={publishAuthor}
                                        onChange={(e) => setPublishAuthor(e.target.value)}
                                    />
                                </label>
                                <label>
                                    Category
                                    <select
                                        value={publishCategory}
                                        onChange={(e) => setPublishCategory(e.target.value)}
                                    >
                                        <option value="Intraday">Intraday</option>
                                        <option value="Swing">Swing</option>
                                        <option value="Momentum">Momentum</option>
                                        <option value="Mean Reversion">Mean Reversion</option>
                                        <option value="Options Proxy">Options Proxy</option>
                                    </select>
                                </label>
                            </div>

                            <label>
                                Tags (comma-separated)
                                <input
                                    type="text"
                                    placeholder="e.g., nifty, banknifty, momentum, intraday"
                                    value={publishTags}
                                    onChange={(e) => setPublishTags(e.target.value)}
                                />
                            </label>

                            {latestVerifiedStats && (
                                <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px 14px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                                        <input
                                            type="checkbox"
                                            checked={includeVerifiedStats}
                                            onChange={(e) => setIncludeVerifiedStats(e.target.checked)}
                                        />
                                        <span>Attach verified backtest proof (+{latestVerifiedStats.return_pct}% on {latestVerifiedStats.symbol})</span>
                                    </label>
                                </div>
                            )}

                            {publishStatus && (
                                <div style={{ fontSize: '13px', color: publishStatus.toLowerCase().includes('success') ? '#10B981' : '#F59E0B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <CheckCircle2 size={13} /> {publishStatus}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                                <button type="button" className="btn-outline" onClick={() => setShowPublishModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="run" style={{ padding: '8px 20px' }}>
                                    Publish to Community
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Comments & Discussion Modal */}
            {activeCommentsStrategy && (
                <div className="modal-overlay" onClick={() => setActiveCommentsStrategy(null)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3>Discussion: {activeCommentsStrategy.title}</h3>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    By {activeCommentsStrategy.author_name} · {commentsList.length} comments
                                </div>
                            </div>
                            <button
                                type="button"
                                className="close-btn"
                                onClick={() => setActiveCommentsStrategy(null)}
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Add Comment Form */}
                        <form onSubmit={handleAddComment} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div className="two">
                                <input
                                    type="text"
                                    placeholder="Your Name / Handle"
                                    value={newCommentAuthor}
                                    onChange={(e) => setNewCommentAuthor(e.target.value)}
                                    style={{ padding: '8px 12px' }}
                                />
                                <button type="submit" className="run" style={{ padding: '8px 16px' }}>
                                    Post Feedback
                                </button>
                            </div>
                            <textarea
                                required
                                rows={2}
                                placeholder="Share your backtest observations, improvements, or questions about this strategy…"
                                value={newCommentText}
                                onChange={(e) => setNewCommentText(e.target.value)}
                                style={{ width: '100%', resize: 'vertical' }}
                            />
                        </form>

                        {/* Comments List */}
                        <div className="comments-stream" style={{ marginTop: '20px', maxHeight: '320px', overflowY: 'auto' }}>
                            {commentsLoading && <div>Loading discussion…</div>}
                            {!commentsLoading && commentsList.length === 0 && (
                                <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0', textAlign: 'center' }}>
                                    No comments yet. Be the first to start the discussion!
                                </div>
                            )}
                            {commentsList.map((c) => (
                                <div key={c.id} className="comment-item" style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                        <strong style={{ color: 'var(--text-main)' }}>{c.author_name}</strong>
                                        <span style={{ color: 'var(--text-muted)' }}>
                                            {c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '13px', marginTop: '4px', color: 'var(--text-secondary)' }}>
                                        {c.comment}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
