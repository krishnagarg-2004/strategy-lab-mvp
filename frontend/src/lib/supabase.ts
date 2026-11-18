import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';

// Environment Supabase config (or fallback to local session state)
const ENV_SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const ENV_SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export interface UserProfile {
    id: string;
    email: string;
    name: string;
    isVerified: boolean;
    provider: 'supabase' | 'local_session';
}

const LOCAL_USER_STORAGE_KEY = 'strategy_lab_auth_profile';
const SUPABASE_CONFIG_STORAGE_KEY = 'strategy_lab_supabase_config';

function getStoredSupabaseConfig(): { url: string; anonKey: string } {
    try {
        const stored = localStorage.getItem(SUPABASE_CONFIG_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.url && parsed.anonKey) return parsed;
        }
    } catch {
        // non-blocking
    }
    return {
        url: ENV_SUPABASE_URL || 'https://aws-1-ap-northeast-1.pooler.supabase.com',
        anonKey: ENV_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key_for_offline',
    };
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
    if (supabaseInstance) return supabaseInstance;

    const config = getStoredSupabaseConfig();
    if (config.url && config.anonKey && config.url.startsWith('https://')) {
        try {
            supabaseInstance = createClient(config.url, config.anonKey);
            return supabaseInstance;
        } catch (e) {
            console.warn('Could not initialize official Supabase client:', e);
        }
    }
    return null;
}

export function saveSupabaseConfig(url: string, anonKey: string) {
    localStorage.setItem(
        SUPABASE_CONFIG_STORAGE_KEY,
        JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() })
    );
    supabaseInstance = null; // force re-init
}

export function getStoredUserProfile(): UserProfile | null {
    try {
        const data = localStorage.getItem(LOCAL_USER_STORAGE_KEY);
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
}

export function setStoredUserProfile(profile: UserProfile | null) {
    if (profile) {
        localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(profile));
    } else {
        localStorage.removeItem(LOCAL_USER_STORAGE_KEY);
    }
}

export async function loginWithEmail(email: string, pass: string): Promise<UserProfile> {
    const client = getSupabaseClient();
    if (client && ENV_SUPABASE_URL && ENV_SUPABASE_ANON_KEY) {
        const { data, error } = await client.auth.signInWithPassword({
            email,
            password: pass,
        });
        if (error) throw new Error(error.message);
        if (data.user) {
            const profile: UserProfile = {
                id: data.user.id,
                email: data.user.email || email,
                name: data.user.user_metadata?.name || email.split('@')[0],
                isVerified: true,
                provider: 'supabase',
            };
            setStoredUserProfile(profile);
            return profile;
        }
    }

    // Fallback local session (verified mock trader account)
    const mockProfile: UserProfile = {
        id: `usr_${Date.now()}`,
        email,
        name: email.split('@')[0],
        isVerified: true,
        provider: 'local_session',
    };
    setStoredUserProfile(mockProfile);
    return mockProfile;
}

export async function registerWithEmail(email: string, pass: string, name: string): Promise<UserProfile> {
    const client = getSupabaseClient();
    if (client && ENV_SUPABASE_URL && ENV_SUPABASE_ANON_KEY) {
        const { data, error } = await client.auth.signUp({
            email,
            password: pass,
            options: {
                data: { name },
            },
        });
        if (error) throw new Error(error.message);
        if (data.user) {
            const profile: UserProfile = {
                id: data.user.id,
                email: data.user.email || email,
                name: name || email.split('@')[0],
                isVerified: true,
                provider: 'supabase',
            };
            setStoredUserProfile(profile);
            return profile;
        }
    }

    // Fallback local session registration
    const mockProfile: UserProfile = {
        id: `usr_${Date.now()}`,
        email,
        name: name || email.split('@')[0],
        isVerified: true,
        provider: 'local_session',
    };
    setStoredUserProfile(mockProfile);
    return mockProfile;
}

export async function logoutUser(): Promise<void> {
    const client = getSupabaseClient();
    if (client) {
        try {
            await client.auth.signOut();
        } catch {
            // non-blocking
        }
    }
    setStoredUserProfile(null);
}
