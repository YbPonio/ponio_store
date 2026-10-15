import { cartStore } from '../../store/cart.store.js';
import { formatCurrency } from '../../utils/formatters.js';
import { showToast } from '../../utils/dom.js';

export class PosView extends HTMLElement {
  constructor() {
    super();
    this.activeMobileTab = 'catalog';
    this.unsubscribeCart = null;
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
    this.unsubscribeCart = cartStore.subscribe(() => {
      this.updateMobileBar();
    });
    this.updateMobileBar();
  }

  disconnectedCallback() {
    if (this.unsubscribeCart) {
      this.unsubscribeCart();
    }
  }

  setupListeners() {
    this.addEventListener('add-to-cart', (e) => {
      const product = e.detail?.product;
      if (product) {
        const added = cartStore.addItem(product, 1);
        if (added) {
          showToast(`Added: ${product.name}`, 'success', 1800);
        } else {
          showToast(`Max stock reached for ${product.name}`, 'warning', 2500);
        }
      }
    });

    this.addEventListener('open-checkout', (e) => {
      const checkoutComponent = this.querySelector('pos-checkout');
      if (checkoutComponent) {
        checkoutComponent.openCheckout(e.detail);
      }
    });

    this.addEventListener('switch-to-catalog', () => {
      this.setMobileTab('catalog');
    });

    const tabCatalogBtn = this.querySelector('#mobile-tab-catalog');
    const tabCartBtn = this.querySelector('#mobile-tab-cart');
    const floatingCartBar = this.querySelector('#mobile-floating-cart-bar');

    if (tabCatalogBtn) {
      tabCatalogBtn.addEventListener('click', () => this.setMobileTab('catalog'));
    }

    if (tabCartBtn) {
      tabCartBtn.addEventListener('click', () => this.setMobileTab('cart'));
    }

    if (floatingCartBar) {
      floatingCartBar.addEventListener('click', () => this.setMobileTab('cart'));
    }
  }

  setMobileTab(tab) {
    this.activeMobileTab = tab;
    const catalogSection = this.querySelector('#pos-catalog-section');
    const cartAside = this.querySelector('#pos-cart-aside');
    const tabCatalogBtn = this.querySelector('#mobile-tab-catalog');
    const tabCartBtn = this.querySelector('#mobile-tab-cart');

    if (tab === 'catalog') {
      if (catalogSection) catalogSection.classList.remove('hidden');
      if (cartAside) cartAside.classList.add('hidden');
      if (tabCatalogBtn) {
        tabCatalogBtn.className = 'flex-1 py-2 px-3 rounded-lg text-xs font-bold bg-slate-900 text-white shadow-xs transition-all text-center';
      }
      if (tabCartBtn) {
        tabCartBtn.className = 'flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all text-center flex items-center justify-center gap-1.5';
      }
    } else {
      if (catalogSection) catalogSection.classList.add('hidden');
      if (cartAside) cartAside.classList.remove('hidden');
      if (tabCatalogBtn) {
        tabCatalogBtn.className = 'flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all text-center';
      }
      if (tabCartBtn) {
        tabCartBtn.className = 'flex-1 py-2 px-3 rounded-lg text-xs font-bold bg-slate-900 text-white shadow-xs transition-all text-center flex items-center justify-center gap-1.5';
      }
    }

    this.updateMobileBar();
  }

  updateMobileBar() {
    const totalCount = cartStore.getTotalCount();
    const totalAmount = cartStore.getTotalAmount();
    const floatingBar = this.querySelector('#mobile-floating-cart-bar');
    const floatingCount = this.querySelector('#floating-cart-count');
    const floatingTotal = this.querySelector('#floating-cart-total');
    const tabCartCount = this.querySelector('#tab-cart-count');

    if (tabCartCount) {
      tabCartCount.textContent = totalCount;
      tabCartCount.classList.toggle('hidden', totalCount === 0);
    }

    if (floatingBar && floatingCount && floatingTotal) {
      floatingCount.textContent = `${totalCount} item${totalCount === 1 ? '' : 's'}`;
      floatingTotal.textContent = formatCurrency(totalAmount);

      const shouldShow = this.activeMobileTab === 'catalog' && totalCount > 0;
      floatingBar.classList.toggle('hidden', !shouldShow);
    }
  }

  render() {
    this.className = 'w-full h-full flex flex-col overflow-hidden bg-slate-100/70 relative';
    this.innerHTML = `
      <div class="md:hidden px-3 pt-2 pb-2 bg-white border-b border-slate-200 shrink-0">
        <div class="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
          <button id="mobile-tab-catalog" class="flex-1 py-2 px-3 rounded-lg text-xs font-bold bg-slate-900 text-white shadow-xs transition-all text-center cursor-pointer">
            Catalog
          </button>
          <button id="mobile-tab-cart" class="flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all text-center cursor-pointer flex items-center justify-center gap-1.5">
            <span>Ticket</span>
            <span id="tab-cart-count" class="hidden px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-bold font-mono">0</span>
          </button>
        </div>
      </div>

      <div class="flex-1 flex flex-col md:flex-row h-full overflow-hidden relative">
        <section id="pos-catalog-section" class="flex-1 h-full overflow-hidden flex flex-col min-w-0" aria-label="Product Catalog">
          <product-catalog class="flex-1 h-full overflow-hidden"></product-catalog>
        </section>

        <aside id="pos-cart-aside" class="hidden md:flex w-full md:w-88 lg:w-96 xl:w-[410px] h-full shrink-0 flex-col border-l border-slate-200 bg-white" aria-label="Active Order Cart">
          <pos-cart class="h-full"></pos-cart>
        </aside>
      </div>

      <div id="mobile-floating-cart-bar" class="hidden md:hidden absolute bottom-3 inset-x-3 z-30 py-3 px-4 rounded-2xl bg-slate-900 text-white shadow-xl flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all border border-slate-800">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xs font-bold font-mono">
            PHP
          </div>
          <div>
            <div id="floating-cart-count" class="text-xs font-semibold text-slate-300">0 items</div>
            <div id="floating-cart-total" class="text-sm font-mono font-black text-white tabular-nums">PHP 0.00</div>
          </div>
        </div>
        <div class="flex items-center gap-1.5 text-xs font-bold text-white bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
          <span>Review Order</span>
        </div>
      </div>

      <pos-checkout></pos-checkout>
    `;
  }
}

customElements.define('pos-view', PosView);
