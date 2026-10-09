// Storefront pages. Each returns the HTML for <main id="view">; main.js wires the controls.
import { store, findPackage, findItem, cartPackage, cartLines, cartTotal, cartCount } from './store.js';
import { CONTACT, PAYMENT, EVENT_TYPES, FAQS } from './info.js';
import { esc, peso, fmtDate, fmtTime, isoDate } from '../utils.js';
import { phoneInputs } from '../phone.js';

const ico = n => `<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`;

// Packages without a picture get a soft gradient and an emoji for their event type.
const ART = { wedding: ['💐', 'a-rose'], birthday: ['🎈', 'a-sky'], debut: ['👑', 'a-gold'], corporate: ['🥂', 'a-sage'] };
const art = type => ART[String(type || '').toLowerCase()] || ['✨', 'a-mint'];

const media = (o, type, fallbackEmoji) => {
  if (o.image) return `<img src="${esc(o.image)}" alt="" loading="lazy">`;
  const [emoji, cls] = art(type);
  return `<span class="art ${cls}" aria-hidden="true">${fallbackEmoji || emoji}</span>`;
};

const ITEM_ART = { chairs: '🪑', tables: '🍽️', balloons: '🎈', decors: '💐', lights: '💡', linens: '🧵' };
const itemEmoji = c => ITEM_ART[String(c || '').toLowerCase()] || '📦';

const sectionHead = (eyebrow, title, more = '') => `<div class="sec-head"><div><span class="eyebrow">${eyebrow}</span><h2>${title}</h2></div>${more}</div>`;

const stepper = (id, qty, max, action = 'draft') => `<div class="step" role="group" aria-label="Quantity">`
  + `<button type="button" data-${action}="${id}" data-d="-1" aria-label="Fewer"${qty <= 0 ? ' disabled' : ''}>−</button>`
  + `<output data-q="${id}">${qty}</output>`
  + `<button type="button" data-${action}="${id}" data-d="1" aria-label="More"${qty >= max ? ' disabled' : ''}>+</button></div>`;

const loading = () => '<div class="wrap state-msg"><span class="spinner" aria-hidden="true"></span>Loading our catalog…</div>';
const failed = () => `<div class="wrap state-msg"><p><b>We couldn't load the catalog.</b><br>${esc(store.error)}</p><button class="btn" data-reload type="button">Try again</button></div>`;
const guard = fn => (...a) => store.status === 'loading' ? loading() : store.status === 'error' ? failed() : fn(...a);

/* ---------- cards ---------- */

export const pkgCard = p => `<article class="card pkg">
  <a class="media" href="#/package/${p.package_id}" aria-label="${esc(p.name)}">${media(p, p.type)}</a>
  <div class="body">${p.type ? `<span class="chip">${esc(p.type)}</span>` : ''}
   <h3><a href="#/package/${p.package_id}">${esc(p.name)}</a></h3>
   ${p.description ? `<p class="muted clamp">${esc(p.description)}</p>` : ''}
   <div class="foot-row"><span class="price">${peso(p.base_price)}</span><a class="btn sm" href="#/package/${p.package_id}">View details</a></div>
  </div></article>`;

const customCard = () => `<article class="card pkg custom">
  <a class="media" href="#/checkout" aria-label="Request a custom order"><span class="art a-mint" aria-hidden="true">✨</span></a>
  <div class="body"><span class="chip">Anything else</span><h3><a href="#/checkout">Custom order</a></h3>
   <p class="muted">Tell us your theme and guest count and we'll send a quote.</p>
   <div class="foot-row"><span class="price small">Priced after review</span><a class="btn sm" href="#/checkout">Request a quote</a></div>
  </div></article>`;

