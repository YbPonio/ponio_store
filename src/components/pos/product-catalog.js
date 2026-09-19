import { inventoryService } from '../../services/inventory.service.js';
import { ICONS, emitEvent, showToast } from '../../utils/dom.js';
import '../common/price-checker-modal.js';

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
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
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
              this.updateCatalog();
            } else {
              showToast(`Item "${exactMatch.name}" is out of stock!`, 'warning');
            }
          }
        }
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
      return `
        <button data-category="${cat}" class="px-2.5 sm:px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer shrink-0 ${
          isSelected
            ? 'bg-slate-900 text-white shadow-2xs font-semibold'
            : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/90'
        }">
          ${cat}
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
    if (!grid) return;

    const filtered = this.getFilteredProducts();

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
    this.className = 'flex flex-col h-full overflow-hidden bg-slate-50 p-3 sm:p-5';
    this.innerHTML = `
      <div class="flex flex-col gap-2.5 mb-3 shrink-0">
        <div class="flex items-center gap-2">
          <div class="relative flex-1">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              ${ICONS.search}
            </span>
            <input
              id="product-search"
              type="text"
              placeholder="Search or scan barcode..."
              class="w-full pl-8 sm:pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200/90 text-sm sm:text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-800 shadow-2xs transition-all font-medium"
              autocomplete="off"
            />
          </div>

          <label class="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white px-2.5 py-2 rounded-xl border border-slate-200/90 cursor-pointer hover:bg-slate-50 shadow-2xs select-none shrink-0">
            <input type="checkbox" id="toggle-stock" class="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-3.5 h-3.5 accent-slate-900 cursor-pointer" />
            <span class="hidden sm:inline">In stock</span>
          </label>

          <button
            id="catalog-check-price-btn"
            type="button"
            class="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 px-3 py-2 rounded-xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer select-none shrink-0 active:scale-95"
            title="Scan barcode to check price"
          >
            <span>Check Price</span>
          </button>
        </div>

        <div id="category-pills" class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth"></div>
      </div>

      <div class="flex-1 overflow-y-auto pr-0.5 pb-16 md:pb-2">
        <div id="product-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-3"></div>

        <div id="catalog-empty" class="hidden h-56 flex flex-col items-center justify-center text-center p-6 text-slate-400">
          <div class="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-2.5 shadow-xs">
            ${ICONS.search}
          </div>
          <h4 class="text-xs font-semibold text-slate-700">No products found</h4>
          <p class="text-[11px] text-slate-500 mt-0.5 max-w-xs">
            Try adjusting your search query or selecting another category.
          </p>
        </div>
      </div>
      <price-checker-modal id="catalog-price-checker"></price-checker-modal>
    `;
  }
}

customElements.define('product-catalog', ProductCatalog);
