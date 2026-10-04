import { api, hasToken, setToken } from './api.js';
import { state, resetData } from './state.js';
import { render } from './views/index.js';
import { startNotifications, stopNotifications } from './notifications.js';
import { toastError } from './utils.js';

// Picks up a login saved by an earlier visit. A rejected token is cleared by the api module.
export async function restoreSession() {
  if (!hasToken()) return;
  try {
    state.user = await api.auth.me();
    startNotifications();
  } catch (err) {
    if (err.status !== 401) toastError(err);
  }
}

export async function signIn(username, password) {
  const { token, user } = await api.auth.login(username, password);
  setToken(token);
  state.user = user;
  startNotifications();
}

export function endSession() {
  setToken(null);
  state.user = null;
  resetData();
  stopNotifications();
  render();
}

export async function signOut() {
  try { await api.auth.logout(); } catch {} // the token is dropped locally either way
  endSession();
}
