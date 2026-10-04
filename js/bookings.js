// Shared by the "New booking" modal and the booking form on the Events page.
import { api } from './api.js';

export function createBooking(b) {
  return api.events.create({
    client_id: Number(b.client_id),
    package_id: b.package_id ? Number(b.package_id) : undefined,
    event_date: b.event_date,
    start_time: b.start_time || undefined,
    venue_name: b.venue_name || undefined,
    contract_value: b.contract_value, // blank = package price plus extra items
    items: b.items?.length ? b.items : undefined,
    downpayment: b.downpayment > 0 ? { amount: b.downpayment, method: b.method || undefined } : undefined,
  });
}
