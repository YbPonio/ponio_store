import { inventoryService } from '../../services/inventory.service.js';
import { authService } from '../../services/auth.service.js';
import { ICONS, showToast, escapeHtml } from '../../utils/dom.js';

export class StockAdjust extends HTMLElement {
  constructor() {
    super();
    this.product = null;
  }

  connectedCallback() {
    this.render();
  }

  open(product) {
    this.product = product;
    const modal = this.querySelector('app-modal');
    if (!modal) return;

    const content = document.createElement('form');
    content.id = 'stock-adjust-form';
    content.className = 'space-y-3.5';

    content.innerHTML = `
      <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
        <div>
          <h4 class="text-xs font-semibold text-slate-900">${escapeHtml(product.name)}</h4>
          <p class="text-[11px] text-slate-500 font-mono">Barcode: ${escapeHtml(product.barcode || product.id)}</p>
        </div>
        <div class="text-right">
          <div class="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Current Stock</div>
          <div class="text-lg font-black text-slate-900 font-mono">${product.stock}</div>
        </div>
      </div>

      <div>
        <label class="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Adjustment Type *</label>
        <div class="grid grid-cols-3 gap-1.5 sm:gap-2" id="adjustment-type-pills">
          <button type="button" data-type="RESTOCK" data-multiplier="1" class="py-2.5 px-2 rounded-lg border border-slate-900 bg-slate-900 text-white font-semibold text-xs flex items-center justify-center gap-1 cursor-pointer">
            <span>+</span> Restock
          </button>
          <button type="button" data-type="DAMAGE" data-multiplier="-1" class="py-2.5 px-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-xs flex items-center justify-center gap-1 cursor-pointer">
            <span>-</span> Damaged
          </button>
          <button type="button" data-type="ADJUSTMENT" data-multiplier="1" class="py-2.5 px-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-xs flex items-center justify-center gap-1 cursor-pointer">
            <span>&plusmn;</span> Audit Count
          </button>
        </div>
      </div>

      <div>
        <label for="adjust-qty-input" class="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Quantity to Add/Deduct *</label>
        <input
          id="adjust-qty-input"
          name="quantity"
          type="number"
          min="1"
          required
          value="10"
          class="w-full px-3 py-2.5 sm:py-2 rounded-xl bg-white border border-slate-300 text-base sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-800 shadow-2xs"
        />
      </div>

      <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
        <span class="text-slate-500">Projected Stock:</span>
        <span id="projected-stock-text" class="font-mono font-bold text-slate-900 text-xs">--</span>
      </div>

      <div>
        <label for="adjust-reason-input" class="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Audit Note / Reason *</label>
        <input
          id="adjust-reason-input"
          name="reason"
          type="text"
          required
          placeholder="e.g. Supplier Delivery Batch #48"
          class="w-full px-3 py-2.5 sm:py-2 rounded-xl bg-white border border-slate-300 text-sm sm:text-xs text-slate-900 focus:outline-none focus:border-slate-800 shadow-2xs font-medium"
        />
      </div>

      <div class="flex items-center gap-2.5 pt-1">
        <button type="button" id="adjust-cancel-btn" class="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-all cursor-pointer">
          Cancel
        </button>
        <button type="submit" id="adjust-submit-btn" class="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5">
          <span>${ICONS.check}</span>
          <span>Apply Adjustment</span>
        </button>
      </div>
    `;

    modal.open({
      title: 'Adjust Stock & Log Audit',
      subtitle: `Item: ${product.name}`,
      content,
      maxWidth: 'max-w-md',
    });

    let currentType = 'RESTOCK';
    let multiplier = 1;

    const qtyInput = content.querySelector('#adjust-qty-input');
    const projectedText = content.querySelector('#projected-stock-text');
    const reasonInput = content.querySelector('#adjust-reason-input');

    const updateProjection = () => {
      const qty = parseInt(qtyInput.value, 10) || 0;
      const delta = qty * multiplier;
      const projected = Math.max(0, product.stock + delta);
      projectedText.textContent = `${product.stock} ${delta >= 0 ? '+' : '-'} ${Math.abs(delta)} = ${projected} units`;
    };

    content.querySelectorAll('#adjustment-type-pills button').forEach(btn => {
      btn.addEventListener('click', () => {
        content.querySelectorAll('#adjustment-type-pills button').forEach(b => {
          b.className = 'py-2.5 px-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-xs flex items-center justify-center gap-1 cursor-pointer';
        });
        btn.className = 'py-2.5 px-2 rounded-lg border border-slate-900 bg-slate-900 text-white font-semibold text-xs flex items-center justify-center gap-1 cursor-pointer';

        currentType = btn.getAttribute('data-type');
        multiplier = parseInt(btn.getAttribute('data-multiplier'), 10);
        if (currentType === 'RESTOCK' && !reasonInput.value) {
          reasonInput.value = 'Supplier Restock Delivery';
        } else if (currentType === 'DAMAGE' && !reasonInput.value) {
          reasonInput.value = 'Damaged items removal';
        }
        updateProjection();
      });
    });

    qtyInput.addEventListener('input', updateProjection);
    updateProjection();

    content.querySelector('#adjust-cancel-btn').addEventListener('click', () => modal.close());

    content.addEventListener('submit', async (e) => {
      e.preventDefault();
      const qty = parseInt(qtyInput.value, 10) || 0;
      if (qty <= 0) {
        showToast('Quantity must be greater than zero', 'warning');
        return;
      }

      const submitBtn = content.querySelector('#adjust-submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Updating...';

      const user = authService.getCurrentUser();
      const quantityChanged = qty * multiplier;

      try {
        await inventoryService.adjustStock({
          productId: product.id,
          changeType: currentType,
          quantityChanged,
          reason: reasonInput.value.trim() || `Manual ${currentType} update`,
          userId: user.id,
        });

        showToast(`Stock updated for "${product.name}"`, 'success');
        modal.close();
      } catch (err) {
        console.error('Adjust stock error:', err);
        showToast(err.message || 'Failed adjusting stock.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Apply Adjustment';
      }
    });
  }

  render() {
    this.innerHTML = `<app-modal></app-modal>`;
  }
}

customElements.define('stock-adjust', StockAdjust);
