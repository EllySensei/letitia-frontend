// The API runs on localhost:3000. When the backend serves this page itself (open
// http://localhost:3000), calls stay same-origin; from any other dev server they go to :3000.
export const API_BASE = location.port === '3000' ? '' : 'http://localhost:3000';

export const TOKEN_KEY = 'laetitia-token';
export const BOOKINGS_KEY = 'laetitia-demo-bookings';

export const NOTIFICATION_POLL_MS = 60_000;
