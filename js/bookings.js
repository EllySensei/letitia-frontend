// The booking form, shared by the "New booking" modal and the Events page. `p` prefixes the
// field ids so both can be on the page at once.
import { api } from './api.js';
import { state } from './state.js';
import {
  field, select, textarea, choice, choiceVal, nameFields, readName, addressFields, readAddress, val, num, phoneField, phoneVal,
} from './form.js';
import { $, esc, peso, isoDate } from './utils.js';

// Select value for "Custom / self order": booked without a package, described in words.
export const CUSTOM = '__custom';

// Client select value for a walk-in customer, saved as a new client together with the booking.
export const WALK_IN = '__walkin';

// What an event is for; anything else goes in "Other". Packages use the same list.
export const EVENT_TYPES = ['Wedding', 'Birthday', 'Debut', 'Christening / Baptism', 'Anniversary', 'Gender Reveal', 'Corporate'];

export const PAST_MSG = 'Hindi puwedeng mag-set ng event sa nakaraang date';

const METHODS = [['Cash', 'Cash'], ['GCash', 'GCash'], ['Bank Transfer', 'Bank Transfer']];
const MONEY = 'min="0" step="0.01" placeholder="₱"';

// Client choices as [value, label] pairs: a walk-in customer, then the existing clients.
export const clientChoices = () => [['', 'Select a client'], [WALK_IN, '+ Walk-in customer (new client)'],
  ...state.clients.map(c => [c.client_id, c.full_name])];

export const packageOptionsHtml = () => '<option value="">Select a package</option>'
  + state.packages.map(p => `<option value="${p.package_id}">${esc(p.name)} (${peso(p.base_price)})</option>`).join('')
  + `<option value="${CUSTOM}">Custom / self order (no package)</option>`;

// What the Package column shows for an event. Custom orders can be long, so tables get the
// start of the description; the event details show all of it.
const clip = (s, n) => s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
export const packageLabel = e => e.package_name || (e.custom_order ? `Custom: ${clip(e.custom_order, 60)}` : '—');

// Venue name when there is one, otherwise the address (online orders have only an address).
export const venueLabel = e => e.venue_name || e.venue_address || '—';

export const bookingFields = (p = '') =>
  select(`${p}client`, 'Client', clientChoices(), { req: true, attrs: `data-walkin="f_${p}walkin"` })
  + `<div class="walkin" id="f_${p}walkin" hidden>${nameFields(`${p}w`)}`
  + '<div class="frow2">'
  + `<div>${phoneField(`${p}wphone`, 'Contact number', { req: true })}</div>`
  + `<div>${field(`${p}wemail`, 'Email', 'email', { attrs: 'maxlength="150" placeholder="Optional"' })}</div></div>`
  + '<small class="hint">The venue address below is saved as their address.</small></div>'
  + choice(`${p}etype`, 'Purpose / type of event', EVENT_TYPES, { req: true, other: 'e.g. Reunion' })
  + '<div class="frow2">'
  + `<div>${field(`${p}date`, 'Event date', 'date', { req: true, attrs: `min="${isoDate()}"` })}</div>`
  + `<div>${field(`${p}time`, 'Event time', 'time')}</div></div>`
  + field(`${p}venue`, 'Venue name', 'text', { attrs: 'maxlength="150" placeholder="e.g. Grand Ballroom (optional)"' })
  + addressFields(`${p}v`, { legend: 'Venue address' })
  + `<label for="f_${p}package">Package<span class="req" aria-hidden="true">*</span></label>`
  + `<select id="f_${p}package" required data-pkgsel data-price="${p}">${packageOptionsHtml()}</select>`
  + `<div id="f_${p}packageCustomBox" hidden>${textarea(`${p}packageCustom`, 'Describe the custom order',
    'What should we prepare? Theme, colours, number of guests, items you need…', { req: true, rows: 6, attrs: 'maxlength="2000" data-minlen="15"' })}</div>`
  + field(`${p}contract`, 'Total price charged to the client (₱)', 'number', { attrs: `${MONEY} data-price="${p}"`, hint: ' ' })
  + '<div class="frow2">'
  + `<div>${field(`${p}pay`, 'Downpayment received now (₱)', 'number', { attrs: MONEY })}</div>`
  + `<div>${select(`${p}method`, 'Payment method', METHODS)}</div></div>`;

// Units × rental price of the extra items picked on the Events page.
const extrasTotal = items => items.reduce((sum, l) => sum + (state.inventory.find(i => i.item_id === l.item_id)?.rental_price || 0) * l.qty, 0);

// Explains what a blank contract value means: the API charges the package price plus extras.
export function updatePriceHint(p = '', items = []) {
  const hint = $(`#f_${p}contractHint`);
  if (!hint) return;
  const pkg = state.packages.find(x => String(x.package_id) === val(`${p}package`));
  const price = (pkg?.base_price || 0) + extrasTotal(items);
  if (val(`${p}contract`)) hint.textContent = 'This is the full amount the client pays, replacing the package price.';
  else if (val(`${p}package`) === CUSTOM && !items.length) hint.textContent = 'Custom orders have no set price: enter the amount agreed with the client.';
  else hint.textContent = `Leave blank to charge ${peso(price)}${items.length ? ' (package price + extra items)' : ' (the package price)'}.`;
}

export const readBooking = (p = '') => ({
  client_id: val(`${p}client`),
  walkIn: { ...readName(`${p}w`), phone: phoneVal(`${p}wphone`), email: val(`${p}wemail`) || undefined },
  event_type: choiceVal(`${p}etype`),
  event_date: val(`${p}date`),
  start_time: val(`${p}time`),
  venue_name: val(`${p}venue`),
  venue: readAddress(`${p}v`, 'venue_'),
  package: val(`${p}package`),
  custom: val(`${p}packageCustom`),
  contract_value: num(`${p}contract`),
  downpayment: num(`${p}pay`),
  method: val(`${p}method`),
});

// The form checks required fields itself; this catches what it can't.
// Returns an error message, or null when the booking can be sent.
export function bookingProblem(b) {
  if (b.event_date < isoDate()) return PAST_MSG;
  return null;
}

export function createBooking(b) {
  const custom = b.package === CUSTOM;
  const walkIn = b.client_id === WALK_IN;
  return api.events.create({
    client_id: walkIn ? undefined : Number(b.client_id),
    new_client: walkIn ? b.walkIn : undefined,
    event_type: b.event_type,
    package_id: custom || !b.package ? undefined : Number(b.package),
    custom_order: custom ? b.custom : undefined,
    event_date: b.event_date,
    start_time: b.start_time || undefined,
    venue_name: b.venue_name || undefined,
    ...b.venue,
    contract_value: b.contract_value, // blank = package price plus extra items
    items: b.items?.length ? b.items : undefined,
    downpayment: b.downpayment > 0 ? { amount: b.downpayment, method: b.method || undefined } : undefined,
  });
}
