import { inventoryService } from '../../services/inventory.service.js';
import { cartStore } from '../../store/cart.store.js';
import { formatCurrency } from '../../utils/formatters.js';
import { ICONS, showToast, escapeHtml } from '../../utils/dom.js';
import './barcode-scanner-modal.js';

export class PriceCheckerModal extends HTMLElement {
  constructor() {
    super();
    this.dialog = null;
    this.currentProduct = null;
    this.lastScannedBarcode = '';
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.innerHTML = `
      <dialog id="price-checker-dialog" class="m-auto w-[88vw] sm:w-[420px] max-w-[420px] rounded-2xl bg-white border border-slate-200 text-slate-900 shadow-2xl overflow-hidden p-0 select-none" style="max-width: 420px;">
        <div class="flex flex-col max-h-[90dvh]">
          <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
            <div>
              <h3 class="text-xs sm:text-sm font-bold text-slate-900">Price Checker</h3>
              <p class="text-[11px] text-slate-500 mt-0.5">Check inventory price and current stock</p>
            </div>
            <button id="price-checker-close-btn" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer" title="Close price checker">
              ${ICONS.x}
            </button>
          </div>

          <div class="p-4 sm:p-5 flex flex-col space-y-4 bg-white overflow-y-auto">
            <div class="flex items-center gap-2">
              <input
                id="price-checker-input"
                type="text"
                placeholder="Scan or enter barcode / SKU..."
                class="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-800 shadow-2xs font-medium"
              />
              <button
                id="price-checker-search-btn"
                type="button"
                class="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer transition-colors shrink-0"
              >
                Check
              </button>
              <button
                id="price-checker-scan-btn"
                type="button"
                class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold cursor-pointer transition-colors shrink-0"
              >
                Scan
              </button>
            </div>

            <div id="price-checker-result-container" class="min-h-[140px] flex flex-col items-center justify-center">
              <div class="text-center text-slate-400 py-6">
                <div class="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-2 text-slate-500">
                  ${ICONS.search}
                </div>
                <p class="text-xs font-semibold text-slate-600">Scan barcode to check price</p>
                <p class="text-[11px] text-slate-400 mt-0.5">Click Scan to start camera or enter barcode</p>
              </div>
            </div>
          </div>
        </div>
      </dialog>
      <barcode-scanner-modal id="price-checker-camera-scanner"></barcode-scanner-modal>
    `;

    this.dialog = this.querySelector('#price-checker-dialog');
    const closeBtn = this.querySelector('#price-checker-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    const scanBtn = this.querySelector('#price-checker-scan-btn');
    const scanner = this.querySelector('#price-checker-camera-scanner');

    if (scanBtn && scanner) {
      scanBtn.addEventListener('click', () => {
        scanner.open();
      });

      scanner.addEventListener('barcode-scanned', (e) => {
        const { barcode } = e.detail;
        if (barcode) {
          const input = this.querySelector('#price-checker-input');
          if (input) input.value = barcode;
          this.checkBarcode(barcode);
        }
      });
    }

    const input = this.querySelector('#price-checker-input');
    const searchBtn = this.querySelector('#price-checker-search-btn');

    if (searchBtn && input) {
      searchBtn.addEventListener('click', () => {
        const code = input.value.trim();
        if (code) {
          this.checkBarcode(code);
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const code = input.value.trim();
          if (code) {
            this.checkBarcode(code);
          }
        }
      });
    }

    this.dialog.addEventListener('click', (e) => {
      const rect = this.dialog.getBoundingClientRect();
      const inDialog = (
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width
      );
      if (!inDialog) {
        this.close();
      }
    });
  }

  open(autoScan = false) {
    if (!this.dialog) this.render();
    this.dialog.showModal();

    const input = this.querySelector('#price-checker-input');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 100);
    }

