// Piccoli componenti di interfaccia: icone, finestre di dialogo, avvisi.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const svg = (body, extra = '') => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const I = {
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  more: svg('<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  settings: svg('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.7-2.5 2-2.5 4"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  grid: svg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16"/>'),
  note: svg('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>'),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>'),
  archive: svg('<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11h14V8M10 12h4"/>'),
  unarchive: svg('<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11h14V8M12 17v-6M9.5 13.5L12 11l2.5 2.5"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  download: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  upload: svg('<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>'),
  share: svg('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>'),
  undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>'),
  up: svg('<path d="M6 15l6-6 6 6"/>'),
  down: svg('<path d="M6 9l6 6 6-6"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  zoomIn: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6M11 8v6"/>'),
  zoomOut: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6"/>'),
  target: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  play: svg('<path d="M8 5l11 7-11 7z" fill="currentColor"/>'),
};

/** Simboli di dritto e rovescio (uguali a quelli dello schema). */
export const SYM = {
  dritto: `<svg class="sym" viewBox="0 0 16 12" width="16" height="12" aria-hidden="true"><path d="M3 2.5L8 10l5-7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  rovescio: `<svg class="sym" viewBox="0 0 16 12" width="16" height="12" aria-hidden="true"><path d="M3 9Q8 0 13 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
};

/* ------------------------------------------------------------------ */
/* Avvisi temporanei (toast)                                           */
/* ------------------------------------------------------------------ */

export function toast(message, { action, onAction, duration = 3200, kind = '' } = {}) {
  const root = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
  root.appendChild(el);
  let timer;
  const close = () => { clearTimeout(timer); el.classList.add('out'); setTimeout(() => el.remove(), 220); };
  if (action) el.querySelector('button').addEventListener('click', () => { close(); onAction && onAction(); });
  timer = setTimeout(close, action ? Math.max(duration, 5000) : duration);
  // al massimo 3 avvisi
  while (root.children.length > 3) root.firstElementChild.remove();
  return close;
}

/* ------------------------------------------------------------------ */
/* Finestre di dialogo                                                 */
/* ------------------------------------------------------------------ */

let openModals = 0;
export const modalOpen = () => openModals > 0;

/**
 * Finestra modale. buttons: [{label, value, kind: 'primary'|'danger'|''}]
 * Restituisce una Promise con il value scelto (null se chiusa).
 */
export function ask({ title, text = '', html = '', buttons = [{ label: 'OK', value: true, kind: 'primary' }], vertical = false, onOpen } = {}) {
  return new Promise(resolve => {
    const root = document.getElementById('modal-root');
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    const prevFocus = document.activeElement;
    back.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">${esc(title)}</h2>
        ${text ? `<p class="modal-text">${esc(text)}</p>` : ''}
        ${html}
        <div class="modal-actions ${vertical ? 'vertical' : ''}">
          ${buttons.map((b, i) => `<button type="button" class="btn ${b.kind || ''}" data-i="${i}">${b.icon || ''}<span>${esc(b.label)}</span></button>`).join('')}
        </div>
      </div>`;
    openModals++;
    const close = value => {
      openModals--;
      document.removeEventListener('keydown', onKey, true);
      back.classList.add('out');
      setTimeout(() => back.remove(), 160);
      if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
      resolve(value);
    };
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(null); }
    };
    back.addEventListener('click', e => {
      if (e.target === back) close(null);
      const b = e.target.closest('[data-i]');
      if (b) close(buttons[+b.dataset.i].value);
    });
    document.addEventListener('keydown', onKey, true);
    root.appendChild(back);
    const modal = back.querySelector('.modal');
    if (onOpen) onOpen(modal, close);
    const focusTarget = modal.querySelector('input, textarea') || modal.querySelector('.btn.primary') || modal.querySelector('.btn:not(.danger)') || modal.querySelector('.btn');
    if (focusTarget) setTimeout(() => focusTarget.focus(), 30);
  });
}

export function confirmDanger(title, text, label) {
  return ask({ title, text, buttons: [{ label: 'Annulla', value: false }, { label, value: true, kind: 'danger' }] });
}

/** Menu a scomparsa con un elenco di azioni. */
export function sheet(title, items) {
  return ask({
    title,
    vertical: true,
    buttons: [...items.map(it => ({ label: it.label, value: it.value, kind: 'sheet-item ' + (it.kind || ''), icon: it.icon || '' })), { label: 'Chiudi', value: null, kind: 'sheet-close' }],
  });
}

/* ------------------------------------------------------------------ */
/* Vibrazione                                                          */
/* ------------------------------------------------------------------ */

export const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
export function vibrate(enabled, pattern) {
  if (!enabled || !canVibrate()) return;
  try { navigator.vibrate(pattern); } catch { /* ignorato */ }
}

/* ------------------------------------------------------------------ */
/* Schermo sempre acceso (Screen Wake Lock API)                        */
/* ------------------------------------------------------------------ */

export const wake = {
  sentinel: null,
  wanted: false,
  supported: typeof navigator !== 'undefined' && 'wakeLock' in navigator,
  onchange: null,
  async enable() {
    this.wanted = true;
    if (!this.supported) { this.onchange && this.onchange(); return false; }
    try {
      if (!this.sentinel) {
        this.sentinel = await navigator.wakeLock.request('screen');
        this.sentinel.addEventListener('release', () => { this.sentinel = null; this.onchange && this.onchange(); });
      }
    } catch (e) {
      console.warn('Wake lock non disponibile', e);
      this.sentinel = null;
    }
    this.onchange && this.onchange();
    return !!this.sentinel;
  },
  async disable() {
    this.wanted = false;
    const s = this.sentinel;
    this.sentinel = null;
    if (s) { try { await s.release(); } catch { /* già rilasciato */ } }
    this.onchange && this.onchange();
  },
  get active() { return !!this.sentinel; },
};

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wake.wanted && !wake.sentinel) wake.enable();
  });
}
