import { inventoryService } from '../../services/inventory.service.js';
import { barcodeLookupService } from '../../services/barcode-lookup.service.js';
import { showToast, escapeHtml } from '../../utils/dom.js';
import '../common/barcode-scanner-modal.js';
import '../common/app-modal.js';

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
    let modal = this.querySelector('app-modal');
    if (!modal) {
      this.render();
      modal = this.querySelector('app-modal');
    }
    if (!modal) return;

    const content = document.createElement('form');
    content.id = 'product-modal-form';
    content.className = 'space-y-4';

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
      <div class="space-y-4">
        <div>
          <label class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Product Name *</label>
          <input
            id="input-product-name"
            name="name"
            type="text"
            required
            value="${escapeHtml(p.name)}"
            placeholder="e.g. San Miguel Pale Pilsen 330ml"
            class="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs font-semibold"
          />
        </div>

        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Barcode / SKU</label>
            <div class="flex items-center gap-1.5">
              <button type="button" id="form-scan-camera-btn" class="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer">
                Scan Camera
              </button>
              <button type="button" id="form-lookup-barcode-btn" class="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer">
                Lookup Details
              </button>
            </div>
          </div>
          <input
            id="input-barcode"
            name="barcode"
            type="text"
            value="${escapeHtml(p.barcode || '')}"
            placeholder="e.g. 480000000001 (Optional)"
            class="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs font-bold"
          />
        </div>

        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Product Photo</label>
            <div class="flex items-center gap-1.5">
              <input type="file" id="form-upload-file-input" accept="image/*" class="hidden" />
              <input type="file" id="form-camera-snap-input" accept="image/*" capture="environment" class="hidden" />
              <button type="button" id="form-upload-photo-btn" class="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer">
                Upload Photo
              </button>
              <button type="button" id="form-snap-camera-btn" class="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer">
                Camera Snap
              </button>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div id="image-preview-box" class="w-14 h-14 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
              ${p.imageUrl ? `<img src="${escapeHtml(p.imageUrl)}" alt="Preview" class="w-full h-full object-contain p-1" onerror="this.parentElement.innerHTML='<span class=\\'text-[10px] text-slate-400 font-bold\\'>No Pic</span>'" />` : `<span class="text-[10px] text-slate-400 font-bold">No Pic</span>`}
            </div>
            <input
              id="input-image-url"
              name="imageUrl"
              type="text"
              value="${escapeHtml(p.imageUrl || '')}"
              placeholder="https://... or photo data URL"
              class="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Category *</label>
            <select
              id="input-category"
              name="category"
              class="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 shadow-2xs font-semibold"
            >
              ${Array.from(new Set(['Beverages', 'Snacks', 'Groceries', 'Household', 'General', p.category].filter(Boolean))).map(cat => `
                <option value="${escapeHtml(cat)}" ${p.category === cat ? 'selected' : ''}>${escapeHtml(cat)}</option>
              `).join('')}
            </select>
          </div>

          <div>
            <label class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Cost Price (PHP)</label>
            <input
              id="input-cost-price"
              name="costPrice"
              type="number"
              step="0.01"
              min="0"
              value="${p.costPrice !== '' && p.costPrice !== undefined && p.costPrice !== null ? p.costPrice : ''}"
              placeholder="0.00 (Optional)"
              class="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs font-bold"
            />
          </div>

          <div>
            <label class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Selling Price (PHP) *</label>
            <input
              id="input-selling-price"
              name="sellingPrice"
              type="number"
              step="0.01"
              min="0"
              required
              value="${p.sellingPrice !== '' && p.sellingPrice !== undefined && p.sellingPrice !== null ? p.sellingPrice : ''}"
              placeholder="0.00"
              class="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs font-bold"
            />
          </div>

          <div>
            <label class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Gross Margin Preview</label>
            <div class="h-[42px] px-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <span class="text-slate-500 text-[11px]">Profit:</span>
              <span id="margin-calc-text" class="font-mono font-bold text-slate-900 tabular-nums">—</span>
            </div>
          </div>

          <div>
            <label class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Initial Stock *</label>
            <input
              name="stock"
              type="number"
              min="0"
              required
              value="${p.stock !== undefined && p.stock !== null ? p.stock : 0}"
              class="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs font-bold"
            />
          </div>

          <div>
            <label class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Low Stock Alert *</label>
            <input
              name="lowStockThreshold"
              type="number"
              min="1"
              required
              value="${p.lowStockThreshold || 10}"
              class="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs font-bold"
            />
          </div>
        </div>

        <div class="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            name="isActive"
            id="is-active-chk"
            ${p.isActive !== false ? 'checked' : ''}
            class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 accent-emerald-600 cursor-pointer"
          />
          <label for="is-active-chk" class="text-xs font-bold text-slate-700 cursor-pointer select-none">
            Active in POS catalog
          </label>
        </div>
      </div>

      <div class="flex items-center gap-2 pt-3 border-t border-slate-100">
        <button type="button" id="form-cancel-btn" class="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer">
          Cancel
        </button>
        <button type="submit" id="form-submit-btn" class="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5">
          <span>${isEdit ? 'Save Changes' : 'Create Product'}</span>
        </button>
      </div>
    `;

    modal.open({
      title: isEdit ? 'Edit Product SKU' : 'New Catalog Item',
      subtitle: isEdit ? `SKU: ${p.barcode || p.id}` : 'Fill in product information and pricing',
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
      const hasCost = costInput.value !== '' && !isNaN(parseFloat(costInput.value));
      const sell = parseFloat(sellInput.value) || 0;
      if (sell > 0 && hasCost) {
        const cost = parseFloat(costInput.value);
        const profit = sell - cost;
        const margin = (profit / sell) * 100;
        marginText.textContent = `PHP ${profit.toFixed(2)} (${margin.toFixed(0)}%)`;
        marginText.className = margin >= 0 ? 'font-mono font-bold text-emerald-700 tabular-nums' : 'font-mono font-bold text-rose-600 tabular-nums';
      } else {
        marginText.textContent = '—';
      }
    };

    const updateImagePreview = (url) => {
      if (!imagePreviewBox) return;
      const cleanUrl = String(url || '').trim();
      if (cleanUrl) {
        imagePreviewBox.innerHTML = `<img src="${escapeHtml(cleanUrl)}" alt="Preview" class="w-full h-full object-contain p-1" onerror="this.parentElement.innerHTML='<span class=\\'text-[10px] text-slate-400 font-bold\\'>No Pic</span>'" />`;
      } else {
        imagePreviewBox.innerHTML = `<span class="text-[10px] text-slate-400 font-bold">No Pic</span>`;
      }
    };

    costInput.addEventListener('input', updateMargin);
    sellInput.addEventListener('input', updateMargin);
    updateMargin();

    imageInput.addEventListener('input', () => updateImagePreview(imageInput.value));

    const uploadBtn = content.querySelector('#form-upload-photo-btn');
    const uploadInput = content.querySelector('#form-upload-file-input');
    const snapBtn = content.querySelector('#form-snap-camera-btn');
    const snapInput = content.querySelector('#form-camera-snap-input');

    const handleFileChosen = (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        imageInput.value = dataUrl;
        updateImagePreview(dataUrl);
        showToast('Product photo loaded', 'success');
      };
      reader.readAsDataURL(file);
    };

    if (uploadBtn && uploadInput) {
      uploadBtn.addEventListener('click', () => uploadInput.click());
      uploadInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleFileChosen(e.target.files[0]);
        }
      });
    }

    if (snapBtn && snapInput) {
      snapBtn.addEventListener('click', () => snapInput.click());
      snapInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleFileChosen(e.target.files[0]);
        }
      });
    }

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
          lookupBtn.textContent = 'Lookup Details';
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

      const rawBarcode = (formData.get('barcode') || '').trim();
      const rawCost = formData.get('costPrice');
      const data = {
        name: formData.get('name'),
        barcode: rawBarcode ? rawBarcode : null,
        category: formData.get('category'),
        costPrice: rawCost !== null && rawCost !== '' && !isNaN(parseFloat(rawCost)) ? parseFloat(rawCost) : null,
        sellingPrice: parseFloat(formData.get('sellingPrice')) || 0,
        stock: parseInt(formData.get('stock'), 10) || 0,
        lowStockThreshold: parseInt(formData.get('lowStockThreshold'), 10) || 10,
        isActive: formData.get('isActive') === 'on',
        imageUrl: (formData.get('imageUrl') || '').trim(),
      };

      try {
        if (isEdit) {
          const prodId = this.editingProduct.id || this.editingProduct.barcode;
          await inventoryService.updateProduct(prodId, data);
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
              imagePreviewBox.innerHTML = `<img src="${escapeHtml(productInfo.imageUrl)}" alt="Preview" class="w-full h-full object-contain p-1" onerror="this.parentElement.innerHTML='<span class=\\'text-[10px] text-slate-400 font-bold\\'>No Pic</span>'" />`;
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
