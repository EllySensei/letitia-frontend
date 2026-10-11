// Customer portal: what a logged-in customer sees (the designer's "Customer Dashboard" mockups).
// The sidebar and top bar wrap every page; the catalog pages (packages, rentals, your order,
// booking) are the storefront's own and simply show inside this shell. The pages below are the
// ones only customers have. main.js does the routing and loads the data they show.
import { store, cartCount } from './store.js';
import { orderCard, paymentInfo, statusPill } from './views.js';
import { CONTACT, FAQS } from './info.js';
import { phoneInputs } from '../phone.js';
import { $, $$, esc, peso, fmtDate, fmtTime, isoDate } from '../utils.js';

const ico = n => `<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const REQ = ' <span class="req" aria-hidden="true">*</span>';

// Pending, approved or under way, and not in the past.
const isUpcoming = o => ['Pending', 'Approved', 'Ongoing'].includes(o.status) && o.event_date >= isoDate();
const owing = o => o.status !== 'Cancelled' && Number(o.remaining) > 0;
const orderName = o => o.package_name || (o.custom_order === 'Rental items only' ? 'Rental items' : 'Custom order');
const sum = (list, key) => list.reduce((s, x) => s + Number(x[key] || 0), 0);

const head = (title, sub) => `<div class="phead"><h1>${title}</h1><p>${sub}</p></div>`;
const loading = what => `<div class="state-msg"><span class="spinner" aria-hidden="true"></span>Loading your ${what}…</div>`;

// A table of the customer's bookings; `cols` picks the columns.
function bookingTable(orders, cols, empty) {
  const COLS = {
    ref: ['Ref.', o => `<b>#${o.event_id}</b>`],
    date: ['Date and time', o => `${fmtDate(o.event_date)}<br><small>${fmtTime(o.start_time)}</small>`],
    venue: ['Venue / address', o => esc(o.venue_address || '—')],
    order: ['Package / order', o => `${esc(orderName(o))}${o.event_type ? `<br><small>${esc(o.event_type)}</small>` : ''}`],
    total: ['Amount', o => peso(o.contract_value)],
    balance: ['Balance', o => (owing(o) ? `<b class="due">${peso(o.remaining)}</b>` : peso(0))],
    status: ['Status', o => statusPill(o.status)],
    view: ['', o => `<a class="btn sm ghost" href="#/booking/${o.event_id}">View</a>`],
  };
  if (!orders.length) return `<p class="pempty">${empty}</p>`;
  return `<div class="ptable-wrap"><table class="ptable"><thead><tr>${cols.map(c => `<th>${COLS[c][0]}</th>`).join('')}</tr></thead>`
    + `<tbody>${orders.map(o => `<tr>${cols.map(c => `<td>${COLS[c][1](o)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

const box = (icon, title, sub, body, more = '') => `<section class="pbox"><h3><span>${ico(icon)}<span>${title}<small>${sub}</small></span></span>${more}</h3>${body}</section>`;

/* ---------- pages ---------- */

export function dashboard(orders) {
  if (!orders) return head('Dashboard', 'Your bookings at a glance') + loading('bookings');
  const upcoming = orders.filter(isUpcoming).sort((a, b) => a.event_date.localeCompare(b.event_date));
  const live = orders.filter(o => o.status !== 'Cancelled');
  const balance = sum(live.filter(owing), 'remaining');
  const latest = [...orders].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const byStatus = ['Pending', 'Approved', 'Ongoing'].map(s => [s, orders.filter(o => o.status === s).length]).filter(([, n]) => n);
  return head('Dashboard', `Welcome back, ${esc(store.profile?.first_name || '')}. Here are your bookings at a glance.`)
    + `<div class="pcards">
      <div class="pstat"><span class="pic t">${ico('cal')}</span><div><small>Upcoming events</small><b>${upcoming.length}</b><small>${upcoming[0] ? `Next: ${fmtDate(upcoming[0].event_date)}` : 'None booked yet'}</small></div></div>
      <div class="pstat"><span class="pic b">${ico('book')}</span><div><small>Booking status</small><b>${orders.length} booking${orders.length === 1 ? '' : 's'}</b><small>${byStatus.length ? byStatus.map(([s, n]) => `${n} ${s.toLowerCase()}`).join(' · ') : 'No active bookings'}</small></div></div>
      <div class="pstat"><span class="pic p">${ico('peso')}</span><div><small>My balance</small><b>${peso(balance)}</b><small>${balance ? 'Due before your events' : 'All paid up'}</small></div></div>
     </div>
     <div class="pgrid">
      ${box('cal', 'Upcoming events', 'Your next bookings', bookingTable(upcoming.slice(0, 5), ['date', 'venue', 'status', 'view'], 'No upcoming events. <a href="#/packages">Book one</a>.'), '<a href="#/bookings">View all ' + ico('arrow') + '</a>')}
      ${box('zap', 'Quick actions', 'Common tasks', `<div class="pqa">
        <a class="p" href="#/packages">${ico('plus')}Book an event</a>
        <a href="#/build">${ico('spark')}Build a custom order</a>
        <a href="#/bookings">${ico('book')}View my bookings</a>
        <a href="#/support">${ico('headset')}Contact support</a>
        <a href="#/payments">${ico('card')}Make a payment</a></div>`)}
     </div>
     ${box('book', 'Recent bookings', 'Newest first', bookingTable(latest.slice(0, 5), ['ref', 'date', 'order', 'total', 'status', 'view'], 'No bookings yet.'), '<a href="#/bookings">View all ' + ico('arrow') + '</a>')}`;
}

let bookingFilter = 'All';
export const setBookingFilter = f => { bookingFilter = f; };

export function bookings(orders) {
  if (!orders) return head('My Bookings', 'Every booking you have made') + loading('bookings');
  const filters = ['All', 'Pending', 'Approved', 'Ongoing', 'Completed', 'Cancelled'].filter(f => f === 'All' || orders.some(o => o.status === f));
  if (!filters.includes(bookingFilter)) bookingFilter = 'All';
  const list = orders.filter(o => bookingFilter === 'All' || o.status === bookingFilter);
  return head('My Bookings', 'Every booking you have made, newest event first')
    + `<div class="chips" role="group" aria-label="Filter by status">${filters.map(f => `<button type="button" class="filter${f === bookingFilter ? ' on' : ''}" data-bfilter="${f}" aria-pressed="${f === bookingFilter}">${f}</button>`).join('')}
       <a class="btn primary sm pnew" href="#/packages">${ico('plus')}Book an event</a></div>`
    + `<section class="pbox">${bookingTable(list, ['ref', 'date', 'order', 'total', 'balance', 'status', 'view'], 'No bookings here yet.')}</section>`;
}

export function bookingDetail(orders, payments, id) {
  if (!orders) return head('Booking', '') + loading('booking');
  const o = orders.find(x => String(x.event_id) === String(id));
  if (!o) return head('Booking not found', 'It may belong to another account.') + '<a class="btn ghost" href="#/bookings">Back to my bookings</a>';
  const paid = (payments || []).filter(p => p.event_id === o.event_id);
  return `<a class="back" href="#/bookings">${ico('back')}My bookings</a>` + head(`Booking #${o.event_id}`, `${esc(o.event_type || 'Event')} · ${fmtDate(o.event_date)}`)
    + `<div class="split"><div class="stack">${orderCard(o)}
       ${box('card', 'Payments', 'Recorded by our team', paymentTable(paid, 'No payments recorded yet.'))}</div>
       <aside class="card next">${owing(o) ? `<h2>Balance due: ${peso(o.remaining)}</h2>${paymentInfo()}` : `<h2>${o.status === 'Cancelled' ? 'This booking was cancelled' : 'Fully paid'}</h2><p class="muted">${o.status === 'Cancelled' ? 'Contact us if you have questions about it.' : 'Thank you! Nothing is owed on this booking.'}</p>`}
        <a class="btn ghost block" href="#/support">Questions? Contact support</a></aside></div>`;
}

const PAY_TYPES = { downpayment: 'Downpayment', balance: 'Balance', deposit: 'Security deposit', damage_fee: 'Damage fee', refund: 'Refund' };

function paymentTable(payments, empty) {
  if (!payments.length) return `<p class="pempty">${empty}</p>`;
  return `<div class="ptable-wrap"><table class="ptable"><thead><tr><th>Date</th><th>Booking</th><th>Type</th><th>Method</th><th>Reference no.</th><th>Amount</th></tr></thead><tbody>`
    + payments.map(p => `<tr><td>${fmtDate(p.paid_at)}</td><td><a href="#/booking/${p.event_id}">#${p.event_id}</a><br><small>${esc(p.package_name)}</small></td>`
      + `<td>${esc(PAY_TYPES[p.type] || p.type)}</td><td>${esc(p.method || '—')}</td><td>${esc(p.reference_no || '—')}</td><td><b>${peso(p.amount)}</b></td></tr>`).join('')
    + '</tbody></table></div>';
}

export function payments(orders, list) {
  if (!orders || !list) return head('My Payments', 'Balances and payment history') + loading('payments');
  const live = orders.filter(o => o.status !== 'Cancelled');
  const due = live.filter(owing).sort((a, b) => a.event_date.localeCompare(b.event_date));
  return head('My Payments', 'What you have paid, what is left, and how to pay')
    + `<div class="pcards">
      <div class="pstat"><span class="pic t">${ico('book')}</span><div><small>Total of your bookings</small><b>${peso(sum(live, 'contract_value'))}</b><small>Not counting cancelled ones</small></div></div>
      <div class="pstat"><span class="pic g">${ico('check')}</span><div><small>Paid so far</small><b>${peso(sum(live, 'paid_amount'))}</b><small>Downpayments and balances</small></div></div>
      <div class="pstat"><span class="pic p">${ico('peso')}</span><div><small>Balance left</small><b>${peso(sum(due, 'remaining'))}</b><small>${due.length ? `${due.length} booking${due.length === 1 ? '' : 's'} with a balance` : 'All paid up'}</small></div></div>
     </div>
     <div class="pgrid">
      ${box('peso', 'Balances due', 'Earliest event first', bookingTable(due, ['ref', 'date', 'total', 'balance', 'view'], 'Nothing to pay right now.'))}
      <section class="pbox"><h3><span>${ico('card')}<span>Make a payment<small>How to pay</small></span></span></h3>${paymentInfo()}
       <p class="muted small">Payments are recorded by our team once received. They show up here with their reference number.</p></section>
     </div>
     ${box('card', 'Payment history', 'Newest first', paymentTable(list, 'No payments recorded yet.'))}`;
}

const pField = (name, label, value, attrs = '', req = false) => `<div class="field"><label for="pf_${name}">${label}${req ? REQ : ''}</label>`
  + `<input id="pf_${name}" name="${name}" value="${esc(value ?? '')}" aria-describedby="pf_${name}Err" ${attrs}${req ? ' required' : ''}>`
  + `<small class="ferr" id="pf_${name}Err" data-for="${name}" aria-live="polite"></small></div>`;

const pwField = (p, name, label, autocomplete) => `<div class="field"><label for="${p}${name}">${label}${REQ}</label>`
  + `<div class="pw"><input id="${p}${name}" name="${name}" type="password" autocomplete="${autocomplete}" maxlength="200" required aria-describedby="${p}${name}Err">`
  + `<button type="button" class="pwt" data-pw="${p}${name}" aria-pressed="false">Show</button></div>`
  + `<small class="ferr" id="${p}${name}Err" data-for="${name}" aria-live="polite"></small></div>`;

export function profile(orders) {
  const p = store.profile || {};
  return head('My Profile', 'Your details, password and account')
    + `<div class="split"><div class="stack">
      <form class="card fs" id="profileForm" novalidate><h2>My details</h2>
       <div class="err" id="profileErr" role="alert" tabindex="-1" hidden></div>
       <div class="fgrid three">${pField('first_name', 'First name', p.first_name, 'autocomplete="given-name" maxlength="100"', true)}
        ${pField('middle_name', 'Middle name', p.middle_name, 'autocomplete="additional-name" maxlength="100"')}
        ${pField('last_name', 'Last name', p.last_name, 'autocomplete="family-name" maxlength="100"', true)}</div>
       <div class="fgrid two"><div class="field"><label for="pf_email">Email address</label><input id="pf_email" value="${esc(p.email || '')}" disabled><small class="hint">You log in with this, so it can't be changed here.</small></div>
        <div class="field"><label for="pf_phone">Phone number${REQ}</label>${phoneInputs('pf_phone', { name: 'phone', attrs: 'required aria-describedby="pf_phoneErr"' })}<small class="ferr" id="pf_phoneErr" data-for="phone" aria-live="polite"></small></div></div>
       <div class="fgrid two">${pField('street', 'Street / building', p.street, 'autocomplete="address-line1" maxlength="255"')}
        ${pField('barangay', 'Barangay', p.barangay, 'maxlength="100"')}
        ${pField('city_municipality', 'City / Municipality', p.city_municipality, 'autocomplete="address-level2" maxlength="100"')}
        ${pField('province', 'Province', p.province, 'autocomplete="address-level1" maxlength="100"')}</div>
       <div class="form-end"><button class="btn primary" type="submit" id="profileBtn">Save my details</button></div>
      </form>
      <form class="card fs" id="passwordForm" novalidate><h2>Change password</h2>
       <div class="err" id="passwordErr" role="alert" tabindex="-1" hidden></div>
       <div class="fgrid three">${pwField('pw_', 'current_password', 'Current password', 'current-password')}
        ${pwField('pw_', 'new_password', 'New password', 'new-password')}
        ${pwField('pw_', 'confirm', 'Confirm new password', 'new-password')}</div>
       <div class="form-end"><button class="btn primary" type="submit" id="passwordBtn">Change password</button></div>
      </form></div>
     <aside class="card summary"><h2>Account</h2>
      <dl class="kv"><dt>Name</dt><dd>${esc(p.full_name || '')}</dd><dt>Email</dt><dd>${esc(p.email || '')}</dd><dt>Bookings</dt><dd>${orders ? orders.length : '…'}</dd></dl>
      <button class="btn ghost block" type="button" data-logout>Log out</button>
      <details class="danger-zone"><summary>Delete my account</summary>
       <p class="muted small">This deletes your login and can't be undone. ${orders?.length
    ? 'Your bookings stay with us so we can finish them, and you can still track them by reference number.'
    : 'Your details are removed too.'}</p>
       <form id="deleteAccountForm" class="stack" novalidate>
        <div class="err" id="deleteErr" role="alert" tabindex="-1" hidden></div>
        ${pwField('d_', 'password', 'Enter your password to confirm', 'current-password')}
        <button class="btn danger block" type="submit" id="deleteBtn">Delete my account</button>
       </form></details>
     </aside></div>`;
}

export function support() {
  const rows = [['phone', 'Phone', CONTACT.phone], ['mail', 'Email', CONTACT.email], ['chat', 'Social', CONTACT.social], ['pin', 'Service area', CONTACT.area]]
    .filter(r => r[2]);
  return head('Support', 'Questions about a booking, a date or a payment? We are here to help.')
    + `<div class="split wide">
      <section class="card fs"><h2>Frequently asked questions</h2>${FAQS.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section>
      <aside class="card fs contact-card"><h2>Get in touch</h2>
       ${rows.length ? rows.map(([i, l, v]) => `<div class="contact-row">${ico(i)}<div><small>${l}</small><b>${esc(v)}</b></div></div>`).join('')
    : '<p class="muted">Add a note to your booking request, or mention your booking\'s reference number when you contact us, and our team will get back to you.</p>'}
       <a class="btn primary block" href="#/bookings">See my bookings</a></aside></div>`;
}

/* ---------- shell ---------- */

// Updates computed from the customer's bookings: what needs their attention.
function updates(orders) {
  const today = isoDate();
  const soon = isoDate(7);
  const list = [];
  for (const o of orders || []) {
    if (o.status === 'Pending') list.push([o, `Booking #${o.event_id} is waiting for our approval.`]);
    if (isUpcoming(o) && o.event_date <= soon) list.push([o, `Your ${o.event_type || 'event'} is on ${fmtDate(o.event_date)}${o.event_date === today ? ' (today)' : ''}.`]);
    if (o.status === 'Approved' && owing(o)) list.push([o, `Booking #${o.event_id} has a balance of ${peso(o.remaining)}.`]);
  }
  return list;
}

// First and last name, e.g. "Sherman Li" -> SL (a middle name is skipped).
const initials = name => {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] || '') + (words.length > 1 ? words.at(-1)[0] : '')).toUpperCase();
};

