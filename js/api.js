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
  dashboard: () => get('/dashboard'),
  receivables: () => get('/receivables', ALL),
  availability: date => get('/availability', { date, all: true }),
  pullsheet: {
    get: date => get('/pullsheet', { date }),
    setStatus: (date, item_id, pull_status) => patch('/pullsheet', { date, item_id, pull_status }),
  },
  clients: {
    list: () => get('/clients', ALL),
    create: body => post('/clients', body),
    remove: id => del(`/clients/${id}`),
    removeAll: () => del('/clients', { confirm: true }),
  },
  events: {
    list: () => get('/events', ALL),
    get: id => get(`/events/${id}`),
    create: body => post('/events', body),
    cancel: id => patch(`/events/${id}/cancel`),
  },
  packages: {
    list: () => get('/packages'),
    create: body => post('/packages', body),
    remove: id => del(`/packages/${id}`),
    removeAll: () => del('/packages', { confirm: true }),
  },
  inventory: {
    list: () => get('/inventory', ALL),
    create: body => post('/inventory', body),
    update: (id, body) => patch(`/inventory/${id}`, body),
    remove: id => del(`/inventory/${id}`),
    removeAll: () => del('/inventory', { confirm: true }),
    restockAll: () => patch('/inventory/restock', undefined, { confirm: true }),
  },
  consumables: {
    list: () => get('/consumables', ALL),
    create: body => post('/consumables', body),
    restock: (id, qty) => patch(`/consumables/${id}/restock`, { qty }),
    remove: id => del(`/consumables/${id}`),
  },
  returns: {
    list: () => get('/returns', ALL),
    markReturned: (id, condition_on_return) => patch(`/returns/${id}`, { condition_on_return }),
    reportDamage: (id, body) => patch(`/returns/${id}/damage`, body),
  },
  payments: {
    create: body => post('/payments', body),
  },
  notifications: {
    list: () => get('/notifications', { limit: 30 }),
    markRead: id => patch(`/notifications/${id}/read`),
  },
  reminders: {
    send: clientId => post('/reminders', clientId ? { client_id: Number(clientId) } : {}),
  },
};
