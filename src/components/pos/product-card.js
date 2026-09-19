import { formatCurrency } from '../../utils/formatters.js';
import { emitEvent, escapeHtml, ICONS } from '../../utils/dom.js';

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

    let badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
    let badgeText = `${p.stock} in stock`;

    if (isOutOfStock) {
      badgeClass = 'bg-rose-50 text-rose-700 border-rose-200/80 font-semibold';
      badgeText = 'Out of Stock';
    } else if (isLowStock) {
      badgeClass = 'bg-amber-50 text-amber-800 border-amber-200/80 font-semibold';
      badgeText = `Low: ${p.stock}`;
    }

    const categoryColors = {
      Beverages: 'bg-orange-50 text-orange-800 border-orange-200/70',
      Snacks: 'bg-emerald-50 text-emerald-800 border-emerald-200/70',
      Groceries: 'bg-blue-50 text-blue-800 border-blue-200/70',
      General: 'bg-slate-50 text-slate-700 border-slate-200/70',
    };
    const catColor = categoryColors[p.category] || categoryColors.General;

    this.className = 'block h-full';
    this.innerHTML = `
      <div class="h-full flex flex-col justify-between p-2.5 sm:p-3.5 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-xs transition-all duration-150 group relative select-none ${
        isOutOfStock ? 'opacity-50 grayscale-[40%] cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'
      }" id="card-container">
        <div class="flex items-center justify-between gap-1 mb-2">
          <span class="text-[9px] sm:text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.2 rounded border ${catColor} truncate max-w-[80px] sm:max-w-none">
            ${escapeHtml(p.category || 'General')}
          </span>
          <span class="text-[9px] sm:text-[10px] font-medium px-1.5 py-0.2 rounded-full border ${badgeClass} shrink-0">
            ${badgeText}
          </span>
        </div>

        <div class="w-full h-14 sm:h-18 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center mb-2 group-hover:bg-slate-100/70 transition-colors overflow-hidden">
          ${p.imageUrl ? `
            <img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" class="w-full h-full object-contain p-1" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
            <div class="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-white border border-slate-200/80 shadow-2xs items-center justify-center text-xs sm:text-sm font-bold text-slate-800 hidden">
              ${escapeHtml((p.name || 'P').charAt(0).toUpperCase())}
            </div>
          ` : `
            <div class="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-white border border-slate-200/80 shadow-2xs flex items-center justify-center text-xs sm:text-sm font-bold text-slate-800">
              ${escapeHtml((p.name || 'P').charAt(0).toUpperCase())}
            </div>
          `}
        </div>

        <div class="flex-1 min-h-[34px] sm:min-h-[38px]">
          <h4 class="text-xs font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-2 leading-tight">
            ${escapeHtml(p.name)}
          </h4>
          <p class="text-[10px] font-mono text-slate-500 mt-0.5 truncate">
            #${escapeHtml(p.barcode || p.id)}
          </p>
        </div>

        <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
          <div>
            <div class="text-[8px] sm:text-[9px] text-slate-500 uppercase font-bold tracking-wider">Price</div>
            <div class="text-xs sm:text-sm font-bold text-slate-900 font-mono">
              ${formatCurrency(p.sellingPrice)}
            </div>
          </div>

          <button class="w-7 h-7 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${
            isOutOfStock
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white active:bg-slate-900 active:text-white'
          }" title="${isOutOfStock ? 'Out of stock' : 'Add to cart'}">
            ${ICONS.plus}
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
