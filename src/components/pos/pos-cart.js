import { cartStore } from '../../store/cart.store.js';
import { formatCurrency } from '../../utils/formatters.js';
import { emitEvent, escapeHtml, confirmDialog } from '../../utils/dom.js';

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
          title: 'Clear Active Ticket',
          message: 'Are you sure you want to remove all items from the current order?',
          confirmText: 'Clear All',
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
    if (headerCount) headerCount.textContent = totalCount;

    const itemsSummaryCount = this.querySelector('#summary-items-count');
    if (itemsSummaryCount) itemsSummaryCount.textContent = `${totalCount} item${totalCount === 1 ? '' : 's'}`;

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
      <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all select-none" data-product-id="${item.productId}">
        <div class="flex-1 min-w-0 pr-2">
          <h5 class="text-xs font-bold text-slate-900 truncate">
            ${escapeHtml(item.name)}
          </h5>
          <div class="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-mono">
            <span class="text-slate-800 font-semibold tabular-nums">${formatCurrency(item.sellingPrice)}</span>
            <span>x</span>
            <span class="text-emerald-700 font-bold">${item.quantity}</span>
            <span class="text-[10px] text-slate-400">(${item.maxStock} in stock)</span>
          </div>
        </div>

        <div class="flex items-center gap-1 bg-white px-1.5 py-1 rounded-lg border border-slate-200 mr-2 shadow-2xs">
          <button class="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer qty-btn-minus active:scale-95 text-xs font-bold font-mono" title="Decrease">
            -
          </button>
          <span class="w-7 text-center font-bold text-xs font-mono text-slate-900 tabular-nums">${item.quantity}</span>
          <button class="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer qty-btn-plus active:scale-95 text-xs font-bold font-mono ${item.quantity >= item.maxStock ? 'opacity-30 cursor-not-allowed' : ''}" title="Increase" ${item.quantity >= item.maxStock ? 'disabled' : ''}>
            +
          </button>
        </div>

        <div class="flex items-center gap-2 text-right">
          <div class="font-mono font-bold text-xs text-slate-900 tabular-nums">
            ${formatCurrency(item.subtotal)}
          </div>
          <button class="px-1.5 py-1 rounded text-[11px] font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer remove-item-btn" title="Remove item">
            Del
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
    this.className = 'flex flex-col h-full bg-white overflow-hidden';
    this.innerHTML = `
      <div class="h-14 px-4 sm:px-5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
        <div class="flex items-center gap-2">
          <button id="cart-back-to-catalog" class="md:hidden px-2 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer">
            Catalog
          </button>
          <div class="flex items-center gap-1.5">
            <h3 class="font-black text-xs text-slate-900 uppercase tracking-wider">Active Ticket</h3>
            <span id="cart-header-count" class="px-1.5 py-0.2 rounded-full bg-slate-900 text-white text-[10px] font-mono font-bold">0</span>
          </div>
        </div>
        <button id="clear-cart-btn" class="text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-md transition-colors cursor-pointer font-semibold" title="Clear active cart">
          Clear
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
        <div id="cart-items-list" class="space-y-2"></div>

        <div id="cart-empty-state" class="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 text-slate-400">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 mb-2.5">
            POS
          </div>
          <h4 class="text-xs font-bold text-slate-700">Ticket is empty</h4>
          <p class="text-[11px] text-slate-500 mt-1 max-w-[210px] leading-relaxed">
            Click any product card or press F2 to search or scan a barcode to add items.
          </p>
        </div>
      </div>

      <div class="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 shrink-0 space-y-3.5">
        <div class="space-y-1.5 text-xs text-slate-600 font-medium">
          <div class="flex justify-between items-center">
            <span>Total Units</span>
            <span id="summary-items-count" class="font-mono text-slate-900 font-bold tabular-nums">0 items</span>
          </div>
          <div class="flex justify-between items-center">
            <span>Subtotal</span>
            <span id="cart-subtotal" class="font-mono text-slate-900 font-bold tabular-nums">PHP 0.00</span>
          </div>
          <div class="flex justify-between items-center text-[11px] text-slate-500">
            <span>Value Added Tax (Included)</span>
            <span class="font-mono font-medium">PHP 0.00</span>
          </div>
        </div>

        <div class="pt-3 border-t border-slate-200 flex justify-between items-baseline">
          <span class="text-xs font-black text-slate-800 uppercase tracking-wider">Total Due</span>
          <span id="cart-total" class="text-2xl font-black text-slate-900 font-mono tracking-tight tabular-nums">PHP 0.00</span>
        </div>

        <button id="checkout-btn" disabled class="w-full py-3.5 px-4 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]">
          <span>Proceed to Payment</span>
        </button>
      </div>
    `;
  }
}

customElements.define('pos-cart', PosCart);
