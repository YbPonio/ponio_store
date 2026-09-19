import { ICONS } from '../../utils/dom.js';

export class AppModal extends HTMLElement {
  constructor() {
    super();
    this.dialog = null;
    this.titleEl = null;
    this.subtitleEl = null;
    this.bodyEl = null;
    this.closeBtn = null;
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.innerHTML = `
      <dialog class="m-auto w-[88vw] max-w-[460px] rounded-2xl bg-white border border-slate-200 text-slate-900 shadow-2xl overflow-hidden p-0 select-none" style="max-width: 460px;">
        <div class="flex flex-col max-h-[90dvh]">
          <div class="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
            <div>
              <h3 id="modal-title" class="text-xs sm:text-sm font-bold text-slate-900">Modal Title</h3>
              <p id="modal-subtitle" class="text-[11px] sm:text-xs text-slate-500 mt-0.5 hidden"></p>
            </div>
            <button id="modal-close-btn" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer" title="Close dialog">
              ${ICONS.x}
            </button>
          </div>

          <div id="modal-body" class="p-4 sm:p-5 overflow-y-auto flex-1 bg-white"></div>
        </div>
      </dialog>
    `;

    this.dialog = this.querySelector('dialog');
    this.titleEl = this.querySelector('#modal-title');
    this.subtitleEl = this.querySelector('#modal-subtitle');
    this.bodyEl = this.querySelector('#modal-body');
    this.closeBtn = this.querySelector('#modal-close-btn');

    this.closeBtn.addEventListener('click', () => this.close());

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

    this.dialog.addEventListener('close', () => {
      this.dispatchEvent(new CustomEvent('modal-closed'));
    });
  }

  open({ title, subtitle, content, maxWidth = 'max-w-md' }) {
    if (!this.dialog) this.render();

    this.titleEl.textContent = title;
    if (subtitle) {
      this.subtitleEl.textContent = subtitle;
      this.subtitleEl.classList.remove('hidden');
    } else {
      this.subtitleEl.classList.add('hidden');
    }

    const widthMap = {
      'max-w-xs': 'max-w-[320px]',
      'max-w-sm': 'max-w-[380px]',
      'max-w-md': 'max-w-[440px]',
      'max-w-lg': 'max-w-[480px]',
      'max-w-xl': 'max-w-[520px]',
      'max-w-2xl': 'max-w-[580px]',
      'max-w-3xl': 'max-w-[620px]',
    };
    const targetClass = widthMap[maxWidth] || maxWidth || 'max-w-[460px]';
    const allWidthClasses = [
      'max-w-xs', 'max-w-sm', 'max-w-md', 'max-w-lg', 'max-w-xl', 'max-w-2xl', 'max-w-3xl',
      'max-w-[320px]', 'max-w-[380px]', 'max-w-[440px]', 'max-w-[460px]', 'max-w-[480px]', 'max-w-[520px]', 'max-w-[580px]', 'max-w-[620px]'
    ];
    this.dialog.classList.remove(...allWidthClasses);
    this.dialog.classList.add(targetClass);
    const pixelMatch = targetClass.match(/\[(.*?)\]/);
    if (pixelMatch) {
      this.dialog.style.maxWidth = pixelMatch[1];
    } else {
      this.dialog.style.maxWidth = '';
    }

    this.bodyEl.innerHTML = '';
    if (typeof content === 'string') {
      this.bodyEl.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      this.bodyEl.appendChild(content);
    }

    this.dialog.showModal();
  }

  close() {
    if (this.dialog && this.dialog.open) {
      this.dialog.close();
    }
  }
}

customElements.define('app-modal', AppModal);
