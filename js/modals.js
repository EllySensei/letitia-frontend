// Modal definitions. Each has a title, a body (may be async), an ok label and run().
// run() returns false when the form is incomplete, 'keep' to stay open, or a success
// message (or true) to close the modal and reload data. A thrown error is shown as a toast.
//   public: usable while logged out   admin: needs an admin account
import { api } from './api.js';
import { state, isAdmin } from './state.js';
import { signIn } from './session.js';
import {
  createBooking, bookingProblem, bookingFields, readBooking, venueLabel, packageLabel, EVENT_TYPES, PAST_MSG,
} from './bookings.js';
import {
  field, password, textarea, select, choice, choiceVal, nameFields, readName, addressFields, readAddress, val, num, note,
  phoneField, phoneVal, picture, pictureVal, changed,
} from './form.js';
import { isoFor } from './phone.js';
import { $, esc, peso, fmtDate, fmtTime, pill, isoDate, toast, idCell } from './utils.js';

const METHODS = [['Cash', 'Cash'], ['GCash', 'GCash'], ['Bank Transfer', 'Bank Transfer']];
const MONEY = 'min="0" step="0.01" placeholder="₱"';
const PAYMENT_TYPES = [['downpayment', 'Downpayment'], ['balance', 'Balance'], ['deposit', 'Security deposit'],
  ['damage_fee', 'Damage / missing fee'], ['refund', 'Refund']];
// Event statuses an admin can set; Ongoing follows from the date and Cancelled has its own button.
const EVENT_STATUSES = [['Pending', 'Pending'], ['Approved', 'Approved'], ['Completed', 'Completed']];

const NO_CHANGES = 'No changes to save';
const isEmpty = body => !Object.keys(body).length;

// The record an edit button points at, from the lists already loaded.
function record(list, key, id, what) {
  const found = list.find(x => String(x[key]) === String(id));
  if (!found) throw new Error(`${what} not found; refresh the page`);
  return found;
}

// Starting choices for the Category and Unit pickers; ones already in use are added to them.
const CATEGORIES = ['Prop', 'Backdrop', 'Furniture', 'Lighting', 'Linens', 'Tableware', 'Florals', 'Signage', 'Balloon Stand'];
const UNITS = ['pcs', 'sets', 'packs', 'boxes', 'rolls', 'bottles', 'meters', 'kg', 'liters'];
const withUsed = (base, used) => [...new Set([...base, ...used.filter(Boolean)])];

// Records that can be archived, for the "Archived" list. `api` names the resource in api.js.
const ARCHIVES = {
  clients: { title: 'Archived clients', head: ['Client', 'Contact'], load: () => api.clients.archived(),
    row: c => [c.full_name, c.phone || c.email || '—'], key: c => ['clients', c.client_id, c.full_name] },
  packages: { title: 'Archived packages', head: ['Package', 'Price'], load: () => api.packages.archived(),
    row: p => [p.name, peso(p.base_price)], key: p => ['packages', p.package_id, p.name] },
  inventory: { title: 'Archived inventory', head: ['Code', 'Item'],
    load: async () => [...await api.inventory.archived(), ...await api.consumables.archived()],
    row: i => [i.item_code || '—', i.name],
    key: i => i.item_id ? ['inventory', i.item_id, i.name] : ['consumables', i.consumable_id, i.name] },
};

const owingOptions = () => state.receivables.map(r => [r.event_id, `${r.client_name} — ${fmtDate(r.event_date)} (${peso(r.remaining)} left)`]);
const eventOptions = () => state.events.filter(e => e.status !== 'Cancelled').map(e => [e.event_id, `#${e.event_id} ${e.client_name} — ${fmtDate(e.event_date)}`]);
const lineOptions = statuses => state.returns.filter(r => statuses.includes(r.status))
  .map(r => [r.event_item_id, `${r.qty} × ${r.item_name} — ${r.client_name} (${r.status})`]);

const table = (head, rows) => `<div class="tw"><table class="mini"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead>`
  + `<tbody>${rows.length ? rows.join('') : `<tr><td class="empty" colspan="${head.length}">Nothing to show</td></tr>`}</tbody></table></div>`;

// ---- fields shared by the add and edit forms ----

