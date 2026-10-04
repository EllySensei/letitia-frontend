import { state } from '../state.js';
import { $, esc, peso, fmtDate, fill } from '../utils.js';
import { emptyMsg } from './dashboard.js';

const search = sel => $(sel).value.trim().toLowerCase();

export function renderPayments() {
  const cq = search('#clQ');
  fill('#clT', state.clients.filter(c => c.full_name.toLowerCase().includes(cq)), 5,
    c => `<tr><td>${esc(c.full_name)}</td><td>${c.next_event_date ? `${fmtDate(c.next_event_date)} · ${esc(c.next_event_venue || '')}` : '—'}</td>`
      + `<td><b>${peso(c.total_contract)}</b></td><td class="${c.balance > 0 ? 'r' : ''}"><b>${peso(c.balance)}</b></td>`
      + `<td><button class="btn red" data-del="clients:${c.client_id}" data-name="${esc(c.full_name)}">Delete Client</button></td></tr>`,
    emptyMsg('No clients yet'));

  const pq = search('#ppQ');
  fill('#ppT', state.receivables.filter(r => r.client_name.toLowerCase().includes(pq)), 5,
    r => `<tr><td>${esc(r.client_name)}<br><small>${fmtDate(r.event_date)}</small></td><td>${peso(r.total_contract)}</td>`
      + `<td>${peso(r.paid_amount)}</td><td class="r">${peso(r.remaining)}</td>`
      + `<td><button class="btn" data-m="payment" data-id="${r.event_id}">Record Payment</button> `
      + `<button class="btn red" data-m="reminder" data-client-id="${r.client_id}">Send Reminder</button></td></tr>`,
    emptyMsg('No pending payments'));
}
