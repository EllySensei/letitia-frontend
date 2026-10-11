// Storefront state: the catalog from the API plus the visitor's order (cart), which is kept
// in localStorage so it survives a reload.
import { api, hasToken, setToken } from '../api.js';
import { readLocal, writeLocal } from '../storage.js';
import { ADMIN_TOKEN_KEY } from '../config.js';

const CART_KEY = 'laetitia-cart';
const ORDER_KEY = 'laetitia-last-order';

export const store = {
  packages: [],
  items: [],          // rentable items
  status: 'loading',  // 'loading' | 'ready' | 'error'
  error: '',
  // packageId: the chosen package (one per booking); lines: { item_id: qty } extra rentals.
  cart: readLocal(CART_KEY, { packageId: null, lines: {} }),
  draft: {},          // quantity picked on each rental card before pressing Add
  lastOrder: readLocal(ORDER_KEY, null), // order summary from the API, plus the email used
  user: null,         // the signed-in customer { user_id, username (their email), full_name, role, client_id }
  profile: null,      // their client details: name, email, phone, address
};

/* ---------- customer login ---------- */

async function useAccount(user) {
  store.user = user;
  store.profile = await api.account.profile();
}

// Picks up a login saved by an earlier visit. Only customer logins are kept on the storefront.
export async function loadUser() {
  if (!hasToken()) return;
  try {
    const user = await api.auth.me();
    if (user.role !== 'customer') throw new Error('not a customer');
    await useAccount(user);
  } catch {
    setToken(null);
    store.user = store.profile = null;
  }
}

// One login form for everyone: a staff or admin account entered here is handed to the admin
// dashboard (which keeps its own login) and the browser goes there. Returns 'staff' then.
// The server still checks the role on every request, so this only saves a second login.
export async function logIn(email, password) {
  const { token, user } = await api.auth.login(email, password);
  if (user.role !== 'customer') {
    writeLocal(ADMIN_TOKEN_KEY, token);
    location.href = 'admin';
    return 'staff';
  }
  setToken(token);
  await useAccount(user);
  return 'customer';
}

export async function register(details) {
  const { token, user } = await api.account.register(details);
  setToken(token);
  await useAccount(user);
}

export async function logOut() {
  try { await api.auth.logout(); } catch {} // the token is dropped locally either way
  setToken(null);
  store.user = store.profile = null;
}

export const findPackage = id => store.packages.find(p => String(p.package_id) === String(id));
export const findItem = id => store.items.find(i => String(i.item_id) === String(id));

export async function loadCatalog() {
  store.status = 'loading';
  try {
    const { packages, items } = await api.shop.catalog();
    store.packages = packages;
    store.items = items;
    store.status = 'ready';
    // Drop anything that has since been removed from the catalog.
    if (store.cart.packageId && !findPackage(store.cart.packageId)) store.cart.packageId = null;
    for (const id of Object.keys(store.cart.lines)) if (!findItem(id)) delete store.cart.lines[id];
    saveCart();
  } catch (err) {
    store.status = 'error';
    store.error = err.message;
  }
}

export const saveCart = () => writeLocal(CART_KEY, store.cart);

export const cartPackage = () => findPackage(store.cart.packageId) || null;

export const cartLines = () => Object.entries(store.cart.lines)
  .map(([id, qty]) => ({ item: findItem(id), qty }))
  .filter(l => l.item && l.qty > 0)
  .map(l => ({ ...l, total: l.item.rental_price * l.qty }));

export const cartTotal = () => (cartPackage()?.base_price || 0) + cartLines().reduce((s, l) => s + l.total, 0);

// Number of lines in the order (the package counts as one), as shown on the nav badge.
export const cartCount = () => (cartPackage() ? 1 : 0) + cartLines().length;

export function setPackage(id) {
  store.cart.packageId = id ? Number(id) : null;
  saveCart();
}

// Sets an item's quantity in the order, capped at what is in stock. Returns the new quantity.
export function setQty(id, qty) {
  const item = findItem(id);
  if (!item) return 0;
  const n = Math.max(0, Math.min(Number(item.qty_available) || 0, Math.floor(qty)));
  if (n) store.cart.lines[id] = n;
  else delete store.cart.lines[id];
  saveCart();
  return n;
}

export function clearCart() {
  store.cart = { packageId: null, lines: {} };
  store.draft = {};
  saveCart();
}

export function rememberOrder(order, email) {
  store.lastOrder = { ...order, email };
  writeLocal(ORDER_KEY, store.lastOrder);
}
