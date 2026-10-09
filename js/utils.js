export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];

// Switches the visible page and highlights its sidebar link.
export function showPage(page) {
  $$('.page').forEach(x => x.classList.toggle('on', x.id === page));
  $$('aside a').forEach(a => a.classList.toggle('on', a.dataset.p === page));
}

export const ico = (n, c = '') => `<svg class="i ${c}"><use href="#i-${n}"/></svg>`;
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const peso = n => '₱' + (Number(n) || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 });

// API dates are plain YYYY-MM-DD; parse them as local dates so they don't shift a day.
const toDate = d => d instanceof Date ? d : new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : String(d).replace(' ', 'T'));

export const fmtDate = d => {
  if (!d) return '—';
  const x = toDate(d);
  return isNaN(x) ? esc(d) : x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// "14:30:00" -> "2:30 PM"
export const fmtTime = t => {
  const m = /^(\d{2}):(\d{2})/.exec(t || '');
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
};

export const timeAgo = d => {
  const mins = Math.round((Date.now() - toDate(d)) / 60000);
  if (isNaN(mins)) return '';
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  return fmtDate(d);
};

// Local YYYY-MM-DD, offset by `days`.
export const isoDate = (days = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const WARN = ['Low Stock', 'Out of Stock', 'Overdue', 'Damaged', 'Missing', 'Cancelled', 'Pending'];
export const pill = (t, cls = WARN.includes(t) ? 'low' : '') => `<span class="pill ${cls}">${esc(t || 'OK')}</span>`;

// A record's database id, shown as the first column of every table.
export const idCell = id => `<td class="id">${id == null ? '—' : `#${id}`}</td>`;

export function fill(sel, rows, cols, tpl, msg) {
  $(sel).innerHTML = rows.length ? rows.map(tpl).join('') : `<tr><td class="empty" colspan="${cols}">${esc(msg)}</td></tr>`;
}

let toastTimer;
export function toast(text, ms = 2600) {
  const e = $('#toast');
  e.textContent = text;
  e.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => e.style.display = 'none', ms);
}

export const toastError = err => toast(`Error: ${err.message}`, 5000);
