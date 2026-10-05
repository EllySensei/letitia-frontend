import { state } from '../state.js';
import { packageLabel } from '../bookings.js';
import { $, esc, ico, peso, fmtDate, fmtTime, pill, fill } from '../utils.js';
import { returnRow } from './returns.js';

export const emptyMsg = text => state.user ? text : 'Log in to view data';

export function eventRow(e, withActions) {
  return `<tr><td>${fmtDate(e.event_date)} ${fmtTime(e.start_time)}</td><td class="g">${esc(e.client_name)}</td>`
    + `<td>${esc(e.venue_name || '—')}</td><td>${esc(packageLabel(e))}</td><td>${pill(e.status)}</td>`
    + (withActions ? `<td><button class="btn" data-m="eventDetail" data-id="${e.event_id}">View</button></td>` : '')
    + '</tr>';
}

export function renderDashboard() {
  const s = state.dashboard.stats;
  $('#sEvents').textContent = s.upcoming_events ?? 0;
  $('#sInq').textContent = s.pending_inquiries ?? 0;
  $('#sOut').textContent = s.items_out_on_rent ?? 0;
  $('#sLow').textContent = s.low_stock_alerts ?? 0;
  $('#sBal').textContent = peso(s.outstanding_balance);

  fill('#dEv', state.dashboard.upcoming_events, 6, e => eventRow(e, true), emptyMsg('No upcoming events'));

  const out = state.returns.filter(r => ['Out', 'Overdue'].includes(r.status));
  fill('#dRet', out, 5, returnRow, emptyMsg('Nothing out on rent'));

  // Clicking the check moves an item along Pending -> Pulled -> Packed.
  fill('#dPull', state.pullsheet.items, 4, p => `<tr><td><button class="ck" type="button" data-pull="${p.item_id}" data-status="${esc(p.status)}" title="Mark as ${p.status === 'Pending' ? 'Pulled' : 'Packed'}">${ico('chk')}</button> ${esc(p.name)}</td>`
    + `<td>${esc(p.category || '—')}</td><td>${p.qty_needed}</td><td>${pill(p.status)}</td></tr>`, emptyMsg('No items to pull'));

  fill('#dRec', state.receivables, 5, r => `<tr><td class="g">${esc(r.client_name)}</td><td>${fmtDate(r.event_date)}</td>`
    + `<td>${peso(r.total_contract)}</td><td>${peso(r.paid_amount)}</td><td class="r">${peso(r.remaining)}</td></tr>`, emptyMsg('No receivables'));

  fill('#dLow', state.consumables.filter(c => c.status !== 'In Stock'), 5, c => `<tr><td>${esc(c.name)}</td><td>${c.current_level} ${esc(c.unit)}</td>`
    + `<td>${c.reorder_level}</td><td>${pill(c.status, 'low')}</td>`
    + `<td><button class="btn" data-m="restock" data-kind="consumable" data-id="${c.consumable_id}">Mark Restocked</button></td></tr>`, emptyMsg('No low stock'));
}
