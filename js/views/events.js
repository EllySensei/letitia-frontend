import { api } from '../api.js';
import { state, isAdmin } from '../state.js';
import { packageOptionsHtml, clientChoices, detailFields, paymentFields, updatePriceHint, CUSTOM, WALK_IN } from '../bookings.js';
import { $, $$, esc, fill, fmtDate, fmtTime, ico, isoDate, peso, toast, toastError } from '../utils.js';
import { eventRow, emptyMsg } from './dashboard.js';

// ---- booking builder ----
// Step 1 is the client and event form, step 2 a tile picker for the package, rental items and
// consumables, step 3 a live summary with the price and payment. Picks are kept here; the
// package choice lives in the form's hidden #f_bpackage so the form reads it like any field.

const PACKAGES = 'Packages';
const CONSUMABLES = 'Consumables';
const picks = { items: new Map(), consumables: new Map() }; // id -> quantity
let tab = PACKAGES;
// Units of each rental item free on the chosen event date (GET /availability); null until a date is set.
let free = { date: null, map: null };

export const pickedItems = () => [...picks.items].map(([item_id, qty]) => ({ item_id, qty }));
export const pickedConsumables = () => [...picks.consumables].map(([consumable_id, qty]) => ({ consumable_id, qty }));

const pkgValue = () => $('#f_bpackage')?.value || '';
const chosenPackage = () => state.packages.find(p => String(p.package_id) === pkgValue()) || null;
const pkgQty = id => chosenPackage()?.items?.find(i => i.item_id === id)?.qty || 0;
const findItem = id => state.inventory.find(i => i.item_id === id);
const findConsumable = id => state.consumables.find(c => c.consumable_id === id);

// How many more of an item can be added: free on the date (or on hand now, before a date is
// picked), less what the package already uses and what's already picked.
const itemRoom = i => (free.map ? free.map.get(i.item_id) ?? 0 : i.qty_available) - pkgQty(i.item_id) - (picks.items.get(i.item_id) || 0);
const consumableRoom = c => c.current_level - (picks.consumables.get(c.consumable_id) || 0);

const tabs = () => [PACKAGES, ...new Set(state.inventory.map(i => i.category || 'Other')), CONSUMABLES];

function tabCount(t) {
  if (t === PACKAGES) return pkgValue() ? 1 : 0;
  if (t === CONSUMABLES) return [...picks.consumables.values()].reduce((s, n) => s + n, 0);
  return state.inventory.filter(i => (i.category || 'Other') === t).reduce((s, i) => s + (picks.items.get(i.item_id) || 0), 0);
}

const stepper = (kind, id, qty, room, name) => `<div class="bstepper">`
  + `<button type="button" data-${kind}sub="${id}" aria-label="One less ${esc(name)}">−</button><output>${qty}</output>`
  + `<button type="button" data-${kind}add="${id}" aria-label="One more ${esc(name)}"${room < 1 ? ' disabled' : ''}>+</button></div>`;

function pkgTile(p) {
  const on = String(p.package_id) === pkgValue();
  return `<article class="btile${on ? ' on' : ''}"><h5>${esc(p.name)}</h5><p class="bprice">${peso(p.base_price)}</p>
    <p class="bmeta">${esc(p.type || 'Package')} · ${p.items?.length || 0} item type${p.items?.length === 1 ? '' : 's'}</p>
    <p class="bincl">${(p.items || []).map(i => `${esc(i.name)} ×${i.qty}`).join(', ') || 'No items listed'}</p>
    <button type="button" class="btn ${on ? '' : 'teal'}" data-bpkg="${on ? '' : p.package_id}">${on ? 'Selected · Remove' : 'Choose'}</button></article>`;
}

function customTile() {
  const on = pkgValue() === CUSTOM;
  return `<article class="btile custom${on ? ' on' : ''}"><h5>Custom order</h5><p class="bmeta">No package: describe what to prepare in step 1 and set the price in step 3.</p>
    <button type="button" class="btn ${on ? '' : 'teal'}" data-bpkg="${on ? '' : CUSTOM}">${on ? 'Selected · Remove' : 'Choose'}</button></article>`;
}

function itemTile(i) {
  const qty = picks.items.get(i.item_id) || 0;
  const room = itemRoom(i);
  const inPkg = pkgQty(i.item_id);
  const avail = room + qty; // what could be picked in total
  return `<article class="btile${qty ? ' on' : ''}">${qty ? `<span class="bbadge">${qty}</span>` : ''}
    <h5>${esc(i.name)}</h5><p class="bprice">${peso(i.rental_price)} <small>each</small></p>
    <p class="bmeta">${esc(i.item_code || '')}</p>
    <p class="bfree ${avail > 0 ? '' : 'out'}">${avail > 0 ? `${avail} free` : 'None free'}${free.date ? ` on ${fmtDate(free.date)}` : ' now'}${inPkg ? ` · ${inPkg} in package` : ''}</p>
    ${qty ? stepper('b', i.item_id, qty, room, i.name) : `<button type="button" class="btn teal" data-badd="${i.item_id}"${room < 1 ? ' disabled' : ''}>Add</button>`}</article>`;
}

