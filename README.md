# Laetitia — Event Styling, Balloon & Decor Rental System (Frontend)

Frontend for Laetitia. It has two parts:

- `index.html`: the public **storefront**, where customers browse packages and rentals, place an order,
  and track a booking.
- `admin.html`: the **admin dashboard**, where staff manage events, packages, inventory, returns, payments
  and clients.

The backend is in [letitia-api](https://github.com/ellysensei/letitia-api), which also serves these
files. Clone both repositories into the same parent folder, then follow the setup steps in the API's
README. When the server is running, open `http://localhost:3000` for the storefront and
`http://localhost:3000/admin` for the dashboard.

## Structure

```
letitia-frontend/
├── index.html, shop.css     Storefront page and styles
├── admin.html, style.css    Admin dashboard page and styles
├── js/
│   ├── shop/                Storefront logic (catalog, ordering, tracking)
│   ├── views/               One file per admin tab (dashboard, events, packages, ...)
│   ├── api.js               Every call to the backend
│   ├── form.js              Form fields and input validation
│   ├── modal.js, modals.js  Pop-up forms (add/edit client, item, payment, ...)
│   ├── actions.js           Button handlers
│   └── ...                  Shared helpers (state, session, phone input, ...)
├── logo.png
└── notification-bell.mp3
```
