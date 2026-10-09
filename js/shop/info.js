// Business details shown on the storefront. Fill these in; blank entries are hidden.
export const CONTACT = {
  phone: '',          // e.g. '0917 123 4567'
  email: '',          // e.g. 'hello@laetitia.ph'
  social: '',         // e.g. 'facebook.com/laetitia.events'
  area: '',           // e.g. 'Serving Metro Manila and nearby provinces'
};

// Where customers send payments once a booking is approved. Blank accounts are hidden;
// with none filled in, customers are told the team will send payment details.
export const PAYMENT = [
  { method: 'GCash', name: '', number: '' },
  { method: 'Maya', name: '', number: '' },
  { method: 'Bank transfer', name: '', number: '', bank: '' },
];

// The event types offered in the booking form and the package filter.
export const EVENT_TYPES = ['Wedding', 'Birthday', 'Debut', 'Corporate', 'Christening', 'Anniversary'];

export const FAQS = [
  ['How do I book an event?', 'Pick a package or the rental items you need, add them to your order, then fill in your event details. We review every request and confirm your schedule.'],
  ['Is my booking confirmed right away?', 'Not yet: online orders arrive as requests. Our team checks the date and items, then approves your booking and sends payment details.'],
  ['What payment methods are accepted?', 'GCash, Maya, bank transfer, and cash. A downpayment secures your date; the balance is due before the event.'],
  ['Can I ask for something that is not listed?', 'Yes. Choose "Request a custom order", describe what you have in mind, and we will send you a quote.'],
  ['How do I check on my booking?', 'Use "Track booking" with your reference number and the email you ordered with.'],
];