const rentCard = it => {
  const inCart = store.cart.lines[it.item_id] || 0;
  const left = Math.max(0, it.qty_available - inCart);
  const draft = Math.min(store.draft[it.item_id] || 0, left);
  return `<article class="card rent">
  <a class="media" href="#/item/${it.item_id}" aria-label="${esc(it.name)}">${it.image ? `<img src="${esc(it.image)}" alt="" loading="lazy">` : `<span class="art a-mist" aria-hidden="true">${itemEmoji(it.category)}</span>`}</a>
  <div class="body">${it.category ? `<span class="chip">${esc(it.category)}</span>` : ''}
   <h3><a href="#/item/${it.item_id}">${esc(it.name)}</a></h3>
   <div class="meta"><span class="price">${peso(it.rental_price)}<small> / piece</small></span><span class="stock ${it.qty_available ? '' : 'out'}">${it.qty_available ? `${it.qty_available} in stock` : 'Out of stock'}</span></div>
   ${it.description ? `<p class="muted clamp">${esc(it.description)}</p>` : ''}
   ${inCart ? `<p class="in-cart">${ico('check')}${inCart} in your order</p>` : ''}
   <div class="add-row">${stepper(it.item_id, draft, left)}<button class="btn primary" type="button" data-add="${it.item_id}"${left < 1 ? ' disabled' : ''}>Add</button></div>
  </div></article>`;
};

/* ---------- pages ---------- */

export const home = guard(() => {
  const featured = store.packages.slice(0, 3);
  const rentals = store.items.slice(0, 4);
  return `<section class="hero"><div class="wrap hero-in">
  <div class="hero-copy">
   <span class="eyebrow">Event styling · Decor · Rentals</span>
   <h1>Laetitia</h1>
   <p class="tagline">Steady as she goes.</p>
   <p class="lead">From intimate birthdays to grand weddings, we style, decorate and supply everything your celebration needs, so you can simply enjoy the day.</p>
   <div class="cta"><a class="btn primary lg" href="#/packages">Book an event ${ico('arrow')}</a><a class="btn ghost lg" href="#/rentals">Rent items</a></div>
   <ul class="ticks"><li>${ico('check')}Full setup &amp; dismantling</li><li>${ico('check')}Packages or à la carte rentals</li><li>${ico('check')}Track your booking online</li></ul>
  </div>
  <div class="hero-art" aria-hidden="true">
   <div class="disc"><img src="logo.png" alt=""></div>
   <div class="float f1"><span>💐</span><div><b>Weddings</b><small>Backdrops, arches, florals</small></div></div>
   <div class="float f2"><span>🎈</span><div><b>Birthdays &amp; Debuts</b><small>Themes for every age</small></div></div>
   <div class="float f3"><span>🪑</span><div><b>Rentals</b><small>Chairs, tables, decor</small></div></div>
  </div></div></section>

 <section class="band soft"><div class="wrap">
  ${sectionHead('What we do', 'Everything your event needs')}
  <div class="grid three">
   <div class="card svc"><span class="svc-ic">${ico('brush')}</span><h3>Event Styling</h3><p>Complete styling and decoration for your special occasion, planned around your theme.</p><a href="#/packages">See packages ${ico('arrow')}</a></div>
   <div class="card svc"><span class="svc-ic">${ico('box')}</span><h3>Decor Rental</h3><p>Chairs, tables, balloons and centerpieces to transform any venue, delivered and set up.</p><a href="#/rentals">Browse rentals ${ico('arrow')}</a></div>
   <div class="card svc"><span class="svc-ic">${ico('spark')}</span><h3>Custom Setups</h3><p>Have something special in mind? Describe it and we'll put together a quote just for you.</p><a href="#/checkout">Request a quote ${ico('arrow')}</a></div>
  </div></div></section>

 <section class="band"><div class="wrap">
  ${sectionHead('Featured', 'Popular packages', '<a class="link-more" href="#/packages">View all packages ' + ico('arrow') + '</a>')}
  <div class="grid three">${featured.length ? featured.map(pkgCard).join('') : customCard()}</div>
 </div></section>

 <section class="band soft"><div class="wrap">
  ${sectionHead('How it works', 'Booking in four easy steps')}
  <ol class="steps">
   <li><b>1</b><h3>Choose</h3><p>Pick a package, rental items, or ask for a custom setup.</p></li>
   <li><b>2</b><h3>Request</h3><p>Tell us your date, venue and any special requests.</p></li>
   <li><b>3</b><h3>Confirm</h3><p>We check availability, approve your booking and send payment details.</p></li>
   <li><b>4</b><h3>Celebrate</h3><p>Our team sets up before your event and takes everything back after.</p></li>
  </ol></div></section>

 ${rentals.length ? `<section class="band"><div class="wrap">
  ${sectionHead('Rentals', 'Need just the pieces?', '<a class="link-more" href="#/rentals">Browse all rentals ' + ico('arrow') + '</a>')}
  <div class="grid four">${rentals.map(rentCard).join('')}</div></div></section>` : ''}

 <section class="band"><div class="wrap"><div class="cta-band">
  <div><h2>Have something special in mind?</h2><p>Describe your dream setup and we'll send you a quote.</p></div>
  <a class="btn light lg" href="#/checkout">Request a custom order ${ico('arrow')}</a>
 </div></div></section>`;
});

