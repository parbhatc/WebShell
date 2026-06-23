import { create } from 'zustand';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

const legacyToken = localStorage.getItem('jwt_token');
const storedAccessToken = localStorage.getItem('access_token') || legacyToken;
const storedRefreshToken = localStorage.getItem('refresh_token');

if (legacyToken && !localStorage.getItem('access_token')) {
  localStorage.setItem('access_token', legacyToken);
  localStorage.removeItem('jwt_token');
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: storedAccessToken,
  refreshToken: storedRefreshToken,
  isAuthenticated: !!storedAccessToken,
  login: (accessToken, refreshToken) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    set({ token: accessToken, refreshToken, isAuthenticated: true });
  },
  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    set({ token: accessToken, refreshToken, isAuthenticated: true });
  },
  logout: () => {
    const refreshToken = get().refreshToken;
    if (refreshToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('jwt_token');
    set({ token: null, refreshToken: null, isAuthenticated: false });
  },
}));
