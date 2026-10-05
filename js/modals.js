// Modal definitions. Each has a title, a body (may be async), an ok label and run().
// run() returns false when the form is incomplete, 'keep' to stay open, or a success
// message (or true) to close the modal and reload data. A thrown error is shown as a toast.
//   public: usable while logged out   admin: needs an admin account
import { api } from './api.js';
import { state, isAdmin } from './state.js';
import { signIn } from './session.js';
import { createBooking, bookingProblem, packageOptionsHtml, packageLabel } from './bookings.js';
import { field, password, textarea, select, val, num, note } from './form.js';
import { $, esc, peso, fmtDate, fmtTime, pill, isoDate, toast } from './utils.js';

const METHODS = [['Cash', 'Cash'], ['GCash', 'GCash'], ['Bank Transfer', 'Bank Transfer']];
const MONEY = 'min="0" step="0.01" placeholder="₱"';

const clientOptions = () => state.clients.map(c => [c.client_id, c.full_name]);
const owingOptions = () => state.receivables.map(r => [r.event_id, `${r.client_name} — ${fmtDate(r.event_date)} (${peso(r.remaining)} left)`]);
const eventOptions = () => state.events.filter(e => e.status !== 'Cancelled').map(e => [e.event_id, `#${e.event_id} ${e.client_name} — ${fmtDate(e.event_date)}`]);
const lineOptions = statuses => state.returns.filter(r => statuses.includes(r.status))
  .map(r => [r.event_item_id, `${r.qty} × ${r.item_name} — ${r.client_name} (${r.status})`]);

// Package select plus the text box that appears for "Custom / self order" (see actions.js).
const packageField = id => `<label for="f_${id}">Event or package<span class="req" aria-hidden="true">*</span></label>`
  + `<select id="f_${id}" required data-pkgsel="${id}">${packageOptionsHtml()}</select>`
  + `<input id="f_${id}Custom" class="pkg-custom" type="text" maxlength="255" placeholder="Describe your custom / self order" hidden>`;

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
    body: () => field('username', 'Username', 'text', { req: true, attrs: 'autocomplete="username"' }) + password('password', 'Password'),
    async run() {
      if (!val('username') || !val('password')) return false;
      await signIn(val('username'), val('password'));
      return `Welcome, ${state.user.full_name || state.user.username}`;
    },
  },

  client: {
    title: 'New Client', ok: 'Add Client', admin: true,
    body: () => field('name', 'Client Name', 'text', { req: true }) + field('contact', 'Contact Number', 'tel')
      + field('email', 'Email', 'email') + field('address', 'Address'),
    async run() {
      if (!val('name')) return false;
      await api.clients.create({ full_name: val('name'), phone: val('contact'), email: val('email'), billing_address: val('address') });
      return 'Client added';
    },
  },

  event: {
    title: 'New Booking / Event', ok: 'Submit Booking', admin: true,
    body: () => select('client', 'Select a Client', clientOptions(), { req: true, empty: 'Add a client first' })
      + field('date', 'Event Date', 'date', { req: true, attrs: `min="${isoDate()}"` }) + field('time', 'Event Time', 'time')
      + field('venue', 'Venue / Address') + packageField('package')
      + field('contract', 'Contract value (blank = package price)', 'number', { attrs: MONEY })
      + field('pay', 'Payment / Downpayment', 'number', { attrs: MONEY }) + select('method', 'Payment method', METHODS),
    async run() {
      const booking = {
        client_id: val('client'), event_date: val('date'), start_time: val('time'), venue_name: val('venue'),
        package: val('package'), custom: val('packageCustom'),
        contract_value: num('contract'), downpayment: num('pay'), method: val('method'),
      };
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
      return note(`<b>${esc(e.client_name)}</b> · event #${e.event_id}<br>${fmtDate(e.event_date)} ${fmtTime(e.start_time)} · ${esc(e.venue_name || 'No venue')}`
          + `<br>Package: ${esc(packageLabel(e))} · Status: ${esc(e.status)}`
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

  package: {
    title: 'Add Package', ok: 'Add Package', admin: true,
    body: () => field('pkgName', 'Package Name', 'text', { req: true, attrs: 'maxlength="120"' })
      + select('pkgType', 'Type', [['Wedding', 'Wedding'], ['Birthday', 'Birthday'], ['Other', 'Other']])
      + field('pkgPrice', 'Price', 'number', { req: true, attrs: MONEY })
      + textarea('pkgDesc', 'Inclusions / Description', 'e.g. Balloon arch, backdrop, LED lights')
      + field('pkgImage', 'Package Picture', 'file', { attrs: 'accept="image/*"' })
      + '<img id="pkgPreview" class="pkg-preview" alt="Package picture preview" hidden>',
    async run() {
      const name = val('pkgName');
      if (!name || !(num('pkgPrice') > 0)) return false;
      if (state.packages.some(p => p.name.toLowerCase() === name.toLowerCase())) { toast('May package na may ganitong pangalan'); return 'keep'; }
      // The preview already holds the resized picture as a data URL (set in actions.js).
      const preview = $('#pkgPreview');
      await api.packages.create({
        name, type: val('pkgType'), base_price: num('pkgPrice'), description: val('pkgDesc'),
        image: preview.hidden ? undefined : preview.src,
      });
      return 'Package added';
    },
  },

  item: {
    title: 'Add Inventory Item', ok: 'Add Item', admin: true,
    body: () => select('kind', 'Type', [['rental', 'Rental item / prop'], ['consumable', 'Consumable']])
      + field('name', 'Item Name', 'text', { req: true }) + field('category', 'Category (rental items)', 'text', { attrs: 'placeholder="Prop"' })
      + field('unit', 'Unit (consumables)', 'text', { attrs: 'placeholder="pcs, kg, packs"' })
      + field('qty', 'Quantity', 'number', { attrs: 'min="0"' }) + field('reorder', 'Reorder Level', 'number', { attrs: 'min="0"' })
      + field('price', 'Rental price (rental items)', 'number', { attrs: MONEY }),
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
      + select('item', 'Item', [['', 'All items'], ...state.inventory.map(i => [i.item_id, i.name])])
      + '<div id="modalResult"></div>',
    async run() {
      const date = val('date');
      if (!date) return false;
      const { items } = await api.availability(date);
      const rows = val('item') ? items.filter(i => String(i.item_id) === val('item')) : items;
      const booked = state.events.filter(e => e.event_date === date && e.status !== 'Cancelled').length;
      $('#modalResult').innerHTML = note(booked ? `May event na sa date na ito (${booked} booked).` : 'Available ang date.')
        + table(['Item', 'Free', 'Owned'], rows.map(i => `<tr><td>${esc(i.name)}</td><td class="${i.qty_free ? 'g' : 'r'}">${i.qty_free}</td><td>${i.qty_total}</td></tr>`));
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