function consumableTile(c) {
  const qty = picks.consumables.get(c.consumable_id) || 0;
  const room = consumableRoom(c);
  return `<article class="btile${qty ? ' on' : ''}">${qty ? `<span class="bbadge">${qty}</span>` : ''}
    <h5>${esc(c.name)}</h5><p class="bmeta">${esc(c.item_code || '')} · used up at the event</p>
    <p class="bfree ${c.current_level > 0 ? '' : 'out'}">${c.current_level} ${esc(c.unit)} in stock</p>
    ${qty ? stepper('c', c.consumable_id, qty, room, c.name) : `<button type="button" class="btn teal" data-cadd="${c.consumable_id}"${room < 1 ? ' disabled' : ''}>Add</button>`}</article>`;
}

function renderPicker() {
  const all = tabs();
  if (!all.includes(tab)) tab = PACKAGES;
  $('#bTabs').innerHTML = all.map(t => `<button type="button" class="btab${t === tab ? ' on' : ''}" data-btab="${esc(t)}" aria-pressed="${t === tab}">`
    + `${esc(t)}${tabCount(t) ? ` <b>${tabCount(t)}</b>` : ''}</button>`).join('');
  const q = $('#bQ').value.trim().toLowerCase();
  const hit = (...f) => !q || f.some(x => String(x ?? '').toLowerCase().includes(q));
  const tiles = tab === PACKAGES ? [...state.packages.filter(p => hit(p.name, p.type)).map(pkgTile), hit('custom order') ? customTile() : '']
    : tab === CONSUMABLES ? state.consumables.filter(c => hit(c.name, c.item_code)).map(consumableTile)
      : state.inventory.filter(i => (i.category || 'Other') === tab && hit(i.name, i.item_code)).map(itemTile);
  $('#bTiles').innerHTML = tiles.join('') || '<p class="bempty">Nothing here matches.</p>';
  $('#bFreeNote').textContent = free.date ? `free stock on ${fmtDate(free.date)}` : 'pick a date to see free stock';
}

// The client's name as the form shows it: the picked client, or the walk-in's typed name.
function clientLabel() {
  const v = $('#f_bclient')?.value;
  if (v === WALK_IN) return [$('#f_bwfirst')?.value, $('#f_bwlast')?.value].filter(Boolean).join(' ').trim() || 'Walk-in customer';
  return state.clients.find(c => String(c.client_id) === v)?.full_name || '';
}

function renderSummary() {
  const p = chosenPackage();
  const custom = pkgValue() === CUSTOM;
  const items = pickedItems().map(l => ({ ...l, item: findItem(l.item_id) })).filter(l => l.item);
  const cons = pickedConsumables().map(l => ({ ...l, c: findConsumable(l.consumable_id) })).filter(l => l.c);
  const extras = items.reduce((s, l) => s + l.item.rental_price * l.qty, 0);
  const auto = (p?.base_price || 0) + extras;
  const charged = $('#f_bcontract')?.value;
  const etype = $('#f_betype')?.value;
  const date = $('#f_bdate')?.value;
  const line = (name, sub, right, controls = '') => `<li><div><b>${name}</b><small>${sub}</small></div>${controls}<span>${right}</span></li>`;
  const x = (attr, id, name) => `<button type="button" class="bx" ${attr}="${id}" aria-label="Remove ${esc(name)}">✕</button>`;
  $('#bSumLines').innerHTML = `<dl class="bwho">
      <dt>Client</dt><dd>${esc(clientLabel()) || '<i>Not chosen</i>'}</dd>
      <dt>Event</dt><dd>${etype && etype !== '__other' ? esc(etype) : esc($('#f_betypeOther')?.value || '') || '<i>Type not set</i>'}${date ? ` · ${fmtDate(date)}` : ''}${$('#f_btime')?.value ? ` ${fmtTime($('#f_btime').value)}` : ''}</dd>
    </dl>
    <ul class="blines">
      ${p ? line(esc(p.name), 'Package', peso(p.base_price), x('data-bpkg', '', p.name)) : ''}
      ${custom ? line('Custom order', 'Described in step 1', 'priced in step 3', x('data-bpkg', '', 'custom order')) : ''}
      ${items.map(l => line(esc(l.item.name), `${peso(l.item.rental_price)} each`, peso(l.item.rental_price * l.qty),
    stepper('b', l.item_id, l.qty, itemRoom(l.item), l.item.name) + x('data-bdel', l.item_id, l.item.name))).join('')}
      ${cons.map(l => line(esc(l.c.name), `${esc(l.c.unit)} · supplies`, '—',
    stepper('c', l.consumable_id, l.qty, consumableRoom(l.c), l.c.name) + x('data-cdel', l.consumable_id, l.c.name))).join('')}
    </ul>
    ${!p && !custom && !items.length && !cons.length ? `<p class="bempty">${ico('plus')} Nothing picked yet. Choose a package or add items in step 2.</p>` : ''}
    ${items.some(l => itemRoom(l.item) < 0) ? '<p class="bwarn">Some items are more than what is free on this date.</p>' : ''}
    <div class="btotal"><span>${charged ? 'Charged (set below)' : 'Estimated total'}</span><b>${peso(charged ? Number(charged) : auto)}</b></div>
    ${charged && auto ? `<p class="bnote">Package + extras would be ${peso(auto)}.</p>` : ''}`;
  updatePriceHint('b', pickedItems());
}

