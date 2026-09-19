# PonioStore POS & Inventory System

A modular, dependency-light Single Page Application (SPA) built for retail businesses using Vanilla JavaScript Web Components, Tailwind CSS v4, Vite, and Cloud Firestore.

---

## Key Features

1. **POS Register (`#/pos`)**:
   - Split-screen layout (Catalog + Sticky Cart Sidebar).
   - Instant search by product name, category, or barcode scanner input.
   - Dynamic stock status badges (In-Stock, Low Stock warning, Out-of-Stock).
   - Reactive active cart with item stepper, max-stock cap enforcement, and clear actions.
   - Quick cash tender presets and live change calculation.
   - Printable 80mm thermal receipt generator upon checkout completion.
   - Camera barcode scanner for instant price checking (`F3`).

2. **Inventory Management (`#/inventory`)**:
   - Executive metric dashboard: Total SKUs, Low Stock alerts, Inventory Cost valuation, and Potential Retail valuation.
   - Searchable, sortable, and paginated data table with product image thumbnails.
   - Camera barcode scanner to automatically scan barcodes and prefill product creation details.
   - Integration with BarcodeLookup API and public database fallback for automated product info and images.
   - Add & Edit product modal with real-time gross profit margin calculator.
   - Stock In / Stock Out adjustment modal (`RESTOCK`, `DAMAGE`, `ADJUSTMENT`) with audit logging.
   - Detailed Stock Audit Trail modal to review historical stock movements.

3. **Sales Orders History (`#/orders`)**:
   - Transaction log with order number (`ORD-YYYYMMDD-XXX`), timestamp, cashier name, line items count, and total.
   - View and reprint receipt for any past transaction.

4. **User & Access Management (`#/users`)**:
   - Role-based access control (`ADMIN` vs `CASHIER`).
   - Admin approval workflow for newly registered accounts.

5. **Dual Engine: Live Firestore & Resilient Local Demo Mode**:
   - When Firebase credentials (`.env`) are configured, executes atomic stock decrements via Firestore `runTransaction()`.
   - When running without credentials, transparently falls back to local persistence (`localStorage`).

---

## Tech Stack

- **Bundler & Server:** Vite 6
- **Styling:** Tailwind CSS v4
- **View Layer:** Native Custom Elements (Web Components in Light DOM for zero-overhead utility styling)
- **State Management:** Custom Event Bus & Observable Store Pattern
- **Database & Auth:** Firebase SDK v11 Modular API (`firebase/firestore`, `firebase/auth`)
- **Barcode Engine:** Html5Qrcode

---

## Keyboard Shortcuts

- `F2`: Focus product catalog search / barcode scanner
- `F3`: Open Camera Barcode Price Checker
- `F4`: Switch to POS Register view (`#/pos`)
- `F8`: Switch to Inventory view (`#/inventory`)
- `Esc`: Close any active modal
