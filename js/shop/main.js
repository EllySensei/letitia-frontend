// Storefront entry point: hash routing (#/packages, #/item/12, ...), cart controls and the
// booking and tracking forms.
import { api } from '../api.js';
import { $, $$, esc, isoDate, toast } from '../utils.js';
import * as V from './views.js';
import { phoneProblem, phoneValue } from '../phone.js';
import {
  store, loadCatalog, findItem, findPackage, setPackage, setQty, cartCount, cartPackage, cartLines, clearCart, rememberOrder,
} from './store.js';

const ROUTES = {
  '': [V.home, 'home'],
  packages: [V.packages, 'packages'],
  package: [V.packageDetail, 'packages'],
  rentals: [V.rentals, 'rentals'],
  item: [V.itemDetail, 'rentals'],
  cart: [V.cart, 'cart'],
  checkout: [V.checkout, 'cart'],
  done: [V.done, 'cart'],
  track: [() => V.track(), 'track'],
  contact: [V.contact, 'contact'],
};

const TITLES = {
  home: 'Laetitia · Event Styling & Rentals', packages: 'Packages · Laetitia', rentals: 'Rentals · Laetitia',
  cart: 'Your order · Laetitia', track: 'Track a booking · Laetitia', contact: 'Contact · Laetitia',
};

