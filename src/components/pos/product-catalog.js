import { inventoryService } from '../../services/inventory.service.js';
import { emitEvent, showToast } from '../../utils/dom.js';
import '../common/price-checker-modal.js';
import '../common/image-scanner-modal.js';

export class ProductCatalog extends HTMLElement {
  constructor() {
    super();
    this.products = [];
    this.selectedCategory = 'All';
    this.searchQuery = '';
    this.hideOutOfStock = false;
    this.unsubscribeInventory = null;
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
    this.unsubscribeInventory = inventoryService.subscribeProducts((products) => {
      this.products = products.filter(p => p.isActive !== false);
      this.updateCatalog();
    });
  }

  disconnectedCallback() {
    if (this.unsubscribeInventory) {
      this.unsubscribeInventory();
    }
  }

  setupListeners() {
    const searchInput = this.querySelector('#product-search');
    const clearSearchBtn = this.querySelector('#clear-search-btn');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        if (clearSearchBtn) {
          clearSearchBtn.classList.toggle('hidden', !this.searchQuery);
        }
        this.updateCatalog();
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const query = searchInput.value.trim();
          if (!query) return;

          const exactMatch = this.products.find(
            p => p.barcode === query || p.id === query
          );

          if (exactMatch) {
            if (exactMatch.stock > 0) {
              emitEvent(this, 'add-to-cart', { product: exactMatch });
              showToast(`Scanned: ${exactMatch.name}`, 'success');
              searchInput.value = '';
              this.searchQuery = '';
              if (clearSearchBtn) clearSearchBtn.classList.add('hidden');
              this.updateCatalog();
            } else {
              showToast(`Item "${exactMatch.name}" is out of stock!`, 'warning');
            }
          }
        }
      });
    }

    if (clearSearchBtn && searchInput) {
      clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.searchQuery = '';
        clearSearchBtn.classList.add('hidden');
        searchInput.focus();
        this.updateCatalog();
      });
    }

    const stockToggle = this.querySelector('#toggle-stock');
    if (stockToggle) {
      stockToggle.addEventListener('change', (e) => {
        this.hideOutOfStock = e.target.checked;
        this.updateCatalog();
      });
    }

    const priceBtn = this.querySelector('#catalog-check-price-btn');
    const priceChecker = this.querySelector('#catalog-price-checker');
    if (priceBtn && priceChecker) {
      priceBtn.addEventListener('click', () => {
        priceChecker.open(true);
      });
    }

    const visualBtn = this.querySelector('#catalog-visual-match-btn');
    const imageScanner = this.querySelector('#catalog-image-scanner');
    if (visualBtn && imageScanner) {
      visualBtn.addEventListener('click', () => {
        imageScanner.open();
      });
    }
  }

  getCategories() {
    const cats = new Set(this.products.map(p => p.category).filter(Boolean));
    return ['All', ...Array.from(cats).sort()];
  }

  updateCategoryPills() {
    const container = this.querySelector('#category-pills');
    if (!container) return;

    const categories = this.getCategories();
    container.innerHTML = categories.map(cat => {
      const isSelected = this.selectedCategory === cat;
      const count = cat === 'All' 
        ? this.products.length 
        : this.products.filter(p => p.category === cat).length;

      return `
        <button data-category="${cat}" class="px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1.5 select-none ${
          isSelected
            ? 'bg-slate-900 text-white shadow-xs font-semibold'
            : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 font-medium'
        }">
          <span>${cat}</span>
          <span class="text-[10px] font-mono px-1 py-0.2 rounded ${
            isSelected ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'
          }">${count}</span>
        </button>
      `;
    }).join('');

    container.querySelectorAll('button[data-category]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedCategory = btn.getAttribute('data-category');
        this.updateCategoryPills();
        this.updateCatalog();
      });
    });
  }

  getFilteredProducts() {
    return this.products.filter(p => {
      const matchesCategory = this.selectedCategory === 'All' || p.category === this.selectedCategory;
      const matchesSearch = !this.searchQuery ||
        (p.name && p.name.toLowerCase().includes(this.searchQuery)) ||
        (p.barcode && p.barcode.toLowerCase().includes(this.searchQuery)) ||
        (p.category && p.category.toLowerCase().includes(this.searchQuery));
      const matchesStock = !this.hideOutOfStock || p.stock > 0;

      return matchesCategory && matchesSearch && matchesStock;
    });
  }

  updateCatalog() {
    this.updateCategoryPills();

    const grid = this.querySelector('#product-grid');
    const emptyState = this.querySelector('#catalog-empty');
    const resultCountEl = this.querySelector('#catalog-result-count');
    if (!grid) return;

    const filtered = this.getFilteredProducts();

    if (resultCountEl) {
      resultCountEl.textContent = `${filtered.length} products found`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    grid.innerHTML = '';

    filtered.forEach(prod => {
      const card = document.createElement('product-card');
      card.setProduct(prod);
      grid.appendChild(card);
    });
  }

  render() {
    this.className = 'flex flex-col h-full overflow-hidden bg-slate-100/60 p-3 sm:p-5';
    this.innerHTML = `
      <div class="flex flex-col gap-3 mb-3.5 shrink-0">
        <div class="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <div class="relative flex-1 min-w-[200px]">
            <input
              id="product-search"
              type="text"
              placeholder="Search by name, SKU, or scan barcode..."
              class="w-full pl-3 pr-16 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs font-medium"
              autocomplete="off"
            />
            <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button id="clear-search-btn" type="button" class="hidden px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
                Clear
              </button>
              <span class="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                F2
              </span>
            </div>
          </div>

          <label class="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-white px-3 py-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 shadow-2xs select-none shrink-0">
            <input type="checkbox" id="toggle-stock" class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 accent-emerald-600 cursor-pointer" />
            <span>In Stock Only</span>
          </label>

          <button
            id="catalog-check-price-btn"
            type="button"
            class="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer select-none shrink-0 active:scale-95"
            title="Scan barcode to check price (F3)"
          >
            <span>Price Check</span>
            <span class="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-100 text-slate-500 border border-slate-200">F3</span>
          </button>

          <button
            id="catalog-visual-match-btn"
            type="button"
            class="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer select-none shrink-0 active:scale-95"
            title="Visual product match by photo or camera (F7)"
          >
            <span>Visual Match</span>
            <span class="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-100 text-slate-500 border border-slate-200">F7</span>
          </button>
        </div>

        <div class="flex items-center justify-between gap-2">
          <div id="category-pills" class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth flex-1"></div>
          <span id="catalog-result-count" class="hidden sm:inline-block text-[11px] font-medium text-slate-500 whitespace-nowrap pl-2">0 products</span>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto pr-1 pb-16 md:pb-2">
        <div id="product-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-3.5"></div>

        <div id="catalog-empty" class="hidden min-h-[260px] flex flex-col items-center justify-center text-center p-8 text-slate-400 bg-white rounded-2xl border border-slate-200 mt-2">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 mb-3">
            0
          </div>
          <h4 class="text-sm font-bold text-slate-800">No matching products</h4>
          <p class="text-xs text-slate-500 mt-1 max-w-sm">
            Try adjusting your search terms, clearing filters, or verifying product inventory.
          </p>
        </div>
      </div>

      <price-checker-modal id="catalog-price-checker"></price-checker-modal>
      <image-scanner-modal id="catalog-image-scanner"></image-scanner-modal>
    `;
  }
}

customElements.define('product-catalog', ProductCatalog);
