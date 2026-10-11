import { renderHeader } from './header.js';
import { renderDashboard } from './dashboard.js';
import { renderEvents } from './events.js';
import { renderPackages } from './packages.js';
import { renderInventory } from './inventory.js';
import { renderReturns } from './returns.js';
import { renderPayments } from './payments.js';
import { renderDatabase } from './database.js';
import { renderAccounts } from './accounts.js';

export { renderInventory, renderPayments };

export function render() {
  renderHeader();
  renderDashboard();
  renderEvents();
  renderPackages();
  renderInventory();
  renderReturns();
  renderPayments();
  renderDatabase();
  renderAccounts();
}
