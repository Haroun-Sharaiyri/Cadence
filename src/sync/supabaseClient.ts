/**
 * src/sync/supabaseClient.ts
 * Supabase Client initialization, lazy factory, and GoTrue 6-Digit Email OTP helper wrappers.
 * Adheres strictly to Cadence iOS 26 Liquid Glass PWA architecture (in-app OTP, no magic links).
 */

import type {
  SupabaseClient,
  User,
  Session,
  AuthError,
  AuthChangeEvent,
} from '@supabase/supabase-js';

interface ViteEnv {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

let cachedClient: SupabaseClient | null = null;
let customClientForTesting: SupabaseClient | null = null;
let clientInitPromise: Promise<SupabaseClient | null> | null = null;

/**
 * Validates whether Supabase environment credentials are present and non-placeholder.
 */
export function isSupabaseConfigured(): boolean {
  if (customClientForTesting) return true;
  if (
    typeof window !== 'undefined' &&
    (window as unknown as { __CADENCE_MOCK_SUPABASE__?: SupabaseClient }).__CADENCE_MOCK_SUPABASE__
  ) {
    return true;
  }

  const env = ((typeof import.meta !== 'undefined' && import.meta.env) || {}) as ViteEnv;
  const url = env.VITE_SUPABASE_URL?.trim();
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();

  return Boolean(
    url &&
    (url.startsWith('https://') || url.startsWith('http://')) &&
    !url.includes('your-project-id') &&
    anonKey &&
    anonKey.length > 20 &&
    !anonKey.includes('your-supabase-anon-key')
  );
}

/**
 * Asynchronously resolves or initializes the Supabase client singleton via dynamic import.
 */
export async function getSupabaseAsync(): Promise<SupabaseClient | null> {
  if (customClientForTesting) {
    return customClientForTesting;
  }

  if (
    typeof window !== 'undefined' &&
    (window as unknown as { __CADENCE_MOCK_SUPABASE__?: SupabaseClient }).__CADENCE_MOCK_SUPABASE__
  ) {
    return (window as unknown as { __CADENCE_MOCK_SUPABASE__: SupabaseClient }).__CADENCE_MOCK_SUPABASE__;
  }

  if (cachedClient) {
    return cachedClient;
  }

  if (!isSupabaseConfigured()) {
    return null;
  }

  if (clientInitPromise) {
    return clientInitPromise;
  }

  const env = ((typeof import.meta !== 'undefined' && import.meta.env) || {}) as ViteEnv;
  const url = env.VITE_SUPABASE_URL!.trim();
  const anonKey = env.VITE_SUPABASE_ANON_KEY!.trim();

  clientInitPromise = (async () => {
    try {
      if (
        typeof globalThis !== 'undefined' &&
        typeof (globalThis as unknown as { WebSocket?: unknown }).WebSocket === 'undefined'
      ) {
        class NoopWebSocket {
          public readyState = 3;
          public close(): void {}
          public send(): void {}
          public addEventListener(): void {}
          public removeEventListener(): void {}
        }
        (globalThis as unknown as { WebSocket: unknown }).WebSocket = NoopWebSocket;
      }

      const { createClient } = await import('@supabase/supabase-js');

      cachedClient = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // Crucial for iOS PWA: prevent query-param magic-link detection from breaking installed standalone PWA
          detectSessionInUrl: false,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });

      return cachedClient;
    } catch (err) {
      console.warn('[Cadence Supabase] Initialization error:', err);
      return null;
    } finally {
      clientInitPromise = null;
    }
  })();

  return clientInitPromise;
}

/**
 * Returns the cached or mock Supabase client synchronously, or kicks off async initialization.
 */
export function getSupabase(): SupabaseClient | null {
  if (customClientForTesting) {
    return customClientForTesting;
  }

  if (
    typeof window !== 'undefined' &&
    (window as unknown as { __CADENCE_MOCK_SUPABASE__?: SupabaseClient }).__CADENCE_MOCK_SUPABASE__
  ) {
    return (window as unknown as { __CADENCE_MOCK_SUPABASE__: SupabaseClient }).__CADENCE_MOCK_SUPABASE__;
  }

  if (cachedClient) {
    return cachedClient;
  }

  if (isSupabaseConfigured()) {
    void getSupabaseAsync();
  }

  return null;
}

/**
 * Exported accessor for direct supabase client usage.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    const client = getSupabase();
    if (!client) {
      return undefined;
    }
    const val = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof val === 'function') {
      return (val as (...args: unknown[]) => unknown).bind(client);
    }
    return val;
  },
});

/**
 * Testing utility: Injects a mock SupabaseClient or resets the cached singleton.
 */
export function setSupabaseClientForTesting(client: SupabaseClient | null): void {
  customClientForTesting = client;
}

