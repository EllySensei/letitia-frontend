// Storefront entry point: hash routing (#/packages, #/item/12, ...), cart controls, customer
// login and sign-up, and the booking and tracking forms.
import { api } from '../api.js';
import { $, $$, esc, isoDate, toast } from '../utils.js';
import * as V from './views.js';
import * as P from './portal.js';
import { phoneProblem, phoneValue, isoFor } from '../phone.js';
import {
  store, loadCatalog, findItem, findPackage, setPackage, setQty, cartCount, cartPackage, cartLines, clearCart, rememberOrder,
  loadUser, logIn, register, logOut,
} from './store.js';

// The customer's bookings and payments for the portal; null until loaded.
let myOrders = null;
let myPayments = null;

// route -> [view, section]. Visitors see the storefront; a logged-in customer sees the same
// catalog pages inside the customer portal (portal.js), plus the portal's own pages.
const ROUTES = {
  '': [V.home, 'home'],
  packages: [V.packages, 'packages'],
  package: [V.packageDetail, 'packages'],
  rentals: [V.rentals, 'rentals'],
  item: [V.itemDetail, 'rentals'],
  build: [V.kiosk, 'build'],
  cart: [V.cart, 'cart'],
  checkout: [V.checkout, 'cart'],
  done: [V.done, 'cart'],
  track: [() => V.track(), 'track'],
  contact: [V.contact, 'contact'],
  login: [V.login, 'account'],
  register: [V.register, 'account'],
  dashboard: [() => P.dashboard(myOrders), 'dashboard'],
  bookings: [() => P.bookings(myOrders), 'bookings'],
  booking: [id => P.bookingDetail(myOrders, myPayments, id), 'bookings'],
  payments: [() => P.payments(myOrders, myPayments), 'payments'],
  profile: [() => P.profile(myOrders), 'profile'],
  support: [P.support, 'support'],
};

// Pages that need a customer login; the visitor is sent to log in and brought back after.
const NEEDS_LOGIN = ['checkout', 'dashboard', 'bookings', 'booking', 'payments', 'profile', 'support'];
// Portal pages that show the customer's payments as well as their bookings.
const NEEDS_PAYMENTS = ['booking', 'payments'];

const TITLES = {
  home: 'Laetitia · Event Styling & Rentals', packages: 'Packages · Laetitia', rentals: 'Rentals · Laetitia',
  build: 'Build your setup · Laetitia', cart: 'Your order · Laetitia', track: 'Track a booking · Laetitia', contact: 'Contact · Laetitia',
  account: 'Log in · Laetitia', dashboard: 'Dashboard · Laetitia', bookings: 'My bookings · Laetitia', payments: 'My payments · Laetitia',
  profile: 'My profile · Laetitia', support: 'Support · Laetitia',
};

