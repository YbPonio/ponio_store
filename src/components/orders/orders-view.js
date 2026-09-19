import { ordersService } from '../../services/orders.service.js';
import { formatCurrency, formatDateTime } from '../../utils/formatters.js';
import { ICONS, escapeHtml } from '../../utils/dom.js';

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

    const mRev = this.querySelector('#metric-total-revenue');
    if (mRev) mRev.textContent = formatCurrency(totalRevenue);

    const mOrders = this.querySelector('#metric-orders-count');
    if (mOrders) mOrders.textContent = count;

    const mItems = this.querySelector('#metric-items-sold');
    if (mItems) mItems.textContent = totalItemsSold;
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
          <td colspan="7" class="py-12 text-center text-slate-400">
            <div class="flex flex-col items-center justify-center gap-1.5">
              <span class="text-slate-400">${ICONS.orders}</span>
              <p class="text-xs font-medium text-slate-500">No sales transactions found.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(order => `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="py-2.5 sm:py-3 px-3 sm:px-4 font-mono font-bold text-slate-900 text-xs whitespace-nowrap">
          ${escapeHtml(order.orderNumber)}
        </td>
        <td class="py-2.5 sm:py-3 px-3 sm:px-4 text-xs text-slate-500 whitespace-nowrap">
          ${formatDateTime(order.createdAt)}
        </td>
        <td class="py-2.5 sm:py-3 px-3 sm:px-4 text-xs text-slate-800">
          ${escapeHtml(order.cashierName || order.cashierId || 'Cashier')}
        </td>
        <td class="py-2.5 sm:py-3 px-3 sm:px-4 text-xs text-slate-600">
          <span class="font-semibold text-slate-800">${order.items ? order.items.length : 0}</span> lines
          <span class="text-slate-400 text-[11px] block truncate max-w-[180px]">
            ${order.items ? order.items.map(i => i.name).join(', ') : ''}
          </span>
        </td>
        <td class="py-2.5 sm:py-3 px-3 sm:px-4 text-xs font-mono font-bold text-slate-900 whitespace-nowrap">
          ${formatCurrency(order.totalAmount)}
        </td>
        <td class="py-2.5 sm:py-3 px-3 sm:px-4 text-xs whitespace-nowrap">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
            ${escapeHtml(order.status || 'COMPLETED')}
          </span>
        </td>
        <td class="py-2.5 sm:py-3 px-3 sm:px-4 text-right whitespace-nowrap">
          <button data-view-order="${order.id}" class="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1.5 active:scale-95">
            <span>${ICONS.print}</span>
            <span>Receipt</span>
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
    content.className = 'space-y-3.5';

    content.innerHTML = `
      <div id="printable-receipt" class="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 space-y-3 shadow-2xs">
        <div class="text-center pb-3 border-b border-dashed border-slate-300">
          <div class="text-sm font-bold text-slate-900 tracking-wider uppercase">PonioStore</div>
          <div class="text-[11px] text-slate-500">123 Ayala Avenue, Makati City</div>
          <div class="text-[11px] text-slate-500 mt-0.5">${formatDateTime(order.createdAt)}</div>
        </div>

        <div class="flex justify-between text-[11px] text-slate-500 pb-2 border-b border-dashed border-slate-300">
          <div>
            <div><strong>Order:</strong> ${order.orderNumber}</div>
            <div><strong>Cashier:</strong> ${escapeHtml(order.cashierName || order.cashierId)}</div>
          </div>
          <div class="text-right">
            <div><strong>Pay:</strong> ${order.paymentMethod}</div>
            <div><strong>Status:</strong> ${order.status}</div>
          </div>
        </div>

        <div class="space-y-1 py-1 text-slate-800 max-h-48 overflow-y-auto">
          ${(order.items || []).map(item => `
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
            <span class="font-mono text-slate-800">${formatCurrency(order.amountTendered || order.totalAmount)}</span>
          </div>
          <div class="flex justify-between font-bold text-sm text-slate-900 pt-1 border-t border-slate-200">
            <span>Change:</span>
            <span class="font-mono">${formatCurrency(order.change || 0)}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 pt-1">
        <button id="modal-print-btn" type="button" class="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]">
          <span>${ICONS.print}</span>
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
    this.className = 'flex flex-col h-full overflow-y-auto bg-slate-50 p-3 sm:p-5 space-y-3 sm:space-y-4 pb-20 md:pb-5';
    this.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 shrink-0">
        <div>
          <h2 class="text-base font-bold text-slate-900 tracking-tight">Sales Orders</h2>
          <p class="text-xs text-slate-500">Transaction history, receipts, and revenue records</p>
        </div>

        <div class="flex items-center gap-2">
          <button id="refresh-orders-btn" class="py-1.5 px-3 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95">
            <span>${ICONS.refresh}</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
        <div class="p-3 sm:p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <div class="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-slate-500">Total Revenue</div>
          <div id="metric-total-revenue" class="text-lg sm:text-xl font-black font-mono text-slate-900 mt-1">₱0.00</div>
          <div class="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">Completed gross sales</div>
        </div>

        <div class="p-3 sm:p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <div class="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-slate-500">Transactions</div>
          <div id="metric-orders-count" class="text-lg sm:text-xl font-black font-mono text-slate-900 mt-1">0</div>
          <div class="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">Orders recorded</div>
        </div>

        <div class="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <div class="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-slate-500">Items Sold</div>
          <div id="metric-items-sold" class="text-lg sm:text-xl font-black font-mono text-slate-900 mt-1">0</div>
          <div class="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">Total units checked out</div>
        </div>
      </div>

      <div class="flex items-center justify-between gap-2 shrink-0">
        <div class="relative flex-1 max-w-sm">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            ${ICONS.search}
          </span>
          <input
            id="order-search"
            type="text"
            placeholder="Search invoice # or cashier..."
            class="w-full pl-8 pr-3 py-2 sm:py-1.5 rounded-xl bg-white border border-slate-200/90 text-sm sm:text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-800 shadow-2xs font-medium"
          />
        </div>
      </div>

      <div class="flex-1 min-h-[360px] bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs">
        <div class="overflow-x-auto h-full overscroll-x-contain">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-50/75 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th class="py-2.5 sm:py-3 px-3 sm:px-4">Order #</th>
                <th class="py-2.5 sm:py-3 px-3 sm:px-4">Date &amp; Time</th>
                <th class="py-2.5 sm:py-3 px-3 sm:px-4">Cashier</th>
                <th class="py-2.5 sm:py-3 px-3 sm:px-4">Items</th>
                <th class="py-2.5 sm:py-3 px-3 sm:px-4">Total</th>
                <th class="py-2.5 sm:py-3 px-3 sm:px-4">Status</th>
                <th class="py-2.5 sm:py-3 px-3 sm:px-4 text-right">Receipt</th>
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