const route = () => {
  const [name = '', arg] = location.hash.replace(/^#\/?/, '').split('/');
  return { name, arg: arg && decodeURIComponent(arg) };
};

function render({ keepScroll = false, focus = null } = {}) {
  const { name, arg } = route();
  const [view, section] = ROUTES[name] || [() => V.notFound(), ''];
  $('#view').innerHTML = view(arg);
  $$('[data-nav]').forEach(a => a.toggleAttribute('aria-current', a.dataset.nav === section));
  const n = cartCount();
  $('#cartCount').textContent = n;
  $('#cartCount').hidden = !n;
  document.title = name === 'package' ? `${findPackage(arg)?.name || 'Package'} · Laetitia`
    : name === 'item' ? `${findItem(arg)?.name || 'Rental item'} · Laetitia` : TITLES[section] || TITLES.home;
  if (name === 'checkout') togglePurposeOther();
  if (focus) $(focus)?.focus();
  else if (!keepScroll) scrollTo(0, 0);
}

function setMenu(open) {
  $('#navLinks').classList.toggle('open', open);
  $('#navToggle').setAttribute('aria-expanded', String(open));
}

/* ---------- cart controls ---------- */

// +/- on a rental card: only the picked quantity changes, so just that stepper is updated.
function stepDraft(btn) {
  const id = btn.dataset.draft;
  const item = findItem(id);
  if (!item) return;
  const left = Math.max(0, item.qty_available - (store.cart.lines[id] || 0));
  const n = Math.max(0, Math.min(left, (store.draft[id] || 0) + Number(btn.dataset.d)));
  store.draft[id] = n;
  const step = btn.closest('.step');
  step.querySelector('output').textContent = n;
  const [minus, plus] = step.querySelectorAll('button');
  minus.disabled = n <= 0;
  plus.disabled = n >= left;
}

function addToOrder(id) {
  const item = findItem(id);
  if (!item) return;
  const have = store.cart.lines[id] || 0;
  const qty = Math.max(1, store.draft[id] || 0); // pressing Add without picking a quantity adds one
  if (have + qty > item.qty_available) return toast(`Only ${item.qty_available} available`);
  setQty(id, have + qty);
  store.draft[id] = 0;
  render({ keepScroll: true, focus: `[data-add="${id}"]` });
  toast(`Added ${qty} × ${item.name} to your order`);
}

function stepLine(btn) {
  const id = btn.dataset.line;
  setQty(id, (store.cart.lines[id] || 0) + Number(btn.dataset.d));
  render({ keepScroll: true });
}

function choosePackage(btn) {
  const p = findPackage(btn.dataset.choose);
  if (!p) return;
  setPackage(p.package_id);
  toast(`${p.name} added to your order`);
  location.hash = btn.dataset.then === 'rentals' ? '#/rentals' : '#/checkout';
}

/* ---------- booking form ---------- */

function togglePurposeOther() {
  const other = $('#c_purpose')?.value === 'Other';
  $('#otherWrap').hidden = !other;
  if (!other) $('#c_purpose_other').value = '';
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Checks the form in the browser first so most mistakes are caught before sending.
function checkoutProblems(f, custom) {
  const problems = [];
  const need = (name, msg, ok = f[name].trim() !== '') => { if (!ok) problems.push([name, msg]); };
  need('first_name', 'Enter your first name.');
  need('last_name', 'Enter your last name.');
  need('email', 'Enter a valid email address.', EMAIL.test(f.email.trim()));
  const phone = phoneProblem(f.phone_cc, f.phone);
  need('phone', `${phone} in your phone number.`, !phone);
  need('purpose', 'Choose the type of event.');
  if (f.purpose === 'Other') need('purpose_other', 'Tell us what kind of event it is.');
  need('event_date', 'Choose an event date that is today or later.', Boolean(f.event_date) && f.event_date >= isoDate());
  need('street', 'Enter the street of the venue.');
  need('barangay', 'Enter the barangay of the venue.');
  need('city', 'Enter the city or the municipality of the venue.', Boolean(f.city.trim() || f.municipality.trim()));
  need('province', 'Enter the province of the venue.');
  if (custom) need('notes', 'Describe your custom order in the notes (at least 15 characters).', f.notes.trim().length >= 15);
  return problems;
}

function showErrors(problems, heading = 'Please check the following:') {
  const box = $('#err');
  $$('#checkout [aria-invalid]').forEach(e => e.removeAttribute('aria-invalid'));
  problems.forEach(([name]) => name && $(`#c_${name}`)?.setAttribute('aria-invalid', 'true'));
  box.hidden = !problems.length;
  if (!problems.length) return;
  box.innerHTML = `<b>${esc(heading)}</b><ul>${problems.map(([, msg]) => `<li>${esc(msg)}</li>`).join('')}</ul>`;
  box.focus();
}

async function submitCheckout(form) {
  const f = Object.fromEntries(new FormData(form).entries());
  const p = cartPackage();
  const lines = cartLines();
  const custom = !p && !lines.length;
  const problems = checkoutProblems(f, custom);
  showErrors(problems);
  if (problems.length) return;

  const blank = v => v.trim() || undefined;
  const body = {
    first_name: f.first_name.trim(), middle_name: blank(f.middle_name), last_name: f.last_name.trim(),
    email: f.email.trim(), phone: phoneValue(f.phone_cc, f.phone),
    purpose: f.purpose === 'Other' ? f.purpose_other.trim() : f.purpose,
    event_date: f.event_date, start_time: blank(f.start_time),
    street: f.street.trim(), barangay: f.barangay.trim(), city: blank(f.city), municipality: blank(f.municipality), province: f.province.trim(),
    notes: blank(f.notes),
    package_id: p?.package_id,
    items: lines.length ? lines.map(l => ({ item_id: l.item.item_id, qty: l.qty })) : undefined,
  };

  const btn = $('#submitOrder');
  btn.disabled = true;
  btn.classList.add('busy');
  try {
    const order = await api.shop.order(body);
    rememberOrder(order, body.email);
    clearCart();
    location.hash = '#/done';
    loadCatalog(); // stock levels changed
  } catch (err) {
    showErrors([[null, err.message]], 'We could not send your request:');
  } finally {
    btn.disabled = false;
    btn.classList.remove('busy');
  }
}

async function submitTrack(form) {
  const f = Object.fromEntries(new FormData(form).entries());
  const ref = f.ref.replace(/\D/g, '');
  if (!ref || !EMAIL.test(f.email.trim())) {
    $('#trackResult').innerHTML = V.trackResult(null, 'Enter your reference number and a valid email address.');
    return;
  }
  $('#trackBtn').disabled = true;
  try {
    $('#trackResult').innerHTML = V.trackResult(await api.shop.track(ref, f.email.trim()));
  } catch (err) {
    $('#trackResult').innerHTML = V.trackResult(null, err.message);
  } finally {
    $('#trackBtn').disabled = false;
  }
}

/* ---------- wiring ---------- */

document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('#navToggle')) return setMenu(!$('#navLinks').classList.contains('open'));
  if (t.closest('#navLinks a')) setMenu(false);

  const el = t.closest('[data-reload],[data-pkgfilter],[data-cat],[data-draft],[data-add],[data-line],[data-remove],[data-unpkg],[data-choose]');
  if (!el || el.disabled) return;
  const d = el.dataset;
  if ('reload' in d) loadCatalog().then(() => render());
  else if ('pkgfilter' in d) { V.setPkgFilter(d.pkgfilter); render({ keepScroll: true }); }
  else if ('cat' in d) { V.setRentalCat(d.cat); render({ keepScroll: true }); }
  else if ('draft' in d) stepDraft(el);
  else if ('add' in d) addToOrder(d.add);
  else if ('line' in d) stepLine(el);
  else if ('remove' in d) { setQty(d.remove, 0); render({ keepScroll: true }); }
  else if ('unpkg' in d) { setPackage(null); render({ keepScroll: true }); }
  else if ('choose' in d) choosePackage(el);
});

document.addEventListener('input', e => {
  if (e.target.id === 'rq') {
    V.setRentalQuery(e.target.value);
    $('#rgrid').innerHTML = V.rentalGrid();
  }
  if (e.target.getAttribute('aria-invalid')) e.target.removeAttribute('aria-invalid');
});

document.addEventListener('change', e => {
  if (e.target.id === 'c_purpose') togglePurposeOther();
});

document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'checkout') submitCheckout(e.target);
  if (e.target.id === 'trackForm') submitTrack(e.target);
});

document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

// Another tab changed the order: pick it up.
addEventListener('storage', e => {
  if (e.key !== 'laetitia-cart') return;
  try { store.cart = JSON.parse(e.newValue) || { packageId: null, lines: {} }; } catch {}
  render({ keepScroll: true });
});

addEventListener('hashchange', () => render());

$('#year').textContent = new Date().getFullYear();
render();
await loadCatalog();
render({ keepScroll: true });
