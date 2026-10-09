// Small builders for form fields. Every field gets the id "f_<name>". Fields can carry a
// data-check rule (see CHECKS); validateForm() checks a whole form and shows each problem
// under its field.
import { $, esc } from './utils.js';
import { phoneInputs, phoneProblem, phoneValue } from './phone.js';

const REQ = '<span class="req" aria-hidden="true">*</span>';
const label = (id, text, req) => `<label for="f_${id}">${text}${req ? REQ : ''}</label>`;
const required = req => req ? ' required aria-required="true"' : '';

export const field = (id, text, type = 'text', { req = false, attrs = '', hint = '' } = {}) =>
  `${label(id, text, req)}<input id="f_${id}" type="${type}"${required(req)} ${attrs}>`
  + (hint ? `<small class="hint" id="f_${id}Hint">${hint}</small>` : '');

// Country code dropdown plus the digits after it (see phone.js). Read it with phoneVal().
export const phoneField = (id, text, { req = false } = {}) =>
  label(id, text, req) + phoneInputs(`f_${id}`, { attrs: `${required(req)} data-check="phone"` });
export const phoneVal = id => val(id) && phoneValue(val(`${id}Cc`), val(id));

// Password input with a Show/Hide toggle (handled in actions.js via data-pw).
export const password = (id, text) =>
  `${label(id, text, true)}<div class="pw"><input id="f_${id}" type="password"${required(true)} autocomplete="current-password">`
  + `<button type="button" class="pwt" data-pw="f_${id}" aria-pressed="false">Show</button></div>`;

export const textarea = (id, text, placeholder = '', { req = false, rows = 3, attrs = '' } = {}) =>
  `${label(id, text, req)}<textarea id="f_${id}" rows="${rows}" placeholder="${esc(placeholder)}"${required(req)} ${attrs}></textarea>`;

