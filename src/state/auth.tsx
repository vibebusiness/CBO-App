import React from 'react';
import { getMe, clearToken, type AppUser } from '../lib/api';

type AuthState = {
  user: AppUser | null;
  loading: boolean;
  signOut: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = React.createContext<AuthState>({
  user: null,
  loading: true,
  signOut: () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AppUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  const loadUser = React.useCallback(async () => {
    const me = await getMe();
    setUser(me);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadUser();
  }, [loadUser]);

  const signOut = React.useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refresh: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return React.useContext(AuthContext);
}