const clientFields = () => nameFields()
  + '<div class="frow2">'
  + `<div>${phoneField('contact', 'Contact number', { req: true })}</div>`
  + `<div>${field('email', 'Email', 'email', { attrs: 'maxlength="150" placeholder="Optional"' })}</div></div>`
  + addressFields();

const packageFields = (image = '') => field('pkgName', 'Package Name', 'text', { req: true, attrs: 'maxlength="120"' })
  + choice('pkgType', 'Type', EVENT_TYPES, { req: true, max: 50, other: 'e.g. Reunion' })
  + field('pkgPrice', 'Price', 'number', { req: true, attrs: 'min="0.01" step="0.01" placeholder="₱"' })
  + textarea('pkgDesc', 'Inclusions / Description', 'e.g. Balloon arch, backdrop, LED lights', { rows: 4, attrs: 'maxlength="2000"' })
  + picture('pkgImage', 'Package Picture', 'pkgPreview', image);

const readPackage = () => ({ name: val('pkgName'), type: choiceVal('pkgType'), base_price: num('pkgPrice'), description: val('pkgDesc'), image: pictureVal('pkgPreview') });

// The collation in the database ignores case, so "Gold" and "gold" are the same name.
const packageNameTaken = (name, exceptId) => state.packages.some(p => p.package_id !== exceptId && p.name.toLowerCase() === name.toLowerCase());

const itemNameAndCode = () => '<div class="frow2">'
  + `<div>${field('name', 'Item name', 'text', { req: true, attrs: 'maxlength="120"' })}</div>`
  + `<div>${field('code', 'Item code', 'text', { attrs: 'maxlength="30" placeholder="Automatic if blank" data-check="code"' })}</div></div>`;

const rentalFields = (image = '') => choice('category', 'Category', withUsed(CATEGORIES, state.inventory.map(i => i.category)), { req: true, max: 100, other: 'New category' })
  + '<div class="frow2">'
  + `<div>${field('qty', 'Quantity owned', 'number', { req: true, attrs: 'min="0" step="1"' })}</div>`
  + `<div>${field('price', 'Rental price (₱)', 'number', { attrs: MONEY, hint: '0 = package use only, hidden from the storefront' })}</div></div>`
  + textarea('itemDesc', 'Description (shown on the storefront)', 'e.g. Classic white chair that pairs with any theme', { attrs: 'maxlength="2000"' })
  + picture('itemImage', 'Picture', 'itemPreview', image);

const readRental = () => ({
  name: val('name'), item_code: val('code') || undefined, category: choiceVal('category'), qty_total: num('qty'),
  rental_price: num('price'), description: val('itemDesc'), image: pictureVal('itemPreview'),
});

const consumableFields = () => '<div class="frow3">'
  + `<div>${field('stock', 'Quantity in stock', 'number', { req: true, attrs: 'min="0" step="1"' })}</div>`
  + `<div>${choice('unit', 'Unit', withUsed(UNITS, state.consumables.map(c => c.unit)), { req: true, max: 30, placeholder: 'Select unit', other: 'e.g. dozens' })}</div>`
  + `<div>${field('reorder', 'Reorder when at or below', 'number', { attrs: 'min="0" step="1" placeholder="0"' })}</div></div>`;

const readConsumable = () => ({
  name: val('name'), item_code: val('code') || undefined, unit: choiceVal('unit'), current_level: num('stock'), reorder_level: num('reorder'),
});

function printSheet(title, html) {
  const w = window.open('', '_blank');
  if (!w) return toast('Allow pop-ups to print the pull sheet');
  w.document.write(`<!doctype html><title>${esc(title)}</title><style>body{font-family:sans-serif;font-size:12px}`
    + 'table{border-collapse:collapse;width:100%;margin-bottom:16px}th,td{border:1px solid #ccc;padding:6px;text-align:left}</style>'
    + `<h2>${esc(title)}</h2>${html}`);
  w.document.close();
  w.print();
}

