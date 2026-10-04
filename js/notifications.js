import { api } from './api.js';
import { NOTIFICATION_POLL_MS } from './config.js';
import { $, esc, timeAgo, toastError } from './utils.js';

const TITLES = {
  new_inquiry: 'New booking inquiry',
  low_stock: 'Inventory alert',
  overdue_return: 'Overdue return',
  reminder: 'Payment reminder',
};

const sound = new Audio('notification-bell.mp3');
sound.preload = 'auto';

let items = [];
let unread = 0;
let timer = null;

function render() {
  $('#notifList').innerHTML = items.length
    ? items.map(n => `
      <button class="notif-item ${n.is_read ? 'read' : 'unread'}" type="button" data-notification="${n.notification_id}">
        <strong>${esc(TITLES[n.type] || 'Notification')}</strong>
        <span>${esc(n.message)}</span>
        <small>${esc(timeAgo(n.created_at))} · ${n.is_read ? 'Read' : 'Click to mark as read'}</small>
      </button>`).join('')
    : '<p class="account-status">No notifications</p>';
  $('#notifCount').textContent = unread;
  $('#notifCount').hidden = unread === 0;
}

function playSound() {
  sound.currentTime = 0;
  sound.play()?.catch(() => {}); // autoplay may be blocked until the user interacts
}

export function stopSound() {
  sound.pause();
  sound.currentTime = 0;
}

export async function refreshNotifications() {
  try {
    const data = await api.notifications.list();
    const grew = data.unread_count > unread;
    items = data.notifications;
    unread = data.unread_count;
    render();
    if (grew) playSound();
  } catch (err) {
    console.warn('notifications failed', err);
  }
}

// The first fetch comes from refresh(), which always follows a login.
export function startNotifications() {
  clearInterval(timer);
  timer = setInterval(refreshNotifications, NOTIFICATION_POLL_MS);
}

export function stopNotifications() {
  clearInterval(timer);
  timer = null;
  items = [];
  unread = 0;
  render();
}

export async function markRead(id) {
  const n = items.find(x => String(x.notification_id) === String(id));
  if (!n || n.is_read) return;
  stopSound();
  try {
    await api.notifications.markRead(id);
    n.is_read = 1;
    unread = Math.max(0, unread - 1);
    render();
  } catch (err) { toastError(err); }
}

export async function markAllRead() {
  stopSound();
  try {
    await api.notifications.markAllRead();
    items.forEach(n => n.is_read = 1);
    unread = 0;
    render();
  } catch (err) { toastError(err); }
}
