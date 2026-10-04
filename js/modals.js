// Modal definitions. Each has a title, a body (may be async), an ok label and run().
// run() returns false when the form is incomplete, 'keep' to stay open, or a success
// message (or true) to close the modal and reload data.
//   public: usable while logged out   admin: needs an admin account
import { api } from './api.js';
import { BOOKINGS_KEY } from './config.js';
import { writeLocal } from './storage.js';
import { state, isAdmin } from './state.js';
import { signIn } from './session.js';
import { createBooking } from './bookings.js';
import { field, textarea, select, val, num, note } from './form.js';
import { $, esc, peso, fmtDate, fmtTime, pill, isoDate, toast } from './utils.js';

const METHODS = [['Cash', 'Cash'], ['GCash', 'GCash'], ['Bank Transfer', 'Bank Transfer']];

const clientOptions = () => state.clients.map(c => [c.client_id, c.full_name]);
const packageOptions = () => [['', 'No package'], ...state.packages.map(p => [p.package_id, `${p.name} (${peso(p.base_price)})`])];
const owingOptions = () => state.receivables.map(r => [r.event_id, `${r.client_name} — ${fmtDate(r.event_date)} (${peso(r.remaining)} left)`]);
const eventOptions = () => state.events.filter(e => e.status !== 'Cancelled').map(e => [e.event_id, `#${e.event_id} ${e.client_name} — ${fmtDate(e.event_date)}`]);
const lineOptions = statuses => state.returns.filter(r => statuses.includes(r.status))
  .map(r => [r.event_item_id, `${r.qty} × ${r.item_name} — ${r.client_name} (${r.status})`]);

