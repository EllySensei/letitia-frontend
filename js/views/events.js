import { state, isAdmin } from '../state.js';
import { packageOptionsHtml } from '../bookings.js';
import { $, $$, esc, fill, isoDate } from '../utils.js';
import { eventRow, emptyMsg } from './dashboard.js';

// Rebuilding the booking form must not wipe what the user has already picked or typed.
function keepValue(sel, html) {
  const el = $(sel);
  const prev = el.value;
  el.innerHTML = html;
  if ([...el.options].some(o => o.value === prev)) el.value = prev;
}

export function renderEvents() {
  keepValue('#bClient', '<option value="">Select a Client</option>'
    + state.clients.map(c => `<option value="${c.client_id}">${esc(c.full_name)}</option>`).join(''));
  keepValue('#bPkg', packageOptionsHtml());
  $('#bDate').min = isoDate();
  $('#bSubmit').disabled = !isAdmin();
  $('#bSubmit').title = isAdmin() ? '' : 'Admin log in required to book events';

  const typed = new Map($$('#bItems .qty').map(q => [q.dataset.item, q.value]));
  fill('#bItems', state.inventory, 4, i => `<tr><td>${esc(i.name)}</td><td>${esc(i.category || '—')}</td>`
    + `<td><input class="qty" type="number" min="0" max="${i.qty_total}" data-item="${i.item_id}" value="${esc(typed.get(String(i.item_id)) ?? '')}"></td>`
    + `<td><span class="bar ${i.qty_available > 0 ? '' : 'no'}" title="${i.qty_available} on hand"></span></td></tr>`, emptyMsg('No items available'));

  fill('#evT', state.events, 5, e => eventRow(e, false), emptyMsg('No events yet'));
}
