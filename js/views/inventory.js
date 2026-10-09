import { state } from '../state.js';
import { $, esc, pill, fill, idCell } from '../utils.js';
import { emptyMsg } from './dashboard.js';

// Rental items and consumables are separate in the API but share one table here.
const rows = () => [
  ...state.inventory.map(i => ({
    kind: 'rental', resource: 'inventory', id: i.item_id, code: i.item_code, name: i.name, category: i.category || 'Prop',
    qty: `${i.qty_available} / ${i.qty_total}`, status: i.status,
  })),
  ...state.consumables.map(c => ({
    kind: 'consumable', resource: 'consumables', id: c.consumable_id, code: c.item_code, name: c.name, category: 'Consumable',
    qty: `${c.current_level} ${c.unit}`, status: c.status,
  })),
];

export function renderInventory() {
  const q = $('#invQ').value.trim().toLowerCase();
  fill('#invT', rows().filter(i => `#${i.id} ${i.code} ${i.name} ${i.category}`.toLowerCase().includes(q)), 7,
    i => `<tr>${idCell(i.id)}<td class="code">${esc(i.code || '—')}</td><td>${esc(i.name)}</td><td>${esc(i.category)}</td><td>${esc(i.qty)}</td><td>${pill(i.status)}</td>`
      + `<td><button class="btn" data-m="editItem" data-kind="${i.kind}" data-id="${i.id}">Edit</button> `
      + `<button class="btn" data-m="restock" data-kind="${i.kind}" data-id="${i.id}">Mark Restocked</button> `
      + `<button class="btn red" data-del="${i.resource}:${i.id}" data-name="${esc(i.name)}">Archive</button></td></tr>`,
    emptyMsg('No inventory items'));
}