// Shows or hides the portal around the page and marks the current section.
export function renderShell(on, section, orders) {
  document.body.classList.toggle('portal', on);
  $('#pside').hidden = !on;
  $('#ptop').hidden = !on;
  $('#nav').hidden = on;
  $('.foot').hidden = on;
  if (!on) return;
  $$('[data-pnav]').forEach(a => a.toggleAttribute('aria-current', a.dataset.pnav === section));
  $('#pDate').innerHTML = `${ico('cal')}${fmtDate(isoDate())}`;
  const n = cartCount();
  $('#pCartCount').textContent = n;
  $('#pCartCount').hidden = !n;
  const name = store.profile?.full_name || store.user?.full_name || '';
  $('#pName').textContent = name;
  $('#pInit').textContent = initials(name);
  const items = updates(orders);
  $('#pBellCount').textContent = items.length;
  $('#pBellCount').hidden = !items.length;
  $('#pBellList').innerHTML = items.length
    ? items.map(([o, text]) => `<a href="#/booking/${o.event_id}">${esc(text)}</a>`).join('')
    : '<p class="pempty">Nothing needs your attention.</p>';
}

/* ---------- header search ---------- */

const matches = (q, ...fields) => fields.some(f => String(f ?? '').toLowerCase().includes(q));

function searchResults(q, orders) {
  const groups = [
    ['Packages', store.packages.filter(p => matches(q, p.name, p.type, p.description)).map(p => [`#/package/${p.package_id}`, p.name, `${p.type || 'Package'} · ${peso(p.base_price)}`])],
    ['Rental items', store.items.filter(i => matches(q, i.name, i.category)).map(i => [`#/item/${i.item_id}`, i.name, `${i.category || 'Item'} · ${peso(i.rental_price)}`])],
    ['My bookings', (orders || []).filter(o => matches(q, `#${o.event_id}`, o.event_type, o.package_name, o.venue_address)).map(o => [`#/booking/${o.event_id}`, `#${o.event_id} ${orderName(o)}`, `${fmtDate(o.event_date)} · ${o.status}`])],
  ];
  return groups.map(([t, rows]) => [t, rows.slice(0, 5)]).filter(([, rows]) => rows.length);
}