function renderBuilder() {
  renderPicker();
  renderSummary();
}

// Loads what's free on the event date, so the tiles show and cap real availability.
let freeRequest = 0;
async function loadFree() {
  const date = $('#f_bdate').value;
  if (!date || date < isoDate()) { free = { date: null, map: null }; return renderBuilder(); }
  const mine = ++freeRequest;
  try {
    const { items } = await api.availability(date);
    if (mine !== freeRequest) return;
    free = { date, map: new Map(items.map(i => [i.item_id, i.qty_free])) };
  } catch (err) { toastError(err); }
  renderBuilder();
}

function setPackage(value) {
  $('#f_bpackage').value = value;
  $('#f_bpackageCustomBox').hidden = value !== CUSTOM;
  if (value === CUSTOM) $('#f_bpackageCustom').focus();
  renderBuilder();
}

function change(map, id, delta, room) {
  const now = map.get(id) || 0;
  const next = delta === 0 ? 0 : now + delta;
  if (delta > 0 && room < 1) return toast('No more free on that date');
  if (next > 0) map.set(id, next); else map.delete(id);
  renderBuilder();
}

// Clears the picks (the form's own fields are cleared by actions.js).
export function resetBuilder() {
  picks.items.clear();
  picks.consumables.clear();
  free = { date: null, map: null };
  tab = PACKAGES;
  $('#bQ').value = '';
  if ($('#f_bpackage')) setPackage('');
}

export function bindBuilder() {
  $('#bBuilder').addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t || t.disabled) return;
    const d = t.dataset;
    if ('btab' in d) { tab = d.btab; $('#bQ').value = ''; return renderPicker(); }
    if ('bpkg' in d) return setPackage(d.bpkg);
    const itemId = Number(d.badd || d.bsub || d.bdel);
    if (itemId) { const i = findItem(itemId); return change(picks.items, itemId, 'badd' in d ? 1 : 'bsub' in d ? -1 : 0, i ? itemRoom(i) : 0); }
    const cId = Number(d.cadd || d.csub || d.cdel);
    if (cId) { const c = findConsumable(cId); return change(picks.consumables, cId, 'cadd' in d ? 1 : 'csub' in d ? -1 : 0, c ? consumableRoom(c) : 0); }
  });
  $('#bQ').addEventListener('input', renderPicker);
  // Anything typed in steps 1 and 3 shows in the summary straight away.
  $('#bForm').addEventListener('input', renderSummary);
  $('#bForm').addEventListener('change', e => { if (e.target.id === 'f_bdate') loadFree(); else renderSummary(); });
  $('#bPay').addEventListener('input', renderSummary);
}

// Rebuilding the booking form must not wipe what the user has already picked or typed.
function keepValue(sel, html) {
  const el = $(sel);
  const prev = el.value;
  el.innerHTML = html;
  if ([...el.options].some(o => o.value === prev)) el.value = prev;
}

export function renderEvents() {
  // The form is built once; later renders only refresh the client and package choices.
  if (!$('#f_bclient')) {
    $('#bForm').innerHTML = detailFields('b');
    $('#bPay').innerHTML = paymentFields('b');
  }
  keepValue('#f_bclient', clientChoices().map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join(''));
  keepValue('#f_bpackage', packageOptionsHtml());
  $('#f_bdate').min = isoDate();
  $('#bSubmit').disabled = !isAdmin();
  $('#bSubmit').title = isAdmin() ? '' : 'Admin log in required to book events';
  renderBuilder();

  // Data changed: a search in progress is run again so its results stay current.
  if (filtering()) filterEvents();
  else fillEvents();
}

// ---- search and filters ----
// They run in the database (GET /events?q=&status=&from=&to=), not on the loaded list.

let filtered = null; // the database's matches while a search or filter is set
let latest = 0;      // only the newest request's answer is shown

const filters = () => ({ q: $('#evQ').value.trim(), status: $('#evStatus').value, from: $('#evFrom').value, to: $('#evTo').value });
const filtering = () => Object.values(filters()).some(Boolean);

function fillEvents() {
  const on = filtering();
  fill('#evT', on ? filtered ?? [] : state.events, 7, e => eventRow(e, true), emptyMsg(on ? 'No events match the search' : 'No events yet'));
}

export async function filterEvents() {
  const f = filters();
  if (!filtering()) { filtered = null; return fillEvents(); }
  if (f.from && f.to && f.from > f.to) return toast('"From" must be on or before "To"');
  const mine = ++latest;
  try {
    const rows = await api.events.list(f);
    if (mine !== latest) return;
    filtered = rows;
    fillEvents();
  } catch (err) { toastError(err); }
}

export function clearEventFilters() {
  ['#evQ', '#evStatus', '#evFrom', '#evTo'].forEach(sel => $(sel).value = '');
  filterEvents();
}
