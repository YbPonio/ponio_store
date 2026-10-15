import { escapeHtml } from '../../utils/dom.js';

export class DataTable extends HTMLElement {
  constructor() {
    super();
    this.columns = [];
    this.data = [];
    this.filteredData = [];
    this.sortKey = '';
    this.sortAsc = true;
    this.currentPage = 1;
    this.pageSize = 8;
    this.searchQuery = '';
  }

  connectedCallback() {
    this.render();
  }

  setConfig(columns, data = []) {
    this.columns = columns;
    this.setData(data);
  }

  setData(data) {
    this.data = Array.isArray(data) ? [...data] : [];
    this.applyFilters();
  }

  setSearchQuery(query) {
    this.searchQuery = (query || '').toLowerCase().trim();
    this.currentPage = 1;
    this.applyFilters();
  }

  applyFilters() {
    let result = [...this.data];

    if (this.searchQuery) {
      result = result.filter(row => {
        return Object.values(row).some(val =>
          String(val).toLowerCase().includes(this.searchQuery)
        );
      });
    }

    if (this.sortKey) {
      result.sort((a, b) => {
        const valA = a[this.sortKey];
        const valB = b[this.sortKey];

        if (typeof valA === 'number' && typeof valB === 'number') {
          return this.sortAsc ? valA - valB : valB - valA;
        }

        const strA = String(valA || '').toLowerCase();
        const strB = String(valB || '').toLowerCase();
        return this.sortAsc ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    this.filteredData = result;
    this.render();
  }

  handleSort(key) {
    if (this.sortKey === key) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortKey = key;
      this.sortAsc = true;
    }
    this.applyFilters();
  }

  render() {
    const totalItems = this.filteredData.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / this.pageSize));
    if (this.currentPage > totalPages) this.currentPage = totalPages;

    const start = (this.currentPage - 1) * this.pageSize;
    const paginated = this.filteredData.slice(start, start + this.pageSize);

    this.innerHTML = `
      <div class="flex flex-col h-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div class="overflow-x-auto flex-1 overscroll-x-contain">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                ${this.columns.map(col => `
                  <th class="py-3 px-4 ${col.sortable !== false ? 'cursor-pointer select-none hover:text-slate-900 transition-colors' : ''}" data-col="${col.key}">
                    <div class="flex items-center gap-1.5 whitespace-nowrap">
                      <span>${escapeHtml(col.label)}</span>
                      ${this.sortKey === col.key ? `<span class="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-200 text-slate-700 font-bold">${this.sortAsc ? 'Asc' : 'Desc'}</span>` : ''}
                    </div>
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-normal text-slate-700">
              ${paginated.length === 0 ? `
                <tr>
                  <td colspan="${this.columns.length}" class="py-16 text-center text-slate-400">
                    <div class="flex flex-col items-center justify-center gap-2">
                      <span class="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">0</span>
                      <p class="text-xs font-bold text-slate-700">No records found</p>
                      <p class="text-[11px] text-slate-500 max-w-xs">Try adjusting your search query or reset table filters.</p>
                    </div>
                  </td>
                </tr>
              ` : paginated.map((row, idx) => `
                <tr class="hover:bg-slate-50 transition-colors group cursor-pointer ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}" data-row-id="${escapeHtml(row.id || row.barcode)}">
                  ${this.columns.map(col => `
                    <td class="py-3 px-4 whitespace-nowrap text-xs">
                      ${col.render ? col.render(row) : escapeHtml(row[col.key] ?? '—')}
                    </td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 shrink-0 select-none">
          <div class="text-center sm:text-left">
            Showing <span class="font-bold text-slate-800 tabular-nums">${totalItems > 0 ? start + 1 : 0}</span> to <span class="font-bold text-slate-800 tabular-nums">${Math.min(start + this.pageSize, totalItems)}</span> of <span class="font-bold text-slate-800 tabular-nums">${totalItems}</span> entries
          </div>
          <div class="flex items-center gap-2">
            <button id="prev-page" class="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer font-bold active:scale-95 shadow-2xs" ${this.currentPage <= 1 ? 'disabled' : ''}>
              Previous
            </button>
            <span class="px-2 text-slate-600 font-mono text-[11px]">Page <strong class="text-slate-900">${this.currentPage}</strong> of ${totalPages}</span>
            <button id="next-page" class="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer font-bold active:scale-95 shadow-2xs" ${this.currentPage >= totalPages ? 'disabled' : ''}>
              Next
            </button>
          </div>
        </div>
      </div>
    `;

    this.querySelectorAll('th[data-col]').forEach(th => {
      const key = th.getAttribute('data-col');
      const colDef = this.columns.find(c => c.key === key);
      if (colDef && colDef.sortable !== false) {
        th.addEventListener('click', () => this.handleSort(key));
      }
    });

    const prevBtn = this.querySelector('#prev-page');
    const nextBtn = this.querySelector('#next-page');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.render();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (this.currentPage < totalPages) {
          this.currentPage++;
          this.render();
        }
      });
    }
  }
}

customElements.define('data-table', DataTable);
