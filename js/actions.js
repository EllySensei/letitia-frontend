// Page controls: navigation, menus, table buttons and the bulk actions.
import { api } from './api.js';
import { state, isAdmin } from './state.js';
import { refresh } from './refresh.js';
import { signIn, signOut } from './session.js';
import { createBooking, bookingProblem, readBooking, updatePriceHint, CUSTOM, WALK_IN } from './bookings.js';
import { validateForm, recheck, showError, OTHER } from './form.js';
import { resizeImage } from './images.js';
import { openModal, closeModal } from './modal.js';
import { markRead, stopSound } from './notifications.js';
import { renderInventory, renderPayments } from './views/index.js';
import { pickedItems } from './views/events.js';
import { openDatabase, bindDatabase } from './views/database.js';
import { $, $$, showPage, toast, toastError } from './utils.js';

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

function setOpen(menu, button, open) {
  $(menu).classList.toggle('hidden', !open);
  $(button).setAttribute('aria-expanded', String(open));
}

// Nothing is deleted for good: archived records keep their history and can be restored
// from "View archived".
const archiveRecord = adminAction(async el => {
  const [resource, id] = el.dataset.del.split(':');
  if (!confirm(`Archive ${el.dataset.name}? You can restore it later from "View archived".`)) return false;
  return (await api[resource].remove(id)).message;
});

const restoreRecord = adminAction(async el => {
  const [resource, id] = el.dataset.restore.split(':');
  await api[resource].restore(id);
  openModal('archived', { kind: el.dataset.kind }); // redraw the list without the restored record
  return `${el.dataset.name} restored`;
});

const NEXT_PULL = { Pending: 'Pulled', Pulled: 'Packed' };
const advancePull = adminAction(async el => {
  const next = NEXT_PULL[el.dataset.status];
  if (!next) { toast('Already packed'); return false; }
  return (await api.pullsheet.setStatus(state.pullsheet.date, Number(el.dataset.pull), next)).message;
});

const deleteAllInventory = adminAction(async () => {
  if (!confirm('Archive all inventory items and consumables? Items still booked on events are kept. You can restore them from "View archived".')) return false;
  const { message } = await api.inventory.removeAll();
  const failed = [];
  for (const c of state.consumables) {
    try { await api.consumables.remove(c.consumable_id); } catch { failed.push(c.name); }
  }
  return message + (failed.length ? `; could not archive ${failed.join(', ')}` : '');
});

const deleteAllClients = adminAction(async () => {
  if (!confirm('Archive all clients? Clients with active events are kept. You can restore them from "View archived".')) return false;
  return (await api.clients.removeAll()).message;
});

const deleteAllPackages = adminAction(async () => {
  if (!confirm('Archive all packages? Events already booked keep their package name. You can restore them from "View archived".')) return false;
  return (await api.packages.removeAll()).message;
});

const restockAll = adminAction(async () => {
  if (!confirm('Return all damaged or missing rental units to service?')) return false;
  return (await api.inventory.restockAll()).message;
});

const BOOKING_PANEL = '#events .panel.form';

function clearBookingForm() {
  $$(`${BOOKING_PANEL} input, ${BOOKING_PANEL} select, ${BOOKING_PANEL} textarea`).forEach(el => {
    if (el.tagName === 'SELECT') el.selectedIndex = 0; else el.value = '';
    showError(el, '');
  });
  ['#f_bwalkin', '#f_bpackageCustomBox', '#f_betypeOther'].forEach(sel => $(sel).hidden = true);
  updatePriceHint('b');
}

