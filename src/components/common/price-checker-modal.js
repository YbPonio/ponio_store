import { inventoryService } from '../../services/inventory.service.js';
import { cartStore } from '../../store/cart.store.js';
import { formatCurrency } from '../../utils/formatters.js';
import { showToast, escapeHtml } from '../../utils/dom.js';
import './barcode-scanner-modal.js';
import './image-scanner-modal.js';

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
      <dialog id="price-checker-dialog" class="m-auto w-[92vw] sm:w-[440px] max-w-[440px] rounded-2xl bg-white border border-slate-200 text-slate-900 shadow-2xl overflow-hidden p-0 select-none">
        <div class="flex flex-col max-h-[90dvh]">
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
            <div>
              <h3 class="text-sm font-bold text-slate-900">Price &amp; Stock Checker</h3>
              <p class="text-xs text-slate-500 mt-0.5">Instant barcode lookup and inventory verification</p>
            </div>
            <button id="price-checker-close-btn" class="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer" title="Close">
              Close
            </button>
          </div>

          <div class="p-5 flex flex-col space-y-4 bg-white overflow-y-auto">
            <div class="flex items-center gap-2">
              <input
                id="price-checker-input"
                type="text"
                placeholder="Scan or enter barcode / SKU..."
                class="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs font-bold"
              />
              <button
                id="price-checker-search-btn"
                type="button"
                class="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition-colors shrink-0 shadow-xs"
              >
                Check
              </button>
              <button
                id="price-checker-scan-btn"
                type="button"
                class="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold cursor-pointer transition-colors shrink-0"
              >
                Scan
              </button>
              <button
                id="price-checker-photo-btn"
                type="button"
                class="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold cursor-pointer transition-colors shrink-0"
              >
                Photo
              </button>
            </div>

            <div id="price-checker-result-container" class="min-h-[160px] flex flex-col items-center justify-center">
              <div class="text-center text-slate-400 py-8">
                <div class="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-2.5 text-xs font-bold text-slate-600">
                  SCAN
                </div>
                <p class="text-xs font-bold text-slate-700">Scan barcode or match photo to check price</p>
                <p class="text-[11px] text-slate-400 mt-1">Press F3 anytime for quick access</p>
              </div>
            </div>
          </div>
        </div>
      </dialog>
      <barcode-scanner-modal id="price-checker-camera-scanner"></barcode-scanner-modal>
      <image-scanner-modal id="price-checker-image-scanner"></image-scanner-modal>
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

    const photoBtn = this.querySelector('#price-checker-photo-btn');
    const imageScanner = this.querySelector('#price-checker-image-scanner');
    if (photoBtn && imageScanner) {
      photoBtn.addEventListener('click', () => {
        imageScanner.open();
      });
      imageScanner.addEventListener('add-to-cart', (e) => {
        if (e.detail?.product) {
          const input = this.querySelector('#price-checker-input');
          if (input) input.value = e.detail.product.barcode || e.detail.product.id;
          this.renderProductCard(e.detail.product);
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
      <div class="py-10 flex flex-col items-center justify-center text-slate-500">
        <div class="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mb-2"></div>
        <p class="text-xs font-semibold">Searching catalog inventory...</p>
      </div>
    `;

    const products = await inventoryService.getProducts();
    const product = products.find(
      p => p.barcode === cleanCode || p.id === cleanCode || (p.barcode && p.barcode.endsWith(cleanCode))
    );

    this.currentProduct = product || null;

    if (product) {
      this.renderProductCard(product);
    } else {
      container.innerHTML = `
        <div class="w-full flex flex-col items-center text-center p-5 rounded-2xl bg-slate-50 border border-slate-200">
          <div class="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-3 text-xs font-black">
            404
          </div>

          <h4 class="text-sm font-bold text-slate-900 mb-1">Item Not Found</h4>
          <p class="text-xs text-slate-500 mb-2">No product found matching barcode number:</p>
          <div class="font-mono text-xs font-bold text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 mb-4 tabular-nums">
            #${escapeHtml(cleanCode)}
          </div>

          <div class="flex items-center gap-2 w-full">
            <button
              id="price-checker-scan-again-btn"
              type="button"
              class="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              Scan Another
            </button>
            <button
              id="price-checker-add-product-btn"
              type="button"
              class="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
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

  renderProductCard(product) {
    this.currentProduct = product;
    const container = this.querySelector('#price-checker-result-container');
    if (!container) return;

    const isOutOfStock = product.stock <= 0;
    const isLowStock = !isOutOfStock && product.stock <= (product.lowStockThreshold || 10);

    let stockBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    let stockDotClass = 'bg-emerald-500';
    let stockLabel = `${product.stock} units in stock`;

    if (isOutOfStock) {
      stockBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
      stockDotClass = 'bg-rose-500';
      stockLabel = 'Out of Stock';
    } else if (isLowStock) {
      stockBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
      stockDotClass = 'bg-amber-500';
      stockLabel = `Low stock: ${product.stock} units remaining`;
    }

    container.innerHTML = `
      <div class="w-full flex flex-col items-center text-center p-5 rounded-2xl bg-slate-50 border border-slate-200">
        <div class="w-20 h-20 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-3 shadow-2xs overflow-hidden">
          ${product.imageUrl ? `
            <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" class="w-full h-full object-contain p-1.5" onerror="this.parentElement.innerHTML='<span class=\\'text-base font-bold text-slate-700\\'>${escapeHtml((product.name || 'P').charAt(0).toUpperCase())}</span>'" />
          ` : `
            <span class="text-base font-bold text-slate-700">${escapeHtml((product.name || 'P').charAt(0).toUpperCase())}</span>
          `}
        </div>

        <span class="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Selling Price</span>
        <div class="text-3xl sm:text-4xl font-black font-mono text-emerald-700 tracking-tight mb-2 tabular-nums">
          ${formatCurrency(product.sellingPrice)}
        </div>

        <h4 class="text-sm font-bold text-slate-900 leading-snug max-w-xs mb-1">
          ${escapeHtml(product.name)}
        </h4>

        <div class="flex items-center gap-2 text-xs font-mono text-slate-500 mb-3">
          <span>SKU: ${escapeHtml(product.barcode || product.id)}</span>
          <span class="text-slate-300">/</span>
          <span class="font-sans font-semibold text-slate-700">${escapeHtml(product.category || 'General')}</span>
        </div>

        <div class="inline-flex items-center gap-1.5 text-xs py-1.5 px-3.5 rounded-full border ${stockBadgeClass} mb-4">
          <span class="w-1.5 h-1.5 rounded-full ${stockDotClass}"></span>
          <span>${stockLabel}</span>
        </div>

        <div class="flex items-center gap-2 w-full pt-1">
          <button
            id="price-checker-scan-again-btn"
            type="button"
            class="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Scan Another
          </button>
          <button
            id="price-checker-add-cart-btn"
            type="button"
            class="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer ${isOutOfStock ? 'opacity-40 cursor-not-allowed' : ''}"
            ${isOutOfStock ? 'disabled' : ''}
          >
            Add to Ticket
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
          showToast(`Added: ${product.name}`, 'success');
          this.close();
        } else {
          showToast(`Cannot add: max stock reached for ${product.name}`, 'warning');
        }
      });
    }
  }
}

customElements.define('price-checker-modal', PriceCheckerModal);
