import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { barcodeLookupService } from '../../services/barcode-lookup.service.js';
import { showToast, ICONS } from '../../utils/dom.js';

function playBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch {}
}

export class BarcodeScannerModal extends HTMLElement {
  constructor() {
    super();
    this.dialog = null;
    this.html5QrCode = null;
    this.isScanning = false;
    this.cameras = [];
    this.selectedCameraId = null;
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    this.stopScanner();
  }

  render() {
    this.innerHTML = `
      <dialog class="m-auto w-[88vw] max-w-[440px] rounded-2xl bg-white border border-slate-200 text-slate-900 shadow-2xl overflow-hidden p-0 select-none">
        <div class="flex flex-col max-h-[90dvh]">
          <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
            <div>
              <h3 class="text-xs sm:text-sm font-bold text-slate-900">Scan Product Barcode</h3>
              <p class="text-[11px] text-slate-500 mt-0.5">Align barcode within the frame to scan</p>
            </div>
            <button id="scanner-close-btn" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer" title="Close scanner">
              ${ICONS.x}
            </button>
          </div>

          <div class="p-4 flex flex-col space-y-3 bg-white">
            <div id="scanner-viewport-wrapper" class="relative w-full aspect-4/3 bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200">
              <div id="barcode-reader-viewport" class="w-full h-full"></div>

              <div id="scanner-reticle" class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6">
                <div class="w-48 h-32 border-2 border-dashed border-emerald-400 rounded-lg relative">
                  <div class="absolute inset-x-0 top-1/2 h-0.5 bg-emerald-400/80 shadow-xs animate-pulse"></div>
                </div>
              </div>

              <div id="scanner-error-overlay" class="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-white p-4 hidden z-20 text-center">
                <p id="scanner-error-title" class="text-xs font-bold text-rose-400 mb-1">Camera Access Blocked</p>
                <p id="scanner-error-desc" class="text-[11px] text-slate-300 leading-relaxed mb-3 max-w-xs">
                  Please enable camera permission in your browser or switch to HTTPS.
                </p>
                <div class="flex items-center gap-2">
                  <button id="scanner-retry-btn" type="button" class="px-3 py-1.5 rounded-lg bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer">
                    Retry Camera
                  </button>
                  <a id="scanner-https-link" href="https://macos.tail266e58.ts.net" class="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors cursor-pointer hidden">
                    Open HTTPS
                  </a>
                </div>
              </div>

              <div id="scanner-loading-overlay" class="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center text-white p-4 hidden z-20">
                <div class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mb-2"></div>
                <p id="scanner-loading-text" class="text-xs font-semibold text-center">Looking up product info...</p>
              </div>
            </div>

            <div class="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
              <span id="scanner-status-text">Starting camera...</span>
              <span class="font-mono">UPC / EAN / QR</span>
            </div>

            <div class="flex items-center gap-2 pt-1">
              <select id="scanner-camera-select" class="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-700 focus:outline-none focus:border-slate-800">
                <option value="">Detecting cameras...</option>
              </select>

              <label class="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition-colors shrink-0">
                Scan Image
                <input type="file" id="scanner-image-file" accept="image/*" class="hidden" />
              </label>
            </div>
          </div>
        </div>
      </dialog>
    `;

    this.dialog = this.querySelector('dialog');
    const closeBtn = this.querySelector('#scanner-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    const cameraSelect = this.querySelector('#scanner-camera-select');
    if (cameraSelect) {
      cameraSelect.addEventListener('change', (e) => {
        this.selectedCameraId = e.target.value;
        if (this.isScanning) {
          this.startScanner();
        }
      });
    }

    const retryBtn = this.querySelector('#scanner-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', async () => {
        this.hideErrorOverlay();
        await this.startScanner();
        await this.initCameras();
      });
    }

    const fileInput = this.querySelector('#scanner-image-file');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleImageScan(e));
    }

    this.dialog.addEventListener('cancel', () => this.stopScanner());
    this.dialog.addEventListener('click', (e) => {
      const rect = this.dialog.getBoundingClientRect();
      const isInDialog = (
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width
      );
      if (!isInDialog) {
        this.close();
      }
    });
  }

  async open() {
    if (!this.dialog) this.render();
    this.dialog.showModal();
    this.setLoading(false);
    this.hideErrorOverlay();

    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      const httpsUrl = 'https://' + window.location.hostname + (window.location.port ? ':' + window.location.port : '') + window.location.pathname;
      this.showErrorOverlay(
        'HTTPS Required for Camera',
        'Mobile browsers strictly require HTTPS to use the camera. Please access the site using https://macos.tail266e58.ts.net',
        true
      );
      this.setStatus('Camera requires HTTPS context');
      return;
    }

    this.setStatus('Starting camera...');
    await this.startScanner();
    await this.initCameras();
  }

  close() {
    this.stopScanner();
    if (this.dialog && this.dialog.open) {
      this.dialog.close();
    }
  }

  setStatus(text) {
    const el = this.querySelector('#scanner-status-text');
    if (el) el.textContent = text;
  }

  setLoading(show, message = 'Looking up product info...') {
    const overlay = this.querySelector('#scanner-loading-overlay');
    const label = this.querySelector('#scanner-loading-text');
    if (overlay) {
      overlay.classList.toggle('hidden', !show);
    }
    if (label && message) {
      label.textContent = message;
    }
  }

  showErrorOverlay(title, description, showHttpsBtn = false) {
    const overlay = this.querySelector('#scanner-error-overlay');
    const titleEl = this.querySelector('#scanner-error-title');
    const descEl = this.querySelector('#scanner-error-desc');
    const httpsLink = this.querySelector('#scanner-https-link');

    if (overlay) overlay.classList.remove('hidden');
    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = description;
    if (httpsLink) {
      httpsLink.classList.toggle('hidden', !showHttpsBtn);
    }
  }

  hideErrorOverlay() {
    const overlay = this.querySelector('#scanner-error-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  async initCameras() {
    try {
      this.cameras = await Html5Qrcode.getCameras();
      const select = this.querySelector('#scanner-camera-select');
      if (!select) return;

      select.innerHTML = '';
      if (this.cameras && this.cameras.length > 0) {
        this.cameras.forEach(cam => {
          const option = document.createElement('option');
          option.value = cam.id;
          option.textContent = cam.label || `Camera ${select.children.length + 1}`;
          if (cam.id === this.selectedCameraId) option.selected = true;
          select.appendChild(option);
        });
      } else {
        const opt = document.createElement('option');
        opt.textContent = 'Active Camera';
        opt.value = '';
        select.appendChild(opt);
      }
    } catch (err) {
      console.warn('Camera enumeration error', err);
    }
  }

  async startScanner() {
    if (this.isScanning) {
      await this.stopScanner();
    }

    const viewport = this.querySelector('#barcode-reader-viewport');
    if (!viewport) return;

    viewport.innerHTML = '';

    const scannerId = 'barcode-scanner-box-' + Math.random().toString(36).substring(2, 8);
    const box = document.createElement('div');
    box.id = scannerId;
    box.className = 'w-full h-full';
    viewport.appendChild(box);

    try {
      this.html5QrCode = new Html5Qrcode(scannerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });

      const config = {
        fps: 15,
        qrbox: { width: 240, height: 150 },
        aspectRatio: 1.333333,
      };

      const cameraIdOrConfig = this.selectedCameraId
        ? this.selectedCameraId
        : { facingMode: 'environment' };

      try {
        await this.html5QrCode.start(
          cameraIdOrConfig,
          config,
          (decodedText) => this.onBarcodeDetected(decodedText),
          () => {}
        );
      } catch (firstErr) {
        if (!this.selectedCameraId) {
          await this.html5QrCode.start(
            { facingMode: 'user' },
            config,
            (decodedText) => this.onBarcodeDetected(decodedText),
            () => {}
          );
        } else {
          throw firstErr;
        }
      }

      this.isScanning = true;
      this.hideErrorOverlay();
      this.setStatus('Camera active. Point at barcode.');
    } catch (err) {
      console.warn('Failed starting camera scanner', err);
      const isHttpsIssue = typeof window !== 'undefined' && !window.isSecureContext;
      const errorMsg = isHttpsIssue
        ? 'Camera blocked on HTTP. Please use HTTPS: https://macos.tail266e58.ts.net'
        : (err.message || 'Permission denied in browser settings');

      this.setStatus('Cannot access camera');
      this.showErrorOverlay(
        isHttpsIssue ? 'HTTPS Required for Camera' : 'Camera Permission Blocked',
        errorMsg,
        isHttpsIssue
      );
      showToast(isHttpsIssue ? 'Camera requires HTTPS' : 'Camera permission blocked', 'error');
    }
  }

  async stopScanner() {
    if (this.html5QrCode && this.isScanning) {
      try {
        await this.html5QrCode.stop();
        this.html5QrCode.clear();
      } catch (e) {
        console.warn('Scanner stop error', e);
      }
    }
    this.isScanning = false;
  }

  async handleImageScan(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    this.setLoading(true, 'Scanning image file...');
    try {
      if (this.isScanning) {
        await this.stopScanner();
      }

      const tempId = 'temp-image-scanner-' + Math.random().toString(36).substring(2, 8);
      const tempDiv = document.createElement('div');
      tempDiv.id = tempId;
      document.body.appendChild(tempDiv);

      const scanner = new Html5Qrcode(tempId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });

      const decodedText = await scanner.scanFile(file, true);
      scanner.clear();
      tempDiv.remove();

      await this.onBarcodeDetected(decodedText);
    } catch (err) {
      console.warn('Image barcode scan error', err);
      showToast('No readable barcode found in image', 'warning');
      this.setLoading(false);
      this.startScanner();
    } finally {
      e.target.value = '';
    }
  }

  async onBarcodeDetected(barcode) {
    if (!barcode) return;

    playBeep();
    await this.stopScanner();

    this.setLoading(true, `Found: ${barcode}. Looking up details...`);

    let productInfo = null;
    try {
      productInfo = await barcodeLookupService.lookup(barcode);
    } catch (err) {
      console.warn('Lookup error', err);
    }

    this.setLoading(false);
    this.close();

    this.dispatchEvent(new CustomEvent('barcode-scanned', {
      bubbles: true,
      composed: true,
      detail: {
        barcode,
        productInfo: productInfo || { found: false, barcode },
      }
    }));
  }
}

customElements.define('barcode-scanner-modal', BarcodeScannerModal);