// options: [value, label] pairs.
export const select = (id, text, options, { selected = '', empty = '— none —', req = false, attrs = '' } = {}) =>
  `${label(id, text, req)}<select id="f_${id}"${required(req)} ${attrs}>${options.length
    ? options.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(selected) ? ' selected' : ''}>${esc(l)}</option>`).join('')
    : `<option value="">${esc(empty)}</option>`}</select>`;

// A dropdown of common values plus "Other…", which reveals a text box (see actions.js).
// Read it with choiceVal().
export const OTHER = '__other';
export const choice = (id, text, values, { req = false, selected = '', placeholder = 'Select…', other = 'Type it here', max = 60 } = {}) => {
  const known = !selected || values.includes(selected);
  return select(id, text, [['', placeholder], ...values.map(v => [v, v]), [OTHER, 'Other…']],
    { req, selected: known ? selected : OTHER, attrs: `data-other="f_${id}Other"` })
    + `<input id="f_${id}Other" class="other-text" type="text" maxlength="${max}" placeholder="${esc(other)}"`
    + ` aria-label="${esc(text)}: ${esc(other)}" value="${known ? '' : esc(selected)}"${required(req)}${known ? ' hidden' : ''}>`;
};
export const choiceVal = id => val(id) === OTHER ? val(id + 'Other') : val(id);

// First, middle (optional) and last name. `p` prefixes the ids so one page can hold two sets.
export const nameFields = (p = '', { req = true } = {}) => '<div class="frow3">'
  + `<div>${field(`${p}first`, 'First name', 'text', { req, attrs: 'maxlength="100" autocomplete="given-name" data-check="name"' })}</div>`
  + `<div>${field(`${p}middle`, 'Middle name', 'text', { attrs: 'maxlength="100" autocomplete="additional-name" placeholder="Optional" data-check="name"' })}</div>`
  + `<div>${field(`${p}last`, 'Last name', 'text', { req, attrs: 'maxlength="100" autocomplete="family-name" data-check="name"' })}</div></div>`;

export const readName = (p = '') => ({ first_name: val(`${p}first`), middle_name: val(`${p}middle`) || undefined, last_name: val(`${p}last`) });

// A Philippine address. A place is in a city or a municipality, never both, so they share a box.
export const addressFields = (p = '', { req = true, legend = 'Address', note: hint = '' } = {}) =>
  `<fieldset class="addr"><legend>${legend}${req ? REQ : ''}</legend>${hint ? `<small class="hint">${hint}</small>` : ''}`
  + field(`${p}street`, 'House no. / Street / Building', 'text', { req, attrs: 'maxlength="255" autocomplete="address-line1"' })
  + '<div class="frow3">'
  + `<div>${field(`${p}barangay`, 'Barangay', 'text', { req, attrs: 'maxlength="100"' })}</div>`
  + `<div>${field(`${p}city`, 'City / Municipality', 'text', { req, attrs: 'maxlength="100" autocomplete="address-level2"' })}</div>`
  + `<div>${field(`${p}province`, 'Province', 'text', { req, attrs: 'maxlength="100" autocomplete="address-level1"' })}</div></div></fieldset>`;

// `prefix` is the API's column prefix, e.g. 'venue_'. Blank parts are left out.
export const readAddress = (p = '', prefix = '') => {
  const parts = { street: val(`${p}street`), barangay: val(`${p}barangay`), city_municipality: val(`${p}city`), province: val(`${p}province`) };
  return Object.fromEntries(Object.entries(parts).filter(([, v]) => v).map(([k, v]) => [prefix + k, v]));
};

// A picture picker with its preview (resized in actions.js) and a Remove button. `current` is
// the saved picture when editing. Read it back with pictureVal().
export const picture = (id, text, preview, current = '') =>
  field(id, text, 'file', { attrs: `accept="image/*" data-preview="${preview}"` })
  + `<img id="${preview}" class="pkg-preview" alt="${esc(text)} preview"${current ? ` src="${esc(current)}" data-original="${esc(current)}"` : ' hidden'}>`
  + `<button type="button" class="btn pic-remove" data-unpic="${preview}"${current ? '' : ' hidden'}>Remove picture</button>`;

// undefined when the picture is as saved, null when it was removed, otherwise the new data URL.
export function pictureVal(preview) {
  const img = $('#' + preview);
  const src = img.hidden ? null : img.getAttribute('src');
  return src === (img.dataset.original ?? null) ? undefined : src;
}

// Puts saved values into a rendered form, keyed by field id without the "f_". A value that
// isn't one of a dropdown's choices goes in its "Other…" box.
export function prefill(values) {
  for (const [id, v] of Object.entries(values)) {
    const el = $('#f_' + id);
    if (!el || v === null || v === undefined) continue;
    const value = String(v);
    if (el.dataset.other && value && ![...el.options].some(o => o.value === value)) {
      el.value = OTHER;
      const box = $('#' + el.dataset.other);
      box.value = value;
      box.hidden = false;
    } else el.value = value;
  }
}

// The fields of `next` that differ from the saved record, so an edit only sends what it
// changes. undefined means "leave as is"; '' and null clear the field.
export const changed = (saved, next) => Object.fromEntries(Object.entries(next)
  .filter(([k, v]) => v !== undefined && String(v ?? '') !== String(saved[k] ?? '')));

export const val = id => ($('#f_' + id)?.value ?? '').trim();

// Number, or undefined when left blank so the API applies its default.
export const num = id => val(id) === '' ? undefined : Number(val(id));

export const note = text => `<p class="demo-credentials">${text}</p>`;

// Checks beyond what the input type and attributes give. They mirror the API's rules.
const CHECKS = {
  name: v => /^\p{L}[\p{L}\p{M} .'-]*$/u.test(v) || 'Letters, spaces, hyphens, apostrophes and periods only',
  phone: (v, el) => phoneProblem($(`#${el.id}Cc`).value, v) || true,
  code: v => /^[A-Za-z0-9][A-Za-z0-9-]{0,29}$/.test(v) || 'Letters, digits and hyphens only (up to 30)',
};

function problemWith(el) {
  const v = el.value.trim();
  if (!v) return el.required ? 'Required' : '';
  const min = Number(el.dataset.minlen);
  if (min && v.length < min) return `Please write at least ${min} characters`;
  if (el.dataset.check) {
    const ok = CHECKS[el.dataset.check](v, el);
    if (ok !== true) return ok;
  }
  return el.checkValidity() ? '' : el.validationMessage;
}

export function showError(el, message) {
  let box = document.getElementById(`${el.id}Err`);
  if (!box && message) {
    box = document.createElement('small');
    box.className = 'ferr';
    box.id = `${el.id}Err`;
    box.setAttribute('role', 'alert');
    (el.closest('.pw, .phone') || el).after(box);
    el.setAttribute('aria-describedby', box.id);
  }
  if (box) box.textContent = message;
  el.classList.toggle('invalid', Boolean(message));
  if (message) el.setAttribute('aria-invalid', 'true');
  else el.removeAttribute('aria-invalid');
}

// Checks every visible field in `root`, marks the ones with problems and focuses the first.
// Hidden fields (walk-in boxes, unused "Other" boxes, the other item kind) are skipped.
export function validateForm(root) {
  let first = null;
  for (const el of root.querySelectorAll('input:not([type=file]), select, textarea')) {
    if (el.closest('[hidden]')) { showError(el, ''); continue; }
    const message = problemWith(el);
    showError(el, message);
    if (message && !first) first = el;
  }
  first?.focus();
  return !first;
}

// Re-checks a flagged field as it's corrected, so the message goes away straight away.
export const recheck = el => { if (el.classList?.contains('invalid')) showError(el, problemWith(el)); };
