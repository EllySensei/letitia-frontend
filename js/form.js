// Small builders for modal form fields. Every field gets the id "f_<name>".
import { $, esc } from './utils.js';

export const field = (id, label, type = 'text', attrs = '') =>
  `<label for="f_${id}">${label}</label><input id="f_${id}" type="${type}" ${attrs}>`;

export const textarea = (id, label, placeholder = '') =>
  `<label for="f_${id}">${label}</label><textarea id="f_${id}" rows="3" placeholder="${esc(placeholder)}"></textarea>`;

// options: [value, label] pairs.
export const select = (id, label, options, selected = '', emptyText = '— none —') =>
  `<label for="f_${id}">${label}</label><select id="f_${id}">${options.length
    ? options.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(selected) ? ' selected' : ''}>${esc(l)}</option>`).join('')
    : `<option value="">${esc(emptyText)}</option>`}</select>`;

export const val = id => ($('#f_' + id)?.value ?? '').trim();

// Number, or undefined when left blank so the API applies its default.
export const num = id => val(id) === '' ? undefined : Number(val(id));

export const note = text => `<p class="demo-credentials">${text}</p>`;