const submitBookingForm = adminAction(async () => {
  if (!validateForm($(BOOKING_PANEL))) { toast('Please fix the highlighted fields'); return false; }
  const booking = { ...readBooking('b'), items: pickedItems() };
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

const approveEvent = adminAction(async el => {
  await api.events.update(el.dataset.approve, { status: 'Approved' });
  return `Event #${el.dataset.approve} approved`;
});

// Admin login screen shown while signed out.
async function submitGate(e) {
  e.preventDefault();
  const username = $('#gUser').value.trim();
  const pass = $('#gPass').value;
  if (!username || !pass) { $('#gateErr').textContent = 'Enter your username and password.'; return; }
  $('#gateBtn').disabled = true;
  $('#gateErr').textContent = '';
  try {
    await signIn(username, pass);
    $('#gPass').value = '';
    await refresh();
    toast(`Welcome, ${state.user.full_name || state.user.username}`);
  } catch (err) {
    $('#gateErr').textContent = err.message;
  } finally {
    $('#gateBtn').disabled = false;
  }
}

// Shows `src` in a picture preview (or hides it), with its Remove button to match.
function showPicture(preview, src) {
  if (src) preview.src = src; else preview.removeAttribute('src');
  preview.hidden = !src;
  const remove = $(`[data-unpic="${preview.id}"]`);
  if (remove) remove.hidden = !src;
}

// Resizes a picked picture and shows it in the <img> named by the input's data-preview;
// the package and item modals send that preview's data URL (see pictureVal in form.js).
// With no file picked, an edit form's saved picture shows again.
async function previewImage(input) {
  const preview = $('#' + input.dataset.preview);
  const file = input.files[0];
  showPicture(preview, preview.dataset.original);
  if (!file) return;
  if (!file.type.startsWith('image/')) { input.value = ''; return toast('Image file lang ang puwede'); }
  try {
    showPicture(preview, await resizeImage(file));
  } catch {
    input.value = '';
    toast('Hindi mabasa ang picture');
  }
}

function removePicture(button) {
  const preview = $('#' + button.dataset.unpic);
  $(`[data-preview="${preview.id}"]`).value = '';
  showPicture(preview, '');
}

// Shows or hides a box of extra fields, focusing its first field when it opens.
function reveal(box, show) {
  if (!box) return;
  box.hidden = !show;
  if (show) (box.matches('input, textarea') ? box : box.querySelector('input, textarea, select'))?.focus();
}

// Keeps the "leave blank to charge ₱…" hint under the contract value in step with the form.
function syncPriceHint(el) {
  if (el.dataset?.price !== undefined) updatePriceHint(el.dataset.price, el.dataset.price === 'b' ? pickedItems() : []);
  else if (el.closest?.('#bItems')) updatePriceHint('b', pickedItems());
}

function onChange(e) {
  const t = e.target;
  recheck(t);
  syncPriceHint(t);
  if (t.dataset.preview) return previewImage(t);
  // "Walk-in customer" reveals boxes for the new client's name and contact details.
  if (t.dataset.walkin) return reveal($('#' + t.dataset.walkin), t.value === WALK_IN);
  // "Other…" in a dropdown reveals a text box for typing the value.
  if (t.dataset.other) return reveal($('#' + t.dataset.other), t.value === OTHER);
  // Rental items and consumables need different fields in the Add Item form.
  if (t.dataset.kindSwitch !== undefined) {
    $$('#modal [data-for]').forEach(box => box.hidden = box.dataset.for !== t.value);
    return;
  }
  // "Custom / self order" reveals a box for describing it.
  if (t.dataset.pkgsel !== undefined) reveal($(`#${t.id}CustomBox`), t.value === CUSTOM);
}

function onInput(e) {
  recheck(e.target);
  syncPriceHint(e.target);
}

async function onClick(e) {
  const t = e.target;

  const pw = t.closest('[data-pw]');
  if (pw) return togglePassword(pw);
  const unpic = t.closest('[data-unpic]');
  if (unpic) return removePicture(unpic);
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
  // A notification about an event opens that event, like its View button.
  const notification = t.closest('[data-notification]');
  if (notification) {
    markRead(notification.dataset.notification);
    if (!notification.dataset.event) return;
    setOpen('#notifPanel', '#notifBtn', false);
    return openModal('eventDetail', { id: notification.dataset.event });
  }

  const modal = t.closest('[data-m]');
  const page = t.closest('[data-p]');
  if (modal) openModal(modal.dataset.m, { ...modal.dataset });
  else if (page) {
    showPage(page.dataset.p);
    if (page.dataset.p === 'db') openDatabase();
  }
  if (t.closest('[data-close]') || t.id === 'ov') closeModal();

  const del = t.closest('[data-del]');
  if (del) archiveRecord(del);
  const restore = t.closest('[data-restore]');
  if (restore) restoreRecord(restore);
  const pull = t.closest('[data-pull]');
  if (pull) advancePull(pull);
  const approve = t.closest('[data-approve]');
  if (approve) approveEvent(approve);
}

export function bindActions() {
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
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
  $('#gateForm').addEventListener('submit', submitGate);
  bindDatabase();

  $('#invQ').addEventListener('input', renderInventory);
  ['#clQ', '#ppQ'].forEach(sel => $(sel).addEventListener('input', renderPayments));
}
