// Small builders for modal form fields. Every field gets the id "f_<name>".
import { $, esc } from './utils.js';

const REQ = '<span class="req" aria-hidden="true">*</span>';
const label = (id, text, req) => `<label for="f_${id}">${text}${req ? REQ : ''}</label>`;
const required = req => req ? ' required aria-required="true"' : '';

export const field = (id, text, type = 'text', { req = false, attrs = '' } = {}) =>
  `${label(id, text, req)}<input id="f_${id}" type="${type}"${required(req)} ${attrs}>`;

// Password input with a Show/Hide toggle (handled in actions.js via data-pw).
export const password = (id, text) =>
  `${label(id, text, true)}<div class="pw"><input id="f_${id}" type="password"${required(true)} autocomplete="current-password">`
  + `<button type="button" class="pwt" data-pw="f_${id}" aria-pressed="false">Show</button></div>`;

export const textarea = (id, text, placeholder = '') =>
  `${label(id, text, false)}<textarea id="f_${id}" rows="3" placeholder="${esc(placeholder)}"></textarea>`;

// options: [value, label] pairs.
export const select = (id, text, options, { selected = '', empty = '— none —', req = false, attrs = '' } = {}) =>
  `${label(id, text, req)}<select id="f_${id}"${required(req)} ${attrs}>${options.length
    ? options.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(selected) ? ' selected' : ''}>${esc(l)}</option>`).join('')
    : `<option value="">${esc(empty)}</option>`}</select>`;

export const val = id => ($('#f_' + id)?.value ?? '').trim();

// Number, or undefined when left blank so the API applies its default.
export const num = id => val(id) === '' ? undefined : Number(val(id));

export const note = text => `<p class="demo-credentials">${text}</p>`;
