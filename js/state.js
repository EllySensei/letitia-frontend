import { api } from './api.js';
import { isoDate } from './utils.js';

const empty = () => ({
  dashboard: { stats: {}, upcoming_events: [] },
  clients: [],
  events: [],
  packages: [],
  inventory: [],    // rental items
  consumables: [],
  returns: [],
  receivables: [],
  pullsheet: { items: [] },
});

export const state = {
  user: null, // { user_id, username, full_name, role } once signed in
  ...empty(),
};

export const isAdmin = () => state.user?.role === 'admin';

export const resetData = () => Object.assign(state, empty());

const loaders = {
  dashboard: api.dashboard,
  clients: api.clients.list,
  events: api.events.list,
  packages: api.packages.list,
  inventory: api.inventory.list,
  consumables: api.consumables.list,
  returns: api.returns.list,
  receivables: api.receivables,
  pullsheet: () => api.pullsheet.get(isoDate(1)),
};

// Loads everything the screens show. Returns the names of any sections that failed.
export async function loadAll() {
  if (!state.user) return [];
  const keys = Object.keys(loaders);
  const results = await Promise.allSettled(keys.map(k => loaders[k]()));
  const failed = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') state[keys[i]] = r.value;
    else { failed.push(keys[i]); console.warn(`load failed: ${keys[i]}`, r.reason); }
  });
  return failed;
}