function setPanel(panel, button, open) {
  $(panel).hidden = !open;
  $(button).setAttribute('aria-expanded', String(open));
}

export function bindPortal(getOrders) {
  const results = () => {
    const q = $('#pQ').value.trim().toLowerCase();
    const box = $('#pResults');
    if (!q) { box.hidden = true; return; }
    const groups = searchResults(q, getOrders());
    box.innerHTML = groups.length
      ? groups.map(([t, rows]) => `<h4>${t}</h4>${rows.map(([href, label, sub]) => `<a href="${href}"><b>${esc(label)}</b><small>${esc(sub)}</small></a>`).join('')}`).join('')
      : '<p class="pempty">No packages, items or bookings match.</p>';
    box.hidden = false;
    $('#pQ').setAttribute('aria-expanded', 'true');
  };
  $('#pQ').addEventListener('input', results);
  $('#pQ').addEventListener('focus', results);
  $('#pQ').addEventListener('keydown', e => {
    if (e.key === 'Enter') { const first = $('#pResults a'); if (first) location.hash = first.getAttribute('href'); }
    if (e.key === 'Escape') $('#pResults').hidden = true;
  });
  document.addEventListener('click', e => {
    if (e.target.closest('#pResults a')) { $('#pQ').value = ''; $('#pResults').hidden = true; }
    else if (!e.target.closest('#pSearch')) $('#pResults').hidden = true;
    if (e.target.closest('#pBell')) return setPanel('#pBellPanel', '#pBell', $('#pBellPanel').hidden);
    if (e.target.closest('#pUser')) return setPanel('#pUserMenu', '#pUser', $('#pUserMenu').hidden);
    if (!e.target.closest('#pBellPanel')) setPanel('#pBellPanel', '#pBell', false);
    if (!e.target.closest('#pUserMenu') || e.target.closest('a, button')) setPanel('#pUserMenu', '#pUser', false);
  });
}
