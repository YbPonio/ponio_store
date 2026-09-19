import { escapeHtml, ICONS } from '../../utils/dom.js';

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
      <div class="flex flex-col h-full bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs">
        <div class="overflow-x-auto flex-1 overscroll-x-contain">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-50/80 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                ${this.columns.map(col => `
                  <th class="py-2.5 sm:py-3 px-3 sm:px-4 ${col.sortable !== false ? 'cursor-pointer select-none hover:text-slate-900' : ''}" data-col="${col.key}">
                    <div class="flex items-center gap-1.5 whitespace-nowrap">
                      <span>${escapeHtml(col.label)}</span>
                      ${this.sortKey === col.key ? `<span>${this.sortAsc ? '↑' : '↓'}</span>` : ''}
                    </div>
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-normal text-slate-700">
              ${paginated.length === 0 ? `
                <tr>
                  <td colspan="${this.columns.length}" class="py-12 text-center text-slate-400">
                    <div class="flex flex-col items-center justify-center gap-1.5">
                      <span class="text-slate-400">${ICONS.box}</span>
                      <p class="text-xs font-medium text-slate-500">No matching records found.</p>
                    </div>
                  </td>
                </tr>
              ` : paginated.map(row => `
                <tr class="hover:bg-slate-50/80 transition-colors group cursor-pointer" data-row-id="${escapeHtml(row.id || row.barcode)}">
                  ${this.columns.map(col => `
                    <td class="py-2.5 sm:py-3 px-3 sm:px-4 whitespace-nowrap text-xs">
                      ${col.render ? col.render(row) : escapeHtml(row[col.key] ?? '—')}
                    </td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 py-2.5 sm:px-4 border-t border-slate-200/80 bg-slate-50/60 text-[11px] text-slate-500 shrink-0 select-none">
          <div class="text-center sm:text-left">
            Showing <span class="font-semibold text-slate-800">${totalItems > 0 ? start + 1 : 0}</span> to <span class="font-semibold text-slate-800">${Math.min(start + this.pageSize, totalItems)}</span> of <span class="font-semibold text-slate-800">${totalItems}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <button id="prev-page" class="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer font-medium active:scale-95" ${this.currentPage <= 1 ? 'disabled' : ''}>
              Prev
            </button>
            <span class="px-1.5 text-slate-500 text-[11px]">Page <strong class="text-slate-800">${this.currentPage}</strong> / ${totalPages}</span>
            <button id="next-page" class="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer font-medium active:scale-95" ${this.currentPage >= totalPages ? 'disabled' : ''}>
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
