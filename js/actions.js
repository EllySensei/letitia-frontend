// Page controls: navigation, menus, table buttons and the bulk actions.
import { api } from './api.js';
import { state, isAdmin } from './state.js';
import { refresh } from './refresh.js';
import { signOut } from './session.js';
import { createBooking, bookingProblem, CUSTOM } from './bookings.js';
import { resizeImage } from './images.js';
import { openModal, closeModal } from './modal.js';
import { markRead, stopSound } from './notifications.js';
import { renderInventory, renderPayments } from './views/index.js';
import { $, $$, toast, toastError } from './utils.js';

// Wraps an admin-only action: checks the role, reports errors, reloads data afterwards.
const adminAction = fn => async (...args) => {
  if (!isAdmin()) return toast(state.user ? 'Only administrators can do this' : 'Log in first (account menu, top right)');
  try {
    const message = await fn(...args);
    if (message === false) return;
    if (message) toast(message);
    await refresh();
  } catch (err) { toastError(err); }
};

function go(page) {
  $$('.page').forEach(x => x.classList.toggle('on', x.id === page));
  $$('aside a').forEach(a => a.classList.toggle('on', a.dataset.p === page));
}

function setOpen(menu, button, open) {
  $(menu).classList.toggle('hidden', !open);
  $(button).setAttribute('aria-expanded', String(open));
}

const deleteRecord = adminAction(async el => {
  const [resource, id] = el.dataset.del.split(':');
  if (!confirm(`Delete ${el.dataset.name}?`)) return false;
  return (await api[resource].remove(id)).message;
});

const NEXT_PULL = { Pending: 'Pulled', Pulled: 'Packed' };
const advancePull = adminAction(async el => {
  const next = NEXT_PULL[el.dataset.status];
  if (!next) { toast('Already packed'); return false; }
  return (await api.pullsheet.setStatus(state.pullsheet.date, Number(el.dataset.pull), next)).message;
});

const deleteAllInventory = adminAction(async () => {
  if (!confirm('Delete all inventory items and consumables? Items still booked on events are kept.')) return false;
  const { message } = await api.inventory.removeAll();
  const failed = [];
  for (const c of state.consumables) {
    try { await api.consumables.remove(c.consumable_id); } catch { failed.push(c.name); }
  }
  return message + (failed.length ? `; could not delete ${failed.join(', ')}` : '');
});

const deleteAllClients = adminAction(async () => {
  if (!confirm('Delete all clients? Clients with active events are kept.')) return false;
  return (await api.clients.removeAll()).message;
});

const deleteAllPackages = adminAction(async () => {
  if (!confirm('Delete all packages? Events already booked keep their package name.')) return false;
  return (await api.packages.removeAll()).message;
});

const restockAll = adminAction(async () => {
  if (!confirm('Return all damaged or missing rental units to service?')) return false;
  return (await api.inventory.restockAll()).message;
});

function clearBookingForm() {
  ['bClient', 'bDate', 'bTime', 'bVenue', 'bPkg', 'bCustom', 'bContract', 'bPay'].forEach(id => $('#' + id).value = '');
  $('#bCustom').hidden = true;
  $$('#bItems .qty').forEach(q => q.value = '');
}

const submitBookingForm = adminAction(async () => {
  const booking = {
    client_id: $('#bClient').value,
    event_date: $('#bDate').value,
    start_time: $('#bTime').value,
    venue_name: $('#bVenue').value.trim(),
    package: $('#bPkg').value,
    custom: $('#bCustom').value,
    contract_value: $('#bContract').value === '' ? undefined : Number($('#bContract').value),
    downpayment: Number($('#bPay').value) || undefined,
    items: $$('#bItems .qty').filter(q => Number(q.value) > 0).map(q => ({ item_id: Number(q.dataset.item), qty: Number(q.value) })),
  };
  const problem = bookingProblem(booking);
  if (problem) { toast(problem); return false; }
  await createBooking(booking);
  clearBookingForm();
  return 'Booking submitted ✓';
});

function togglePassword(btn) {
  const input = $('#' + btn.dataset.pw);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.textContent = show ? 'Hide' : 'Show';
  btn.setAttribute('aria-pressed', String(show));
}

// Resizes the picked package picture and shows it; the Add Package modal sends the preview's data URL.
async function previewPackageImage(input) {
  const preview = $('#pkgPreview');
  const file = input.files[0];
  preview.hidden = true;
  preview.removeAttribute('src');
  if (!file) return;
  if (!file.type.startsWith('image/')) { input.value = ''; return toast('Image file lang ang puwede'); }
  try {
    preview.src = await resizeImage(file);
    preview.hidden = false;
  } catch {
    input.value = '';
    toast('Hindi mabasa ang picture');
  }
}

function onChange(e) {
  if (e.target.id === 'f_pkgImage') return previewPackageImage(e.target);
  // "Custom / self order" reveals a text box for describing it.
  const pkgSelect = e.target.closest('[data-pkgsel]');
  if (!pkgSelect) return;
  const custom = pkgSelect.id === 'bPkg' ? $('#bCustom') : $(`#${pkgSelect.id}Custom`);
  if (!custom) return;
  custom.hidden = pkgSelect.value !== CUSTOM;
  if (!custom.hidden) custom.focus();
}

async function onClick(e) {
  const t = e.target;

  const pw = t.closest('[data-pw]');
  if (pw) return togglePassword(pw);
  if (t.closest('#accountBtn')) return setOpen('#accountMenu', '#accountBtn', $('#accountMenu').classList.contains('hidden'));
  const accountAction = t.closest('[data-account-action]');
  if (accountAction) {
    setOpen('#accountMenu', '#accountBtn', false);
    const action = accountAction.dataset.accountAction;
    if (action === 'login') openModal('adminLogin');
    if (action === 'book') openModal('event');
    if (action === 'logout') { await signOut(); toast('Logged out'); }
    return;
  }
  if (!t.closest('#accountMenu')) setOpen('#accountMenu', '#accountBtn', false);

  if (t.closest('#notifBtn')) {
    stopSound();
    return setOpen('#notifPanel', '#notifBtn', $('#notifPanel').classList.contains('hidden'));
  }
  if (t.closest('#closeNotif')) {
    stopSound();
    return setOpen('#notifPanel', '#notifBtn', false);
  }
  const notification = t.closest('[data-notification]');
  if (notification) return markRead(notification.dataset.notification);

  const modal = t.closest('[data-m]');
  const page = t.closest('[data-p]');
  if (modal) openModal(modal.dataset.m, { ...modal.dataset });
  else if (page) go(page.dataset.p);
  if (t.closest('[data-close]') || t.id === 'ov') closeModal();

  const del = t.closest('[data-del]');
  if (del) deleteRecord(del);
  const pull = t.closest('[data-pull]');
  if (pull) advancePull(pull);
}

export function bindActions() {
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    setOpen('#accountMenu', '#accountBtn', false);
    closeModal();
  });

  $('#delAllInv').onclick = deleteAllInventory;
  $('#delAllCl').onclick = deleteAllClients;
  $('#delAllPkg').onclick = deleteAllPackages;
  $('#restockAll').onclick = restockAll;
  $('#bCancel').onclick = clearBookingForm;
  $('#bSubmit').onclick = submitBookingForm;

  $('#invQ').addEventListener('input', renderInventory);
  ['#clQ', '#ppQ'].forEach(sel => $(sel).addEventListener('input', renderPayments));
}