const table = (head, rows) => `<div class="tw"><table class="mini"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead>`
  + `<tbody>${rows.length ? rows.join('') : `<tr><td class="empty" colspan="${head.length}">Nothing to show</td></tr>`}</tbody></table></div>`;

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
    body: () => field('username', 'Username', 'text', 'autocomplete="username"')
      + field('password', 'Password', 'password', 'autocomplete="current-password"'),
    async run() {
      if (!val('username') || !val('password')) return false;
      await signIn(val('username'), val('password'));
      return `Welcome, ${state.user.full_name || state.user.username}`;
    },
  },

  guestBooking: {
    title: 'Request an event booking', ok: 'Send booking request', public: true, noRefresh: true,
    body: () => field('guestName', 'Your name') + field('guestEmail', 'Email', 'email') + field('guestContact', 'Contact number', 'tel')
      + field('guestDate', 'Preferred event date', 'date') + field('guestType', 'Event or package') + field('guestVenue', 'Venue / address')
      + textarea('guestNotes', 'Details', 'Tell us about your event')
      + note('Requests are saved in this browser only; the API has no public booking endpoint yet.'),
    async run() {
      const email = val('guestEmail');
      if (!val('guestName') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !val('guestDate')) return false;
      state.guestBookings.push({
        id: Date.now(), name: val('guestName'), email, contact: val('guestContact'), date: val('guestDate'),
        package: val('guestType'), venue: val('guestVenue'), notes: val('guestNotes'), status: 'Pending',
      });
      writeLocal(BOOKINGS_KEY, state.guestBookings);
      return 'Booking request saved';
    },
  },

  client: {
    title: 'New Client', ok: 'Add Client', admin: true,
    body: () => field('name', 'Client Name') + field('contact', 'Contact Number', 'tel') + field('email', 'Email', 'email') + field('address', 'Address'),
    async run() {
      if (!val('name')) return false;
      await api.clients.create({ full_name: val('name'), phone: val('contact'), email: val('email'), billing_address: val('address') });
      return 'Client added';
    },
  },

  event: {
    title: 'New Booking / Event', ok: 'Submit Booking', admin: true,
    body: () => select('client', 'Select a Client', clientOptions(), '', 'Add a client first')
      + field('date', 'Event Date', 'date', `min="${isoDate()}"`) + field('time', 'Event Time', 'time')
      + field('venue', 'Venue / Address') + select('package', 'Package', packageOptions())
      + field('contract', 'Contract value (blank = package price)', 'number', 'min="0" step="0.01" placeholder="₱"')
      + field('pay', 'Payment / Downpayment', 'number', 'min="0" step="0.01" placeholder="₱"') + select('method', 'Payment method', METHODS),
    async run() {
      if (!val('client') || !val('date')) return false;
      await createBooking({
        client_id: val('client'), event_date: val('date'), start_time: val('time'), venue_name: val('venue'),
        package_id: val('package'), contract_value: num('contract'), downpayment: num('pay'), method: val('method'),
      });
      return 'Booking submitted ✓';
    },
  },

  eventDetail: {
    title: 'Event details', cancel: 'Close',
    async body(ctx) {
      const e = ctx.event = await api.events.get(ctx.id);
      return note(`<b>${esc(e.client_name)}</b> · event #${e.event_id}<br>${fmtDate(e.event_date)} ${fmtTime(e.start_time)} · ${esc(e.venue_name || 'No venue')}`
          + `<br>Package: ${esc(e.package_name || '—')} · Status: ${esc(e.status)}`
          + `<br>Contract ${peso(e.contract_value)} · Paid ${peso(e.paid_amount)} · Remaining ${peso(e.remaining)}`)
        + '<label>Rental items</label>'
        + table(['Item', 'Qty', 'Return'], e.items.map(i => `<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td>${pill(i.return_status)}</td></tr>`))
        + '<label>Payments</label>'
        + table(['Date', 'Type', 'Amount'], e.payments.map(p => `<tr><td>${fmtDate(p.paid_at)}</td><td>${esc(p.type)}</td><td>${peso(p.amount)}</td></tr>`));
    },
    ok: ctx => isAdmin() && !['Cancelled', 'Completed'].includes(ctx.event.status) ? 'Cancel event' : null,
    async run(ctx) {
      if (!confirm(`Cancel event #${ctx.event.event_id} for ${ctx.event.client_name}?`)) return 'keep';
      await api.events.cancel(ctx.event.event_id);
      return 'Event cancelled';
    },
  },

  item: {
    title: 'Add Inventory Item', ok: 'Add Item', admin: true,
    body: () => select('kind', 'Type', [['rental', 'Rental item / prop'], ['consumable', 'Consumable']])
      + field('name', 'Item Name') + field('category', 'Category (rental items)', 'text', 'placeholder="Prop"')
      + field('unit', 'Unit (consumables)', 'text', 'placeholder="pcs, kg, packs"')
      + field('qty', 'Quantity', 'number', 'min="0"') + field('reorder', 'Reorder Level', 'number', 'min="0"')
      + field('price', 'Rental price (rental items)', 'number', 'min="0" step="0.01" placeholder="₱"'),
    async run() {
      if (!val('name')) return false;
      if (val('kind') === 'consumable') {
        if (!val('unit')) return false;
        await api.consumables.create({ name: val('name'), unit: val('unit'), current_level: num('qty'), reorder_level: num('reorder') });
      } else {
        if (num('qty') === undefined) return false;
        await api.inventory.create({
          name: val('name'), category: val('category') || 'Prop', qty_total: num('qty'), reorder_level: num('reorder'), rental_price: num('price'),
        });
      }
      return 'Item added';
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
        + field('qty', 'Quantity received', 'number', 'min="1"');
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
    body: () => field('date', 'Event Date', 'date', `value="${isoDate()}"`)
      + select('item', 'Item', [['', 'All items'], ...state.inventory.map(i => [i.item_id, i.name])])
      + '<div id="modalResult"></div>',
    async run() {
      const date = val('date');
      if (!date) return false;
      const { items } = await api.availability(date);
      const rows = val('item') ? items.filter(i => String(i.item_id) === val('item')) : items;
      const booked = state.events.filter(e => e.event_date === date && e.status !== 'Cancelled').length;
      $('#modalResult').innerHTML = note(booked ? `${booked} event(s) already booked on this date.` : 'No events booked on this date yet.')
        + table(['Item', 'Free', 'Owned'], rows.map(i => `<tr><td>${esc(i.name)}</td><td class="${i.qty_free ? 'g' : 'r'}">${i.qty_free}</td><td>${i.qty_total}</td></tr>`));
      return 'keep';
    },
  },

  pull: {
    title: 'Generate Pull Sheet', ok: 'Generate',
    body: () => field('date', 'Event Date', 'date', `value="${isoDate(1)}"`) + '<div id="modalResult"></div>',
    async run() {
      const date = val('date');
      if (!date) return false;
      const sheet = await api.pullsheet.get(date);
      const html = table(['Event', 'Time', 'Venue'], sheet.events.map(e => `<tr><td>#${e.event_id} ${esc(e.client_name)}</td><td>${fmtTime(e.start_time)}</td><td>${esc(e.venue_name || '—')}</td></tr>`))
        + table(['Item', 'Category', 'Qty', 'Status'], sheet.items.map(i => `<tr><td>${esc(i.name)}</td><td>${esc(i.category || '—')}</td><td>${i.qty_needed}</td><td>${esc(i.status)}</td></tr>`))
        + (sheet.consumables.length ? table(['Consumable', 'Qty'], sheet.consumables.map(c => `<tr><td>${esc(c.name)}</td><td>${c.qty_needed} ${esc(c.unit)}</td></tr>`)) : '');
      $('#modalResult').innerHTML = `<label>Pull sheet for ${fmtDate(date)}</label>${html}<div class="row"><button class="btn blue" id="printSheet" type="button">Print</button></div>`;
      $('#printSheet').onclick = () => printSheet(`Pull sheet — ${fmtDate(date)}`, html);
      return 'keep';
    },
  },

  payment: {
    title: 'Record Payment', ok: 'Save Payment', admin: true,
    body: ctx => select('event', 'Event with a balance', owingOptions(), ctx.id, 'No unpaid events')
      + field('amount', 'Amount', 'number', 'min="0.01" step="0.01" placeholder="₱"') + select('method', 'Method', METHODS)
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
      return select('client', 'Client', [['', 'All clients with a balance'], ...owing], ctx.clientId)
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
    body: ctx => select('line', 'Item', lineOptions(['Out', 'Overdue']), ctx.id, 'Nothing out on rent')
      + field('notes', 'Condition Notes', 'text', 'placeholder="Good"'),
    async run() {
      if (!val('line')) return false;
      await api.returns.markReturned(val('line'), val('notes'));
      return 'Item marked returned';
    },
  },

  damage: {
    title: 'Damage / Missing Fee', ok: 'Charge Fee', admin: true,
    body: () => select('line', 'Item', lineOptions(['Out', 'Overdue', 'Returned']), '', 'No items to report')
      + select('status', 'Status', [['Damaged', 'Damaged'], ['Missing', 'Missing']])
      + field('qty', 'Units affected (blank = whole line)', 'number', 'min="1"')
      + field('fee', 'Fee Amount', 'number', 'min="0" step="0.01" placeholder="₱"') + field('notes', 'Notes'),
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
    body: () => select('event', 'Event', eventOptions(), '', 'No events') + field('amount', 'Amount', 'number', 'min="0.01" step="0.01" placeholder="₱"')
      + select('method', 'Method', METHODS),
    async run() {
      const amount = num('amount');
      if (!val('event') || !(amount > 0)) return false;
      await api.payments.create({ event_id: Number(val('event')), type: 'deposit', amount, method: val('method') });
      return `Deposit of ${peso(amount)} recorded`;
    },
  },
};
