// Thin client for the let-api backend. Every call sends the saved login token.
import { API_BASE, TOKEN_KEY } from './config.js';
import { readLocal, writeLocal } from './storage.js';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let token = readLocal(TOKEN_KEY, null);
let onUnauthorized = () => {};

export const hasToken = () => Boolean(token);
export const setToken = t => { token = t; writeLocal(TOKEN_KEY, t); };
// Called when a saved token is rejected (expired, logged out, user removed).
export const handleUnauthorized = fn => { onUnauthorized = fn; };

// Folds the API's details (validation errors, stock shortages) into one readable line.
function describe(data, status) {
  const message = data?.error || `Request failed (${status})`;
  const details = (Array.isArray(data?.details) ? data.details : [])
    .map(d => d.message || (d.name && d.requested !== undefined ? `${d.name}: ${d.available} of ${d.requested} available` : null))
    .filter(Boolean);
  return details.length ? `${message}: ${details.join('; ')}` : message;
}

async function request(method, path, { body, query } = {}) {
  const url = new URL(API_BASE + path, location.href);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, `Cannot reach the server at ${API_BASE || location.origin}`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) {
      setToken(null);
      onUnauthorized(data?.error);
    }
    throw new ApiError(res.status, describe(data, res.status), data?.details);
  }
  return data;
}

const get = (path, query) => request('GET', path, { query });
const post = (path, body) => request('POST', path, { body });
const patch = (path, body, query) => request('PATCH', path, { body, query });
const del = (path, query) => request('DELETE', path, { query });

const ALL = { limit: 500 };

export const api = {
  auth: {
    login: (username, password) => post('/auth/login', { username, password }),
    logout: () => post('/auth/logout'),
    me: () => get('/auth/me'),
  },
  // Storefront (no login needed).
  shop: {
    catalog: () => get('/public/catalog'),
    track: (id, email) => get(`/public/orders/${id}`, { email }),
    phoneCountries: () => get('/public/phone-countries'),
  },
  // Customer accounts (storefront). Ordering needs a login.
  account: {
    register: body => post('/auth/register', body),
    profile: () => get('/account/profile'),
    orders: () => get('/account/orders'),
    order: body => post('/account/orders', body),
    remove: password => request('DELETE', '/account', { body: { password } }),
    payments: () => get('/account/payments'),
    updateProfile: body => patch('/account/profile', body),
    changePassword: (current_password, new_password) => patch('/account/password', { current_password, new_password }),
  },
  // Accounts tab (admins only).
  users: {
    list: () => get('/users'),
    create: body => post('/users', body),
    setRole: (id, role) => patch(`/users/${id}/role`, { role }),
    setPassword: (id, password) => patch(`/users/${id}/password`, { password }),
    remove: id => del(`/users/${id}`),
  },
  dashboard: () => get('/dashboard'),
  receivables: () => get('/receivables', ALL),
  availability: date => get('/availability', { date, all: true }),
  pullsheet: {
    get: date => get('/pullsheet', { date }),
    setStatus: (date, item_id, pull_status) => patch('/pullsheet', { date, item_id, pull_status }),
  },
  clients: {
    list: () => get('/clients', ALL),
    archived: () => get('/clients', { ...ALL, archived: true }),
    restore: id => patch(`/clients/${id}/restore`),
    create: body => post('/clients', body),
    update: (id, body) => patch(`/clients/${id}`, body),
    remove: id => del(`/clients/${id}`),
    purge: id => del(`/clients/${id}/permanent`),
    removeAll: () => del('/clients', { confirm: true }),
  },
  events: {
    // query: q, status, from, to (search and filters run in the database).
    list: (query = {}) => get('/events', { ...ALL, ...query }),
    get: id => get(`/events/${id}`),
    create: body => post('/events', body),
    update: (id, body) => patch(`/events/${id}`, body),
    cancel: id => patch(`/events/${id}/cancel`),
  },
  packages: {
    list: () => get('/packages'),
    archived: () => get('/packages', { archived: true }),
    restore: id => patch(`/packages/${id}/restore`),
    create: body => post('/packages', body),
    update: (id, body) => patch(`/packages/${id}`, body),
    remove: id => del(`/packages/${id}`),
    purge: id => del(`/packages/${id}/permanent`),
    removeAll: () => del('/packages', { confirm: true }),
    // Adds the standard packages (and the items they use), skipping ones already there.
    starter: () => post('/packages/starter'),
  },
  inventory: {
    list: () => get('/inventory', ALL),
    archived: () => get('/inventory', { ...ALL, archived: true }),
    restore: id => patch(`/inventory/${id}/restore`),
    create: body => post('/inventory', body),
    update: (id, body) => patch(`/inventory/${id}`, body),
    remove: id => del(`/inventory/${id}`),
    purge: id => del(`/inventory/${id}/permanent`),
    removeAll: () => del('/inventory', { confirm: true }),
    restockAll: () => patch('/inventory/restock', undefined, { confirm: true }),
    // Adds the standard rental items and consumables, skipping ones already there.
    starter: () => post('/inventory/starter'),
  },
  consumables: {
    list: () => get('/consumables', ALL),
    archived: () => get('/consumables', { ...ALL, archived: true }),
    restore: id => patch(`/consumables/${id}/restore`),
    create: body => post('/consumables', body),
    update: (id, body) => patch(`/consumables/${id}`, body),
    restock: (id, qty) => patch(`/consumables/${id}/restock`, { qty }),
    remove: id => del(`/consumables/${id}`),
    purge: id => del(`/consumables/${id}/permanent`),
  },
  returns: {
    list: () => get('/returns', ALL),
    markReturned: (id, condition_on_return) => patch(`/returns/${id}`, { condition_on_return }),
    reportDamage: (id, body) => patch(`/returns/${id}/damage`, body),
  },
  payments: {
    create: body => post('/payments', body),
    update: (id, body) => patch(`/payments/${id}`, body),
  },
  notifications: {
    list: () => get('/notifications', { limit: 30 }),
    markRead: id => patch(`/notifications/${id}/read`),
  },
  // Admins only.
  database: {
    tables: () => get('/database/tables'),
    rows: (name, query) => get(`/database/tables/${encodeURIComponent(name)}`, query),
    changes: after => get('/database/changes', { after }),
    // Replaces all business data with the sample set; admin accounts are kept.
    sampleData: () => post('/database/sample-data', { confirm: true }),
  },
  reminders: {
    send: clientId => post('/reminders', clientId ? { client_id: Number(clientId) } : {}),
  },
};
