// Header search: finds events, clients and inventory among the loaded records and lists
// them grouped by kind. Picking one opens it (Enter picks the highlighted one).
import { state } from './state.js';
import { openModal } from './modal.js';
import { $, $$, esc, fmtDate } from './utils.js';

const PER_GROUP = 5;

const matches = (q, ...fields) => fields.some(f => String(f ?? '').toLowerCase().includes(q));

function search(q) {
  const events = state.events
    .filter(e => matches(q, `#${e.event_id}`, e.client_name, e.venue_name, e.venue_address, e.package_name, e.event_type))
    .map(e => ({ modal: 'eventDetail', ctx: { id: String(e.event_id) }, label: `${e.client_name} · ${e.event_type || e.package_name || 'Event'}`,
      sub: `#${e.event_id} · ${fmtDate(e.event_date)} · ${e.status}` }));
  const clients = state.clients
    .filter(c => matches(q, `#${c.client_id}`, c.full_name, c.email, c.phone))
    .map(c => ({ modal: 'editClient', ctx: { id: String(c.client_id) }, label: c.full_name, sub: `#${c.client_id} · ${c.email || c.phone || ''}` }));
  const items = [
    ...state.inventory.map(i => ({ kind: 'rental', id: i.item_id, code: i.item_code, name: i.name, category: i.category })),
    ...state.consumables.map(c => ({ kind: 'consumable', id: c.consumable_id, code: c.item_code, name: c.name, category: 'Consumable' })),
  ]
    .filter(i => matches(q, i.code, i.name, i.category))
    .map(i => ({ modal: 'editItem', ctx: { kind: i.kind, id: String(i.id) }, label: i.name, sub: `${i.code || ''} · ${i.category || ''}` }));
  return [['Events', events], ['Clients', clients], ['Inventory', items]]
    .map(([title, rows]) => [title, rows.slice(0, PER_GROUP)])
    .filter(([, rows]) => rows.length);
}

let shown = [];  // the results on screen, in order
let active = -1; // index of the highlighted one

function setOpen(open) {
  $('#gResults').classList.toggle('hidden', !open);
  $('#gQ').setAttribute('aria-expanded', String(open));
}

function highlight(i) {
  active = i;
  $$('#gResults [data-gs]').forEach(b => b.classList.toggle('on', Number(b.dataset.gs) === i));
  $(`#gResults [data-gs="${i}"]`)?.scrollIntoView({ block: 'nearest' });
}

function render() {
  const q = $('#gQ').value.trim().toLowerCase();
  if (!q) { shown = []; return setOpen(false); }
  const groups = search(q);
  shown = groups.flatMap(([, rows]) => rows);
  let n = 0;
  $('#gResults').innerHTML = groups.length
    ? groups.map(([title, rows]) => `<h4>${title}</h4>` + rows.map(r =>
      `<button type="button" role="option" data-gs="${n++}"><b>${esc(r.label)}</b><small>${esc(r.sub)}</small></button>`).join('')).join('')
    : '<p class="none">No events, clients or items match</p>';
  setOpen(true);
  highlight(shown.length ? 0 : -1);
}

function pick(i) {
  const r = shown[i];
  if (!r) return;
  setOpen(false);
  $('#gQ').value = '';
  openModal(r.modal, r.ctx);
}

export function bindSearch() {
  $('#gQ').addEventListener('input', render);
  $('#gQ').addEventListener('focus', render);
  $('#gQ').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && shown.length) { e.preventDefault(); highlight((active + 1) % shown.length); }
    else if (e.key === 'ArrowUp' && shown.length) { e.preventDefault(); highlight((active - 1 + shown.length) % shown.length); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(active); }
    else if (e.key === 'Escape') setOpen(false);
  });
  // mousedown, so the pick happens before the input loses focus.
  $('#gResults').addEventListener('mousedown', e => {
    const b = e.target.closest('[data-gs]');
    if (!b) return;
    e.preventDefault();
    pick(Number(b.dataset.gs));
  });
  document.addEventListener('click', e => { if (!e.target.closest('#gSearch')) setOpen(false); });
}
