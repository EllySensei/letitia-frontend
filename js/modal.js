import { MODALS } from './modals.js';
import { state, isAdmin } from './state.js';
import { refresh } from './refresh.js';
import { $, esc, toast, toastError } from './utils.js';

export const closeModal = () => $('#ov').classList.remove('on');

// ctx carries the clicked element's data-* values (data-id -> ctx.id, data-client-id -> ctx.clientId).
export async function openModal(key, ctx = {}) {
  const def = MODALS[key];
  if (!def) return;
  if (!def.public && !state.user) return toast('Log in first (account menu, top right)');
  if (def.admin && !isAdmin()) return toast('Only administrators can do this');

  let body;
  try { body = await def.body(ctx); } catch (err) { return toastError(err); }
  const title = typeof def.title === 'function' ? def.title(ctx) : def.title;
  const ok = typeof def.ok === 'function' ? def.ok(ctx) : def.ok;

  $('#modal').innerHTML = `<div class="mh"><img src="logo.png" alt="Laetitia logo"><h4>${esc(title)}</h4><button class="x" data-close aria-label="Close">×</button></div>`
    + `${body}<div class="ft"><button class="btn red" data-close>${def.cancel || 'Cancel'}</button>`
    + (ok ? `<button class="btn teal" id="okb">${esc(ok)}</button>` : '') + '</div>';
  $('#ov').classList.add('on');
  $('#modal input, #modal select')?.focus();
  $('#okb')?.addEventListener('click', () => submit(def, ctx, title));
}

async function submit(def, ctx, title) {
  const btn = $('#okb');
  btn.disabled = true; // no double submits while the request is in flight
  try {
    const result = await def.run(ctx);
    if (result === false) return toast('Complete the required fields');
    if (result === 'keep') return;
    closeModal();
    toast(typeof result === 'string' ? result : `${title} — done ✓`);
    if (!def.noRefresh) await refresh();
  } catch (err) {
    toastError(err);
  } finally {
    btn.disabled = false;
  }
}
