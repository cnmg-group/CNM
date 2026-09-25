import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';

import { track } from '@/lib/analytics';
import { api, ApiError, setAuthToken, setUnauthorizedHandler } from '@/lib/api';
import { authenticate } from '@/lib/biometrics';
import { KEYS, readJSON, writeJSON } from '@/lib/storage';
import type { User } from '@/lib/types';

const TOKEN_KEY = 'cnm.auth.token';
const USER_KEY = 'cnm.auth.user';

type Status = 'restoring' | 'signedOut' | 'signedIn';

interface State {
  status: Status;
  token: string | null;
  user: User | null;
  /** Biometric gate is active: account details stay hidden until unlocked. */
  locked: boolean;
  biometricEnabled: boolean;
}

type Action =
  | { type: 'restored'; token: string | null; user: User | null; biometricEnabled: boolean }
  | { type: 'signedIn'; token: string; user: User }
  | { type: 'user'; user: User }
  | { type: 'signedOut' }
  | { type: 'unlock' }
  | { type: 'biometric'; enabled: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'restored':
      return {
        status: action.token ? 'signedIn' : 'signedOut',
        token: action.token,
        user: action.user,
        biometricEnabled: action.biometricEnabled,
        locked: !!action.token && action.biometricEnabled,
      };
    case 'signedIn':
      return { ...state, status: 'signedIn', token: action.token, user: action.user, locked: false };
    case 'user':
      return { ...state, user: action.user };
    case 'signedOut':
      return { ...state, status: 'signedOut', token: null, user: null, locked: false };
    case 'unlock':
      return { ...state, locked: false };
    case 'biometric':
      return { ...state, biometricEnabled: action.enabled };
    default:
      return state;
  }
}

interface AuthResponse {
  user: User;
  token?: string;
}

interface AuthContextValue extends State {
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; firstName: string; lastName: string; marketingOptIn?: boolean }) => Promise<void>;
  requestOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  signOut: (opts?: { everywhere?: boolean }) => Promise<void>;
  setUser: (user: User) => void;
  setBiometricEnabled: (enabled: boolean) => Promise<boolean>;
  unlock: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function persistSession(token: string | null, user: User | null) {
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
    if (user) await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    else await SecureStore.deleteItemAsync(USER_KEY);
  } catch {
    // SecureStore unavailable (e.g. web) — session lasts for this app run only.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    status: 'restoring',
    token: null,
    user: null,
    locked: false,
    biometricEnabled: false,
  });

  const clearSession = useCallback(async () => {
    setAuthToken(null);
    dispatch({ type: 'signedOut' });
    await persistSession(null, null);
  }, []);

  // Restore session on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let token: string | null = null;
      let user: User | null = null;
      try {
        token = await SecureStore.getItemAsync(TOKEN_KEY);
        const rawUser = await SecureStore.getItemAsync(USER_KEY);
        user = rawUser ? (JSON.parse(rawUser) as User) : null;
      } catch {
        token = null;
      }
      const biometricEnabled = await readJSON<boolean>(KEYS.biometricEnabled, false);
      setAuthToken(token);
      if (cancelled) return;
      dispatch({ type: 'restored', token, user, biometricEnabled });
      if (!token) return;
      try {
        const me = await api<{ user: User }>('/api/auth/me');
        if (!cancelled) {
          dispatch({ type: 'user', user: me.user });
          persistSession(token, me.user);
        }
      } catch (e) {
        // 401 → session revoked (password reset / logout everywhere). Offline → keep cached user.
        if (e instanceof ApiError && e.status === 401 && !cancelled) clearSession();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const completeSignIn = useCallback(async (res: AuthResponse, method: string, event: 'login' | 'sign_up' = 'login') => {
    if (!res.token) {
      // The server only returns a token when X-CNM-Client: mobile is sent.
      throw new ApiError(500, 'no_token', 'Sign-in succeeded but no mobile session was issued. Please try again.');
    }
    setAuthToken(res.token);
    await persistSession(res.token, res.user);
    dispatch({ type: 'signedIn', token: res.token, user: res.user });
    track(event, { method });
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await api<AuthResponse>('/api/auth/login', { method: 'POST', body: { email: email.trim(), password }, auth: false });
      await completeSignIn(res, 'password');
    },
    [completeSignIn],
  );

  const register = useCallback<AuthContextValue['register']>(
    async (input) => {
      const res = await api<AuthResponse>('/api/auth/register', { method: 'POST', body: { ...input, email: input.email.trim() }, auth: false });
      await completeSignIn(res, 'password', 'sign_up');
    },
    [completeSignIn],
  );

  const requestOtp = useCallback(async (email: string) => {
    await api('/api/auth/otp-request', { method: 'POST', body: { email: email.trim() }, auth: false });
  }, []);

  const verifyOtp = useCallback(
    async (email: string, code: string) => {
      const res = await api<AuthResponse>('/api/auth/otp-verify', { method: 'POST', body: { email: email.trim(), code: code.trim() }, auth: false });
      await completeSignIn(res, 'otp');
    },
    [completeSignIn],
  );

  const requestPasswordReset = useCallback(async (email: string) => {
    await api('/api/auth/reset-request', { method: 'POST', body: { email: email.trim() }, auth: false });
  }, []);

  const signOut = useCallback(
    async (opts?: { everywhere?: boolean }) => {
      try {
        await api(opts?.everywhere ? '/api/account/logout-all' : '/api/auth/logout', { method: 'POST', timeoutMs: 6000 });
      } catch {
        // Logging out locally must always succeed.
      }
      await clearSession();
    },
    [clearSession],
  );

  const setUser = useCallback(
    (user: User) => {
      dispatch({ type: 'user', user });
      persistSession(state.token, user);
    },
    [state.token],
  );

  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    if (enabled) {
      // Confirm the user can actually pass the check before turning it on.
      const ok = await authenticate('Confirm to enable biometric unlock');
      if (!ok) return false;
    }
    await writeJSON(KEYS.biometricEnabled, enabled);
    dispatch({ type: 'biometric', enabled });
    return true;
  }, []);

  const unlock = useCallback(async () => {
    const ok = await authenticate('Unlock your CNM account');
    if (ok) dispatch({ type: 'unlock' });
    return ok;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signIn, register, requestOtp, verifyOtp, requestPasswordReset, signOut, setUser, setBiometricEnabled, unlock }),
    [state, signIn, register, requestOtp, verifyOtp, requestPasswordReset, signOut, setUser, setBiometricEnabled, unlock],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