    if (autoScan) {
      const scanner = this.querySelector('#price-checker-camera-scanner');
      if (scanner) {
        scanner.open();
      }
    }
  }

  close() {
    if (this.dialog && this.dialog.open) {
      this.dialog.close();
    }
  }

  async checkBarcode(barcode) {
    const cleanCode = String(barcode || '').trim();
    if (!cleanCode) return;

    this.lastScannedBarcode = cleanCode;
    const container = this.querySelector('#price-checker-result-container');
    if (!container) return;

    container.innerHTML = `
      <div class="py-8 flex flex-col items-center justify-center text-slate-500">
        <div class="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mb-2"></div>
        <p class="text-xs font-semibold">Searching inventory...</p>
      </div>
    `;

    const products = await inventoryService.getProducts();
    const product = products.find(
      p => p.barcode === cleanCode || p.id === cleanCode || (p.barcode && p.barcode.endsWith(cleanCode))
    );

    this.currentProduct = product || null;

    if (product) {
      const isOutOfStock = product.stock <= 0;
      const isLowStock = !isOutOfStock && product.stock <= (product.lowStockThreshold || 10);

      let stockBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      let stockLabel = `${product.stock} units in stock`;

      if (isOutOfStock) {
        stockBadgeClass = 'bg-rose-50 text-rose-800 border-rose-200 font-semibold';
        stockLabel = 'Out of stock';
      } else if (isLowStock) {
        stockBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200 font-semibold';
        stockLabel = `Low stock: ${product.stock} units remaining`;
      }

      container.innerHTML = `
        <div class="w-full flex flex-col items-center text-center p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div class="w-20 h-20 rounded-xl bg-white border border-slate-200 flex items-center justify-center mb-3 shadow-2xs overflow-hidden">
            ${product.imageUrl ? `
              <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" class="w-full h-full object-contain p-1" onerror="this.parentElement.innerHTML='<span class=\\'text-base font-bold text-slate-700\\'>${escapeHtml((product.name || 'P').charAt(0).toUpperCase())}</span>'" />
            ` : `
              <span class="text-base font-bold text-slate-700">${escapeHtml((product.name || 'P').charAt(0).toUpperCase())}</span>
            `}
          </div>

          <span class="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">Selling Price</span>
          <div class="text-3xl sm:text-4xl font-black font-mono text-slate-900 tracking-tight mb-2">
            ${formatCurrency(product.sellingPrice)}
          </div>

          <h4 class="text-sm font-bold text-slate-900 leading-snug max-w-xs mb-1">
            ${escapeHtml(product.name)}
          </h4>

          <div class="flex items-center gap-2 text-xs font-mono text-slate-500 mb-2">
            <span>SKU: ${escapeHtml(product.barcode || product.id)}</span>
            <span>&bull;</span>
            <span class="font-sans font-medium text-slate-600">${escapeHtml(product.category || 'General')}</span>
          </div>

          <div class="w-full text-xs py-1.5 px-3 rounded-lg border text-center ${stockBadgeClass} mb-4">
            ${stockLabel}
          </div>

          <div class="flex items-center gap-2 w-full pt-1">
            <button
              id="price-checker-scan-again-btn"
              type="button"
              class="flex-1 py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Scan Another
            </button>
            <button
              id="price-checker-add-cart-btn"
              type="button"
              class="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''}"
              ${isOutOfStock ? 'disabled' : ''}
            >
              Add to Cart
            </button>
          </div>
        </div>
      `;

      const scanAgainBtn = container.querySelector('#price-checker-scan-again-btn');
      if (scanAgainBtn) {
        scanAgainBtn.addEventListener('click', () => {
          const scanner = this.querySelector('#price-checker-camera-scanner');
          if (scanner) scanner.open();
        });
      }

      const addCartBtn = container.querySelector('#price-checker-add-cart-btn');
      if (addCartBtn && !isOutOfStock) {
        addCartBtn.addEventListener('click', () => {
          const added = cartStore.addItem(product, 1);
          if (added) {
            showToast(`Added "${product.name}" to cart`, 'success');
            this.close();
          } else {
            showToast(`Cannot add "${product.name}". Max stock reached!`, 'warning');
          }
        });
      }
    } else {
      container.innerHTML = `
        <div class="w-full flex flex-col items-center text-center p-5 rounded-xl bg-slate-50 border border-slate-200">
          <div class="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-3 text-lg font-bold">
            !
          </div>

          <h4 class="text-sm font-bold text-slate-900 mb-1">Item Not in Inventory</h4>
          <p class="text-xs text-slate-500 mb-2">No product found matching barcode:</p>
          <div class="font-mono text-xs font-bold text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200 mb-4">
            #${escapeHtml(cleanCode)}
          </div>

          <div class="flex items-center gap-2 w-full">
            <button
              id="price-checker-scan-again-btn"
              type="button"
              class="flex-1 py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Scan Another
            </button>
            <button
              id="price-checker-add-product-btn"
              type="button"
              class="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              Add Product
            </button>
          </div>
        </div>
      `;

      const scanAgainBtn = container.querySelector('#price-checker-scan-again-btn');
      if (scanAgainBtn) {
        scanAgainBtn.addEventListener('click', () => {
          const scanner = this.querySelector('#price-checker-camera-scanner');
          if (scanner) scanner.open();
        });
      }

      const addProductBtn = container.querySelector('#price-checker-add-product-btn');
      if (addProductBtn) {
        addProductBtn.addEventListener('click', () => {
          this.close();
          const productForm = document.querySelector('product-form');
          if (productForm) {
            productForm.open(null, { barcode: cleanCode });
          } else {
            window.location.hash = '#/inventory';
            setTimeout(() => {
              const form = document.querySelector('product-form');
              if (form) form.open(null, { barcode: cleanCode });
            }, 300);
          }
        });
      }
    }
  }
}

customElements.define('price-checker-modal', PriceCheckerModal);
