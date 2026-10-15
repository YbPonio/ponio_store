import { inventoryService } from '../../services/inventory.service.js';
import { formatCurrency, formatDateTime } from '../../utils/formatters.js';
import { escapeHtml, showToast, confirmDialog } from '../../utils/dom.js';
import '../common/barcode-scanner-modal.js';
import '../common/image-scanner-modal.js';
import '../common/price-checker-modal.js';
import '../common/data-table.js';
import '../common/app-modal.js';
import './product-form.js';
import './stock-adjust.js';

export class InventoryView extends HTMLElement {
  constructor() {
    super();
    this.products = [];
    this.unsubscribe = null;
    this.selectedCategory = 'All';
    this.stockFilter = 'all';
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
    this.unsubscribe = inventoryService.subscribeProducts((products) => {
      this.products = products;
      this.updateView();
    });
  }

  disconnectedCallback() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  setupListeners() {
    const scanBtn = this.querySelector('#scan-barcode-btn');
    const inventoryScanner = this.querySelector('#inventory-barcode-scanner');
    if (scanBtn && inventoryScanner) {
      scanBtn.addEventListener('click', () => {
        inventoryScanner.open();
      });

      inventoryScanner.addEventListener('barcode-scanned', (e) => {
        const { barcode, productInfo } = e.detail;
        const form = this.querySelector('product-form');
        if (form) {
          form.open(null, {
            barcode,
            name: productInfo?.name || '',
            category: productInfo?.category || 'General',
            imageUrl: productInfo?.imageUrl || '',
            sellingPrice: productInfo?.sellingPrice || 0,
          });
        }
      });
    }

    const priceBtn = this.querySelector('#inventory-check-price-btn');
    const priceChecker = this.querySelector('#inventory-price-checker');
    if (priceBtn && priceChecker) {
      priceBtn.addEventListener('click', () => {
        priceChecker.open(true);
      });
    }

    const visualBtn = this.querySelector('#inventory-visual-match-btn');
    const visualScanner = this.querySelector('#inventory-visual-scanner');
    if (visualBtn && visualScanner) {
      visualBtn.addEventListener('click', () => {
        visualScanner.open();
      });
      visualScanner.addEventListener('add-to-cart', (e) => {
        const prod = e.detail?.product;
        if (prod) {
          const form = this.querySelector('product-form');
          if (form) form.open(prod);
        }
      });
    }

    const addBtn = this.querySelector('#add-product-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const form = this.querySelector('product-form');
        if (form) form.open();
      });
    }

    const logsBtn = this.querySelector('#view-audit-logs-btn');
    if (logsBtn) {
      logsBtn.addEventListener('click', () => this.showAuditLogsModal());
    }

    const searchInput = this.querySelector('#inventory-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const dataTable = this.querySelector('data-table');
        if (dataTable) {
          dataTable.setSearchQuery(e.target.value);
        }
      });
    }

    const catSelect = this.querySelector('#filter-category');
    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        this.selectedCategory = e.target.value;
        this.updateTableData();
      });
    }

    const stockFilterSelect = this.querySelector('#filter-stock-level');
    if (stockFilterSelect) {
      stockFilterSelect.addEventListener('change', (e) => {
        this.stockFilter = e.target.value;
        this.updateTableData();
      });
    }

    const table = this.querySelector('data-table');
    if (table) {
      table.addEventListener('click', async (e) => {
        const adjustBtn = e.target.closest('[data-action="adjust"]');
        const deleteBtn = e.target.closest('[data-action="delete"]');
        const editBtn = e.target.closest('[data-action="edit"]');
        const row = e.target.closest('tr[data-row-id], tr');
        const rowActions = e.target.closest('[data-row-actions]');

        const prodId = rowActions?.getAttribute('data-row-actions') || row?.getAttribute('data-row-id');
        const product = prodId ? this.products.find(p => String(p.id) === String(prodId) || String(p.barcode) === String(prodId)) : null;

        if (adjustBtn) {
          e.stopPropagation();
          if (product) {
            const adjustComponent = this.querySelector('stock-adjust');
            if (adjustComponent) adjustComponent.open(product);
          }
          return;
        }

        if (deleteBtn) {
          e.stopPropagation();
          if (product) {
            const confirmed = await confirmDialog({
              title: 'Delete Product',
              message: `Are you sure you want to delete "${product.name}"? This action cannot be undone.`,
              confirmText: 'Delete Item',
              cancelText: 'Cancel',
              isDestructive: true,
            });
            if (confirmed) {
              await inventoryService.deleteProduct(product.id || prodId);
              showToast(`Deleted: ${product.name}`, 'info');
            }
          }
          return;
        }

        if (editBtn) {
          e.stopPropagation();
          if (product) {
            const form = this.querySelector('product-form');
            if (form) form.open(product);
          }
          return;
        }

        if (row && product && !e.target.closest('button, a, input, select, th')) {
          const form = this.querySelector('product-form');
          if (form) form.open(product);
        }
      });
    }
  }

  updateMetrics() {
    const totalSKUs = this.products.length;
    const lowStockItems = this.products.filter(p => p.stock > 0 && p.stock <= (p.lowStockThreshold || 10));
    const outOfStockItems = this.products.filter(p => p.stock <= 0);
    const totalValuation = this.products.reduce((sum, p) => sum + ((p.costPrice || 0) * (p.stock || 0)), 0);
    const totalRetailVal = this.products.reduce((sum, p) => sum + ((p.sellingPrice || 0) * (p.stock || 0)), 0);
    const alertCount = lowStockItems.length + outOfStockItems.length;

    const mSKU = this.querySelector('#metric-total-skus');
    if (mSKU) mSKU.textContent = totalSKUs;

    const mLow = this.querySelector('#metric-low-stock');
    const mLowBadge = this.querySelector('#metric-low-stock-badge');
    if (mLow) {
      mLow.textContent = alertCount;
      mLow.className = alertCount > 0 ? 'text-2xl font-black font-mono text-amber-700 tabular-nums' : 'text-2xl font-black font-mono text-slate-900 tabular-nums';
    }
    if (mLowBadge) {
      if (alertCount > 0) {
        mLowBadge.textContent = 'Attention Needed';
        mLowBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200';
      } else {
        mLowBadge.textContent = 'Healthy';
        mLowBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200';
      }
    }

    const mCost = this.querySelector('#metric-inventory-cost');
    if (mCost) mCost.textContent = formatCurrency(totalValuation);

    const mRetail = this.querySelector('#metric-inventory-retail');
    if (mRetail) mRetail.textContent = formatCurrency(totalRetailVal);

    const mMarginBadge = this.querySelector('#metric-margin-badge');
    if (mMarginBadge) {
      const margin = totalRetailVal > 0 ? (((totalRetailVal - totalValuation) / totalRetailVal) * 100).toFixed(0) : '0';
      mMarginBadge.textContent = `${margin}% est. margin`;
    }
  }

  getFilteredProducts() {
    return this.products.filter(p => {
      const matchCat = this.selectedCategory === 'All' || p.category === this.selectedCategory;
      let matchStock = true;
      if (this.stockFilter === 'low') {
        matchStock = p.stock > 0 && p.stock <= (p.lowStockThreshold || 10);
      } else if (this.stockFilter === 'out') {
        matchStock = p.stock <= 0;
      }
      return matchCat && matchStock;
    });
  }

  updateCategoryDropdown() {
    const select = this.querySelector('#filter-category');
    if (!select) return;
    const cats = ['All', ...Array.from(new Set(this.products.map(p => p.category).filter(Boolean))).sort()];
    const current = this.selectedCategory;
    select.innerHTML = cats.map(c => `
      <option value="${c}" ${c === current ? 'selected' : ''}>${c === 'All' ? 'All Categories' : c}</option>
    `).join('');
  }

  updateTableData() {
    const table = this.querySelector('data-table');
    if (!table) return;

    const filtered = this.getFilteredProducts();
    table.setData(filtered);
  }

  updateView() {
    this.updateMetrics();
    this.updateCategoryDropdown();
    this.setupTableConfig();
    this.updateTableData();
  }

  setupTableConfig() {
    const table = this.querySelector('data-table');
    if (!table || table.columns.length > 0) return;

    const columns = [
      {
        key: 'name',
        label: 'Product & SKU',
        render: (row) => `
          <div class="flex items-center gap-3">
            ${row.imageUrl ? `
              <img src="${escapeHtml(row.imageUrl)}" alt="${escapeHtml(row.name)}" class="w-9 h-9 rounded-xl object-contain border border-slate-200 bg-white p-0.5 shrink-0" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
              <div class="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 items-center justify-center font-bold text-xs text-slate-700 shrink-0 hidden">
                ${escapeHtml((row.name || 'P').charAt(0).toUpperCase())}
              </div>
            ` : `
              <div class="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                ${escapeHtml((row.name || 'P').charAt(0).toUpperCase())}
              </div>
            `}
            <div class="min-w-0">
              <div class="font-bold text-slate-900 truncate">${escapeHtml(row.name)}</div>
              <div class="text-[10px] font-mono text-slate-400">SKU: ${escapeHtml(row.barcode || row.id)}</div>
            </div>
          </div>
        `
      },
      {
        key: 'category',
        label: 'Category',
        render: (row) => `
          <span class="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
            ${escapeHtml(row.category || 'General')}
          </span>
        `
      },
      {
        key: 'costPrice',
        label: 'Cost',
        render: (row) => `<span class="font-mono text-slate-500 tabular-nums">${row.costPrice !== null && row.costPrice !== undefined ? formatCurrency(row.costPrice) : '—'}</span>`
      },
      {
        key: 'sellingPrice',
        label: 'Price',
        render: (row) => `<span class="font-mono font-bold text-slate-900 tabular-nums">${formatCurrency(row.sellingPrice)}</span>`
      },
      {
        key: 'stock',
        label: 'Stock Level',
        render: (row) => {
          const isOut = row.stock <= 0;
          const isLow = !isOut && row.stock <= (row.lowStockThreshold || 10);
          let badge = 'bg-emerald-50 text-emerald-800 border-emerald-200';
          let dot = 'bg-emerald-500';
          let label = `${row.stock} in stock`;

          if (isOut) {
            badge = 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
            dot = 'bg-rose-500';
            label = '0 (Out of stock)';
          } else if (isLow) {
            badge = 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
            dot = 'bg-amber-500';
            label = `${row.stock} (Low Stock)`;
          }

          return `
            <span class="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-full border ${badge} tabular-nums">
              <span class="w-1.5 h-1.5 rounded-full ${dot}"></span>
              <span>${label}</span>
            </span>
          `;
        }
      },
      {
        key: 'margin',
        label: 'Gross Margin',
        render: (row) => {
          if (!row.sellingPrice || !row.costPrice) {
            return `<span class="text-slate-400 font-mono text-[11px]">—</span>`;
          }
          const margin = (((row.sellingPrice - row.costPrice) / row.sellingPrice) * 100).toFixed(0);
          const isHealthy = Number(margin) >= 30;
          return `
            <span class="font-mono text-[11px] font-bold px-2 py-0.5 rounded ${isHealthy ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'} tabular-nums">
              ${margin}%
            </span>
          `;
        }
      },
      {
        key: 'actions',
        label: 'Actions',
        sortable: false,
        render: (row) => `
          <div class="flex items-center gap-1.5" data-row-actions="${escapeHtml(row.id || row.barcode)}">
            <button type="button" data-action="adjust" class="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-colors cursor-pointer active:scale-95" title="Adjust Stock">
              Adjust
            </button>
            <button type="button" data-action="edit" class="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-colors cursor-pointer active:scale-95" title="Edit Product">
              Edit
            </button>
            <button type="button" data-action="delete" class="px-2 py-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer active:scale-95" title="Delete Product">
              Del
            </button>
          </div>
        `
      }
    ];

    table.setConfig(columns, this.getFilteredProducts());
  }

  async showAuditLogsModal() {
    const modal = this.querySelector('#audit-logs-modal');
    if (!modal) return;

    const logs = await inventoryService.getStockLogs();
    const content = document.createElement('div');
    content.className = 'space-y-3';

    if (logs.length === 0) {
      content.innerHTML = `
        <div class="py-12 text-center text-slate-400 text-xs font-medium">No stock adjustment movements recorded yet.</div>
      `;
    } else {
      content.innerHTML = `
        <div class="overflow-x-auto max-h-96 rounded-xl border border-slate-200 bg-white">
          <table class="w-full text-left text-xs divide-y divide-slate-100">
            <thead class="text-slate-500 uppercase font-bold text-[10px] bg-slate-50 tracking-wider">
              <tr>
                <th class="py-2.5 px-3">Date</th>
                <th class="py-2.5 px-3">Type</th>
                <th class="py-2.5 px-3">Quantity</th>
                <th class="py-2.5 px-3">Movement</th>
                <th class="py-2.5 px-3">Reason / Details</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-mono text-slate-700">
              ${logs.map(log => {
                const product = this.products.find(p => p.id === log.productId);
                const prodName = product ? product.name : log.productId;
                return `
                  <tr class="hover:bg-slate-50/75">
                    <td class="py-2.5 px-3 text-slate-500 whitespace-nowrap tabular-nums">${formatDateTime(log.timestamp)}</td>
                    <td class="py-2.5 px-3">
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.changeType === 'RESTOCK' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        log.changeType === 'SALE' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        'bg-amber-50 text-amber-800 border border-amber-200'
                      }">${log.changeType}</span>
                    </td>
                    <td class="py-2.5 px-3 font-bold tabular-nums ${log.quantityChanged > 0 ? 'text-emerald-700' : 'text-rose-600'}">
                      ${log.quantityChanged > 0 ? '+' : ''}${log.quantityChanged}
                    </td>
                    <td class="py-2.5 px-3 text-slate-500 whitespace-nowrap tabular-nums">${log.previousStock} to ${log.newStock}</td>
                    <td class="py-2.5 px-3 font-sans text-slate-800">
                      <div class="font-semibold">${escapeHtml(log.reason)}</div>
                      <div class="text-[10px] text-slate-400 font-mono">Product: ${escapeHtml(prodName)}</div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    modal.open({
      title: 'Stock Movement Audit Trail',
      subtitle: 'Recorded inventory transactions and stock level adjustments',
      content,
      maxWidth: 'max-w-2xl',
    });
  }

  render() {
    this.className = 'flex flex-col h-full overflow-y-auto bg-slate-100/60 p-3 sm:p-5 space-y-4 pb-20 md:pb-6';
    this.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
        <div>
          <h2 class="text-lg font-black text-slate-900 tracking-tight">Inventory & Stock Operations</h2>
          <p class="text-xs text-slate-500">Live SKU management, valuation tracking, and movement audit</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button id="inventory-check-price-btn" class="py-2 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold shadow-2xs transition-all cursor-pointer">
            <span>Price Check</span>
          </button>
          <button id="inventory-visual-match-btn" class="py-2 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold shadow-2xs transition-all cursor-pointer">
            <span>Visual Match</span>
          </button>
          <button id="scan-barcode-btn" class="py-2 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold shadow-2xs transition-all cursor-pointer">
            <span>Scan Barcode</span>
          </button>
          <button id="view-audit-logs-btn" class="py-2 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold shadow-2xs transition-all cursor-pointer">
            <span>Audit Trail</span>
          </button>
          <button id="add-product-btn" class="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer">
            <span>+ Add Product</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div class="flex items-center justify-between text-slate-500">
            <span class="text-[10px] uppercase font-bold tracking-wider">Total SKUs</span>
            <span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">Active</span>
          </div>
          <div id="metric-total-skus" class="text-2xl font-black font-mono text-slate-900 mt-2 tabular-nums">0</div>
          <div class="text-[11px] text-slate-500 mt-1">Catalog items tracked</div>
        </div>

        <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div class="flex items-center justify-between text-slate-500">
            <span class="text-[10px] uppercase font-bold tracking-wider">Stock Alerts</span>
            <span id="metric-low-stock-badge" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">Healthy</span>
          </div>
          <div id="metric-low-stock" class="text-2xl font-black font-mono text-slate-900 mt-2 tabular-nums">0</div>
          <div class="text-[11px] text-slate-500 mt-1">Items at or below minimum threshold</div>
        </div>

        <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div class="flex items-center justify-between text-slate-500">
            <span class="text-[10px] uppercase font-bold tracking-wider">Asset Valuation</span>
            <span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">Cost</span>
          </div>
          <div id="metric-inventory-cost" class="text-2xl font-black font-mono text-slate-900 mt-2 tabular-nums">PHP 0.00</div>
          <div class="text-[11px] text-slate-500 mt-1">Total inventory procurement cost</div>
        </div>

        <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div class="flex items-center justify-between text-slate-500">
            <span class="text-[10px] uppercase font-bold tracking-wider">Retail Valuation</span>
            <span id="metric-margin-badge" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">0% est. margin</span>
          </div>
          <div id="metric-inventory-retail" class="text-2xl font-black font-mono text-slate-900 mt-2 tabular-nums">PHP 0.00</div>
          <div class="text-[11px] text-slate-500 mt-1">Projected total retail revenue</div>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
        <div class="relative flex-1 max-w-md">
          <input
            id="inventory-search"
            type="text"
            placeholder="Search by product name, SKU, or category..."
            class="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs font-medium"
          />
        </div>

        <div class="flex items-center gap-2">
          <select
            id="filter-category"
            class="flex-1 sm:flex-initial px-3 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-700 focus:outline-none focus:border-emerald-600 shadow-2xs font-semibold"
          >
            <option value="All">All Categories</option>
          </select>

          <select
            id="filter-stock-level"
            class="flex-1 sm:flex-initial px-3 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-700 focus:outline-none focus:border-emerald-600 shadow-2xs font-semibold"
          >
            <option value="all">All Stock Statuses</option>
            <option value="low">Low Stock Alerts</option>
            <option value="out">Out of Stock Only</option>
          </select>
        </div>
      </div>

      <div class="flex-1 min-h-[400px]">
        <data-table class="h-full block"></data-table>
      </div>

      <product-form></product-form>
      <stock-adjust></stock-adjust>
      <app-modal id="audit-logs-modal"></app-modal>
      <barcode-scanner-modal id="inventory-barcode-scanner"></barcode-scanner-modal>
      <image-scanner-modal id="inventory-visual-scanner"></image-scanner-modal>
      <price-checker-modal id="inventory-price-checker"></price-checker-modal>
    `;
  }
}

customElements.define('inventory-view', InventoryView);
