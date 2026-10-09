// Database tab (admins only): every table with its rows, and a console that tails the
// change log while the tab is open.
import { api } from '../api.js';
import { isAdmin } from '../state.js';
import { $, esc, showPage, toastError } from '../utils.js';

const POLL_MS = 3000;
const PAGE_SIZE = 50;
const MAX_LINES = 1000;

let tables = [];
let selected = null;   // { name, offset }
let entries = [];      // console lines, oldest first
let lastId = null;     // newest change-log id seen; null until the first load
let paused = false;
let timer = null;

const isOpen = () => $('#db').classList.contains('on');

// ---- tables ----

const fmtCount = n => Number(n).toLocaleString('en-PH');

function renderTables() {
  $('#dbTables').innerHTML = tables.length
    ? tables.map(t => `<button type="button" class="dbt${t.name === selected?.name ? ' on' : ''}" data-dbtable="${esc(t.name)}">
        <b>${esc(t.name)}</b><small>${fmtCount(t.rows)} row${t.rows === 1 ? '' : 's'} · ${t.columns} cols${t.last_change ? ` · changed ${esc(t.last_change.slice(0, 16))}` : ''}</small></button>`).join('')
    : '<p class="notif-empty">No tables</p>';
  const filter = $('#dbFilter');
  const current = filter.value;
  filter.innerHTML = '<option value="">All tables</option>' + tables.map(t => `<option>${esc(t.name)}</option>`).join('');
  filter.value = current;
}

async function loadTables() {
  tables = await api.database.tables();
  renderTables();
}

const cell = v => v === null || v === undefined ? '<i class="null">NULL</i>' : `<span title="${esc(v)}">${esc(v)}</span>`;

async function loadRows() {
  if (!selected) return;
  const data = await api.database.rows(selected.name, { limit: PAGE_SIZE, offset: selected.offset });
  if (data.name !== selected?.name) return; // another table was picked meanwhile
  $('#dbTitle').textContent = data.name;
  $('#dbHead').innerHTML = '<tr>' + data.columns.map(c => `<th title="${esc(c.type)}${c.is_primary ? ' · primary key' : ''}">${c.is_primary ? '🔑 ' : ''}${esc(c.name)}</th>`).join('') + '</tr>';
  $('#dbRows').innerHTML = data.rows.length
    ? data.rows.map(r => '<tr>' + data.columns.map(c => `<td class="dbc">${cell(r[c.name])}</td>`).join('') + '</tr>').join('')
    : `<tr><td class="empty" colspan="${data.columns.length}">This table is empty</td></tr>`;
  const from = data.total ? data.offset + 1 : 0;
  const to = data.offset + data.rows.length;
  $('#dbPager').innerHTML = `<small>${from}–${to} of ${fmtCount(data.total)}</small> `
    + `<button class="btn" data-dbpage="-1"${data.offset ? '' : ' disabled'}>‹ Newer</button> `
    + `<button class="btn" data-dbpage="1"${to < data.total ? '' : ' disabled'}>Older ›</button>`;
}

function selectTable(name) {
  selected = { name, offset: 0 };
  renderTables();
  loadRows().catch(toastError);
}

// ---- console ----

const ACTION_CLASS = { INSERT: 'ins', UPDATE: 'upd', DELETE: 'del' };

// Writes from the storefront have no signed-in user; ones outside any request come from the server itself.
const who = e => e.username || (e.source?.includes(' /public/') ? 'storefront' : e.source ? 'guest' : 'system');

const line = e => `<details class="ln" data-table="${esc(e.table_name)}">
  <summary><span class="t">${esc(e.created_at)}</span> <span class="u">${esc(who(e))}</span> <span class="a ${ACTION_CLASS[e.action] || ''}">${esc(e.action)}</span> `
  + `<span class="tb" data-dbtable="${esc(e.table_name)}">${esc(e.table_name)}</span> <span class="n">${e.row_count} row${e.row_count === 1 ? '' : 's'}${e.row_id ? ` · #${e.row_id}` : ''}</span>`
  + `${e.source ? ` <span class="src">← ${esc(e.source)}</span>` : ''}</summary>
  <pre>${esc(e.statement)}${e.params ? `\n<span class="p">params ${esc(e.params)}</span>` : ''}</pre></details>`;

