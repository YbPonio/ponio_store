import { cartStore } from '../../store/cart.store.js';
import { formatCurrency } from '../../utils/formatters.js';
import { ICONS, emitEvent, escapeHtml, confirmDialog } from '../../utils/dom.js';

export class PosCart extends HTMLElement {
  constructor() {
    super();
    this.unsubscribeCart = null;
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
    this.unsubscribeCart = cartStore.subscribe(() => {
      this.updateCartUI();
    });
  }

  disconnectedCallback() {
    if (this.unsubscribeCart) {
      this.unsubscribeCart();
    }
  }

  setupListeners() {
    const clearBtn = this.querySelector('#clear-cart-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        if (cartStore.getTotalCount() === 0) return;
        const confirmed = await confirmDialog({
          title: 'Clear Cart',
          message: 'Are you sure you want to clear all items in the active cart?',
          confirmText: 'Clear Cart',
          cancelText: 'Cancel',
          isDestructive: true,
        });
        if (confirmed) {
          cartStore.clearCart();
        }
      });
    }

    const backBtn = this.querySelector('#cart-back-to-catalog');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        emitEvent(this, 'switch-to-catalog');
      });
    }

    const checkoutBtn = this.querySelector('#checkout-btn');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => {
        if (cartStore.getItems().length > 0) {
          emitEvent(this, 'open-checkout', {
            items: cartStore.getItems(),
            totalAmount: cartStore.getTotalAmount(),
          });
        }
      });
    }
  }

  updateCartUI() {
    const items = cartStore.getItems();
    const totalCount = cartStore.getTotalCount();
    const totalAmount = cartStore.getTotalAmount();

    const headerCount = this.querySelector('#cart-header-count');
    if (headerCount) headerCount.textContent = `(${totalCount})`;

    const itemsSummaryCount = this.querySelector('#summary-items-count');
    if (itemsSummaryCount) itemsSummaryCount.textContent = totalCount;

    const subtotalEl = this.querySelector('#cart-subtotal');
    if (subtotalEl) subtotalEl.textContent = formatCurrency(totalAmount);

    const totalEl = this.querySelector('#cart-total');
    if (totalEl) totalEl.textContent = formatCurrency(totalAmount);

    const checkoutBtn = this.querySelector('#checkout-btn');
    if (checkoutBtn) {
      checkoutBtn.disabled = items.length === 0;
    }

    const listContainer = this.querySelector('#cart-items-list');
    const emptyState = this.querySelector('#cart-empty-state');
    if (!listContainer) return;

    if (items.length === 0) {
      listContainer.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    listContainer.innerHTML = items.map(item => `
      <div class="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-all select-none" data-product-id="${item.productId}">
        <div class="flex-1 min-w-0 pr-2">
          <h5 class="text-xs font-semibold text-slate-900 truncate">
            ${escapeHtml(item.name)}
          </h5>
          <div class="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-600">
            <span class="font-mono text-slate-900 font-semibold">${formatCurrency(item.sellingPrice)}</span>
            <span>&times;</span>
            <span class="text-slate-800 font-bold">${item.quantity}</span>
            <span class="text-slate-500 font-mono text-[10px]">(${item.maxStock} max)</span>
          </div>
        </div>

        <div class="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-lg border border-slate-200 mr-2 shadow-2xs">
          <button class="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer qty-btn-minus active:scale-95" title="Decrease">
            ${ICONS.minus}
          </button>
          <span class="w-6 text-center font-bold text-xs font-mono text-slate-900">${item.quantity}</span>
          <button class="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer qty-btn-plus active:scale-95 ${item.quantity >= item.maxStock ? 'opacity-40 cursor-not-allowed' : ''}" title="Increase" ${item.quantity >= item.maxStock ? 'disabled' : ''}>
            ${ICONS.plus}
          </button>
        </div>

        <div class="flex items-center gap-1.5 text-right">
          <div class="font-mono font-bold text-xs text-slate-900">
            ${formatCurrency(item.subtotal)}
          </div>
          <button class="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer remove-item-btn" title="Remove">
            ${ICONS.trash}
          </button>
        </div>
      </div>
    `).join('');

    listContainer.querySelectorAll('[data-product-id]').forEach(row => {
      const prodId = row.getAttribute('data-product-id');
      const item = items.find(i => i.productId === prodId);
      if (!item) return;

      const minusBtn = row.querySelector('.qty-btn-minus');
      const plusBtn = row.querySelector('.qty-btn-plus');
      const removeBtn = row.querySelector('.remove-item-btn');

      if (minusBtn) {
        minusBtn.addEventListener('click', () => {
          cartStore.updateQuantity(prodId, item.quantity - 1);
        });
      }

      if (plusBtn) {
        plusBtn.addEventListener('click', () => {
          cartStore.updateQuantity(prodId, item.quantity + 1);
        });
      }

      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          cartStore.removeItem(prodId);
        });
      }
    });
  }

  render() {
    this.className = 'flex flex-col h-full bg-white md:border-l border-slate-200/80 overflow-hidden';
    this.innerHTML = `
      <div class="h-14 px-3 sm:px-5 border-b border-slate-200/80 flex items-center justify-between shrink-0 bg-white">
        <div class="flex items-center gap-2">
          <button id="cart-back-to-catalog" class="md:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer" title="Back to Catalog">
            <span>&larr;</span>
          </button>
          <span class="text-slate-800">${ICONS.cart}</span>
          <h3 class="font-semibold text-xs text-slate-900 uppercase tracking-wider">Active Order</h3>
          <span id="cart-header-count" class="text-xs text-slate-600 font-mono font-bold">(0)</span>
        </div>
        <button id="clear-cart-btn" class="text-xs text-slate-600 hover:text-rose-600 hover:bg-slate-50 px-2 py-1 rounded-md transition-colors cursor-pointer font-medium" title="Clear active cart">
          Clear
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
        <div id="cart-items-list" class="space-y-2"></div>

        <div id="cart-empty-state" class="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-6 text-slate-400">
          <div class="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-2.5">
            ${ICONS.cart}
          </div>
          <h4 class="text-xs font-semibold text-slate-700">Order is empty</h4>
          <p class="text-[11px] text-slate-500 mt-0.5 max-w-[190px]">
            Select products from the catalog or scan a barcode to begin.
          </p>
        </div>
      </div>

      <div class="p-3.5 sm:p-5 border-t border-slate-200/80 bg-slate-50/70 shrink-0 space-y-3">
        <div class="space-y-1 text-xs text-slate-600 font-medium">
          <div class="flex justify-between items-center">
            <span>Items Count</span>
            <span id="summary-items-count" class="font-mono text-slate-900 font-semibold">0</span>
          </div>
          <div class="flex justify-between items-center">
            <span>Subtotal</span>
            <span id="cart-subtotal" class="font-mono text-slate-900 font-semibold">₱0.00</span>
          </div>
          <div class="flex justify-between items-center text-[11px] text-slate-500">
            <span>Tax (Included)</span>
            <span class="font-mono">₱0.00</span>
          </div>
        </div>

        <div class="pt-2 border-t border-slate-200 flex justify-between items-baseline">
          <span class="text-xs font-bold text-slate-800 uppercase tracking-wider">Total</span>
          <span id="cart-total" class="text-xl font-black text-slate-900 font-mono tracking-tight">₱0.00</span>
        </div>

        <button id="checkout-btn" disabled class="w-full py-3 px-4 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white shadow-xs disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]">
          <span>${ICONS.check}</span>
          <span>Proceed to Checkout</span>
        </button>
      </div>
    `;
  }
}

customElements.define('pos-cart', PosCart);