/**
 * Testing utility: Resets internal cached singleton client.
 */
export function resetSupabaseClient(): void {
  cachedClient = null;
  customClientForTesting = null;
  clientInitPromise = null;
}

/**
 * Helper: Sends a 6-digit numeric OTP code to the user's email address.
 * Uses GoTrue email OTP (shouldCreateUser: true creates user if new).
 */
export async function signInWithOtp(
  email: string
): Promise<{ data: { user: User | null; session: Session | null } | null; error: AuthError | Error | null }> {
  const client = await getSupabaseAsync();
  if (!client) {
    return { data: null, error: new Error('Supabase is not configured') };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { data: null, error: new Error('Please enter a valid email address') };
  }

  try {
    const { data, error } = await client.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
      },
    });

    return {
      data: data as { user: User | null; session: Session | null } | null,
      error,
    };
  } catch (err: unknown) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Helper: Verifies the 6-digit numeric OTP token entered in-app.
 */
export async function verifyOtp(
  email: string,
  token: string
): Promise<{ data: { user: User | null; session: Session | null }; error: AuthError | Error | null }> {
  const client = await getSupabaseAsync();
  if (!client) {
    return {
      data: { user: null, session: null },
      error: new Error('Supabase is not configured'),
    };
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanToken = token.trim().replace(/\D/g, '');

  if (cleanToken.length !== 6) {
    return {
      data: { user: null, session: null },
      error: new Error('OTP token must be exactly 6 digits'),
    };
  }

  try {
    const { data, error } = await client.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'email',
    });

    return {
      data: {
        user: data?.user ?? null,
        session: data?.session ?? null,
      },
      error,
    };
  } catch (err: unknown) {
    return {
      data: { user: null, session: null },
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Helper: Signs out current authenticated user session and revokes tokens.
 */
export async function signOut(): Promise<{ error: AuthError | Error | null }> {
  const client = await getSupabaseAsync();
  if (!client) {
    return { error: null };
  }

  try {
    const { error } = await client.auth.signOut();
    return { error };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Helper: Returns currently authenticated User or null.
 */
export async function getCurrentUser(): Promise<User | null> {
  const client = await getSupabaseAsync();
  if (!client) return null;

  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data) return null;
    return data.user ?? null;
  } catch {
    return null;
  }
}

/**
 * Helper: Returns current active Session or null.
 */
export async function getSession(): Promise<Session | null> {
  const client = await getSupabaseAsync();
  if (!client) return null;

  try {
    const { data, error } = await client.auth.getSession();
    if (error || !data) return null;
    return data.session ?? null;
  } catch {
    return null;
  }
}

/**
 * Helper: Subscribes to Supabase authentication state changes (SIGNED_IN, SIGNED_OUT, etc.).
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): { unsubscribe: () => void } {
  const syncClient = getSupabase();
  if (syncClient) {
    try {
      const { data } = syncClient.auth.onAuthStateChange(callback);
      return {
        unsubscribe: () => {
          data.subscription.unsubscribe();
        },
      };
    } catch (err) {
      console.warn('[Cadence Supabase] Failed to attach authStateChange listener:', err);
      return { unsubscribe: () => {} };
    }
  }

  if (!isSupabaseConfigured()) {
    return { unsubscribe: () => {} };
  }

  let unsub: (() => void) | null = null;
  let cancelled = false;

  void getSupabaseAsync().then((client) => {
    if (cancelled || !client) return;
    try {
      const { data } = client.auth.onAuthStateChange(callback);
      unsub = () => data.subscription.unsubscribe();
    } catch (err) {
      console.warn('[Cadence Supabase] Failed to attach async authStateChange listener:', err);
    }
  });

  return {
    unsubscribe: () => {
      cancelled = true;
      if (unsub) unsub();
    },
  };
}

/**
 * Detects if an error is PostgREST schema cache miss (unmigrated database).
 */
export function isPgrst205Error(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string };
  return e.code === 'PGRST205' || (typeof e.message === 'string' && e.message.includes('schema cache'));
}

/**
 * In-app OTP convenience helpers
 */
export async function sendEmailOtp(email: string): Promise<{ success: boolean; error?: string }> {
  const res = await signInWithOtp(email);
  if (res.error) {
    return { success: false, error: res.error.message };
  }
  return { success: true };
}

export async function verifyEmailOtp(
  email: string,
  token: string
): Promise<{ success: boolean; error?: string; user?: User | null; session?: Session | null }> {
  const res = await verifyOtp(email, token);
  if (res.error) {
    return { success: false, error: res.error.message };
  }
  return { success: true, user: res.data.user, session: res.data.session };
}

export async function signOutUser(): Promise<void> {
  await signOut();
}
