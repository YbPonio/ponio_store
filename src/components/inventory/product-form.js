import { inventoryService } from '../../services/inventory.service.js';
import { barcodeLookupService } from '../../services/barcode-lookup.service.js';
import { ICONS, showToast, escapeHtml } from '../../utils/dom.js';
import '../common/barcode-scanner-modal.js';

export class ProductForm extends HTMLElement {
  constructor() {
    super();
    this.modal = null;
    this.editingProduct = null;
  }

  connectedCallback() {
    this.render();
  }

  open(product = null, prefill = null) {
    this.editingProduct = product;
    const isEdit = Boolean(product);
    const modal = this.querySelector('app-modal');
    if (!modal) return;

    const content = document.createElement('form');
    content.id = 'product-modal-form';
    content.className = 'space-y-3.5';

    const p = product || {
      barcode: prefill?.barcode || '',
      name: prefill?.name || '',
      category: prefill?.category || 'Beverages',
      costPrice: '',
      sellingPrice: prefill?.sellingPrice !== undefined && prefill.sellingPrice > 0 ? prefill.sellingPrice : '',
      stock: 0,
      lowStockThreshold: 10,
      isActive: true,
      imageUrl: prefill?.imageUrl || '',
    };

    content.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="sm:col-span-2">
          <label class="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">Product Name *</label>
          <input
            id="input-product-name"
            name="name"
            type="text"
            required
            value="${escapeHtml(p.name)}"
            placeholder="e.g. Barako Ground Coffee 250g"
            class="w-full px-3 py-2.5 sm:py-2 rounded-xl bg-white border border-slate-300 text-sm sm:text-xs text-slate-900 focus:outline-none focus:border-slate-800 shadow-2xs font-medium"
          />
        </div>

        <div class="sm:col-span-2">
          <div class="flex items-center justify-between mb-1">
            <label class="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Barcode / SKU *</label>
            <div class="flex items-center gap-1.5">
              <button type="button" id="form-scan-camera-btn" class="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer">
                Scan Camera
              </button>
              <button type="button" id="form-lookup-barcode-btn" class="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer">
                Lookup Info
              </button>
            </div>
          </div>
          <input
            id="input-barcode"
            name="barcode"
            type="text"
            required
            value="${escapeHtml(p.barcode || '')}"
            placeholder="e.g. 480000000001"
            class="w-full px-3 py-2.5 sm:py-2 rounded-xl bg-white border border-slate-300 text-sm sm:text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-800 shadow-2xs font-medium"
          />
        </div>

        <div class="sm:col-span-2">
          <label class="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">Product Image URL (Optional)</label>
          <div class="flex items-center gap-2.5">
            <div id="image-preview-box" class="w-14 h-14 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
              ${p.imageUrl ? `<img src="${escapeHtml(p.imageUrl)}" alt="Preview" class="w-full h-full object-contain p-1" onerror="this.parentElement.innerHTML='<span class=\\'text-xs text-slate-400 font-bold\\'>No Pic</span>'" />` : `<span class="text-xs text-slate-400 font-bold">No Pic</span>`}
            </div>
            <input
              id="input-image-url"
              name="imageUrl"
              type="url"
              value="${escapeHtml(p.imageUrl || '')}"
              placeholder="https://images.barcodelookup.com/... or image URL"
              class="w-full px-3 py-2.5 sm:py-2 rounded-xl bg-white border border-slate-300 text-sm sm:text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-800 shadow-2xs font-medium"
            />
          </div>
        </div>

        <div>
          <label class="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">Category *</label>
          <select
            id="input-category"
            name="category"
            class="w-full px-3 py-2.5 sm:py-2 rounded-xl bg-white border border-slate-300 text-sm sm:text-xs text-slate-900 focus:outline-none focus:border-slate-800 shadow-2xs font-medium"
          >
            ${['Beverages', 'Snacks', 'Groceries', 'Household', 'General'].map(cat => `
              <option value="${cat}" ${p.category === cat ? 'selected' : ''}>${cat}</option>
            `).join('')}
          </select>
        </div>

        <div>
          <label class="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">Cost Price (PHP) *</label>
          <input
            id="input-cost-price"
            name="costPrice"
            type="number"
            step="0.01"
            min="0"
            required
            value="${p.costPrice !== '' ? p.costPrice : ''}"
            placeholder="0.00"
            class="w-full px-3 py-2.5 sm:py-2 rounded-xl bg-white border border-slate-300 text-sm sm:text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-800 shadow-2xs font-medium"
          />
        </div>

        <div>
          <label class="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">Selling Price (PHP) *</label>
          <input
            id="input-selling-price"
            name="sellingPrice"
            type="number"
            step="0.01"
            min="0"
            required
            value="${p.sellingPrice !== '' ? p.sellingPrice : ''}"
            placeholder="0.00"
            class="w-full px-3 py-2.5 sm:py-2 rounded-xl bg-white border border-slate-300 text-sm sm:text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-800 shadow-2xs font-medium"
          />
        </div>

        <div class="sm:col-span-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
          <span class="text-slate-500">Projected Margin:</span>
          <span id="margin-calc-text" class="font-mono font-bold text-slate-900">—</span>
        </div>

        <div>
          <label class="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">Current Stock *</label>
          <input
            name="stock"
            type="number"
            min="0"
            required
            value="${p.stock}"
            class="w-full px-3 py-2.5 sm:py-2 rounded-xl bg-white border border-slate-300 text-sm sm:text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-800 shadow-2xs font-medium"
          />
        </div>

        <div>
          <label class="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">Low Stock Alert *</label>
          <input
            name="lowStockThreshold"
            type="number"
            min="1"
            required
            value="${p.lowStockThreshold || 10}"
            class="w-full px-3 py-2.5 sm:py-2 rounded-xl bg-white border border-slate-300 text-sm sm:text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-800 shadow-2xs font-medium"
          />
        </div>

        <div class="sm:col-span-2 flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            name="isActive"
            id="is-active-chk"
            ${p.isActive ? 'checked' : ''}
            class="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-4 h-4 accent-slate-900 cursor-pointer"
          />
          <label for="is-active-chk" class="text-xs font-medium text-slate-700 cursor-pointer select-none">
            Active in POS catalog
          </label>
        </div>
      </div>

      <div class="flex items-center gap-2.5 pt-2 border-t border-slate-100">
        <button type="button" id="form-cancel-btn" class="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-all cursor-pointer">
          Cancel
        </button>
        <button type="submit" id="form-submit-btn" class="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5">
          <span>${ICONS.check}</span>
          <span>${isEdit ? 'Save Changes' : 'Create Product'}</span>
        </button>
      </div>
    `;

    modal.open({
      title: isEdit ? 'Edit Product' : 'Add New Product',
      subtitle: isEdit ? `SKU: ${p.barcode || p.id}` : 'Fill in item details and pricing',
      content,
      maxWidth: 'max-w-lg',
    });

    const costInput = content.querySelector('#input-cost-price');
    const sellInput = content.querySelector('#input-selling-price');
    const marginText = content.querySelector('#margin-calc-text');
    const barcodeInput = content.querySelector('#input-barcode');
    const nameInput = content.querySelector('#input-product-name');
    const catSelect = content.querySelector('#input-category');
    const imageInput = content.querySelector('#input-image-url');
    const imagePreviewBox = content.querySelector('#image-preview-box');
    const scanBtn = content.querySelector('#form-scan-camera-btn');
    const lookupBtn = content.querySelector('#form-lookup-barcode-btn');

    const updateMargin = () => {
      const cost = parseFloat(costInput.value) || 0;
      const sell = parseFloat(sellInput.value) || 0;
      if (sell > 0) {
        const profit = sell - cost;
        const margin = (profit / sell) * 100;
        marginText.textContent = `PHP ${profit.toFixed(2)} (${margin.toFixed(1)}%)`;
        marginText.className = margin >= 0 ? 'font-mono font-bold text-emerald-700' : 'font-mono font-bold text-rose-600';
      } else {
        marginText.textContent = '—';
      }
    };

    const updateImagePreview = (url) => {
      if (!imagePreviewBox) return;
      const cleanUrl = String(url || '').trim();
      if (cleanUrl) {
        imagePreviewBox.innerHTML = `<img src="${escapeHtml(cleanUrl)}" alt="Preview" class="w-full h-full object-contain p-1" onerror="this.parentElement.innerHTML='<span class=\\'text-xs text-slate-400 font-bold\\'>No Pic</span>'" />`;
      } else {
        imagePreviewBox.innerHTML = `<span class="text-xs text-slate-400 font-bold">No Pic</span>`;
      }
    };

    costInput.addEventListener('input', updateMargin);
    sellInput.addEventListener('input', updateMargin);
    updateMargin();

    imageInput.addEventListener('input', () => updateImagePreview(imageInput.value));

    if (scanBtn) {
      scanBtn.addEventListener('click', () => {
        const scanner = this.querySelector('barcode-scanner-modal');
        if (scanner) {
          scanner.open();
        }
      });
    }

    if (lookupBtn) {
      lookupBtn.addEventListener('click', async () => {
        const code = (barcodeInput.value || '').trim();
        if (!code) {
          showToast('Please enter a barcode number first', 'warning');
          return;
        }

        lookupBtn.disabled = true;
        lookupBtn.textContent = 'Searching...';

        try {
          const info = await barcodeLookupService.lookup(code);
          if (info && info.found) {
            if (nameInput && (!nameInput.value || nameInput.value === '')) {
              nameInput.value = info.name || '';
            } else if (nameInput && info.name) {
              nameInput.value = info.name;
            }

            if (catSelect && info.category) {
              catSelect.value = info.category;
            }

            if (imageInput && info.imageUrl) {
              imageInput.value = info.imageUrl;
              updateImagePreview(info.imageUrl);
            }

            if (sellInput && info.sellingPrice > 0 && (!sellInput.value || sellInput.value === '0')) {
              sellInput.value = info.sellingPrice;
              updateMargin();
            }

            showToast(`Loaded details for "${info.name || code}"`, 'success');
          } else {
            showToast('No product details found for this barcode', 'info');
          }
        } catch (e) {
          showToast('Barcode lookup failed: ' + (e.message || 'Network error'), 'error');
        } finally {
          lookupBtn.disabled = false;
          lookupBtn.textContent = 'Lookup Info';
        }
      });
    }

    content.querySelector('#form-cancel-btn').addEventListener('click', () => modal.close());

    content.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(content);
      const submitBtn = content.querySelector('#form-submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';

      const data = {
        name: formData.get('name'),
        barcode: formData.get('barcode'),
        category: formData.get('category'),
        costPrice: parseFloat(formData.get('costPrice')) || 0,
        sellingPrice: parseFloat(formData.get('sellingPrice')) || 0,
        stock: parseInt(formData.get('stock'), 10) || 0,
        lowStockThreshold: parseInt(formData.get('lowStockThreshold'), 10) || 10,
        isActive: formData.get('isActive') === 'on',
        imageUrl: (formData.get('imageUrl') || '').trim(),
      };

      try {
        if (isEdit) {
          await inventoryService.updateProduct(this.editingProduct.id, data);
          showToast(`Updated "${data.name}"`, 'success');
        } else {
          await inventoryService.addProduct(data);
          showToast(`Created "${data.name}"`, 'success');
        }
        modal.close();
      } catch (err) {
        console.error('Failed saving product:', err);
        showToast(err.message || 'Error saving product.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = isEdit ? 'Save Changes' : 'Create Product';
      }
    });
  }

  render() {
    this.innerHTML = `
      <app-modal></app-modal>
      <barcode-scanner-modal></barcode-scanner-modal>
    `;

    const scanner = this.querySelector('barcode-scanner-modal');
    if (scanner) {
      scanner.addEventListener('barcode-scanned', (e) => {
        const { barcode, productInfo } = e.detail;
        const barcodeInput = this.querySelector('#input-barcode');
        const nameInput = this.querySelector('#input-product-name');
        const catSelect = this.querySelector('#input-category');
        const imageInput = this.querySelector('#input-image-url');
        const imagePreviewBox = this.querySelector('#image-preview-box');
        const sellInput = this.querySelector('#input-selling-price');

        if (barcodeInput) barcodeInput.value = barcode;
        if (productInfo && productInfo.found) {
          if (nameInput) nameInput.value = productInfo.name || '';
          if (catSelect && productInfo.category) catSelect.value = productInfo.category;
          if (imageInput && productInfo.imageUrl) {
            imageInput.value = productInfo.imageUrl;
            if (imagePreviewBox) {
              imagePreviewBox.innerHTML = `<img src="${escapeHtml(productInfo.imageUrl)}" alt="Preview" class="w-full h-full object-contain p-1" onerror="this.parentElement.innerHTML='<span class=\\'text-xs text-slate-400 font-bold\\'>No Pic</span>'" />`;
            }
          }
          if (sellInput && productInfo.sellingPrice > 0) {
            sellInput.value = productInfo.sellingPrice;
          }
          showToast(`Scanned and loaded "${productInfo.name || barcode}"`, 'success');
        } else {
          showToast(`Scanned barcode: ${barcode}`, 'info');
        }
      });
    }
  }
}

customElements.define('product-form', ProductForm);
