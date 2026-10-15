import { formatCurrency } from '../../utils/formatters.js';
import { emitEvent, escapeHtml } from '../../utils/dom.js';

export class ProductCard extends HTMLElement {
  constructor() {
    super();
    this.product = null;
  }

  setProduct(product) {
    this.product = product;
    this.render();
  }

  render() {
    if (!this.product) return;

    const p = this.product;
    const isOutOfStock = p.stock <= 0;
    const isLowStock = !isOutOfStock && p.stock <= (p.lowStockThreshold || 10);

    let stockBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    let stockDotClass = 'bg-emerald-500';
    let stockText = `${p.stock} in stock`;

    if (isOutOfStock) {
      stockBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
      stockDotClass = 'bg-rose-500';
      stockText = 'Out of Stock';
    } else if (isLowStock) {
      stockBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
      stockDotClass = 'bg-amber-500';
      stockText = `Low: ${p.stock}`;
    }

    const categoryColors = {
      Beverages: 'bg-blue-50 text-blue-700 border-blue-200',
      Snacks: 'bg-amber-50 text-amber-800 border-amber-200',
      Groceries: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      General: 'bg-slate-100 text-slate-700 border-slate-200',
    };
    const catColor = categoryColors[p.category] || categoryColors.General;

    this.className = 'block h-full';
    this.innerHTML = `
      <div class="h-full flex flex-col justify-between p-3.5 rounded-2xl bg-white border border-slate-200 hover-lift relative select-none ${
        isOutOfStock ? 'opacity-55 cursor-not-allowed' : 'cursor-pointer'
      }" id="card-container">
        <div class="flex items-center justify-between gap-1.5 mb-2.5">
          <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${catColor} truncate max-w-[90px] sm:max-w-none">
            ${escapeHtml(p.category || 'General')}
          </span>
          <span class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${stockBadgeClass} shrink-0">
            <span class="w-1.5 h-1.5 rounded-full ${stockDotClass}"></span>
            <span>${stockText}</span>
          </span>
        </div>

        <div class="w-full h-20 sm:h-24 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-2.5 overflow-hidden relative">
          ${p.imageUrl ? `
            <img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" class="w-full h-full object-contain p-1.5 transition-transform duration-200 hover:scale-105" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
            <div class="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-2xs items-center justify-center text-sm font-black text-slate-800 hidden">
              ${escapeHtml((p.name || 'P').charAt(0).toUpperCase())}
            </div>
          ` : `
            <div class="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-sm font-black text-slate-800">
              ${escapeHtml((p.name || 'P').charAt(0).toUpperCase())}
            </div>
          `}
        </div>

        <div class="flex-1 min-h-[44px]">
          <h4 class="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-tight">
            ${escapeHtml(p.name)}
          </h4>
          <p class="text-[10px] font-mono text-slate-400 mt-1 truncate">
            SKU: ${escapeHtml(p.barcode || p.id)}
          </p>
        </div>

        <div class="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100">
          <div>
            <div class="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Unit Price</div>
            <div class="text-sm sm:text-base font-black text-slate-900 font-mono tabular-nums leading-tight">
              ${formatCurrency(p.sellingPrice)}
            </div>
          </div>

          <button class="px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all shrink-0 flex items-center gap-1 ${
            isOutOfStock
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-2xs'
          }" title="${isOutOfStock ? 'Out of stock' : 'Add item to active cart'}">
            <span>+ Add</span>
          </button>
        </div>
      </div>
    `;

    const container = this.querySelector('#card-container');
    if (!isOutOfStock && container) {
      container.addEventListener('click', () => {
        emitEvent(this, 'add-to-cart', { product: this.product });
      });
    }
  }
}

customElements.define('product-card', ProductCard);