const route = () => {
  const [name = '', arg] = location.hash.replace(/^#\/?/, '').split('/');
  return { name, arg: arg && decodeURIComponent(arg) };
};

function render({ keepScroll = false, focus = null } = {}) {
  const { name, arg } = route();
  const portal = Boolean(store.user);
  if (NEEDS_LOGIN.includes(name) && !portal) return location.replace(`#/login/${name}`);
  if (['login', 'register'].includes(name) && portal) return location.replace(arg ? `#/${arg}` : '#/dashboard');
  // Logged in, the storefront's home and the old account page give way to the dashboard.
  if (portal && ['', 'account'].includes(name)) return location.replace('#/dashboard');
  if (!portal && name === 'account') return location.replace('#/login');
  if (portal && myOrders === null) loadMyOrders();
  if (portal && NEEDS_PAYMENTS.includes(name) && myPayments === null) loadMyPayments();

  const [view, section] = ROUTES[name] || [() => V.notFound(), ''];
  $('#view').innerHTML = view(arg);
  P.renderShell(portal, section, myOrders);
  $$('[data-nav]').forEach(a => a.toggleAttribute('aria-current', a.dataset.nav === section));
  const n = cartCount();
  $('#cartCount').textContent = n;
  $('#cartCount').hidden = !n;
  renderAccountButton(section === 'account');
  document.title = name === 'package' ? `${findPackage(arg)?.name || 'Package'} · Laetitia`
    : name === 'item' ? `${findItem(arg)?.name || 'Rental item'} · Laetitia` : TITLES[section] || TITLES.home;
  if (FORMS[`#${FORM_ROUTES[name]}`]) touched.delete(FORM_ROUTES[name]); // a fresh form starts without errors
  if (name === 'checkout') togglePurposeOther();
  if (name === 'profile') fillProfilePhone();
  if (name === 'build') $('#tray')?.classList.toggle('open', trayOpen);
  if (focus) $(focus)?.focus();
  else if (!keepScroll) scrollTo(0, 0);
}

// The phone dropdown and number can't be set in the page's HTML, so they're filled after it shows.
function fillProfilePhone() {
  const p = store.profile;
  if (!p || !$('#pf_phone')) return;
  const iso = isoFor(p.phone_country_code);
  if (iso) $('#pf_phoneCc').value = iso;
  $('#pf_phone').value = p.phone_number || '';
}

// Header: "Log in" for visitors, the customer's first name (to My account) once signed in.
function renderAccountButton(current) {
  const btn = $('#acctBtn');
  btn.href = store.user ? '#/account' : '#/login';
  $('#acctLabel').textContent = store.user ? (store.profile?.first_name || 'My account') : 'Log in';
  btn.setAttribute('aria-label', store.user ? 'My account' : 'Log in');
  btn.toggleAttribute('aria-current', current);
}

// Each loads once and redraws the page when it arrives; null again means "load afresh".
let loadingOrders = false;
async function loadMyOrders() {
  if (loadingOrders) return;
  loadingOrders = true;
  try {
    myOrders = await api.account.orders();
  } catch (err) {
    myOrders = [];
    toast(`Could not load your bookings: ${err.message}`, 5000);
  }
  loadingOrders = false;
  if (store.user) render({ keepScroll: true });
}

let loadingPayments = false;
async function loadMyPayments() {
  if (loadingPayments) return;
  loadingPayments = true;
  try {
    myPayments = await api.account.payments();
  } catch (err) {
    myPayments = [];
    toast(`Could not load your payments: ${err.message}`, 5000);
  }
  loadingPayments = false;
  if (store.user) render({ keepScroll: true });
}

const forgetAccountData = () => { myOrders = null; myPayments = null; };

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
  // Never below 1 while any are left: the number shown is the number Add puts in the order.
  const n = Math.max(Math.min(1, left), Math.min(left, (store.draft[id] || 1) + Number(btn.dataset.d)));
  store.draft[id] = n;
  const step = btn.closest('.step');
  step.querySelector('output').textContent = n;
  const [minus, plus] = step.querySelectorAll('button');
  minus.disabled = n <= 1;
  plus.disabled = n >= left;
}

