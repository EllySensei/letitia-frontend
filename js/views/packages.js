import { state } from '../state.js';
import { esc, peso, fill, idCell } from '../utils.js';
import { emptyMsg } from './dashboard.js';

export function renderPackages() {
  fill('#pkgT', state.packages, 7, p => `<tr>${idCell(p.package_id)}<td>${p.image
      ? `<img class="pkg-thumb" src="${esc(p.image)}" alt="${esc(p.name)}">`
      : '<span class="pkg-thumb none">No picture</span>'}</td>`
    + `<td class="g">${esc(p.name)}</td><td>${esc(p.type || '—')}</td><td><b>${peso(p.base_price)}</b></td><td>${esc(p.description)}</td>`
    + `<td><button class="btn" data-m="editPackage" data-id="${p.package_id}">Edit</button> <button class="btn red" data-del="packages:${p.package_id}" data-name="${esc(p.name)}">Archive</button></td></tr>`,
  emptyMsg('No packages yet'));
}
