import { state } from '../state.js';
import { esc, fmtDate, pill, fill } from '../utils.js';

export const returnRow = r => `<tr><td>${r.qty} × ${esc(r.item_name)}</td><td>${esc(r.client_name)} (event #${r.event_id})</td>`
  + `<td>${fmtDate(r.expected_return)}</td><td>${pill(r.status)}</td><td>`
  + (['Out', 'Overdue'].includes(r.status) ? `<button class="btn" data-m="returned" data-id="${r.event_item_id}">Mark Returned</button>` : '—')
  + '</td></tr>';

export function renderReturns() {
  fill('#retT', state.returns, 5, returnRow, state.user ? 'Nothing out on rent' : 'Log in to view data');
}
