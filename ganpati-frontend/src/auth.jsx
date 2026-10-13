import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearToken, getToken, setToken } from './api.js';

const Ctx = createContext(null);

// status: 'loading' (checking a saved login) | 'in' | 'out' | 'error' (server not reachable)
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: getToken() ? 'loading' : 'out', user: null, error: null });

  const check = useCallback(async () => {
    if (!getToken()) return setState({ status: 'out', user: null, error: null });
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const { user } = await api.me();
      setState({ status: 'in', user, error: null });
    } catch (err) {
      if (err.status === 401) {
        clearToken();
        setState({ status: 'out', user: null, error: null });
      } else {
        setState({ status: 'error', user: null, error: err });
      }
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  // Any request answered with "401" means the login is no longer valid.
  useEffect(() => {
    const onUnauthorized = () => {
      clearToken();
      setState({ status: 'out', user: null, error: null });
    };
    window.addEventListener('gw:unauthorized', onUnauthorized);
    return () => window.removeEventListener('gw:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (username, password) => {
    const { token, user } = await api.login(username, password);
    setToken(token);
    setState({ status: 'in', user, error: null });
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setState({ status: 'out', user: null, error: null });
  }, []);

  // After changing the password the server hands back a fresh token.
  const replaceSession = useCallback(({ token, user }) => {
    setToken(token);
    setState({ status: 'in', user, error: null });
  }, []);

  const value = useMemo(() => ({ ...state, login, logout, retry: check, replaceSession }), [state, login, logout, check, replaceSession]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
