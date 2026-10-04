// Entry point: wires the page, restores a saved login, then loads data from the API.
import { handleUnauthorized } from './api.js';
import { bindActions } from './actions.js';
import { restoreSession, endSession } from './session.js';
import { refresh } from './refresh.js';
import { render } from './views/index.js';
import { toast } from './utils.js';

handleUnauthorized(message => {
  endSession();
  toast(message || 'Please log in again', 4000);
});

bindActions();
render();
await restoreSession();
await refresh();