export const MODALS = {
  adminLogin: {
    title: 'Admin log in', ok: 'Log in', public: true,
    body: () => field('username', 'Username', 'text', { req: true, attrs: 'autocomplete="username"' }) + password('password', 'Password'),
    async run() {
      if (!val('username') || !val('password')) return false;
      await signIn(val('username'), val('password'));
      return `Welcome, ${state.user.full_name || state.user.username}`;
    },
  },

  client: {
    title: 'New Client', ok: 'Add Client', admin: true,
    body: clientFields,
    async run() {
      await api.clients.create({ ...readName(), phone: phoneVal('contact'), email: val('email') || undefined, ...readAddress() });
      return 'Client added';
    },
  },

  editClient: {
    title: 'Edit Client', ok: 'Save Changes', admin: true,
    body(ctx) {
      ctx.saved = record(state.clients, 'client_id', ctx.id, 'Client');
      return clientFields();
    },
    fill: ({ saved: c }) => ({
      first: c.first_name, middle: c.middle_name, last: c.last_name, contactCc: isoFor(c.phone_country_code), contact: c.phone_number,
      email: c.email, street: c.street, barangay: c.barangay, city: c.city_municipality, province: c.province,
    }),
    async run({ saved: c }) {
      const body = changed({ ...c, phone: `${c.phone_country_code ?? ''}${c.phone_number ?? ''}` }, {
        first_name: val('first'), middle_name: val('middle'), last_name: val('last'), phone: phoneVal('contact'), email: val('email'),
        street: val('street'), barangay: val('barangay'), city_municipality: val('city'), province: val('province'),
      });
      if (isEmpty(body)) return NO_CHANGES;
      await api.clients.update(c.client_id, body);
      return `${val('first')} ${val('last')} updated`;
    },
  },

  event: {
    title: 'New Booking / Event', ok: 'Submit Booking', admin: true, wide: true,
    body: () => bookingFields(),
    async run() {
      const booking = readBooking();
      const problem = bookingProblem(booking);
      if (problem) { toast(problem); return 'keep'; }
      await createBooking(booking);
      return 'Booking submitted ✓';
    },
  },

  eventDetail: {
    title: 'Event details', cancel: 'Close',
    async body(ctx) {
      const e = ctx.event = await api.events.get(ctx.id);
      return note(`<b>${esc(e.client_name)}</b> · event #${e.event_id}${e.source === 'online' ? ' <span class="pill web">Online</span>' : ''}`
          + `<br>${esc(e.event_type || 'Event type not set')} · ${fmtDate(e.event_date)} ${fmtTime(e.start_time)}`
          + `<br>${e.venue_name ? `${esc(e.venue_name)}, ` : ''}${esc(e.venue_address || 'No venue address')}`
          + `<br>Package: ${esc(e.package_name || (e.custom_order ? 'Custom order' : '—'))} · Status: ${esc(e.status)}`
          + `<br>Total price ${peso(e.contract_value)} · Paid ${peso(e.paid_amount)} · Remaining ${peso(e.remaining)}`)
        + (e.custom_order && !e.package_name ? `<label>Custom order</label><p class="order-notes">${esc(e.custom_order)}</p>` : '')
        + (e.setup_notes ? `<label>Order notes</label><p class="order-notes">${esc(e.setup_notes)}</p>` : '')
        + '<label>Rental items</label>'
        + table(['ID', 'Item', 'Qty', 'Return'], e.items.map(i => `<tr>${idCell(i.event_item_id)}<td>${esc(i.name)}</td><td>${i.qty}</td><td>${pill(i.return_status)}</td></tr>`))
        + '<label>Payments</label>'
        + table(['ID', 'Date', 'Type', 'Amount', ''], e.payments.map(p => `<tr>${idCell(p.payment_id)}<td>${fmtDate(p.paid_at)}</td><td>${esc(p.type)}</td><td>${peso(p.amount)}</td>`
          + `<td>${isAdmin() ? `<button class="btn" data-m="editPayment" data-id="${p.payment_id}" data-event="${e.event_id}">Edit</button>` : ''}</td></tr>`))
        + (isAdmin() && e.status !== 'Cancelled' ? `<div class="row"><button class="btn blue" data-m="editEvent" data-id="${e.event_id}">Edit event details</button></div>` : '');
    },
    // Pending orders and inquiries can be approved; anything unfinished can be cancelled.
    ok: ctx => isAdmin() && ctx.event.status === 'Pending' ? 'Approve booking' : null,
    async run(ctx) {
      await api.events.update(ctx.event.event_id, { status: 'Approved' });
      return `Event #${ctx.event.event_id} approved`;
    },
    alt: ctx => isAdmin() && !['Cancelled', 'Completed'].includes(ctx.event.status) ? 'Cancel event' : null,
    async runAlt(ctx) {
      if (!confirm(`Cancel event #${ctx.event.event_id} for ${ctx.event.client_name}?`)) return 'keep';
      await api.events.cancel(ctx.event.event_id);
      return 'Event cancelled';
    },
  },

  editEvent: {
    title: ctx => `Edit event #${ctx.id}`, ok: 'Save Changes', admin: true, wide: true,
    async body(ctx) {
      const e = await api.events.get(ctx.id);
      if (e.status === 'Cancelled') throw new Error('Cancelled events cannot be edited');
      // Compared against the form: the form shows times as HH:MM, and an Ongoing event is stored as Approved.
      ctx.saved = { ...e, start_time: (e.start_time || '').slice(0, 5), status: e.status === 'Ongoing' ? 'Approved' : e.status };
      const pulled = e.items.some(i => i.pull_status !== 'Pending' && !['Returned', 'Damaged', 'Missing'].includes(i.return_status));
      return note(`<b>${esc(e.client_name)}</b> · ${esc(packageLabel(e))} · paid so far ${peso(e.paid_amount)}`
          + '<br>The client, package and rental items stay as booked. To change those, cancel the event and book it again.')
        + choice('etype', 'Purpose / type of event', EVENT_TYPES, { req: true, other: 'e.g. Reunion' })
        + '<div class="frow2">'
        + `<div>${field('date', 'Event date', 'date', {
          req: true, attrs: pulled ? 'disabled' : '',
          hint: pulled ? 'Items have already been pulled, so the date can no longer change.' : 'Moving the date checks that the rental items are free on the new date.',
        })}</div>`
        + `<div>${field('time', 'Event time', 'time')}</div></div>`
        + field('venue', 'Venue name', 'text', { attrs: 'maxlength="150" placeholder="e.g. Grand Ballroom (optional)"' })
        + addressFields('v', { legend: 'Venue address' })
        + (e.package_id ? '' : textarea('custom', 'Custom order', 'What should we prepare?', { rows: 4, attrs: 'maxlength="2000"' }))
        + textarea('notes', 'Order notes', 'Setup instructions, theme, reminders…', { attrs: 'maxlength="5000"' })
        + '<div class="frow2">'
        + `<div>${field('contract', 'Total price charged to the client (₱)', 'number', {
          req: true, attrs: `min="${e.paid_amount}" step="0.01" placeholder="₱"`, hint: e.paid_amount ? `Can't be less than the ${peso(e.paid_amount)} already paid.` : '',
        })}</div>`
        + `<div>${select('status', 'Status', EVENT_STATUSES)}</div></div>`;
    },
    fill: ({ saved: e }) => ({
      etype: e.event_type, date: e.event_date, time: e.start_time, venue: e.venue_name,
      vstreet: e.venue_street, vbarangay: e.venue_barangay, vcity: e.venue_city_municipality, vprovince: e.venue_province,
      custom: e.custom_order, notes: e.setup_notes, contract: e.contract_value, status: e.status,
    }),
    async run({ saved: e }) {
      const body = changed(e, {
        event_type: choiceVal('etype'), event_date: val('date'), start_time: val('time'), venue_name: val('venue'),
        venue_street: val('vstreet'), venue_barangay: val('vbarangay'), venue_city_municipality: val('vcity'), venue_province: val('vprovince'),
        custom_order: e.package_id ? undefined : val('custom'), setup_notes: val('notes'), contract_value: num('contract'), status: val('status'),
      });
      if (body.event_date && body.event_date < isoDate()) { toast(PAST_MSG); return 'keep'; }
      if (isEmpty(body)) return NO_CHANGES;
      await api.events.update(e.event_id, body);
      return `Event #${e.event_id} updated`;
    },
  },

  // Corrects a recorded payment; ctx.event is its event.
  editPayment: {
    title: ctx => `Edit payment #${ctx.id}`, ok: 'Save Changes', admin: true,
    async body(ctx) {
      const e = await api.events.get(ctx.event);
      ctx.saved = record(e.payments, 'payment_id', ctx.id, 'Payment');
      return note(`Event #${e.event_id} · <b>${esc(e.client_name)}</b> · total ${peso(e.contract_value)}, paid ${peso(e.paid_amount)}, recorded ${fmtDate(ctx.saved.paid_at)}`)
        + select('type', 'Type', PAYMENT_TYPES)
        + field('amount', 'Amount', 'number', { req: true, attrs: 'min="0.01" step="0.01" placeholder="₱"' })
        + choice('method', 'Method', METHODS.map(([v]) => v), { placeholder: 'Not recorded', max: 50, other: 'e.g. Maya' })
        + field('ref', 'Reference no. (optional)', 'text', { attrs: 'maxlength="100"' });
    },
    fill: ({ saved: p }) => ({ type: p.type, amount: p.amount, method: p.method, ref: p.reference_no }),
    async run({ saved: p }) {
      const body = changed(p, { type: val('type'), amount: num('amount'), method: choiceVal('method'), reference_no: val('ref') });
      if (isEmpty(body)) return NO_CHANGES;
      await api.payments.update(p.payment_id, body);
      return `Payment #${p.payment_id} updated`;
    },
  },

  package: {
    title: 'Add Package', ok: 'Add Package', admin: true,
    body: () => packageFields(),
    async run() {
      const pkg = readPackage();
      if (packageNameTaken(pkg.name)) { toast('May package na may ganitong pangalan'); return 'keep'; }
      await api.packages.create(pkg);
      return 'Package added';
    },
  },

  editPackage: {
    title: 'Edit Package', ok: 'Save Changes', admin: true,
    body(ctx) {
      ctx.saved = record(state.packages, 'package_id', ctx.id, 'Package');
      return packageFields(ctx.saved.image);
    },
    fill: ({ saved: p }) => ({ pkgName: p.name, pkgType: p.type, pkgPrice: p.base_price, pkgDesc: p.description }),
    async run({ saved: p }) {
      const body = changed(p, readPackage());
      if (body.name && packageNameTaken(body.name, p.package_id)) { toast('May package na may ganitong pangalan'); return 'keep'; }
      if (isEmpty(body)) return NO_CHANGES;
      await api.packages.update(p.package_id, body);
      return `${val('pkgName')} updated`;
    },
  },

  item: {
    title: 'Add Inventory Item', ok: 'Add Item', admin: true,
    // Fields in a data-for box only apply to that kind; actions.js shows the right ones.
    body: () => select('kind', 'Type', [['rental', 'Rental item / prop (comes back after the event)'], ['consumable', 'Consumable (used up)']],
      { attrs: 'data-kind-switch' })
      + itemNameAndCode()
      + `<div data-for="rental">${rentalFields()}</div>`
      + `<div data-for="consumable" hidden>${consumableFields()}</div>`,
    async run() {
      if (val('kind') === 'consumable') await api.consumables.create(readConsumable());
      else await api.inventory.create(readRental());
      return 'Item added';
    },
  },

  // ctx.kind is 'rental' or 'consumable', as on the inventory table's buttons.
  editItem: {
    title: ctx => ctx.kind === 'consumable' ? 'Edit Consumable' : 'Edit Rental Item', ok: 'Save Changes', admin: true,
    body(ctx) {
      if (ctx.kind === 'consumable') {
        const c = ctx.saved = record(state.consumables, 'consumable_id', ctx.id, 'Consumable');
        return note(`To add a delivery, use Mark Restocked instead; this sets the stock count to what you type.${c.last_restocked_at ? ` Last restocked ${fmtDate(c.last_restocked_at)}.` : ''}`)
          + itemNameAndCode() + consumableFields();
      }
      const i = ctx.saved = record(state.inventory, 'item_id', ctx.id, 'Item');
      const busy = i.qty_total - i.qty_available;
      return note(`${i.qty_available} on hand of ${i.qty_total} owned${busy ? ` (${busy} out on rent or out of service, so you can't own fewer than that)` : ''}.`)
        + itemNameAndCode() + rentalFields(i.image);
    },
    fill: ({ kind, saved: s }) => kind === 'consumable'
      ? { name: s.name, code: s.item_code, stock: s.current_level, unit: s.unit, reorder: s.reorder_level }
      : { name: s.name, code: s.item_code, category: s.category, qty: s.qty_total, price: s.rental_price, itemDesc: s.description },
    async run({ kind, saved: s }) {
      const consumable = kind === 'consumable';
      const body = changed(s, consumable ? readConsumable() : readRental());
      if (isEmpty(body)) return NO_CHANGES;
      if (consumable) await api.consumables.update(s.consumable_id, body);
      else await api.inventory.update(s.item_id, body);
      return `${val('name')} updated`;
    },
  },

  archived: {
    title: ctx => ARCHIVES[ctx.kind].title, cancel: 'Close', admin: true,
    async body(ctx) {
      const a = ARCHIVES[ctx.kind];
      const rows = await a.load();
      return note('Archived records are hidden from lists and new bookings but keep their history. Restore brings them back.')
        + table(['ID', ...a.head, ''], rows.map(r => {
          const [resource, id, name] = a.key(r);
          return `<tr>${idCell(id)}${a.row(r).map(v => `<td>${esc(v)}</td>`).join('')}`
            + `<td><button class="btn teal" data-restore="${resource}:${id}" data-kind="${ctx.kind}" data-name="${esc(name)}">Restore</button></td></tr>`;
        }));
    },
  },

  restock: {
    title: 'Mark Restocked', ok: 'Restock', admin: true,
    body(ctx) {
      const consumable = ctx.kind === 'consumable';
      const item = ctx.item = consumable
        ? state.consumables.find(c => String(c.consumable_id) === ctx.id)
        : state.inventory.find(i => String(i.item_id) === ctx.id);
      if (!item) throw new Error('Item not found; refresh the page');
      return note(consumable
        ? `<b>${esc(item.name)}</b>: ${item.current_level} ${esc(item.unit)} left (reorder at ${item.reorder_level}).`
        : `<b>${esc(item.name)}</b>: ${item.qty_available} on hand of ${item.qty_total} owned. Adds newly bought units.`)
        + field('qty', 'Quantity received', 'number', { req: true, attrs: 'min="1"' });
    },
    async run(ctx) {
      const qty = num('qty');
      if (!Number.isInteger(qty) || qty < 1) return false;
      if (ctx.kind === 'consumable') await api.consumables.restock(ctx.id, qty);
      else await api.inventory.update(ctx.id, { qty_total: ctx.item.qty_total + qty });
      return `${ctx.item.name} restocked`;
    },
  },

  avail: {
    title: 'Check Date Availability', ok: 'Check',
    body: () => field('date', 'Event Date', 'date', { req: true, attrs: `value="${isoDate()}"` })
      + select('item', 'Item', [['', 'All items'], ...state.inventory.map(i => [i.item_id, `${i.item_code ? `${i.item_code} · ` : ''}${i.name}`])])
      + '<div id="modalResult"></div>',
    async run() {
      const date = val('date');
      if (!date) return false;
      const { items } = await api.availability(date);
      const rows = val('item') ? items.filter(i => String(i.item_id) === val('item')) : items;
      const booked = state.events.filter(e => e.event_date === date && e.status !== 'Cancelled').length;
      $('#modalResult').innerHTML = note(booked ? `May event na sa date na ito (${booked} booked).` : 'Available ang date.')
        + table(['ID', 'Item', 'Free', 'Owned'], rows.map(i => `<tr>${idCell(i.item_id)}<td>${esc(i.name)}</td><td class="${i.qty_free ? 'g' : 'r'}">${i.qty_free}</td><td>${i.qty_total}</td></tr>`));
      return 'keep';
    },
  },

  pull: {
    title: 'Generate Pull Sheet', ok: 'Generate',
    body: () => field('date', 'Event Date', 'date', { req: true, attrs: `value="${isoDate(1)}"` }) + '<div id="modalResult"></div>',
    async run() {
      const date = val('date');
      if (!date) return false;
      const sheet = await api.pullsheet.get(date);
      const html = table(['ID', 'Event', 'Time', 'Venue'], sheet.events.map(e => `<tr>${idCell(e.event_id)}<td>${esc(e.client_name)}${e.event_type ? ` · ${esc(e.event_type)}` : ''}</td><td>${fmtTime(e.start_time)}</td><td>${esc(venueLabel(e))}</td></tr>`))
        + table(['ID', 'Code', 'Item', 'Category', 'Qty', 'Status'], sheet.items.map(i => `<tr>${idCell(i.item_id)}<td>${esc(i.item_code || '—')}</td><td>${esc(i.name)}</td><td>${esc(i.category || '—')}</td><td>${i.qty_needed}</td><td>${esc(i.status)}</td></tr>`))
        + (sheet.consumables.length ? table(['ID', 'Consumable', 'Qty'], sheet.consumables.map(c => `<tr>${idCell(c.consumable_id)}<td>${esc(c.name)}</td><td>${c.qty_needed} ${esc(c.unit)}</td></tr>`)) : '');
      $('#modalResult').innerHTML = `<label>Pull sheet for ${fmtDate(date)}</label>${html}<div class="row"><button class="btn blue" id="printSheet" type="button">Print</button></div>`;
      $('#printSheet').onclick = () => printSheet(`Pull sheet — ${fmtDate(date)}`, html);
      return 'keep';
    },
  },

  payment: {
    title: 'Record Payment', ok: 'Save Payment', admin: true,
    body: ctx => select('event', 'Event with a balance', owingOptions(), { selected: ctx.id, empty: 'No unpaid events', req: true })
      + field('amount', 'Amount', 'number', { req: true, attrs: 'min="0.01" step="0.01" placeholder="₱"' }) + select('method', 'Method', METHODS)
      + field('ref', 'Reference no. (optional)'),
    async run() {
      const r = state.receivables.find(x => String(x.event_id) === val('event'));
      const amount = num('amount');
      if (!r || !(amount > 0)) return false;
      await api.payments.create({
        event_id: r.event_id, type: r.paid_amount > 0 ? 'balance' : 'downpayment', amount, method: val('method'), reference_no: val('ref'),
      });
      return `Payment of ${peso(amount)} recorded`;
    },
  },

  reminder: {
    title: 'Send Reminder', ok: 'Send', admin: true,
    body(ctx) {
      const owing = new Map(state.receivables.map(r => [r.client_id, r.client_name]));
      return select('client', 'Client', [['', 'All clients with a balance'], ...owing], { selected: ctx.clientId })
        + note('No email/SMS provider is set up yet, so reminders are logged to notifications.');
    },
    async run() {
      const res = await api.reminders.send(val('client'));
      const skipped = res.reminders.filter(r => !r.sent).length;
      return res.message + (skipped ? ` (${skipped} without contact details)` : '');
    },
  },

  returned: {
    title: 'Mark Returned', ok: 'Confirm Return', admin: true,
    body: ctx => select('line', 'Item', lineOptions(['Out', 'Overdue']), { selected: ctx.id, empty: 'Nothing out on rent', req: true })
      + field('notes', 'Condition Notes', 'text', { attrs: 'placeholder="Good"' }),
    async run() {
      if (!val('line')) return false;
      await api.returns.markReturned(val('line'), val('notes'));
      return 'Item marked returned';
    },
  },

  damage: {
    title: 'Damage / Missing Fee', ok: 'Charge Fee', admin: true,
    body: () => select('line', 'Item', lineOptions(['Out', 'Overdue', 'Returned']), { empty: 'No items to report', req: true })
      + select('status', 'Status', [['Damaged', 'Damaged'], ['Missing', 'Missing']])
      + field('qty', 'Units affected (blank = whole line)', 'number', { attrs: 'min="1"' })
      + field('fee', 'Fee Amount', 'number', { attrs: MONEY }) + field('notes', 'Notes'),
    async run() {
      if (!val('line')) return false;
      await api.returns.reportDamage(val('line'), {
        status: val('status'), qty_affected: num('qty'), damage_fee: num('fee'), condition_on_return: val('notes'),
      });
      return 'Damage recorded';
    },
  },

  deposit: {
    title: 'Charge Security Deposit', ok: 'Charge', admin: true,
    body: () => select('event', 'Event', eventOptions(), { empty: 'No events', req: true })
      + field('amount', 'Amount', 'number', { req: true, attrs: 'min="0.01" step="0.01" placeholder="₱"' }) + select('method', 'Method', METHODS),
    async run() {
      const amount = num('amount');
      if (!val('event') || !(amount > 0)) return false;
      await api.payments.create({ event_id: Number(val('event')), type: 'deposit', amount, method: val('method') });
      return `Deposit of ${peso(amount)} recorded`;
    },
  },
};