function addToOrder(id) {
  const item = findItem(id);
  if (!item) return;
  const have = store.cart.lines[id] || 0;
  const qty = store.draft[id] || 1; // the stepper starts at 1
  if (have >= item.qty_available) return toast(`All ${item.qty_available} are already in your order`);
  if (have + qty > item.qty_available) return toast(`Only ${item.qty_available - have} more available`);
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

/* ---------- form checks ---------- */
// Each returns [[field, message], ...]; the browser checks first so most mistakes are caught
// before sending, and the server checks again.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME = /^\p{L}[\p{L}\p{M} .'-]*$/u;
const MIN_PASSWORD = 8;

function checker(f) {
  const problems = [];
  const need = (name, msg, ok = (f[name] ?? '').trim() !== '') => { if (!ok) problems.push([name, msg]); };
  return { problems, need };
}

function checkoutProblems(f) {
  const custom = !cartPackage() && !cartLines().length;
  const { problems, need } = checker(f);
  need('purpose', 'Choose the type of event.');
  if (f.purpose === 'Other') need('purpose_other', 'Tell us what kind of event it is.');
  need('event_date', 'Choose an event date that is today or later.', Boolean(f.event_date) && f.event_date >= isoDate());
  need('street', 'Enter the street of the venue.');
  need('barangay', 'Enter the barangay of the venue.');
  need('city', 'Enter the city or municipality of the venue.');
  need('province', 'Enter the province of the venue.');
  if (custom) need('notes', 'Describe your custom order in the notes (at least 15 characters).', f.notes.trim().length >= 15);
  return problems;
}

function loginProblems(f) {
  const { problems, need } = checker(f);
  need('email', 'Enter the email address you signed up with.', EMAIL.test(f.email.trim()));
  need('password', 'Enter your password.');
  return problems;
}

function registerProblems(f) {
  const { problems, need } = checker(f);
  const name = v => NAME.test(v.trim());
  need('first_name', 'Enter your first name (letters only).', name(f.first_name));
  if (f.middle_name.trim()) need('middle_name', 'Letters only, please.', name(f.middle_name));
  need('last_name', 'Enter your last name (letters only).', name(f.last_name));
  need('email', 'Enter a valid email address.', EMAIL.test(f.email.trim()));
  const phone = phoneProblem(f.phone_cc, f.phone);
  need('phone', `${phone} in your phone number.`, !phone);
  need('password', `Use at least ${MIN_PASSWORD} characters.`, f.password.length >= MIN_PASSWORD);
  need('confirm', 'The passwords don\'t match.', Boolean(f.confirm) && f.confirm === f.password);
  return problems;
}

function profileProblems(f) {
  const { problems, need } = checker(f);
  const name = v => NAME.test(v.trim());
  need('first_name', 'Enter your first name (letters only).', name(f.first_name));
  if (f.middle_name.trim()) need('middle_name', 'Letters only, please.', name(f.middle_name));
  need('last_name', 'Enter your last name (letters only).', name(f.last_name));
  const phone = phoneProblem(f.phone_cc, f.phone);
  need('phone', `${phone} in your phone number.`, !phone);
  return problems;
}

function passwordProblems(f) {
  const { problems, need } = checker(f);
  need('current_password', 'Enter your current password.');
  need('new_password', `Use at least ${MIN_PASSWORD} characters.`, f.new_password.length >= MIN_PASSWORD);
  need('confirm', 'The passwords don\'t match.', Boolean(f.confirm) && f.confirm === f.new_password);
  return problems;
}

function deleteProblems(f) {
  const { problems, need } = checker(f);
  need('password', 'Enter your password to confirm.');
  return problems;
}

// form id -> its checks, its field id prefix and its error summary box.
const FORMS = {
  '#checkout': { check: checkoutProblems, prefix: 'c_', box: '#err' },
  '#loginForm': { check: loginProblems, prefix: 'l_', box: '#loginErr' },
  '#registerForm': { check: registerProblems, prefix: 'r_', box: '#registerErr' },
  '#deleteAccountForm': { check: deleteProblems, prefix: 'd_', box: '#deleteErr' },
  '#profileForm': { check: profileProblems, prefix: 'pf_', box: '#profileErr' },
  '#passwordForm': { check: passwordProblems, prefix: 'pw_', box: '#passwordErr' },
};
const FORM_ROUTES = { checkout: 'checkout', login: 'loginForm', register: 'registerForm', profile: 'profileForm' };

/* ---------- live validation ---------- */
// A field is checked once the visitor leaves it, then again on every change until it's right.
// Sending a form checks every field at once.

const touched = new Map(); // form id -> names of the fields the visitor has left
const touchedIn = id => { if (!touched.has(id)) touched.set(id, new Set()); return touched.get(id); };
const formValues = form => Object.fromEntries(new FormData(form).entries());
const formOf = el => el.closest?.(Object.keys(FORMS).join(','));

function showFieldErrors(form, problems) {
  const { prefix } = FORMS[`#${form.id}`];
  const seen = touchedIn(form.id);
  const byField = new Map(problems.filter(([name]) => name));
  form.querySelectorAll('.ferr').forEach(slot => {
    const name = slot.dataset.for;
    const msg = seen.has(name) ? byField.get(name) || '' : '';
    slot.textContent = msg;
    const el = $(`#${prefix}${name}`);
    if (msg) el?.setAttribute('aria-invalid', 'true');
    else el?.removeAttribute('aria-invalid');
  });
}

function liveCheck(e) {
  const form = formOf(e.target);
  if (!form || !e.target.name) return;
  const name = e.target.name === 'phone_cc' ? 'phone' : e.target.name;
  const seen = touchedIn(form.id);
  // Leaving the country-code dropdown doesn't count: the number hasn't been typed yet.
  if (e.type === 'focusout' && e.target.name !== 'phone_cc') seen.add(name);
  // Changing the password re-checks "Confirm password" once that has been filled in.
  if (!seen.has(name) && !(name === 'password' && seen.has('confirm'))) return;
  const { check, box } = FORMS[`#${form.id}`];
  const problems = check(formValues(form));
  showFieldErrors(form, problems);
  if (!problems.length) $(box).hidden = true; // the summary from a failed send goes once all is fixed
}

// Checks a form being sent: marks every problem and lists them at the top. True when it's fine.
function checkForm(form) {
  const { check } = FORMS[`#${form.id}`];
  const problems = check(formValues(form));
  problems.forEach(([name]) => touchedIn(form.id).add(name));
  showFieldErrors(form, problems);
  showErrors(form, problems);
  return !problems.length;
}

function showErrors(form, problems, heading = 'Please check the following:') {
  const box = $(FORMS[`#${form.id}`].box);
  box.hidden = !problems.length;
  if (!problems.length) return;
  box.innerHTML = `<b>${esc(heading)}</b><ul>${problems.map(([, msg]) => `<li>${esc(msg)}</li>`).join('')}</ul>`;
  box.focus();
}

// Disables a form's button while its request is out; returns a function that restores it.
function busy(selector, label) {
  const btn = $(selector);
  const text = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add('busy');
  if (label) btn.textContent = label;
  return () => { btn.disabled = false; btn.classList.remove('busy'); btn.innerHTML = text; };
}

/* ---------- booking form ---------- */

function togglePurposeOther() {
  if (!$('#otherWrap')) return; // still showing "Loading our catalog…"
  const other = $('#c_purpose')?.value === 'Other';
  $('#otherWrap').hidden = !other;
  if (!other) $('#c_purpose_other').value = '';
}

async function submitCheckout(form) {
  if (!checkForm(form)) return;
  const f = formValues(form);
  const p = cartPackage();
  const lines = cartLines();
  const blank = v => v.trim() || undefined;
  // Name, email and phone come from the customer's account.
  const body = {
    purpose: f.purpose === 'Other' ? f.purpose_other.trim() : f.purpose,
    event_date: f.event_date, start_time: blank(f.start_time),
    street: f.street.trim(), barangay: f.barangay.trim(), city: f.city.trim(), province: f.province.trim(),
    notes: blank(f.notes),
    package_id: p?.package_id,
    items: lines.length ? lines.map(l => ({ item_id: l.item.item_id, qty: l.qty })) : undefined,
  };

  const done = busy('#submitOrder');
  try {
    const order = await api.account.order(body);
    rememberOrder(order, store.profile.email);
    clearCart();
    forgetAccountData(); // the portal shows the new booking next
    location.hash = '#/done';
    loadCatalog(); // stock levels changed
  } catch (err) {
    showErrors(form, [[null, err.message]], 'We could not send your request:');
  } finally {
    done();
  }
}

/* ---------- login and sign-up ---------- */

// After logging in, go where the visitor was headed (e.g. the booking form), else the dashboard.
function afterLogin(form) {
  forgetAccountData();
  const next = form.dataset.next;
  location.hash = next ? `#/${next}` : '#/dashboard';
}

async function submitLogin(form) {
  if (!checkForm(form)) return;
  const f = formValues(form);
  const done = busy('#loginBtn', 'Logging in…');
  try {
    if (await logIn(f.email.trim(), f.password) === 'staff') {
      toast('Staff account: opening the admin dashboard…', 4000);
      return; // the browser is on its way to /admin
    }
    toast(`Welcome back, ${store.profile.first_name}`);
    afterLogin(form);
  } catch (err) {
    showErrors(form, [[null, err.message]], 'We could not log you in:');
    $('#l_password').value = '';
  } finally {
    done();
    hidePasswords(form);
  }
}

async function submitRegister(form) {
  if (!checkForm(form)) return;
  const f = formValues(form);
  const blank = v => v.trim() || undefined;
  const done = busy('#registerBtn', 'Creating your account…');
  try {
    await register({
      first_name: f.first_name.trim(), middle_name: blank(f.middle_name), last_name: f.last_name.trim(),
      email: f.email.trim(), phone: phoneValue(f.phone_cc, f.phone), password: f.password,
    });
    toast(`Welcome to Laetitia, ${store.profile.first_name}!`);
    afterLogin(form);
  } catch (err) {
    showErrors(form, [[null, err.message]], 'We could not create your account:');
  } finally {
    done();
    hidePasswords(form);
  }
}

// Deletes the customer's own login after they confirm with their password.
async function submitDeleteAccount(form) {
  if (!checkForm(form)) return;
  if (!confirm('Delete your Laetitia account? You will be logged out and can\'t log in with it again.')) return;
  const done = busy('#deleteBtn', 'Deleting…');
  try {
    const { message } = await api.account.remove(formValues(form).password);
    await logOut();
    forgetAccountData();
    toast(message, 6000);
    location.hash = '#/';
  } catch (err) {
    showErrors(form, [[null, err.message]], 'We could not delete your account:');
    $('#d_password').value = '';
  } finally {
    done();
  }
}

/* ---------- portal: my profile ---------- */

async function submitProfile(form) {
  if (!checkForm(form)) return;
  const f = formValues(form);
  const blank = v => v.trim() || null; // a cleared box clears that detail
  const done = busy('#profileBtn', 'Saving…');
  try {
    const { message } = await api.account.updateProfile({
      first_name: f.first_name.trim(), middle_name: blank(f.middle_name), last_name: f.last_name.trim(),
      phone: phoneValue(f.phone_cc, f.phone),
      street: blank(f.street), barangay: blank(f.barangay), city_municipality: blank(f.city_municipality), province: blank(f.province),
    });
    store.profile = await api.account.profile();
    toast(message);
    render({ keepScroll: true });
  } catch (err) {
    showErrors(form, [[null, err.message]], 'We could not save your details:');
  } finally {
    done();
  }
}

async function submitPassword(form) {
  if (!checkForm(form)) return;
  const f = formValues(form);
  const done = busy('#passwordBtn', 'Changing…');
  try {
    toast((await api.account.changePassword(f.current_password, f.new_password)).message);
    form.reset();
    touched.delete(form.id);
  } catch (err) {
    showErrors(form, [[null, err.message]], 'We could not change your password:');
  } finally {
    done();
    hidePasswords(form);
  }
}

/* ---------- build your own (kiosk) ---------- */

// The kiosk's order tray: on phones it folds down to a bar until opened.
let trayOpen = false;

function kioskAction(el) {
  const d = el.dataset;
  if ('kcat' in d) {
    V.setKioskCat(d.kcat);
    return render({ keepScroll: true });
  }
  if ('ktray' in d) {
    trayOpen = !trayOpen;
    $('#tray').classList.toggle('open', trayOpen);
    el.setAttribute('aria-expanded', String(trayOpen));
    return;
  }
  if ('kclear' in d) {
    if (!confirm('Remove everything from your order?')) return;
    clearCart();
    toast('Your order is empty');
  } else if ('kpkg' in d) {
    const p = findPackage(d.kpkg);
    setPackage(d.kpkg);
    V.kioskFlash.id = 'pkg';
    toast(`${p?.name || 'Package'} added`);
  } else if ('kunpkg' in d) {
    setPackage(null);
  } else {
    const id = d.kadd || d.ksub || d.kdel;
    const item = findItem(id);
    if (!item) return;
    const have = store.cart.lines[id] || 0;
    const next = 'kadd' in d ? have + 1 : 'ksub' in d ? have - 1 : 0;
    if (next > item.qty_available) return toast(`Only ${item.qty_available} available`);
    setQty(id, next);
    V.kioskFlash.id = next > have ? `i${id}` : null;
  }
  render({ keepScroll: true });
}

async function signOut() {
  await logOut();
  forgetAccountData();
  toast('You are logged out');
  if (NEEDS_LOGIN.includes(route().name)) location.hash = '#/';
  else render({ keepScroll: true });
}

function togglePassword(btn) {
  const input = $(`#${btn.dataset.pw}`);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.textContent = show ? 'Hide' : 'Show';
  btn.setAttribute('aria-pressed', String(show));
}

// A password left on "Show" would still be readable on screen afterwards.
function hidePasswords(form) {
  form?.querySelectorAll('[data-pw]').forEach(btn => { if ($(`#${btn.dataset.pw}`)?.type === 'text') togglePassword(btn); });
}

/* ---------- tracking ---------- */

async function submitTrack(form) {
  const f = formValues(form);
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
  const pw = t.closest('[data-pw]');
  if (pw) return togglePassword(pw);
  if (t.closest('[data-logout]')) return signOut();

  const kiosk = t.closest('[data-kcat],[data-ktray],[data-kclear],[data-kpkg],[data-kunpkg],[data-kadd],[data-ksub],[data-kdel]');
  if (kiosk && !kiosk.disabled) return kioskAction(kiosk);
  const bfilter = t.closest('[data-bfilter]');
  if (bfilter) { P.setBookingFilter(bfilter.dataset.bfilter); return render({ keepScroll: true }); }

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
  liveCheck(e);
});

document.addEventListener('change', e => {
  if (e.target.id === 'c_purpose') togglePurposeOther();
  liveCheck(e);
});

document.addEventListener('focusout', liveCheck);

const SUBMITS = {
  checkout: submitCheckout, loginForm: submitLogin, registerForm: submitRegister, deleteAccountForm: submitDeleteAccount, trackForm: submitTrack,
  profileForm: submitProfile, passwordForm: submitPassword,
};
document.addEventListener('submit', e => {
  e.preventDefault();
  SUBMITS[e.target.id]?.(e.target);
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
// A saved login is checked before the first page shows, so pages that need one don't bounce to Log in.
P.bindPortal(() => myOrders);
await loadUser();
render();
await loadCatalog();
render({ keepScroll: true });
