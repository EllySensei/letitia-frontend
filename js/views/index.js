import { renderHeader } from './header.js';
import { renderDashboard } from './dashboard.js';
import { renderEvents } from './events.js';
import { renderInventory } from './inventory.js';
import { renderReturns } from './returns.js';
import { renderPayments } from './payments.js';

export { renderInventory, renderPayments };

export function render() {
  renderHeader();
  renderDashboard();
  renderEvents();
  renderInventory();
  renderReturns();
  renderPayments();
}
