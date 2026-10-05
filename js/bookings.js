// Shared by the "New booking" modal and the booking form on the Events page.
import { api } from './api.js';
import { state } from './state.js';
import { esc, peso, isoDate } from './utils.js';

// Select value for "Custom / self order": booked without a package, described in words.
export const CUSTOM = '__custom';

export const PAST_MSG = 'Hindi puwedeng mag-set ng event sa nakaraang date';

export const packageOptionsHtml = () => '<option value="">Select a package</option>'
  + state.packages.map(p => `<option value="${p.package_id}">${esc(p.name)} (${peso(p.base_price)})</option>`).join('')
  + `<option value="${CUSTOM}">Custom / self order</option>`;

// What the Package column shows for an event.
export const packageLabel = e => e.package_name || (e.custom_order ? `Custom: ${e.custom_order}` : '—');

// b.package is the package select's value; b.custom the custom-order text.
// Returns an error message, or null when the booking can be sent.
export function bookingProblem(b) {
  const pkg = b.package === CUSTOM ? b.custom.trim() : b.package;
  if (!b.client_id || !b.event_date || !pkg) return 'Pumili ng client, date, at package';
  if (b.event_date < isoDate()) return PAST_MSG;
  return null;
}

export function createBooking(b) {
  const custom = b.package === CUSTOM;
  return api.events.create({
    client_id: Number(b.client_id),
    package_id: custom || !b.package ? undefined : Number(b.package),
    custom_order: custom ? b.custom.trim() : undefined,
    event_date: b.event_date,
    start_time: b.start_time || undefined,
    venue_name: b.venue_name || undefined,
    contract_value: b.contract_value, // blank = package price plus extra items
    items: b.items?.length ? b.items : undefined,
    downpayment: b.downpayment > 0 ? { amount: b.downpayment, method: b.method || undefined } : undefined,
  });
}
