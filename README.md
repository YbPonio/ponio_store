# PonioStore POS & Inventory System

A modular, dependency-light Single Page Application (SPA) built for retail businesses using Vanilla JavaScript Web Components, Tailwind CSS v4, Vite, and Cloud Firestore.

---

## 🌟 Key Features

1. **POS Register (`#/pos`)**:
   - Split-screen layout (Catalog + Sticky Cart Sidebar).
   - Instant search by product name, category, or barcode scanner input.
   - Dynamic stock status badges (In-Stock, Low Stock warning `<10`, Out-of-Stock).
   - Reactive active cart with item stepper, max-stock cap enforcement, and clear actions.
   - Quick cash tender presets (`Exact`, `+₱50`, `+₱100`, `+₱500`, `₱1,000`) and live change calculation.
   - Printable 80mm thermal receipt generator upon checkout completion.

2. **Inventory Management (`#/inventory`)**:
   - Executive metric dashboard: Total SKUs, Low Stock alerts, Inventory Cost valuation, and Potential Retail valuation.
   - Searchable, sortable, and paginated data table.
   - Add & Edit product modal with real-time gross profit margin calculator.
   - Stock In / Stock Out adjustment modal (`RESTOCK`, `DAMAGE`, `ADJUSTMENT`) with audit logging.
   - Detailed Stock Audit Trail modal to review historical stock movements.

3. **Sales Orders History (`#/orders`)**:
   - Transaction log with order number (`ORD-YYYYMMDD-XXX`), timestamp, cashier name, line items count, and total.
   - View and reprint receipt for any past transaction.

4. **Dual Engine: Live Firestore & Resilient Local Demo Mode**:
   - When Firebase credentials (`.env`) are configured, executes atomic stock decrements via Firestore `runTransaction()`.
   - When running without credentials, transparently falls back to local persistence (`localStorage`), pre-seeded with sample retail items from `firestore.md`.

---

## 🛠️ Tech Stack

- **Bundler & Server:** Vite 6
- **Styling:** Tailwind CSS v4
- **View Layer:** Native Custom Elements (Web Components in Light DOM for zero-overhead utility styling)
- **State Management:** Custom Event Bus & Observable Store Pattern
- **Database & Auth:** Firebase SDK v11 Modular API (`firebase/firestore`)
- **Routing:** Hash-based SPA Router (`#/pos`, `#/inventory`, `#/orders`)

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Dev Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Build for Production
```bash
npm run build
```

### 4. Run Verification Suite
```bash
node tests/verify.test.js
```

---

## ⚙️ Connecting to Cloud Firestore

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Fill in your Firebase Project credentials:
   ```env
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
   VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
   ```
3. Restart the dev server (`npm run dev`). The status badge in the header will switch to **Cloud Firestore**.

---

## ⌨️ Keyboard Shortcuts

- `F2`: Focus product catalog search / barcode scanner
- `F4`: Switch to POS Register view (`#/pos`)
- `F8`: Switch to Inventory view (`#/inventory`)
- `Esc`: Close any active modal
