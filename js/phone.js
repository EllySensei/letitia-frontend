// Phone numbers are typed as a country code (dropdown) plus the digits after it, e.g. PH +63
// and up to 10 digits instead of a local 09XXXXXXXXX or 02XXXXXXXX. The countries, and how many digits each
// takes, come from the API; until they arrive only the default country is offered.
import { api } from './api.js';
import { esc } from './utils.js';

let countries = [{ iso: 'PH', name: 'Philippines', code: '+63', main: true, min: 6, max: 10, example: '9051234567' }];
const country = iso => countries.find(c => c.iso === iso) || countries[0];

const options = selected => countries.map(c =>
  `<option value="${c.iso}" title="${esc(c.name)}"${c.iso === selected ? ' selected' : ''}>${c.iso} ${c.code}</option>`).join('');

// Limits and hint for the digits box, following the chosen country. The limit is applied
// here rather than with maxlength, which would cut a pasted '+63…' or '09…' short before
// its code or leading 0 could be taken off.
function fit(input, c) {
  input.placeholder = c.example || '';
  if (input.value.length > c.max) input.value = input.value.slice(0, c.max);
}

// The dropdown (id `${id}Cc`) and the digits box (id `id`). `attrs` go on the digits box.
export const phoneInputs = (id, { name = '', attrs = '' } = {}) => {
  const c = countries[0];
  return `<div class="phone"><select class="cc" id="${id}Cc"${name ? ` name="${name}_cc"` : ''} data-phone-cc="${id}" aria-label="Country code">${options(c.iso)}</select>`
    + `<input id="${id}"${name ? ` name="${name}"` : ''} type="tel" inputmode="numeric" autocomplete="tel-national"`
    + ` placeholder="${esc(c.example || '')}" data-phone ${attrs}></div>`;
};

// '' when the digits fit the country, otherwise what's wrong.
export function phoneProblem(iso, digits) {
  const c = country(iso);
  if (digits.length >= c.min && digits.length <= c.max) return '';
  return `Enter ${c.min === c.max ? c.min : `${c.min} to ${c.max}`} digits after ${c.code}`;
}

// The dropdown value for a stored code such as '+63' (the main country when several share it).
export const isoFor = code => (countries.find(c => c.code === code && c.main) || countries.find(c => c.code === code))?.iso;

// What the API takes, e.g. '+639171234567'.
export const phoneValue = (iso, digits) => country(iso).code + digits;

export async function loadPhoneCountries() {
  try {
    const list = await api.shop.phoneCountries();
    if (!list.length) return;
    countries = list;
  } catch {
    return; // keep the default country; the form still works
  }
  // A form opened before the list arrived gets the full dropdown now.
  document.querySelectorAll('select[data-phone-cc]').forEach(sel => { sel.innerHTML = options(sel.value); });
}

// Digits only, without the local leading 0 (the code replaces it). A pasted '+63 917…' or
// '0063 917…' picks its country from the code (the main one, for a code several share).
document.addEventListener('input', e => {
  const input = e.target;
  if (!input.matches?.('input[data-phone]')) return;
  const sel = document.getElementById(`${input.id}Cc`);
  let v = input.value.trim().replace(/^00/, '+');
  if (v.startsWith('+')) {
    const digits = v.replace(/\D/g, '');
    const match = countries.filter(c => c.main && digits.startsWith(c.code.slice(1))).sort((a, b) => b.code.length - a.code.length)[0];
    if (match) {
      sel.value = match.iso;
      v = digits.slice(match.code.length - 1);
    }
  }
  const c = country(sel.value);
  input.value = v.replace(/\D/g, '').replace(/^0+/, '');
  fit(input, c);
});

document.addEventListener('change', e => {
  const sel = e.target;
  if (!sel.matches?.('select[data-phone-cc]')) return;
  const input = document.getElementById(sel.dataset.phoneCc);
  fit(input, country(sel.value));
  input.dispatchEvent(new Event('input', { bubbles: true })); // re-checks a flagged number
});

loadPhoneCountries();
