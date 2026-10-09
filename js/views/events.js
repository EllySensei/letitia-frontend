import { state, isAdmin } from '../state.js';
import { packageOptionsHtml, clientChoices, bookingFields, updatePriceHint } from '../bookings.js';
import { $, $$, esc, fill, idCell, isoDate } from '../utils.js';

// Extra items with a quantity typed in the booking form's item table.
export const pickedItems = () => $$('#bItems .qty').filter(q => Number(q.value) > 0)
  .map(q => ({ item_id: Number(q.dataset.item), qty: Number(q.value) }));
import { eventRow, emptyMsg } from './dashboard.js';

// Rebuilding the booking form must not wipe what the user has already picked or typed.
function keepValue(sel, html) {
  const el = $(sel);
  const prev = el.value;
  el.innerHTML = html;
  if ([...el.options].some(o => o.value === prev)) el.value = prev;
}

export function renderEvents() {
  // The form is built once (same fields as the New Booking modal, ids prefixed with "b");
  // later renders only refresh the client and package choices.
  if (!$('#f_bclient')) $('#bForm').innerHTML = bookingFields('b');
  keepValue('#f_bclient', clientChoices().map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join(''));
  keepValue('#f_bpackage', packageOptionsHtml());
  $('#f_bdate').min = isoDate();
  $('#bSubmit').disabled = !isAdmin();
  $('#bSubmit').title = isAdmin() ? '' : 'Admin log in required to book events';

  const typed = new Map($$('#bItems .qty').map(q => [q.dataset.item, q.value]));
  fill('#bItems', state.inventory, 5, i => `<tr>${idCell(i.item_id)}<td>${esc(i.name)}<br><small>${esc(i.item_code || '')}</small></td><td>${esc(i.category || '—')}</td>`
    + `<td><input class="qty" type="number" min="0" max="${i.qty_total}" data-item="${i.item_id}" value="${esc(typed.get(String(i.item_id)) ?? '')}"></td>`
    + `<td><span class="bar ${i.qty_available > 0 ? '' : 'no'}" title="${i.qty_available} on hand"></span></td></tr>`, emptyMsg('No items available'));

  updatePriceHint('b', pickedItems());

  fill('#evT', state.events, 7, e => eventRow(e, true), emptyMsg('No events yet'));
}
