import { ordersService } from '../../services/orders.service.js';
import { formatCurrency, formatDateTime } from '../../utils/formatters.js';
import { escapeHtml } from '../../utils/dom.js';

export class OrdersView extends HTMLElement {
  constructor() {
    super();
    this.orders = [];
    this.modal = null;
  }

  async connectedCallback() {
    this.render();
    await this.loadOrders();
    this.setupListeners();
  }

  async loadOrders() {
    this.orders = await ordersService.getOrders();
    this.updateMetrics();
    this.renderOrdersTable();
  }

  setupListeners() {
    const refreshBtn = this.querySelector('#refresh-orders-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadOrders());
    }

    const searchInput = this.querySelector('#order-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        this.renderOrdersTable(query);
      });
    }
  }

  updateMetrics() {
    const count = this.orders.length;
    const totalRevenue = this.orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    const totalItemsSold = this.orders.reduce((sum, o) => {
      return sum + (o.items ? o.items.reduce((s, i) => s + (i.quantity || 1), 0) : 0);
    }, 0);
    const avgOrderVal = count > 0 ? totalRevenue / count : 0;

    const mRev = this.querySelector('#metric-total-revenue');
    if (mRev) mRev.textContent = formatCurrency(totalRevenue);

    const mOrders = this.querySelector('#metric-orders-count');
    if (mOrders) mOrders.textContent = count;

    const mAvg = this.querySelector('#metric-avg-order');
    if (mAvg) mAvg.textContent = formatCurrency(avgOrderVal);

    const mItems = this.querySelector('#metric-items-sold');
    if (mItems) mItems.textContent = `${totalItemsSold} units`;
  }

  renderOrdersTable(query = '') {
    const tbody = this.querySelector('#orders-tbody');
    if (!tbody) return;

    let filtered = [...this.orders];
    if (query) {
      filtered = filtered.filter(o =>
        (o.orderNumber && o.orderNumber.toLowerCase().includes(query)) ||
        (o.cashierName && o.cashierName.toLowerCase().includes(query)) ||
        (o.paymentMethod && o.paymentMethod.toLowerCase().includes(query))
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-16 text-center text-slate-400">
            <div class="flex flex-col items-center justify-center gap-2">
              <span class="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">0</span>
              <p class="text-xs font-bold text-slate-700">No transaction records found</p>
              <p class="text-[11px] text-slate-500 max-w-xs">Complete a sale in the Register to view transaction receipts.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((order, idx) => `
      <tr class="hover:bg-slate-50 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}">
        <td class="py-3 px-4 font-mono font-bold text-slate-900 text-xs whitespace-nowrap">
          ${escapeHtml(order.orderNumber)}
        </td>
        <td class="py-3 px-4 text-xs text-slate-500 whitespace-nowrap tabular-nums">
          ${formatDateTime(order.createdAt)}
        </td>
        <td class="py-3 px-4 text-xs font-semibold text-slate-800">
          ${escapeHtml(order.cashierName || order.cashierId || 'Cashier')}
        </td>
        <td class="py-3 px-4 text-xs text-slate-600">
          <span class="font-bold text-slate-900">${order.items ? order.items.length : 0}</span> lines
          <span class="text-slate-400 text-[11px] block truncate max-w-[200px]">
            ${order.items ? order.items.map(i => i.name).join(', ') : ''}
          </span>
        </td>
        <td class="py-3 px-4 text-xs font-mono font-black text-slate-900 whitespace-nowrap tabular-nums">
          ${formatCurrency(order.totalAmount)}
        </td>
        <td class="py-3 px-4 text-xs whitespace-nowrap">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            ${escapeHtml(order.status || 'COMPLETED')}
          </span>
        </td>
        <td class="py-3 px-4 text-right whitespace-nowrap">
          <button data-view-order="${order.id}" class="px-3 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1 active:scale-95">
            <span>View Receipt</span>
          </button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-view-order]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-view-order');
        const order = this.orders.find(o => o.id === id);
        if (order) this.openReceiptModal(order);
      });
    });
  }

  openReceiptModal(order) {
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
            <div>Pay: ${order.paymentMethod}</div>
            <div>Status: ${order.status}</div>
          </div>
        </div>

        <div class="space-y-1.5 py-1 text-slate-800 max-h-48 overflow-y-auto">
          ${(order.items || []).map(item => `
            <div class="flex justify-between items-start text-[11px]">
              <div class="flex-1 pr-2">
                <div class="font-bold text-slate-900 truncate">${escapeHtml(item.name)}</div>
                <div class="text-slate-500">${item.quantity} x ${formatCurrency(item.unitPrice)}</div>
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
            <span class="font-mono text-slate-800 tabular-nums">${formatCurrency(order.amountTendered || order.totalAmount)}</span>
          </div>
          <div class="flex justify-between font-bold text-sm text-slate-900 pt-1.5 border-t border-slate-200">
            <span>Change:</span>
            <span class="font-mono tabular-nums">${formatCurrency(order.change || 0)}</span>
          </div>
        </div>

        <div class="text-center pt-2 border-t border-dashed border-slate-300 text-[10px] text-slate-400">
          <p>Thank you for shopping with us!</p>
          <p>Official Sales Receipt</p>
        </div>
      </div>

      <div class="flex items-center gap-2 pt-1">
        <button id="modal-print-btn" type="button" class="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]">
          <span>Print Receipt</span>
        </button>
      </div>
    `;

    modal.open({
      title: 'Sales Receipt',
      subtitle: `Invoice #${order.orderNumber}`,
      content,
      maxWidth: 'max-w-md',
    });

    const printBtn = content.querySelector('#modal-print-btn');
    if (printBtn) {
      printBtn.addEventListener('click', () => window.print());
    }
  }

  render() {
    this.className = 'flex flex-col h-full overflow-y-auto bg-slate-100/60 p-3 sm:p-5 space-y-4 pb-20 md:pb-6';
    this.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
        <div>
          <h2 class="text-lg font-black text-slate-900 tracking-tight">Sales Orders History</h2>
          <p class="text-xs text-slate-500">Audit sales transactions, review tenders, and reprint receipts</p>
        </div>

        <div class="flex items-center gap-2">
          <button id="refresh-orders-btn" class="py-2 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95">
            <span>Refresh Orders</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 shrink-0">
        <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div class="text-[10px] uppercase font-bold tracking-wider text-slate-500">Total Sales</div>
          <div id="metric-total-revenue" class="text-2xl font-black font-mono text-emerald-700 mt-2 tabular-nums">PHP 0.00</div>
          <div class="text-[11px] text-slate-500 mt-1">Completed gross revenue</div>
        </div>

        <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div class="text-[10px] uppercase font-bold tracking-wider text-slate-500">Transactions</div>
          <div id="metric-orders-count" class="text-2xl font-black font-mono text-slate-900 mt-2 tabular-nums">0</div>
          <div class="text-[11px] text-slate-500 mt-1">Total orders processed</div>
        </div>

        <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div class="text-[10px] uppercase font-bold tracking-wider text-slate-500">Avg Ticket Size</div>
          <div id="metric-avg-order" class="text-2xl font-black font-mono text-slate-900 mt-2 tabular-nums">PHP 0.00</div>
          <div class="text-[11px] text-slate-500 mt-1">Revenue per order</div>
        </div>

        <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div class="text-[10px] uppercase font-bold tracking-wider text-slate-500">Units Sold</div>
          <div id="metric-items-sold" class="text-2xl font-black font-mono text-slate-900 mt-2 tabular-nums">0 units</div>
          <div class="text-[11px] text-slate-500 mt-1">Total items checked out</div>
        </div>
      </div>

      <div class="flex items-center justify-between gap-3 shrink-0">
        <div class="relative flex-1 max-w-md">
          <input
            id="order-search"
            type="text"
            placeholder="Search by order #, cashier name, or payment method..."
            class="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs font-medium"
          />
        </div>
      </div>

      <div class="flex-1 min-h-[380px] bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div class="overflow-x-auto h-full overscroll-x-contain">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th class="py-3 px-4">Order #</th>
                <th class="py-3 px-4">Date &amp; Time</th>
                <th class="py-3 px-4">Cashier</th>
                <th class="py-3 px-4">Items Summary</th>
                <th class="py-3 px-4">Total Amount</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody id="orders-tbody" class="divide-y divide-slate-100 font-normal text-slate-700">
            </tbody>
          </table>
        </div>
      </div>

      <app-modal></app-modal>
    `;
  }
}

customElements.define('orders-view', OrdersView);
