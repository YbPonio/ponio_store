import { ordersService } from '../../services/orders.service.js';
import { cartStore } from '../../store/cart.store.js';
import { authService } from '../../services/auth.service.js';
import { formatCurrency, formatDateTime } from '../../utils/formatters.js';
import { showToast, escapeHtml } from '../../utils/dom.js';

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
    content.className = 'space-y-4';

    content.innerHTML = `
      <div class="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
        <div class="text-[11px] uppercase font-bold tracking-wider text-emerald-800">Total Amount Due</div>
        <div class="text-3xl font-black text-emerald-950 font-mono mt-0.5 tabular-nums">${formatCurrency(this.totalAmount)}</div>
        <div class="text-xs text-emerald-700 mt-1 font-medium">${this.items.length} item line${this.items.length === 1 ? '' : 's'} in order</div>
      </div>

      <div>
        <label class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Payment Method</label>
        <div class="py-2.5 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold text-xs flex items-center justify-between shadow-2xs">
          <span>Cash Payment</span>
          <span class="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded font-mono font-bold">DEFAULT</span>
        </div>
      </div>

      <div>
        <label for="tendered-input" class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Cash Tendered (PHP)</label>
        <div class="relative">
          <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-sm">PHP</span>
          <input
            id="tendered-input"
            type="number"
            step="0.01"
            min="${this.totalAmount}"
            value="${this.amountTendered}"
            class="w-full pl-13 pr-4 py-2.5 rounded-xl bg-white border border-slate-300 text-base font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
          />
        </div>

        <div class="grid grid-cols-5 gap-1.5 mt-2" id="tender-quick-buttons">
          <button type="button" data-val="${this.totalAmount}" class="py-2 px-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 border border-slate-200 cursor-pointer text-center">
            Exact
          </button>
          <button type="button" data-add="50" class="py-2 px-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 border border-slate-200 cursor-pointer text-center">
            +50
          </button>
          <button type="button" data-add="100" class="py-2 px-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 border border-slate-200 cursor-pointer text-center">
            +100
          </button>
          <button type="button" data-add="500" class="py-2 px-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 border border-slate-200 cursor-pointer text-center">
            +500
          </button>
          <button type="button" data-val="1000" class="py-2 px-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 border border-slate-200 cursor-pointer text-center">
            1000
          </button>
        </div>
      </div>

      <div id="change-display-box" class="p-3.5 rounded-xl border bg-slate-50 border-slate-200 flex items-center justify-between">
        <div>
          <div class="text-[10px] uppercase font-bold tracking-wider text-slate-500">Change Due</div>
          <div id="change-text" class="text-xl font-black font-mono text-slate-900 tabular-nums">PHP 0.00</div>
        </div>
        <div id="tender-validation-status" class="text-xs font-bold text-emerald-700 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
          Ready
        </div>
      </div>

      <div class="flex items-center gap-2 pt-2 border-t border-slate-100">
        <button id="cancel-checkout-btn" type="button" class="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer">
          Cancel
        </button>
        <button id="confirm-payment-btn" type="button" class="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2">
          <span>Complete Sale</span>
        </button>
      </div>
    `;

    modal.open({
      title: 'Order Checkout',
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
        changeText.className = 'text-base font-bold font-mono text-rose-600';
        statusText.textContent = 'Insufficient';
        statusText.className = 'text-xs font-bold text-rose-700 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200';
        confirmBtn.disabled = true;
        confirmBtn.classList.add('opacity-40', 'pointer-events-none');
      } else {
        changeText.textContent = formatCurrency(change);
        changeText.className = 'text-xl font-black font-mono text-slate-900 tabular-nums';
        statusText.textContent = 'Ready';
        statusText.className = 'text-xs font-bold text-emerald-700 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200';
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
    content.className = 'space-y-4';

    content.innerHTML = `
      <div id="printable-receipt" class="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 text-xs font-mono text-slate-800 space-y-3 shadow-2xs">
        <div class="text-center pb-3 border-b border-dashed border-slate-300">
          <div class="text-sm font-black text-slate-900 tracking-wider uppercase">PONIOSTORE</div>
          <div class="text-[11px] text-slate-500">Retail Core Station 1</div>
          <div class="text-[11px] text-slate-500 mt-0.5">${formatDateTime(order.createdAt)}</div>
        </div>

        <div class="flex justify-between text-[11px] text-slate-500 pb-2 border-b border-dashed border-slate-300">
          <div>
            <div>Order: <strong>${order.orderNumber}</strong></div>
            <div>Cashier: ${escapeHtml(order.cashierName || order.cashierId)}</div>
          </div>
          <div class="text-right">
            <div>Status: ${order.status}</div>
            <div>Pay: ${order.paymentMethod}</div>
          </div>
        </div>

        <div class="space-y-1.5 py-1 text-slate-800 max-h-48 overflow-y-auto">
          ${order.items.map(item => `
            <div class="flex justify-between items-start text-[11px]">
              <div class="flex-1 pr-2">
                <div class="font-bold text-slate-900 truncate">${escapeHtml(item.name)}</div>
                <div class="text-slate-500 font-mono">${item.quantity} x ${formatCurrency(item.unitPrice)}</div>
              </div>
              <div class="font-bold font-mono tabular-nums">${formatCurrency(item.subtotal)}</div>
            </div>
          `).join('')}
        </div>

        <div class="pt-3 border-t border-dashed border-slate-300 space-y-1 text-xs">
          <div class="flex justify-between">
            <span class="text-slate-500">Total Due:</span>
            <span class="font-bold text-slate-900 font-mono tabular-nums">${formatCurrency(order.totalAmount)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Cash Tendered:</span>
            <span class="font-mono text-slate-800 tabular-nums">${formatCurrency(order.amountTendered)}</span>
          </div>
          <div class="flex justify-between font-bold text-sm text-slate-900 pt-1.5 border-t border-slate-200">
            <span>Change:</span>
            <span class="font-mono tabular-nums">${formatCurrency(order.change)}</span>
          </div>
        </div>

        <div class="text-center pt-2 border-t border-dashed border-slate-300 text-[10px] text-slate-400">
          <p>Thank you for your purchase!</p>
          <p>Official Sales Receipt</p>
        </div>
      </div>

      <div class="flex items-center gap-2 pt-1">
        <button id="print-receipt-btn" type="button" class="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all">
          <span>Print Receipt</span>
        </button>
        <button id="new-sale-btn" type="button" class="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all">
          <span>Next Order</span>
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