const visible = e => !$('#dbFilter').value || e.table_name === $('#dbFilter').value;

function renderConsole() {
  const shown = entries.filter(visible);
  $('#dbConsole').innerHTML = shown.length ? shown.map(line).join('') : '<p class="console-empty">Waiting for changes…</p>';
  $('#dbConsole').scrollTop = $('#dbConsole').scrollHeight;
}

function appendLines(fresh) {
  const out = $('#dbConsole');
  const atBottom = out.scrollHeight - out.scrollTop - out.clientHeight < 40;
  entries.push(...fresh);
  if (entries.length > MAX_LINES) {
    entries = entries.slice(-MAX_LINES);
    return renderConsole();
  }
  const shown = fresh.filter(visible);
  if (!shown.length) return;
  out.querySelector('.console-empty')?.remove();
  out.insertAdjacentHTML('beforeend', shown.map(line).join(''));
  if (atBottom) out.scrollTop = out.scrollHeight;
}

function setStatus(text, cls) {
  $('#dbLive').textContent = text;
  $('#dbLive').className = `live ${cls}`;
}

async function poll() {
  timer = null;
  if (!isOpen() || !isAdmin()) return; // reopening the tab starts it again
  if (!paused && !document.hidden) {
    try {
      const fresh = await api.database.changes(lastId);
      if (fresh.length) {
        lastId = fresh.at(-1).log_id;
        appendLines(fresh);
        // Keep the table list and the open table in step with what just changed.
        await loadTables();
        if (selected && fresh.some(e => e.table_name === selected.name)) await loadRows();
      }
      setStatus('● live', 'on');
    } catch (err) {
      setStatus('● offline', 'off');
      console.warn('change console failed', err);
    }
  }
  timer = setTimeout(poll, POLL_MS);
}

// ---- tab ----

export async function openDatabase() {
  if (!isAdmin()) return showPage('dash');
  try {
    await loadTables();
    // Opens on the first business table rather than the bookkeeping ones.
    const first = tables.find(t => !['change_log', 'data_versions'].includes(t.name)) ?? tables[0];
    if (!selected && first) selectTable(first.name);
    else await loadRows();
    if (lastId === null) {
      entries = await api.database.changes();
      lastId = entries.at(-1)?.log_id ?? 0;
      renderConsole();
    }
  } catch (err) { toastError(err); }
  if (!timer) poll();
}

// Called on every render: hides the tab from non-admins and forgets everything on logout.
export function renderDatabase() {
  $('#dbNav').hidden = !isAdmin();
  if (isAdmin()) return;
  if (isOpen()) showPage('dash');
  clearTimeout(timer);
  timer = null;
  tables = [];
  selected = null;
  entries = [];
  lastId = null;
}

export function bindDatabase() {
  $('#db').addEventListener('click', e => {
    const table = e.target.closest('[data-dbtable]');
    if (table) {
      e.preventDefault(); // a table name inside a console line shouldn't also toggle it open
      return selectTable(table.dataset.dbtable);
    }
    const page = e.target.closest('[data-dbpage]');
    if (page && selected) {
      selected.offset = Math.max(0, selected.offset + Number(page.dataset.dbpage) * PAGE_SIZE);
      loadRows().catch(toastError);
    }
  });
  $('#dbFilter').addEventListener('change', renderConsole);
  $('#dbPause').addEventListener('click', () => {
    paused = !paused;
    $('#dbPause').textContent = paused ? 'Resume' : 'Pause';
    $('#dbPause').setAttribute('aria-pressed', String(paused));
    setStatus(paused ? '❚❚ paused' : '● live', paused ? 'off' : 'on');
  });
  $('#dbClear').addEventListener('click', () => { entries = []; renderConsole(); });
  $('#dbRefresh').addEventListener('click', () => Promise.all([loadTables(), loadRows()]).catch(toastError));
}
