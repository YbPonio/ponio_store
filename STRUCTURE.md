# Project Architecture & Specification: RetailCore POS & Inventory

A modular, dependency-free Single Page Application (SPA) built for small retail businesses using modern Vanilla JavaScript Web Components, Tailwind CSS, Vite, and Cloud Firestore.

---

## 1. Tech Stack & Architectural Overview

* **Bundler & Dev Server:** Vite (Vanilla JS template)
* **View Layer:** Native Custom Elements (Web Components)
* **Styling Strategy:** Tailwind CSS v4 / PostCSS. Components use **Light DOM** or adopt shared `CSSStyleSheet` (`adoptedStyleSheets`) to leverage utility classes without style boundary overhead.
* **State Management:** Custom Event Bus & Observable Store Pattern
* **Database & Auth:** Firebase SDK v10+ (Firestore modular API, Firebase Auth)
* **Routing:** Hash-based client-side router (`#/inventory`, `#/pos`, `#/orders`)

---

## 2. Directory Structure

```text
store-pos-system/
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
├── postcss.config.js               # PostCSS configuration for Tailwind
├── tailwind.config.js              # Tailwind theme configuration
├── public/
│   ├── favicon.ico
│   └── icons/
└── src/
    ├── main.js                     # Imports Tailwind, registers Web Components
    ├── styles/
    │   └── main.css                # Tailwind directives (@tailwind base, components, utilities)
    ├── services/
    │   ├── firebase.js             # Firebase initialization & Firestore instance
    │   ├── auth.service.js         # Authentication logic & session state
    │   ├── inventory.service.js    # Firestore CRUD for items, stock adjustments
    │   └── orders.service.js       # Transactions & stock synchronization
    ├── store/
    │   ├── router.js               # Hash router & dynamic view switcher
    │   └── cart.store.js           # Reactive state for active POS cart
    ├── components/
    │   ├── common/
    │   │   ├── app-header.js       # Top navigation, online status, auth badge
    │   │   ├── app-modal.js        # Reusable modal container
    │   │   └── data-table.js       # Paginated/sortable table for inventory
    │   ├── pos/
    │   │   ├── pos-view.js         # Master POS layout (catalog + cart split view)
    │   │   ├── product-catalog.js  # Category pills, search bar, item grid
    │   │   ├── product-card.js     # Item card with image/placeholder & stock badge
    │   │   ├── pos-cart.js         # Active cart items, quantity triggers, totals
    │   │   └── pos-checkout.js     # Payment modal (Cash, Change calculation, Receipt)
    │   └── inventory/
    │       ├── inventory-view.js   # Inventory layout (metric cards, actions, table)
    │       ├── product-form.js     # Add/Edit product modal form
    │       └── stock-adjust.js     # Quick stock in/out modal dialog
    └── utils/
        ├── formatters.js           # Currency (PHP), date/time formatters
        └── dom.js                  # DOM helper utilities (template clone helpers)

```

## Web Component Architecture & Data Flow

[ Browser Hash Change ]
          │
          ▼
    [ router.js ] ── (Mounts view) ──► [ <pos-view> ] or [ <inventory-view> ]
                                               │
               ┌───────────────────────────────┴──────────────────────────────┐
               ▼                                                              ▼
     [ <product-catalog> ]                                              [ <pos-cart> ]
     - Tailwind grid layout                                             - Tailwind flex sidebar
     - Fetches via inventory.service                                    - Subscribes to cart.store
     - Fires "add-to-cart" CustomEvent ──────────► [ cart.store.js ] ──► - Re-renders active list
                                                          │
                                                          ▼
                                                 [ <pos-checkout> ]
                                                 - Firestore runTransaction()
                                                 - Decrements stock atomically
                                                 - Creates /orders record