let pkgFilter = 'All';
export const setPkgFilter = t => { pkgFilter = t; };

export const packages = guard(() => {
  const types = ['All', ...new Set(store.packages.map(p => p.type).filter(Boolean))];
  if (!types.includes(pkgFilter)) pkgFilter = 'All';
  const list = store.packages.filter(p => pkgFilter === 'All' || p.type === pkgFilter);
  return `<section class="page-head"><div class="wrap"><span class="eyebrow">Packages</span><h1>Event styling packages</h1>
   <p class="lead">Complete setups for your celebration. Choose one, add extra rental items if you like, then send your request.</p></div></section>
  <div class="wrap page">
   <div class="chips" role="group" aria-label="Filter by event type">${types.map(t => `<button type="button" class="filter${t === pkgFilter ? ' on' : ''}" data-pkgfilter="${esc(t)}" aria-pressed="${t === pkgFilter}">${esc(t)}</button>`).join('')}</div>
   <div class="grid three">${list.map(pkgCard).join('')}${customCard()}</div>
   ${!store.packages.length ? '<p class="muted center">No packages are listed yet. Send us a custom order and we will put one together for you.</p>' : ''}
  </div>`;
});

export const packageDetail = guard(id => {
  const p = findPackage(id);
  if (!p) return notFound('That package is no longer available.', '#/packages', 'Browse packages');
  const chosen = String(store.cart.packageId) === String(p.package_id);
  return `<div class="wrap page">
  <a class="back" href="#/packages">${ico('back')}All packages</a>
  <div class="detail">
   <div class="detail-media">${media(p, p.type)}</div>
   <div class="detail-body">
    ${p.type ? `<span class="chip">${esc(p.type)}</span>` : ''}
    <h1>${esc(p.name)}</h1>
    <p class="price big">${peso(p.base_price)}</p>
    ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}
    ${p.items.length ? `<h2 class="h-small">What's included</h2><ul class="included">${p.items.map(i => `<li>${ico('check')}${esc(i.name)}${i.qty > 1 ? ` <span class="muted">× ${i.qty}</span>` : ''}</li>`).join('')}<li>${ico('check')}Setup &amp; dismantling</li></ul>` : ''}
    <div class="cta">
     ${chosen
    ? `<a class="btn primary lg" href="#/checkout">Continue to booking ${ico('arrow')}</a><a class="btn ghost lg" href="#/rentals">Add rental items</a>`
    : `<button class="btn primary lg" type="button" data-choose="${p.package_id}">Book this package ${ico('arrow')}</button><button class="btn ghost lg" type="button" data-choose="${p.package_id}" data-then="rentals">Add to order &amp; rent extras</button>`}
    </div>
    ${chosen ? `<p class="note">${ico('check')}This package is in your order.</p>` : store.cart.packageId ? `<p class="note">Choosing this replaces <b>${esc(cartPackage()?.name || 'your current package')}</b> in your order.</p>` : ''}
   </div></div></div>`;
});

let rentalCat = 'All';
let rentalQuery = '';
export const setRentalCat = c => { rentalCat = c; };
export const setRentalQuery = q => { rentalQuery = q; };

export const rentalGrid = () => {
  const q = rentalQuery.trim().toLowerCase();
  const list = store.items.filter(i => (rentalCat === 'All' || i.category === rentalCat)
    && `${i.name} ${i.category || ''} ${i.description || ''}`.toLowerCase().includes(q));
  return list.length ? list.map(rentCard).join('') : '<p class="muted empty-note">No rental items match your search.</p>';
};

export const rentals = guard(() => {
  const cats = ['All', ...new Set(store.items.map(i => i.category).filter(Boolean))];
  if (!cats.includes(rentalCat)) rentalCat = 'All';
  return `<section class="page-head"><div class="wrap"><span class="eyebrow">Rentals</span><h1>Rent decor &amp; furniture</h1>
   <p class="lead">Pick the pieces you need. Prices are per piece for one event day, delivery and setup included.</p></div></section>
  <div class="wrap page">
   <div class="toolbar">
    <label class="search">${ico('search')}<span class="sr">Search rental items</span><input type="search" id="rq" placeholder="Search items…" value="${esc(rentalQuery)}"></label>
    <div class="chips" role="group" aria-label="Category">${cats.map(c => `<button type="button" class="filter${c === rentalCat ? ' on' : ''}" data-cat="${esc(c)}" aria-pressed="${c === rentalCat}">${esc(c)}</button>`).join('')}</div>
   </div>
   <div class="grid four" id="rgrid">${rentalGrid()}</div>
   ${!store.items.length ? '<p class="muted center">No rental items are listed yet.</p>' : ''}
  </div>
  ${orderBar()}`;
});

export const orderBar = () => {
  const n = cartCount();
  return `<div class="order-bar${n ? '' : ' empty'}" id="orderBar"><div class="wrap ob-in"><span>${n ? `${n} item${n === 1 ? '' : 's'} in your order · <b>${peso(cartTotal())}</b>` : 'Your order is empty'}</span>
   <a class="btn primary" href="#/cart">${ico('cart')}View order</a></div></div>`;
};

export const itemDetail = guard(id => {
  const it = findItem(id);
  if (!it) return notFound('That item is no longer available.', '#/rentals', 'Browse rentals');
  const inCart = store.cart.lines[it.item_id] || 0;
  const left = Math.max(0, it.qty_available - inCart);
  return `<div class="wrap page">
  <a class="back" href="#/rentals">${ico('back')}All rental items</a>
  <div class="detail">
   <div class="detail-media">${it.image ? `<img src="${esc(it.image)}" alt="">` : `<span class="art a-mist" aria-hidden="true">${itemEmoji(it.category)}</span>`}</div>
   <div class="detail-body">
    ${it.category ? `<span class="chip">${esc(it.category)}</span>` : ''}
    <h1>${esc(it.name)}</h1>
    <p class="price big">${peso(it.rental_price)} <small>/ piece</small></p>
    <p class="stock ${it.qty_available ? '' : 'out'}">${it.qty_available ? `${it.qty_available} in stock` : 'Out of stock'}</p>
    ${it.description ? `<p class="desc">${esc(it.description)}</p>` : ''}
    ${inCart ? `<p class="note">${ico('check')}${inCart} already in your order.</p>` : ''}
    <div class="add-row big">${stepper(it.item_id, Math.min(store.draft[it.item_id] || 0, left), left)}<button class="btn primary lg" type="button" data-add="${it.item_id}"${left < 1 ? ' disabled' : ''}>Add to order</button></div>
   </div></div></div>`;
});

export const cart = guard(() => {
  const p = cartPackage();
  const lines = cartLines();
  if (!p && !lines.length) {
    return `<div class="wrap page narrow"><div class="empty-state"><span class="art a-mint" aria-hidden="true">🛒</span>
     <h1>Your order is empty</h1><p class="muted">Choose a package or some rental items, or ask us for a custom setup.</p>
     <div class="cta center"><a class="btn primary" href="#/packages">Browse packages</a><a class="btn ghost" href="#/rentals">Rent items</a><a class="btn ghost" href="#/checkout">Custom order</a></div></div></div>`;
  }
  return `<div class="wrap page"><h1 class="page-title">Your order</h1>
  <div class="split">
   <div class="stack">
    ${p ? `<div class="card line pkg-line"><div class="thumb">${media(p, p.type)}</div><div class="grow"><span class="chip">Package</span><h3>${esc(p.name)}</h3><a class="small-link" href="#/package/${p.package_id}">View details</a></div>
      <div class="line-end"><b>${peso(p.base_price)}</b><button class="icon-btn" type="button" data-unpkg aria-label="Remove package">${ico('trash')}</button></div></div>`
    : '<div class="card line hint-line"><div class="grow"><b>No package chosen</b><p class="muted">Renting items only? That works too. Or <a href="#/packages">add a styling package</a>.</p></div></div>'}
    ${lines.map(l => `<div class="card line"><div class="thumb">${l.item.image ? `<img src="${esc(l.item.image)}" alt="">` : `<span class="art a-mist" aria-hidden="true">${itemEmoji(l.item.category)}</span>`}</div>
      <div class="grow"><h3>${esc(l.item.name)}</h3><p class="muted">${peso(l.item.rental_price)} / piece</p></div>
      ${stepper(l.item.item_id, l.qty, l.item.qty_available, 'line')}
      <div class="line-end"><b>${peso(l.total)}</b><button class="icon-btn" type="button" data-remove="${l.item.item_id}" aria-label="Remove ${esc(l.item.name)}">${ico('trash')}</button></div></div>`).join('')}
    <a class="small-link" href="#/rentals">+ Add more rental items</a>
   </div>
   ${summary(true)}
  </div></div>`;
});

// Order total box, used beside the cart and the booking form.
function summary(withButton) {
  const p = cartPackage();
  const lines = cartLines();
  return `<aside class="card summary"><h2>Order summary</h2>
   ${p ? `<div class="sum-row"><span>${esc(p.name)}</span><b>${peso(p.base_price)}</b></div>` : ''}
   ${lines.map(l => `<div class="sum-row"><span>${esc(l.item.name)} × ${l.qty}</span><b>${peso(l.total)}</b></div>`).join('')}
   ${!p && !lines.length ? '<div class="sum-row"><span>Custom order</span><b>Quoted after review</b></div>' : ''}
   <div class="sum-total"><span>Estimated total</span><b>${peso(cartTotal())}</b></div>
   <p class="muted small">Nothing is charged online. We confirm availability and the final price, then send payment details.</p>
   ${withButton ? `<a class="btn primary lg block" href="#/checkout">Continue to booking ${ico('arrow')}</a>` : ''}
  </aside>`;
}

const input = (name, label, attrs = '', req = true) => `<div class="field"><label for="c_${name}">${label}${req ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label><input id="c_${name}" name="${name}" ${attrs}${req ? ' required' : ''}></div>`;

export const checkout = guard(() => {
  const custom = !cartPackage() && !cartLines().length;
  const p = cartPackage();
  const prefType = p && EVENT_TYPES.includes(p.type) ? p.type : '';
  return `<div class="wrap page"><a class="back" href="#/cart">${ico('back')}Back to your order</a>
  <h1 class="page-title">${custom ? 'Request a custom order' : 'Booking details'}</h1>
  <p class="lead">${custom ? 'Tell us what you need and we will send you a quote. Fields marked * are required.' : 'Almost done. Tell us about you and your event. Fields marked * are required.'}</p>
  <div class="split">
   <form class="stack" id="checkout" novalidate>
    <div class="err" id="err" role="alert" tabindex="-1" hidden></div>
    <fieldset class="card fs"><legend>Your details</legend><div class="fgrid three">
     ${input('first_name', 'First name', 'autocomplete="given-name" maxlength="50"')}
     ${input('middle_name', 'Middle name', 'autocomplete="additional-name" maxlength="50"', false)}
     ${input('last_name', 'Last name', 'autocomplete="family-name" maxlength="50"')}
    </div><div class="fgrid two">
     ${input('email', 'Email address', 'type="email" autocomplete="email" maxlength="150"')}
     <div class="field"><label for="c_phone">Phone number <span class="req" aria-hidden="true">*</span></label>${phoneInputs('c_phone', { name: 'phone', attrs: 'required' })}</div>
    </div></fieldset>
    <fieldset class="card fs"><legend>Event</legend><div class="fgrid three">
     <div class="field"><label for="c_purpose">Type of event <span class="req" aria-hidden="true">*</span></label><select id="c_purpose" name="purpose" required>
      <option value="">Select</option>${EVENT_TYPES.map(t => `<option${t === prefType ? ' selected' : ''}>${esc(t)}</option>`).join('')}<option value="Other">Other</option></select></div>
     <div class="field" id="otherWrap" hidden><label for="c_purpose_other">Please specify <span class="req" aria-hidden="true">*</span></label><input id="c_purpose_other" name="purpose_other" maxlength="60" placeholder="e.g. Gender reveal"></div>
     ${input('event_date', 'Event date', `type="date" min="${isoDate()}"`)}
     ${input('start_time', 'Start time', 'type="time"', false)}
    </div></fieldset>
    <fieldset class="card fs"><legend>Venue address</legend><div class="fgrid two">
     ${input('street', 'Street / building', 'autocomplete="address-line1" maxlength="150" placeholder="e.g. 12 Rizal St."')}
     ${input('barangay', 'Barangay', 'maxlength="100"')}
     ${input('city', 'City', 'maxlength="100"', false)}
     ${input('municipality', 'Municipality', 'maxlength="100"', false)}
     ${input('province', 'Province', 'maxlength="100"')}
    </div><p class="hint">Fill in the city or the municipality, whichever applies to the venue.</p></fieldset>
    <fieldset class="card fs"><legend>${custom ? 'Describe your custom order *' : 'Special notes or requests'}</legend>
     <label class="sr" for="c_notes">Notes</label><textarea id="c_notes" name="notes" rows="5" maxlength="2000" placeholder="${custom ? 'Theme, colors, guest count, the items you need…' : 'Theme, colors, setup time, anything we should know'}"${custom ? ' required' : ''}></textarea></fieldset>
    <div class="form-end"><a class="btn ghost" href="#/cart">Back</a><button class="btn primary lg" type="submit" id="submitOrder">Send booking request ${ico('arrow')}</button></div>
   </form>
   ${summary(false)}
  </div></div>`;
});

const statusPill = s => `<span class="status s-${esc(String(s).toLowerCase())}">${esc(s)}</span>`;

// Shared by the confirmation page and Track booking.
function orderCard(o) {
  const what = o.package_name || o.custom_order || 'Custom order';
  return `<div class="card order">
   <div class="order-top"><div><span class="muted small">Reference number</span><p class="ref">#${o.event_id}</p></div>${statusPill(o.status)}</div>
   <dl class="kv">
    <dt>Event date</dt><dd>${fmtDate(o.event_date)}${o.start_time ? ' · ' + fmtTime(o.start_time) : ''}</dd>
    <dt>Order</dt><dd>${esc(what)}</dd>
    ${o.items?.length ? `<dt>Items</dt><dd>${o.items.map(i => `${esc(i.name)} × ${i.qty}`).join(', ')}</dd>` : ''}
    ${o.venue_address ? `<dt>Venue</dt><dd>${esc(o.venue_address)}</dd>` : ''}
    <dt>Total</dt><dd><b>${peso(o.contract_value)}</b></dd>
    <dt>Paid</dt><dd>${peso(o.paid_amount)}</dd>
    <dt>Balance</dt><dd><b>${peso(o.remaining)}</b></dd>
   </dl></div>`;
}

function paymentInfo() {
  const accounts = PAYMENT.filter(a => a.number);
  if (!accounts.length) return '<p>Once your booking is approved, our team will send you the payment details. A downpayment secures your date.</p>';
  return `<p>Once your booking is approved, pay the downpayment to any of these accounts and send us the reference number:</p>
   <ul class="pay-list">${accounts.map(a => `<li><b>${esc(a.method)}</b>${a.bank ? ` · ${esc(a.bank)}` : ''}<br>${esc(a.name)} · ${esc(a.number)}</li>`).join('')}</ul>`;
}

export const done = () => {
  const o = store.lastOrder;
  if (!o) return notFound('There is no recent order on this device.', '#/track', 'Track a booking');
  return `<div class="wrap page narrow">
  <div class="success"><span class="tick" aria-hidden="true">${ico('check')}</span>
   <h1>Thank you! Your request is in.</h1>
   <p class="lead">We've received your booking request. Keep your reference number <b>#${o.event_id}</b>; you'll need it with your email (${esc(o.email)}) to track your booking.</p></div>
  ${orderCard(o)}
  <div class="card next"><h2>What happens next</h2>
   <ol><li>We check the date and the items you asked for.</li><li>We approve your booking and confirm the final price.</li><li>You pay the downpayment to secure your date.</li></ol>
   ${paymentInfo()}</div>
  <div class="cta center"><a class="btn primary" href="#/track">Track this booking</a><a class="btn ghost" href="#/">Back to home</a></div></div>`;
};

export const trackResult = (result, error) => (error ? `<p class="err">${esc(error)}</p>` : '')
  + (result ? orderCard(result) + `<div class="card next"><h2>Payment</h2>${paymentInfo()}</div>` : '');

export const track = (result = null, error = '') => {
  const last = store.lastOrder;
  return `<section class="page-head"><div class="wrap"><span class="eyebrow">Your booking</span><h1>Track a booking</h1>
   <p class="lead">Enter the reference number from your confirmation and the email you ordered with.</p></div></section>
  <div class="wrap page narrow">
   <form class="card fs track-form" id="trackForm" novalidate>
    <div class="fgrid two">
     <div class="field"><label for="t_ref">Reference number</label><input id="t_ref" name="ref" inputmode="numeric" placeholder="e.g. 128" required value="${last ? esc(last.event_id) : ''}"></div>
     <div class="field"><label for="t_email">Email address</label><input id="t_email" name="email" type="email" autocomplete="email" required value="${last ? esc(last.email) : ''}"></div>
    </div>
    <button class="btn primary" type="submit" id="trackBtn">Check status</button>
   </form>
   <div id="trackResult" aria-live="polite">${trackResult(result, error)}</div>
  </div>`;
};

export const contact = () => {
  const rows = [['phone', 'Phone', CONTACT.phone], ['mail', 'Email', CONTACT.email], ['chat', 'Social', CONTACT.social], ['pin', 'Service area', CONTACT.area]]
    .filter(r => r[2]);
  return `<section class="page-head"><div class="wrap"><span class="eyebrow">Contact</span><h1>We're here to help</h1>
   <p class="lead">Questions about a package, a date or a custom idea? Reach out or check the answers below.</p></div></section>
  <div class="wrap page"><div class="split wide">
   <div class="card fs"><h2>Frequently asked questions</h2>${FAQS.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
   <aside class="card fs contact-card"><h2>Get in touch</h2>
    ${rows.length ? rows.map(([i, l, v]) => `<div class="contact-row">${ico(i)}<div><small>${l}</small><b>${esc(v)}</b></div></div>`).join('')
    : '<p class="muted">Send us your request through the booking form and our team will contact you using the details you give.</p>'}
    <a class="btn primary block" href="#/checkout">Send a request</a></aside>
  </div></div>`;
};

export function notFound(msg = 'We couldn\'t find that page.', href = '#/', label = 'Back to home') {
  return `<div class="wrap page narrow"><div class="empty-state"><span class="art a-mint" aria-hidden="true">🔍</span><h1>Not found</h1><p class="muted">${esc(msg)}</p><div class="cta center"><a class="btn primary" href="${href}">${label}</a></div></div></div>`;
}
