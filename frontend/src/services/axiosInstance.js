/**
 * Jesta — centralized Axios instance
 *
 * • Reads VITE_API_URL from .env.local
 * • Request interceptor: attaches Bearer token stored in localStorage
 * • Response interceptor: normalises errors and handles 401 auto-logout
 */
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 12_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request: inject auth token ────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const raw = localStorage.getItem('jesta_session');
    if (raw) {
      try {
        const { token } = JSON.parse(raw);
        if (token) config.headers.Authorization = `Bearer ${token}`;
      } catch {
        // malformed storage — ignore
      }
    }
    return config;
  },
  (err) => Promise.reject(err),
);

// ── Response: global error normalisation ─────────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status  = err.response?.status;
    const payload = err.response?.data;

    // NestJS validation errors arrive as an array in payload.message
    const message = Array.isArray(payload?.message)
      ? payload.message.join(' • ')
      : (payload?.message ?? err.message ?? 'שגיאת רשת לא ידועה');

    console.error(`[Jesta API] ${status ?? 'NET'} — ${message}`);

    // 401: clear stored session so the app re-shows AuthScreen on next action
    if (status === 401) {
      localStorage.removeItem('jesta_session');
      // Dispatch a custom event that App.jsx can listen to for immediate sign-out
      window.dispatchEvent(new CustomEvent('jesta:unauthorized'));
    }

    // Preserve the HTTP status so callers can branch on it
    // (e.g. 409 "already applied" is success-like in the apply flow)
    const normalised = new Error(message);
    normalised.status = status;
    // Preserve structured error data (e.g. OVERLAP_LIMIT returns the
    // conflicting jobs so the UI can show exactly which shifts collide)
    normalised.code = payload?.code;
    normalised.data = payload;
    return Promise.reject(normalised);
  },
);

export default api;
