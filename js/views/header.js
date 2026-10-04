import { state } from '../state.js';
import { $, ico, fmtDate, isoDate } from '../utils.js';

const initials = name => name.split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();

export function renderHeader() {
  $('#today').innerHTML = ico('cal') + fmtDate(isoDate()) + ico('chev');
  $('#pullDate').textContent = 'Tomorrow · ' + fmtDate(isoDate(1));

  const u = state.user;
  const name = u ? (u.full_name || u.username) : 'Guest';
  $('#uName').textContent = name;
  $('#uRole').textContent = !u ? 'Guest booking' : u.role === 'admin' ? 'Administrator' : `${u.role} (view only)`;
  $('#uInit').textContent = initials(name);

  $('#accountStatus').textContent = u ? `Signed in as ${u.username}` : 'Browsing as a guest';
  $('#adminLoginAction').hidden = Boolean(u);
  $('#logoutAction').hidden = !u;
  $('#accountBtn').setAttribute('aria-label', `Account menu, ${u ? u.role : 'guest'}`);
}
