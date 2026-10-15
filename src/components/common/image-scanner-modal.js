import { visualRecognitionService } from '../../services/visual-recognition.service.js';
import { inventoryService } from '../../services/inventory.service.js';
import { formatCurrency } from '../../utils/formatters.js';
import { showToast, emitEvent, escapeHtml } from '../../utils/dom.js';

export class ImageScannerModal extends HTMLElement {
  constructor() {
    super();
    this.dialog = null;
    this.stream = null;
    this.activeTab = 'camera';
    this.cameras = [];
    this.selectedCameraId = null;
    this.isAnalyzing = false;
    this.capturedDataUrl = null;
    this.matchResults = [];
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    this.stopCamera();
  }

  async open() {
    if (!this.dialog) {
      this.render();
    }
    this.resetState();
    this.dialog.showModal();
    if (this.activeTab === 'camera') {
      await this.startCamera();
    }
  }

  close() {
    this.stopCamera();
    if (this.dialog && this.dialog.open) {
      this.dialog.close();
    }
    this.resetState();
  }

  resetState() {
    this.capturedDataUrl = null;
    this.matchResults = [];
    this.isAnalyzing = false;
    const resultBox = this.querySelector('#visual-result-container');
    if (resultBox) {
      resultBox.innerHTML = '';
      resultBox.classList.add('hidden');
    }
    const captureBox = this.querySelector('#visual-capture-container');
    if (captureBox) {
      captureBox.classList.remove('hidden');
    }
  }

