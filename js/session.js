import { api, hasToken, setToken } from './api.js';
import { state, resetData } from './state.js';
import { render } from './views/index.js';
import { startNotifications, stopNotifications } from './notifications.js';
import { toastError } from './utils.js';
import { writeLocal } from './storage.js';
import { SHOP_TOKEN_KEY } from './config.js';

// The dashboard is for staff accounts; customers sign in on the storefront.
const STAFF_ROLES = ['admin', 'staff'];

// Picks up a login saved by an earlier visit. A rejected token is cleared by the api module.
export async function restoreSession() {
  if (!hasToken()) return;
  try {
    const user = await api.auth.me();
    if (!STAFF_ROLES.includes(user.role)) return setToken(null);
    state.user = user;
    startNotifications();
  } catch (err) {
    if (err.status !== 401) toastError(err);
  }
}

// One login form for everyone: a customer account entered here is handed to the storefront
// (which keeps its own login) and the browser opens their customer dashboard. Returns
// 'customer' then. The server still checks the role on every request.
export async function signIn(username, password) {
  const { token, user } = await api.auth.login(username, password);
  if (!STAFF_ROLES.includes(user.role)) {
    writeLocal(SHOP_TOKEN_KEY, token);
    location.href = './#/dashboard';
    return 'customer';
  }
  setToken(token);
  state.user = user;
  startNotifications();
  return 'staff';
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
