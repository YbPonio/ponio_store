import './styles/main.css';

import { router } from './store/router.js';
import { cartStore } from './store/cart.store.js';
import { inventoryService } from './services/inventory.service.js';
import { ordersService } from './services/orders.service.js';
import { authService } from './services/auth.service.js';
import { usersService } from './services/users.service.js';

window.usersService = usersService;
window.seedAdminInFirestore = () => usersService.seedAdminInFirestore();

import './components/auth/auth-view.js';
import './components/common/app-header.js';
import './components/common/app-modal.js';
import './components/common/barcode-scanner-modal.js';
import './components/common/price-checker-modal.js';
import './components/common/data-table.js';

import './components/pos/product-card.js';
import './components/pos/product-catalog.js';
import './components/pos/pos-cart.js';
import './components/pos/pos-checkout.js';
import './components/pos/pos-view.js';

import './components/inventory/product-form.js';
import './components/inventory/stock-adjust.js';
import './components/inventory/inventory-view.js';

import './components/orders/orders-view.js';
import './components/auth/pending-approval-view.js';
import './components/users/user-management-view.js';

window.addEventListener('keydown', (e) => {
  if (e.key === 'F2') {
    e.preventDefault();
    const searchInput = document.querySelector('#product-search, #inventory-search');
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }

  if (e.key === 'F3') {
    e.preventDefault();
    const priceChecker = document.querySelector('price-checker-modal');
    if (priceChecker) {
      priceChecker.open(true);
    }
  }

  if (e.key === 'F4') {
    e.preventDefault();
    router.navigate('/pos');
  }

  if (e.key === 'F8') {
    e.preventDefault();
    router.navigate('/inventory');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  console.info('[PonioStore POS] Application initialized.');
  router.init();
});
