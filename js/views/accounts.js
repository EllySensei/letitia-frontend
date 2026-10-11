// Accounts tab (admins only): every login, its role, and the buttons to manage it. Staff
// accounts are made with "Add staff account" and passwords reset from pop-ups (modals.js).
import { api } from '../api.js';
import { isAdmin } from '../state.js';
import { $, esc, fill, fmtDate, idCell, showPage, toast, toastError } from '../utils.js';
import { emptyMsg } from './dashboard.js';

const ROLE_LABELS = { admin: 'Admin', staff: 'Staff', customer: 'Customer' };

let accounts = [];

const isOpen = () => $('#acct').classList.contains('on');

// A role dropdown; customer is only offered to accounts linked to a client (signed up on the
// storefront). Your own role can't be changed here.
function roleSelect(u) {
  const roles = Object.keys(ROLE_LABELS).filter(r => r !== 'customer' || u.client_id);
  return `<select data-role-user="${u.user_id}" data-name="${esc(u.full_name)}" aria-label="Role of ${esc(u.full_name)}"${u.is_self ? ' disabled title="You can\'t change your own role"' : ''}>`
    + roles.map(r => `<option value="${r}"${r === u.role ? ' selected' : ''}>${ROLE_LABELS[r]}</option>`).join('') + '</select>';
}

function renderRows() {
  const q = $('#acQ').value.trim().toLowerCase();
  const role = $('#acRole').value;
  const rows = accounts.filter(u => (!role || u.role === role) && `${u.full_name} ${u.username}`.toLowerCase().includes(q));
  fill('#acT', rows, 7, u => `<tr>${idCell(u.user_id)}<td>${esc(u.full_name || '—')}${u.is_self ? ' <span class="pill web">You</span>' : ''}</td>`
    + `<td>${esc(u.username || '—')}<br><small>${u.client_id ? `Client #${u.client_id}` : 'Username'}</small></td>`
    + `<td>${roleSelect(u)}</td><td>${u.client_id ? u.bookings : '—'}</td><td>${fmtDate(u.created_at)}</td>`
    + `<td><button class="btn" data-m="resetPassword" data-id="${u.user_id}" data-name="${esc(u.full_name)}">Reset password</button>`
    + (u.is_self ? '' : ` <button class="btn red" data-del-user="${u.user_id}" data-name="${esc(u.full_name)}">Delete</button>`) + '</td></tr>',
  emptyMsg('No accounts match'));
}

export async function loadAccounts() {
  if (!isAdmin()) return;
  try {
    accounts = await api.users.list();
    renderRows();
  } catch (err) { toastError(err); }
}

export function openAccounts() {
  if (!isAdmin()) return showPage('dash');
  loadAccounts();
}

// Called on every render: shows the tab to admins only.
export function renderAccounts() {
  $('#acctNav').hidden = !isAdmin();
  if (isAdmin()) return;
  if (isOpen()) showPage('dash');
  accounts = [];
}

async function changeRole(select) {
  const id = select.dataset.roleUser;
  const before = accounts.find(u => String(u.user_id) === id)?.role;
  const to = select.value;
  const warn = to === 'admin' ? '\n\nAdmins can change and delete everything, including other accounts.' : '';
  if (!confirm(`Make ${select.dataset.name} ${to === 'admin' ? 'an admin' : to}?${warn}`)) {
    select.value = before;
    return;
  }
  try {
    toast((await api.users.setRole(id, to)).message);
  } catch (err) {
    toastError(err);
  }
  loadAccounts();
}

async function deleteAccount(btn) {
  if (!confirm(`Delete the account of ${btn.dataset.name}? They won't be able to log in any more. Any bookings they made stay.`)) return;
  try {
    toast((await api.users.remove(btn.dataset.delUser)).message);
  } catch (err) {
    toastError(err);
  }
  loadAccounts();
}

export function bindAccounts() {
  $('#acQ').addEventListener('input', renderRows);
  $('#acRole').addEventListener('change', renderRows);
  $('#acT').addEventListener('change', e => { if (e.target.dataset.roleUser) changeRole(e.target); });
  $('#acT').addEventListener('click', e => {
    const del = e.target.closest('[data-del-user]');
    if (del) deleteAccount(del);
  });
}
