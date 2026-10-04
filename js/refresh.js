import { state, loadAll } from './state.js';
import { render } from './views/index.js';
import { refreshNotifications } from './notifications.js';
import { toast } from './utils.js';

// Reloads all data from the API and redraws every screen. Changes often raise alerts
// (new inquiry, low stock), so the bell is refreshed too.
export async function refresh() {
  const [failed] = await Promise.all([loadAll(), state.user && refreshNotifications()]);
  render();
  if (failed.length) toast(`Could not load: ${failed.join(', ')}`, 5000);
}
