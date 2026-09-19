import { ordersService } from '../../services/orders.service.js';
import { cartStore } from '../../store/cart.store.js';
import { authService } from '../../services/auth.service.js';
import { formatCurrency, formatDateTime } from '../../utils/formatters.js';
import { ICONS, showToast, escapeHtml } from '../../utils/dom.js';

export class PosCheckout extends HTMLElement {
  constructor() {
    super();
    this.modal = null;
    this.totalAmount = 0;
    this.items = [];
    this.amountTendered = 0;
    this.currentOrder = null;
    this.isProcessing = false;
  }

  connectedCallback() {
    this.render();
  }

  openCheckout({ items, totalAmount }) {
    this.items = [...items];
    this.totalAmount = totalAmount;
    this.amountTendered = totalAmount;
    this.currentOrder = null;
    this.isProcessing = false;

    this.showPaymentStep();
  }

  showPaymentStep() {
    const modal = this.querySelector('app-modal');
    if (!modal) return;

    const content = document.createElement('div');
    content.className = 'space-y-3.5';

    content.innerHTML = `
      <div class="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
        <div class="text-[10px] sm:text-[11px] uppercase font-bold tracking-wider text-slate-500">Amount Due</div>
        <div class="text-2xl sm:text-3xl font-black text-slate-900 font-mono mt-0.5">${formatCurrency(this.totalAmount)}</div>
        <div class="text-xs text-slate-500 mt-0.5">${this.items.length} item line${this.items.length === 1 ? '' : 's'} in order</div>
      </div>

      <div>
        <label class="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">Payment Method</label>
        <div class="py-2 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 font-semibold text-xs flex items-center justify-between shadow-2xs">
          <span>Cash</span>
          <span class="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold border border-slate-200">ACTIVE</span>
        </div>
      </div>

      <div>
        <label for="tendered-input" class="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">Amount Tendered (PHP)</label>
        <div class="relative">
          <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono font-bold text-base">₱</span>
          <input
            id="tendered-input"
            type="number"
            step="0.01"
            min="${this.totalAmount}"
            value="${this.amountTendered}"
            class="w-full pl-8 pr-4 py-2.5 rounded-xl bg-white border border-slate-300 text-base font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-800 shadow-2xs"
          />
        </div>

        <div class="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5 mt-2" id="tender-quick-buttons">
          <button type="button" data-val="${this.totalAmount}" class="py-2 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 border border-slate-200 cursor-pointer text-center">
            Exact
          </button>
          <button type="button" data-add="50" class="py-2 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 border border-slate-200 cursor-pointer text-center">
            +₱50
          </button>
          <button type="button" data-add="100" class="py-2 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 border border-slate-200 cursor-pointer text-center">
            +₱100
          </button>
          <button type="button" data-add="500" class="py-2 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 border border-slate-200 cursor-pointer text-center">
            +₱500
          </button>
          <button type="button" data-val="1000" class="py-2 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 border border-slate-200 cursor-pointer text-center col-span-2 sm:col-span-1">
            ₱1,000
          </button>
        </div>
      </div>

      <div id="change-display-box" class="p-3 sm:p-3.5 rounded-xl border bg-slate-50 border-slate-200 flex items-center justify-between">
        <div>
          <div class="text-[10px] uppercase font-bold tracking-wider text-slate-500">Change Due</div>
          <div id="change-text" class="text-base sm:text-lg font-bold font-mono text-slate-900">₱0.00</div>
        </div>
        <div id="tender-validation-status" class="text-xs font-semibold text-emerald-700 flex items-center gap-1">
          ${ICONS.check} Ready
        </div>
      </div>

      <div class="flex items-center gap-2 pt-1">
        <button id="cancel-checkout-btn" type="button" class="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-all cursor-pointer">
          Cancel
        </button>
        <button id="confirm-payment-btn" type="button" class="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2">
          <span>${ICONS.check}</span>
          <span>Complete Sale</span>
        </button>
      </div>
    `;

    modal.open({
      title: 'Checkout & Payment',
      subtitle: 'Review total and record cash payment',
      content,
      maxWidth: 'max-w-md',
    });

    const tenderedInput = content.querySelector('#tendered-input');
    const changeText = content.querySelector('#change-text');
    const statusText = content.querySelector('#tender-validation-status');
    const confirmBtn = content.querySelector('#confirm-payment-btn');
    const cancelBtn = content.querySelector('#cancel-checkout-btn');

    const updateChange = () => {
      const val = parseFloat(tenderedInput.value) || 0;
      this.amountTendered = val;
      const change = val - this.totalAmount;

      if (change < 0) {
        changeText.textContent = `Need ${formatCurrency(Math.abs(change))} more`;
        changeText.className = 'text-base sm:text-lg font-bold font-mono text-rose-600';
        statusText.innerHTML = `<span class="text-rose-600 flex items-center gap-1">${ICONS.x} Insufficient</span>`;
        confirmBtn.disabled = true;
        confirmBtn.classList.add('opacity-40', 'pointer-events-none');
      } else {
        changeText.textContent = formatCurrency(change);
        changeText.className = 'text-base sm:text-lg font-bold font-mono text-slate-900';
        statusText.innerHTML = `<span class="text-emerald-700 flex items-center gap-1">${ICONS.check} Ready</span>`;
        confirmBtn.disabled = false;
        confirmBtn.classList.remove('opacity-40', 'pointer-events-none');
      }
    };

    tenderedInput.addEventListener('input', updateChange);

    content.querySelectorAll('#tender-quick-buttons button').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.hasAttribute('data-val')) {
          tenderedInput.value = btn.getAttribute('data-val');
        } else if (btn.hasAttribute('data-add')) {
          const current = parseFloat(tenderedInput.value) || 0;
          tenderedInput.value = (current + parseFloat(btn.getAttribute('data-add'))).toFixed(2);
        }
        updateChange();
      });
    });

    cancelBtn.addEventListener('click', () => modal.close());

    confirmBtn.addEventListener('click', async () => {
      if (this.isProcessing) return;
      this.isProcessing = true;
      confirmBtn.innerHTML = `<span>Processing...</span>`;

      try {
        const change = this.amountTendered - this.totalAmount;
        const cashier = authService.getCurrentUser();

        const order = await ordersService.processCheckout({
          items: this.items,
          totalAmount: this.totalAmount,
          amountTendered: this.amountTendered,
          change,
          paymentMethod: 'CASH',
          cashierId: cashier.id,
          cashierName: cashier.name,
        });

        cartStore.clearCart();
        showToast(`Order #${order.orderNumber} completed!`, 'success');

        this.showReceiptStep(order);
      } catch (err) {
        console.error('Checkout error:', err);
        showToast(err.message || 'Checkout failed.', 'error');
        confirmBtn.innerHTML = `<span>Complete Sale</span>`;
        this.isProcessing = false;
      }
    });

    updateChange();
  }

  showReceiptStep(order) {
    const modal = this.querySelector('app-modal');
    if (!modal) return;

    const content = document.createElement('div');
    content.className = 'space-y-3.5';

    content.innerHTML = `
      <div id="printable-receipt" class="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 space-y-3 shadow-2xs">
        <div class="text-center pb-3 border-b border-dashed border-slate-300">
          <div class="text-sm font-bold text-slate-900 tracking-wider uppercase">PonioStore</div>
          <div class="text-[11px] text-slate-500">123 Ayala Avenue, Makati City</div>
          <div class="text-[11px] text-slate-500">VAT Reg TIN: 000-123-456-000</div>
          <div class="text-[11px] text-slate-500 mt-0.5">${formatDateTime(order.createdAt)}</div>
        </div>

        <div class="flex justify-between text-[11px] text-slate-500 pb-2 border-b border-dashed border-slate-300">
          <div>
            <div><strong>Order:</strong> ${order.orderNumber}</div>
            <div><strong>Cashier:</strong> ${escapeHtml(order.cashierName || order.cashierId)}</div>
          </div>
          <div class="text-right">
            <div><strong>Status:</strong> ${order.status}</div>
            <div><strong>Pay:</strong> ${order.paymentMethod}</div>
          </div>
        </div>

        <div class="space-y-1 py-1 text-slate-800 max-h-48 overflow-y-auto">
          ${order.items.map(item => `
            <div class="flex justify-between items-start text-[11px]">
              <div class="flex-1 pr-2">
                <div class="font-bold text-slate-900 truncate">${escapeHtml(item.name)}</div>
                <div class="text-slate-500">${item.quantity} &times; ${formatCurrency(item.unitPrice)}</div>
              </div>
              <div class="font-bold font-mono">${formatCurrency(item.subtotal)}</div>
            </div>
          `).join('')}
        </div>

        <div class="pt-2.5 border-t border-dashed border-slate-300 space-y-1 text-xs">
          <div class="flex justify-between">
            <span class="text-slate-500">Total Due:</span>
            <span class="font-bold text-slate-900 font-mono">${formatCurrency(order.totalAmount)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Cash Tendered:</span>
            <span class="font-mono text-slate-800">${formatCurrency(order.amountTendered)}</span>
          </div>
          <div class="flex justify-between font-bold text-sm text-slate-900 pt-1 border-t border-slate-200">
            <span>Change:</span>
            <span class="font-mono">${formatCurrency(order.change)}</span>
          </div>
        </div>

        <div class="text-center pt-2 border-t border-dashed border-slate-300 text-[10px] text-slate-400">
          <p>Thank you for shopping with us!</p>
          <p>Official Sales Invoice</p>
        </div>
      </div>

      <div class="flex items-center gap-2 pt-1">
        <button id="print-receipt-btn" type="button" class="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all">
          <span>${ICONS.print}</span>
          <span>Print</span>
        </button>
        <button id="new-sale-btn" type="button" class="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all">
          <span>${ICONS.plus}</span>
          <span>Next Sale</span>
        </button>
      </div>
    `;

    modal.open({
      title: 'Sale Completed',
      subtitle: `Invoice #${order.orderNumber}`,
      content,
      maxWidth: 'max-w-md',
    });

    const printBtn = content.querySelector('#print-receipt-btn');
    const newSaleBtn = content.querySelector('#new-sale-btn');

    if (printBtn) {
      printBtn.addEventListener('click', () => window.print());
    }

    if (newSaleBtn) {
      newSaleBtn.addEventListener('click', () => modal.close());
    }
  }

  render() {
    this.innerHTML = `<app-modal></app-modal>`;
    this.modal = this.querySelector('app-modal');
  }
}

customElements.define('pos-checkout', PosCheckout);
