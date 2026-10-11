// The backend serves these pages itself (http://localhost:3000), so API calls go to the same
// origin. Only when the pages come from VS Code's Live Server (port 5500) do they go to :3000.
export const API_BASE = location.port === '5500' ? 'http://localhost:3000' : '';

// The storefront and the admin dashboard keep separate logins, so a customer signed in on the
// storefront isn't signed in to /admin (and the other way round).
export const ADMIN_TOKEN_KEY = 'laetitia-token';
export const SHOP_TOKEN_KEY = 'laetitia-shop-token';
export const TOKEN_KEY = /\/admin(\.html)?$/.test(location.pathname) ? ADMIN_TOKEN_KEY : SHOP_TOKEN_KEY;

export const NOTIFICATION_POLL_MS = 60_000;
