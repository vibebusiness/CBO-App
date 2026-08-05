import React from 'react';
import { getMe, clearToken, type AppUser } from '../lib/api';

type AuthState = {
  user: AppUser | null;
  loading: boolean;
  error: string | null;
  signOut: () => void;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
};

const AuthContext = React.createContext<AuthState>({
  user: null,
  loading: true,
  error: null,
  signOut: () => {},
  refresh: async () => {},
  retry: async () => {},
});

const RETRY_DELAY_MS = 700;

function connectionMessage() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'You appear to be offline. Reconnect, then try again.';
  }
  return 'CBO could not reach the server. It may still be waking up.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AppUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadUser = React.useCallback(async (showLoading: boolean, retryOnce: boolean) => {
    if (showLoading) setLoading(true);
    setError(null);

    const attempts = retryOnce ? 2 : 1;
    let lastError: unknown;

    try {
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          const me = await getMe();
          setUser(me);
          return;
        } catch (loadError) {
          lastError = loadError;
          if (attempt + 1 < attempts) {
            await new Promise((resolve) => window.setTimeout(resolve, RETRY_DELAY_MS));
          }
        }
      }

      console.warn('Unable to restore the CBO session:', lastError);
      setError(connectionMessage());
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadUser(true, true);
  }, [loadUser]);

  const refresh = React.useCallback(async () => {
    await loadUser(false, false);
  }, [loadUser]);

  const retry = React.useCallback(async () => {
    await loadUser(true, true);
  }, [loadUser]);

  const signOut = React.useCallback(() => {
    clearToken();
    setUser(null);
    setError(null);
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, signOut, refresh, retry }}>
      {children}
    </AuthContext.Provider>
  );
}

// The provider and hook intentionally share this small state module.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return React.useContext(AuthContext);
}
