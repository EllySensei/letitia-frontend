import { MODALS } from './modals.js';
import { state, isAdmin } from './state.js';
import { refresh } from './refresh.js';
import { validateForm, prefill } from './form.js';
import { $, esc, toast, toastError } from './utils.js';

export const closeModal = () => $('#ov').classList.remove('on');

// ctx carries the clicked element's data-* values (data-id -> ctx.id, data-client-id -> ctx.clientId).
// A modal can have a second action besides ok: alt (label) with runAlt(), shown in red.
// body(ctx) may keep the record it loaded on ctx for fill() and run().
export async function openModal(key, ctx = {}) {
  const def = MODALS[key];
  if (!def) return;
  if (!def.public && !state.user) return toast('Log in first (account menu, top right)');
  if (def.admin && !isAdmin()) return toast('Only administrators can do this');

  let body;
  try { body = await def.body(ctx); } catch (err) { return toastError(err); }
  const title = typeof def.title === 'function' ? def.title(ctx) : def.title;
  const ok = typeof def.ok === 'function' ? def.ok(ctx) : def.ok;
  const alt = typeof def.alt === 'function' ? def.alt(ctx) : def.alt;

  $('#modal').innerHTML = `<div class="mh"><img src="logo.png" alt="Laetitia logo"><h4>${esc(title)}</h4><button class="x" data-close aria-label="Close">×</button></div>`
    + `${body}<div class="ft"><button class="btn" data-close>${def.cancel || 'Cancel'}</button>`
    + (alt ? `<button class="btn red" id="altb">${esc(alt)}</button>` : '')
    + (ok ? `<button class="btn teal" id="okb">${esc(ok)}</button>` : '') + '</div>';
  $('#modal').classList.toggle('wide', Boolean(def.wide));
  // Edit forms fill in the saved values: fill(ctx) returns { fieldId: value }.
  if (def.fill) prefill(def.fill(ctx));
  $('#ov').classList.add('on');
  $('#modal input, #modal select')?.focus();
  $('#okb')?.addEventListener('click', () => submit(def.run, def, ctx, title));
  $('#altb')?.addEventListener('click', () => submit(def.runAlt, def, ctx, title));
}

async function submit(run, def, ctx, title) {
  // Only the main action submits the form; alt actions (e.g. Cancel event) need no input.
  if (run === def.run && !validateForm($('#modal'))) return toast('Please fix the highlighted fields');
  const buttons = [$('#okb'), $('#altb')].filter(Boolean);
  buttons.forEach(b => b.disabled = true); // no double submits while the request is in flight
  try {
    const result = await run(ctx);
    if (result === false) return toast('Complete the required fields');
    if (result === 'keep') return;
    closeModal();
    toast(typeof result === 'string' ? result : `${title} — done ✓`);
    if (!def.noRefresh) await refresh();
  } catch (err) {
    toastError(err);
  } finally {
    buttons.forEach(b => b.disabled = false);
  }
}
