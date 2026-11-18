import React, { useState } from 'react';
import {
    loginWithEmail,
    registerWithEmail,
    logoutUser,
    saveSupabaseConfig,
    type UserProfile,
} from '../lib/supabase';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: UserProfile | null;
    onAuthSuccess: (user: UserProfile | null) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
    isOpen,
    onClose,
    currentUser,
    onAuthSuccess,
}) => {
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Supabase project config drawer
    const [showConfig, setShowConfig] = useState(false);
    const [customUrl, setCustomUrl] = useState('');
    const [customKey, setCustomKey] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            if (mode === 'signup') {
                const profile = await registerWithEmail(email, password, name);
                setSuccessMsg('✓ Account created successfully! Logged in as verified trader.');
                setTimeout(() => {
                    onAuthSuccess(profile);
                    onClose();
                }, 1000);
            } else {
                const profile = await loginWithEmail(email, password);
                setSuccessMsg('✓ Signed in successfully!');
                setTimeout(() => {
                    onAuthSuccess(profile);
                    onClose();
                }, 800);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await logoutUser();
        onAuthSuccess(null);
        onClose();
    };

    const handleSaveConfig = () => {
        if (!customUrl.trim() || !customKey.trim()) {
            setError('Please enter both Project URL and Anon Key');
            return;
        }
        saveSupabaseConfig(customUrl, customKey);
        setSuccessMsg('✓ Supabase config updated!');
        setTimeout(() => setSuccessMsg(''), 2000);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-card auth-modal-card"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '440px', width: '92%' }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>🛡️</span>
                        <div>
                            <h3 style={{ margin: 0 }}>
                                {currentUser ? 'Verified Trader Profile' : 'Trader Authentication'}
                            </h3>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                Supabase Auth & Verified Community Identity
                            </div>
                        </div>
                    </div>
                    <button type="button" className="close-btn" onClick={onClose}>
                        ✕
                    </button>
                </div>

                {/* If Logged In: Show Profile */}
                {currentUser ? (
                    <div style={{ marginTop: '16px' }}>
                        <div
                            style={{
                                background: 'var(--surface-card)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '8px',
                                padding: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '14px',
                            }}
                        >
                            <div
                                style={{
                                    width: '46px',
                                    height: '46px',
                                    borderRadius: '50%',
                                    background: 'rgba(99, 223, 176, 0.15)',
                                    color: 'var(--accent-positive)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '18px',
                                }}
                            >
                                {currentUser.name ? currentUser.name[0].toUpperCase() : 'T'}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <strong style={{ fontSize: '15px' }}>{currentUser.name}</strong>
                                    <span
                                        style={{
                                            fontSize: '10px',
                                            background: 'rgba(16, 185, 129, 0.15)',
                                            color: 'var(--accent-positive)',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontWeight: 700,
                                        }}
                                    >
                                        ✓ Verified Quant
                                    </span>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {currentUser.email}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            Your verified profile is automatically attached when you publish strategies to the Community Hub and export institutional PDF fact sheets.
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
                            <button type="button" className="btn-outline" onClick={onClose}>
                                Close
                            </button>
                            <button
                                type="button"
                                className="btn-outline"
                                style={{ borderColor: 'var(--accent-negative)', color: 'var(--accent-negative)' }}
                                onClick={handleLogout}
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                ) : (
                    /* If Logged Out: Show Sign In / Sign Up Form */
                    <div style={{ marginTop: '16px' }}>
                        {/* Tab Switcher */}
                        <div className="tab-group" style={{ marginBottom: '16px' }}>
                            <button
                                type="button"
                                className={`tab-btn ${mode === 'signin' ? 'active' : ''}`}
                                onClick={() => setMode('signin')}
                            >
                                Sign In
                            </button>
                            <button
                                type="button"
                                className={`tab-btn ${mode === 'signup' ? 'active' : ''}`}
                                onClick={() => setMode('signup')}
                            >
                                Create Account
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {mode === 'signup' && (
                                <label>
                                    Trader Name / Handle *
                                    <input
                                        required
                                        type="text"
                                        placeholder="e.g. Arjun Mehta"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                </label>
                            )}

                            <label>
                                Email Address *
                                <input
                                    required
                                    type="email"
                                    placeholder="trader@domain.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </label>

                            <label>
                                Password *
                                <input
                                    required
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </label>

                            {error && (
                                <div style={{ color: 'var(--accent-negative)', fontSize: '12px' }}>
                                    ⚠️ {error}
                                </div>
                            )}

                            {successMsg && (
                                <div style={{ color: 'var(--accent-positive)', fontSize: '12px' }}>
                                    {successMsg}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="run"
                                disabled={loading}
                                style={{ marginTop: '6px', padding: '10px' }}
                            >
                                {loading ? 'Authenticating…' : mode === 'signin' ? 'Sign In to Strategy Lab' : 'Create Verified Profile'}
                            </button>
                        </form>

                        {/* Optional Project Config Toggle */}
                        <div style={{ marginTop: '14px', textAlign: 'center' }}>
                            <button
                                type="button"
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                                onClick={() => setShowConfig(!showConfig)}
                            >
                                {showConfig ? 'Hide Supabase Project Credentials' : '⚙ Connect Custom Supabase Project'}
                            </button>
                        </div>

                        {showConfig && (
                            <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '10px', marginTop: '10px' }}>
                                <label style={{ fontSize: '11px' }}>
                                    Supabase Project URL
                                    <input
                                        type="text"
                                        placeholder="https://xyzcompany.supabase.co"
                                        value={customUrl}
                                        onChange={(e) => setCustomUrl(e.target.value)}
                                    />
                                </label>
                                <label style={{ fontSize: '11px', marginTop: '6px' }}>
                                    Supabase Anon Public Key
                                    <input
                                        type="password"
                                        placeholder="eyJhbGciOi..."
                                        value={customKey}
                                        onChange={(e) => setCustomKey(e.target.value)}
                                    />
                                </label>
                                <button
                                    type="button"
                                    className="btn-outline"
                                    style={{ marginTop: '8px', width: '100%', fontSize: '11px', padding: '4px' }}
                                    onClick={handleSaveConfig}
                                >
                                    Save Custom Credentials
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