  async loadCameras() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.cameras = devices.filter(d => d.kind === 'videoinput');
      const select = this.querySelector('#visual-camera-select');
      if (select) {
        select.innerHTML = this.cameras.map((cam, idx) => `
          <option value="${cam.deviceId}" ${idx === 0 ? 'selected' : ''}>
            ${escapeHtml(cam.label || `Camera ${idx + 1}`)}
          </option>
        `).join('');
        if (this.cameras.length > 1) {
          select.classList.remove('hidden');
        } else {
          select.classList.add('hidden');
        }
      }
    } catch {}
  }

  async startCamera() {
    this.stopCamera();
    const video = this.querySelector('#visual-video');
    const errorBox = this.querySelector('#visual-camera-error');
    if (!video) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (errorBox) {
        errorBox.textContent = 'Camera API is not supported in this browser environment.';
        errorBox.classList.remove('hidden');
      }
      return;
    }

    try {
      if (errorBox) errorBox.classList.add('hidden');
      const constraints = {
        video: this.selectedCameraId
          ? { deviceId: { exact: this.selectedCameraId } }
          : { facingMode: { ideal: 'environment' } }
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = this.stream;
      await video.play();
      await this.loadCameras();
    } catch (err) {
      if (errorBox) {
        errorBox.textContent = 'Camera access denied or unavailable. You can use Photo Upload instead.';
        errorBox.classList.remove('hidden');
      }
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    const video = this.querySelector('#visual-video');
    if (video) {
      video.srcObject = null;
    }
  }

  async captureFromVideo() {
    const video = this.querySelector('#visual-video');
    if (!video || !this.stream) {
      showToast('Camera is not active', 'warning');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    this.capturedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

    await this.runRecognition(canvas);
  }

  async captureFromFile(file) {
    if (!file) return;
    try {
      this.capturedDataUrl = await visualRecognitionService.fileToDataUrl(file);
      const img = new Image();
      img.onload = async () => {
        await this.runRecognition(img);
      };
      img.src = this.capturedDataUrl;
    } catch (err) {
      showToast('Error reading selected image file', 'error');
    }
  }

  async runRecognition(imageSource) {
    this.isAnalyzing = true;
    this.showLoadingView();

    try {
      const allProducts = await inventoryService.getProducts();
      const results = await visualRecognitionService.findMatches(imageSource, allProducts, 4);
      this.matchResults = results;
      this.renderResults();
    } catch (err) {
      this.renderNoMatchView(err.message || 'Visual search failed.');
    } finally {
      this.isAnalyzing = false;
    }
  }

  showLoadingView() {
    const captureBox = this.querySelector('#visual-capture-container');
    const resultBox = this.querySelector('#visual-result-container');
    if (captureBox) captureBox.classList.add('hidden');
    if (resultBox) {
      resultBox.classList.remove('hidden');
      resultBox.innerHTML = `
        <div class="py-12 px-4 flex flex-col items-center justify-center text-center">
          <div class="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-4"></div>
          <p class="text-sm font-bold text-slate-900">Comparing Image with Product Catalog...</p>
          <p class="text-xs text-slate-500 mt-1 max-w-xs">
            Extracting perceptual hash, color distribution, and luminance vectors.
          </p>
        </div>
      `;
    }
  }

  renderResults() {
    const captureBox = this.querySelector('#visual-capture-container');
    const resultBox = this.querySelector('#visual-result-container');
    if (captureBox) captureBox.classList.add('hidden');
    if (!resultBox) return;

    resultBox.classList.remove('hidden');

    if (!this.matchResults || this.matchResults.length === 0 || this.matchResults[0].score < 0.25) {
      this.renderNoMatchView('No matching products found with sufficient visual similarity.');
      return;
    }

    const topMatch = this.matchResults[0];
    const p = topMatch.product;
    const scorePct = topMatch.confidencePercent;

    let confidenceClass = 'bg-emerald-50 text-emerald-800 border-emerald-300';
    let confidenceLabel = 'High Visual Match';
    if (scorePct < 60) {
      confidenceClass = 'bg-amber-50 text-amber-800 border-amber-300';
      confidenceLabel = 'Moderate Match';
    } else if (scorePct < 40) {
      confidenceClass = 'bg-slate-50 text-slate-700 border-slate-300';
      confidenceLabel = 'Low Confidence';
    }

    const isOutOfStock = p.stock <= 0;

    const alternatives = this.matchResults.slice(1).filter(m => m.score >= 0.30);

    resultBox.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between pb-2 border-b border-slate-200">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-600">Match Found</span>
            <span class="px-2 py-0.5 rounded-full text-[11px] font-bold border ${confidenceClass}">
              ${scorePct}% - ${confidenceLabel}
            </span>
          </div>
          <button id="btn-scan-another" type="button" class="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors">
            Scan Again
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <div class="text-[10px] font-bold text-slate-500 uppercase mb-1">Captured Image</div>
            <div class="w-full h-32 rounded-lg bg-slate-900 overflow-hidden flex items-center justify-center border border-slate-200">
              <img src="${this.capturedDataUrl}" alt="Captured" class="w-full h-full object-contain" />
            </div>
          </div>
          <div>
            <div class="text-[10px] font-bold text-slate-500 uppercase mb-1">Catalog Reference</div>
            <div class="w-full h-32 rounded-lg bg-white overflow-hidden flex items-center justify-center border border-slate-200">
              <img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" class="w-full h-full object-contain p-1" onerror="this.parentElement.innerHTML='<span class=\\'text-xs text-slate-400\\'>No Photo</span>'" />
            </div>
          </div>
        </div>

        <div class="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1.5 py-0.5 bg-slate-100 rounded">
                ${escapeHtml(p.category || 'General')}
              </span>
              <h4 class="text-sm font-bold text-slate-900 mt-1">${escapeHtml(p.name)}</h4>
              <p class="text-[11px] font-mono text-slate-500">Barcode / SKU: ${escapeHtml(p.barcode || p.id)}</p>
            </div>
            <div class="text-right">
              <div class="text-[10px] font-bold uppercase text-slate-400">Price</div>
              <div class="text-base font-extrabold text-slate-900 font-mono">${formatCurrency(p.sellingPrice)}</div>
              <div class="text-[11px] font-semibold ${isOutOfStock ? 'text-rose-600' : 'text-emerald-700'} mt-0.5">
                ${isOutOfStock ? 'Out of Stock' : `${p.stock} in stock`}
              </div>
            </div>
          </div>

          <div class="pt-2 flex items-center gap-2">
            <button
              id="btn-add-matched-cart"
              type="button"
              class="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer text-center ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''}"
              ${isOutOfStock ? 'disabled' : ''}
            >
              Add to Cart
            </button>
            <button
              id="btn-close-matched-view"
              type="button"
              class="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>

        ${alternatives.length > 0 ? `
          <div class="pt-1">
            <p class="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Alternative Matches</p>
            <div class="space-y-1.5">
              ${alternatives.map(alt => `
                <div class="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition-colors">
                  <div class="flex items-center gap-2 min-w-0">
                    <div class="w-8 h-8 rounded bg-slate-50 border border-slate-200 overflow-hidden shrink-0">
                      <img src="${escapeHtml(alt.product.imageUrl)}" alt="${escapeHtml(alt.product.name)}" class="w-full h-full object-contain" />
                    </div>
                    <div class="truncate">
                      <p class="text-xs font-semibold text-slate-900 truncate">${escapeHtml(alt.product.name)}</p>
                      <p class="text-[10px] text-slate-500 font-mono">${formatCurrency(alt.product.sellingPrice)} - ${alt.confidencePercent}% match</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    data-select-id="${escapeHtml(alt.product.id || alt.product.barcode)}"
                    class="alt-select-btn px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-900 hover:text-white text-[11px] font-bold text-slate-700 transition-colors cursor-pointer shrink-0"
                  >
                    Select
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    const scanAnotherBtn = resultBox.querySelector('#btn-scan-another');
    if (scanAnotherBtn) {
      scanAnotherBtn.addEventListener('click', () => {
        this.resetState();
        if (this.activeTab === 'camera') {
          this.startCamera();
        }
      });
    }

    const addCartBtn = resultBox.querySelector('#btn-add-matched-cart');
    if (addCartBtn && !isOutOfStock) {
      addCartBtn.addEventListener('click', () => {
        emitEvent(this, 'add-to-cart', { product: p });
        showToast(`Added "${p.name}" to cart`, 'success');
        this.close();
      });
    }

    const doneBtn = resultBox.querySelector('#btn-close-matched-view');
    if (doneBtn) {
      doneBtn.addEventListener('click', () => this.close());
    }

    resultBox.querySelectorAll('.alt-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-select-id');
        const selected = alternatives.find(a => (a.product.id || a.product.barcode) === id);
        if (selected) {
          this.matchResults = [selected, ...alternatives.filter(a => a !== selected)];
          this.renderResults();
        }
      });
    });
  }

  renderNoMatchView(message) {
    const captureBox = this.querySelector('#visual-capture-container');
    const resultBox = this.querySelector('#visual-result-container');
    if (captureBox) captureBox.classList.add('hidden');
    if (!resultBox) return;

    resultBox.classList.remove('hidden');
    resultBox.innerHTML = `
      <div class="py-8 px-4 text-center space-y-3">
        <div class="w-12 h-12 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center mx-auto text-slate-600 font-bold text-sm">
          No Match
        </div>
        <div>
          <h4 class="text-sm font-bold text-slate-900">Product Not Recognized</h4>
          <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
            ${escapeHtml(message)}
          </p>
        </div>
        ${this.capturedDataUrl ? `
          <div class="w-36 h-28 mx-auto rounded-lg overflow-hidden border border-slate-200 bg-slate-100 mt-2">
            <img src="${this.capturedDataUrl}" alt="Captured" class="w-full h-full object-contain" />
          </div>
        ` : ''}
        <div class="pt-2 flex items-center justify-center gap-2">
          <button id="btn-try-again" type="button" class="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer">
            Try Again
          </button>
          <button id="btn-dismiss-nomatch" type="button" class="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-colors cursor-pointer">
            Close
          </button>
        </div>
      </div>
    `;

    const tryAgainBtn = resultBox.querySelector('#btn-try-again');
    if (tryAgainBtn) {
      tryAgainBtn.addEventListener('click', () => {
        this.resetState();
        if (this.activeTab === 'camera') {
          this.startCamera();
        }
      });
    }

    const dismissBtn = resultBox.querySelector('#btn-dismiss-nomatch');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => this.close());
    }
  }

  render() {
    this.innerHTML = `
      <dialog id="visual-modal-dialog" class="m-auto w-[90vw] sm:w-[480px] max-w-[480px] rounded-2xl bg-white border border-slate-200 text-slate-900 shadow-2xl overflow-hidden p-0 select-none">
        <div class="flex flex-col max-h-[90dvh]">
          <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
            <div>
              <h3 class="text-xs sm:text-sm font-bold text-slate-900">Visual Product Match</h3>
              <p class="text-[11px] text-slate-500 mt-0.5">Match product image against database catalog</p>
            </div>
            <button id="visual-close-btn" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer font-bold text-xs">
              Close
            </button>
          </div>

          <div class="p-4 flex flex-col space-y-3 bg-white overflow-y-auto">
            <div id="visual-capture-container" class="space-y-3">
              <div class="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button id="tab-camera-btn" type="button" class="flex-1 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-900 shadow-2xs transition-all cursor-pointer text-center">
                  Live Camera
                </button>
                <button id="tab-upload-btn" type="button" class="flex-1 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all cursor-pointer text-center">
                  Upload Photo
                </button>
              </div>

              <div id="panel-camera" class="space-y-3">
                <div class="relative w-full aspect-4/3 max-h-[260px] bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200">
                  <video id="visual-video" class="w-full h-full object-cover" autoplay playsinline muted></video>

                  <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-4">
                    <div class="w-48 h-40 border-2 border-dashed border-sky-400 rounded-xl relative">
                      <div class="absolute inset-0 bg-sky-400/5 rounded-xl"></div>
                    </div>
                    <span class="mt-2 text-[10px] font-bold text-white bg-slate-900/80 px-2 py-0.5 rounded-full">
                      Center product in box
                    </span>
                  </div>

                  <div id="visual-camera-error" class="absolute inset-0 bg-slate-900/95 flex items-center justify-center text-white text-xs p-4 text-center hidden">
                    Camera access error
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <select id="visual-camera-select" class="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-slate-800 shadow-2xs hidden font-medium">
                  </select>
                  <button id="btn-capture-video" type="button" class="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer text-center">
                    Capture & Match
                  </button>
                </div>
              </div>

              <div id="panel-upload" class="space-y-3 hidden">
                <div id="drop-zone" class="w-full border-2 border-dashed border-slate-300 hover:border-slate-800 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-slate-50">
                  <input type="file" id="file-upload-input" accept="image/*" class="hidden" />
                  <p class="text-xs font-bold text-slate-800">Click to Select or Drop Product Photo</p>
                  <p class="text-[11px] text-slate-500 mt-1">Supports PNG, JPG, WebP images</p>
                </div>
              </div>
            </div>

            <div id="visual-result-container" class="hidden"></div>
          </div>
        </div>
      </dialog>
    `;

    this.dialog = this.querySelector('#visual-modal-dialog');

    const closeBtn = this.querySelector('#visual-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    const tabCam = this.querySelector('#tab-camera-btn');
    const tabUp = this.querySelector('#tab-upload-btn');
    const panelCam = this.querySelector('#panel-camera');
    const panelUp = this.querySelector('#panel-upload');

    if (tabCam && tabUp && panelCam && panelUp) {
      tabCam.addEventListener('click', async () => {
        this.activeTab = 'camera';
        tabCam.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-900 shadow-2xs transition-all cursor-pointer text-center';
        tabUp.className = 'flex-1 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all cursor-pointer text-center';
        panelCam.classList.remove('hidden');
        panelUp.classList.add('hidden');
        await this.startCamera();
      });

      tabUp.addEventListener('click', () => {
        this.activeTab = 'upload';
        this.stopCamera();
        tabUp.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-900 shadow-2xs transition-all cursor-pointer text-center';
        tabCam.className = 'flex-1 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all cursor-pointer text-center';
        panelUp.classList.remove('hidden');
        panelCam.classList.add('hidden');
      });
    }

    const captureBtn = this.querySelector('#btn-capture-video');
    if (captureBtn) {
      captureBtn.addEventListener('click', () => this.captureFromVideo());
    }

    const cameraSelect = this.querySelector('#visual-camera-select');
    if (cameraSelect) {
      cameraSelect.addEventListener('change', async (e) => {
        this.selectedCameraId = e.target.value;
        await this.startCamera();
      });
    }

    const dropZone = this.querySelector('#drop-zone');
    const fileInput = this.querySelector('#file-upload-input');
    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-slate-800', 'bg-slate-100');
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-slate-800', 'bg-slate-100');
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-slate-800', 'bg-slate-100');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.captureFromFile(e.dataTransfer.files[0]);
        }
      });
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.captureFromFile(e.target.files[0]);
        }
      });
    }
  }
}

customElements.define('image-scanner-modal', ImageScannerModal);
