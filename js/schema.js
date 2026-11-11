// Disegno dello schema indicativo su canvas.
// Convenzione: il giro 1 è in basso, il lavoro cresce verso l'alto.
import { futureTint, luminance, ROW_ROVESCIO } from './model.js';

const DPR = () => Math.min(3, window.devicePixelRatio || 1);

export function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function setupCanvas(canvas, w, h) {
  const dpr = DPR();
  const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

export function makePalette(project) {
  return project.colors.map(c => {
    const light = futureTint(c.hex);
    return {
      full: c.hex,
      light,
      inkFull: luminance(c.hex) > 0.35 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.75)',
      inkLight: 'rgba(0,0,0,0.30)',
    };
  });
}

/* ------------------------------------------------------------------ */
/* Panoramica dell'intero progetto (verticale o orizzontale)           */
/* ------------------------------------------------------------------ */

/**
 * Disegna l'intero progetto in un rettangolo. vertical: giro 1 in basso;
 * horizontal: giro 1 a sinistra. Indica con un marcatore il punto raggiunto.
 */
export function drawOverview(canvas, project, plan, done, { width, height, orientation = 'vertical', marker = true, viewport = null } = {}) {
  const ctx = setupCanvas(canvas, width, height);
  const total = plan.total;
  if (!total) return;
  const pal = makePalette(project);
  const vertical = orientation === 'vertical';
  const m = marker ? (vertical ? 9 : 7) : 0; // margine per i triangoli
  const fx = vertical ? m : 0, fy = vertical ? 0 : m;
  const fw = vertical ? width - 2 * m : width;
  const fh = vertical ? height : height - 2 * m;
  const len = vertical ? fh : fw;
  const pos = r => (r / total) * len; // offset lungo l'asse dei giri

  const rect = (a, b, color) => {
    // a,b: giri [a,b) → rettangolo
    const p0 = Math.floor(pos(a)), p1 = Math.ceil(pos(b));
    ctx.fillStyle = color;
    if (vertical) ctx.fillRect(fx, fy + fh - p1, fw, p1 - p0);
    else ctx.fillRect(fx + p0, fy, p1 - p0, fh);
  };

  ctx.fillStyle = cssVar('--fabric-bg', '#fff');
  ctx.fillRect(fx, fy, fw, fh);
  for (const b of plan.blocks) {
    const ci = plan.rowColor[b.start];
    const end = b.start + b.len;
    const split = Math.max(b.start, Math.min(done, end));
    if (split > b.start) rect(b.start, split, pal[ci].full);
    if (end > split) rect(split, end, pal[ci].light);
  }
  // confini dei blocchi, se c'è spazio
  if (len / plan.blocks.length >= 4) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (const b of plan.blocks.slice(1)) {
      const p = Math.round(pos(b.start));
      if (vertical) ctx.fillRect(fx, fy + fh - p, fw, 1); else ctx.fillRect(fx + p, fy, 1, fh);
    }
  }
  ctx.strokeStyle = cssVar('--fabric-edge', 'rgba(0,0,0,.25)');
  ctx.lineWidth = 1;
  ctx.strokeRect(fx + 0.5, fy + 0.5, fw - 1, fh - 1);

  if (viewport) {
    const a = pos(viewport[0]), b = pos(viewport[1]);
    ctx.strokeStyle = cssVar('--accent', '#9c4a5a');
    ctx.lineWidth = 2;
    if (vertical) ctx.strokeRect(fx + 1, fy + fh - b, fw - 2, Math.max(4, b - a));
    else ctx.strokeRect(fx + a, fy + 1, Math.max(4, b - a), fh - 2);
  }

  if (marker) {
    const p = Math.round(pos(Math.min(done, total)));
    const ink = cssVar('--marker', '#d0435b');
    ctx.fillStyle = ink;
    ctx.beginPath();
    if (vertical) {
      const y = fy + fh - p;
      ctx.fillRect(fx - 2, y - 1, fw + 4, 2);
      ctx.moveTo(0, y - 6); ctx.lineTo(m - 1, y); ctx.lineTo(0, y + 6);
      ctx.moveTo(width, y - 6); ctx.lineTo(width - m + 1, y); ctx.lineTo(width, y + 6);
    } else {
      const x = fx + p;
      ctx.fillRect(x - 1, fy - 2, 2, fh + 4);
      ctx.moveTo(x - 5, 0); ctx.lineTo(x, m - 1); ctx.lineTo(x + 5, 0);
      ctx.moveTo(x - 5, height); ctx.lineTo(x, height - m + 1); ctx.lineTo(x + 5, height);
    }
    ctx.fill();
  }
}

/* ------------------------------------------------------------------ */
/* Vista dettagliata (giri con maglie e simboli)                        */
/* ------------------------------------------------------------------ */

/**
 * Disegna i giri [rFrom, rTo] con il giro r alla coordinata yOf(r) (bordo alto).
 */
function drawRows(ctx, { project, plan, pal, done, rFrom, rTo, x0, yOf, cellW, rowH, gutter, labelEvery, showLabels = true }) {
  const stitches = project.stitches;
  const fabricW = cellW * stitches;
  const symbols = cellW >= 6 && rowH >= 6;
  const textCol = cssVar('--muted', '#777');
  const nextRow = done < plan.total ? done : -1;

  for (let r = rFrom; r <= rTo; r++) {
    if (r < 0 || r >= plan.total) continue;
    const y = yOf(r);
    const c = pal[plan.rowColor[r]];
    const completed = r < done;
    ctx.fillStyle = completed ? c.full : c.light;
    ctx.fillRect(x0, y, fabricW, rowH + 0.5);

    const rev = plan.rowWork[r] === ROW_ROVESCIO;
    ctx.strokeStyle = completed ? c.inkFull : c.inkLight;
    ctx.fillStyle = ctx.strokeStyle;
    if (symbols) {
      ctx.lineWidth = Math.max(1, Math.min(2, cellW / 9));
      ctx.beginPath();
      for (let s = 0; s < stitches; s++) {
        const cx = x0 + s * cellW;
        if (rev) {
          ctx.moveTo(cx + cellW * 0.2, y + rowH * 0.62);
          ctx.quadraticCurveTo(cx + cellW * 0.5, y + rowH * 0.12, cx + cellW * 0.8, y + rowH * 0.62);
        } else {
          ctx.moveTo(cx + cellW * 0.22, y + rowH * 0.22);
          ctx.lineTo(cx + cellW * 0.5, y + rowH * 0.8);
          ctx.lineTo(cx + cellW * 0.78, y + rowH * 0.22);
        }
      }
      ctx.stroke();
    } else if (rowH >= 3 && rev) {
      // texture semplificata: i rovesci hanno una linea tratteggiata
      ctx.fillRect(x0, y + rowH / 2 - 0.5, fabricW, 1);
    }

  }

  // griglia leggera
  if (rowH >= 6) {
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    for (let r = rFrom; r <= rTo + 1; r++) {
      if (r < 0 || r > plan.total) continue;
      const y = r < plan.total ? yOf(r) + rowH : yOf(r - 1);
      ctx.fillRect(x0, Math.round(y), fabricW, 1);
    }
  }
  if (cellW >= 9) {
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    const top = yOf(Math.min(rTo, plan.total - 1)), bottom = yOf(Math.max(rFrom, 0)) + rowH;
    for (let s = 1; s < stitches; s++) ctx.fillRect(Math.round(x0 + s * cellW), top, 1, bottom - top);
  }

  // prossimo giro
  if (nextRow >= rFrom && nextRow <= rTo && nextRow >= 0) {
    const y = yOf(nextRow);
    const accent = cssVar('--marker', '#d0435b');
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x0 - 1.5, y - 1.5, fabricW + 3, rowH + 3);
  } else if (done >= plan.total) {
    // progetto completato: marcatore sopra l'ultimo giro
    const y = yOf(plan.total - 1);
    if (y > -10) {
      ctx.fillStyle = cssVar('--marker', '#d0435b');
      ctx.fillRect(x0 - 4, y - 2, fabricW + 8, 2.5);
    }
  }

  ctx.strokeStyle = cssVar('--fabric-edge', 'rgba(0,0,0,.25)');
  ctx.lineWidth = 1;
  const top = yOf(Math.min(rTo, plan.total - 1)), bottom = yOf(Math.max(rFrom, 0)) + rowH;
  ctx.strokeRect(x0 - 0.5, top - 0.5, fabricW + 1, bottom - top + 1);

  // colonna dei numeri di giro, sempre visibile anche scorrendo in orizzontale
  if (gutter > 0 && showLabels) {
    const gx = Math.min(gutter, Math.max(0, x0 - 2));
    if (x0 < gutter) {
      ctx.fillStyle = cssVar('--surface', '#fff');
      ctx.fillRect(0, Math.min(top, 0) - 2, gutter - 2, Math.max(bottom, ctx.canvas.height) + 4);
    }
    const lx = Math.max(gx, gutter - 2);
    ctx.font = `${Math.min(12, Math.max(9, rowH * 0.9))}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textCol;
    const near = rowH < 14 ? 1 : 0;
    for (let r = rFrom; r <= rTo; r++) {
      if (r < 0 || r >= plan.total) continue;
      if (!((r + 1) % labelEvery === 0 || r === 0)) continue;
      if (nextRow >= 0 && Math.abs(r - nextRow) <= near) continue;
      ctx.fillText(String(r + 1), lx - 6, yOf(r) + rowH / 2);
    }
    if (nextRow >= rFrom && nextRow <= rTo && nextRow >= 0) {
      const cy = yOf(nextRow) + rowH / 2;
      ctx.fillStyle = cssVar('--marker', '#d0435b');
      ctx.beginPath();
      ctx.moveTo(lx - 2, cy); ctx.lineTo(lx - 10, cy - 6); ctx.lineTo(lx - 10, cy + 6);
      ctx.fill();
      ctx.font = `bold 12px system-ui, sans-serif`;
      ctx.fillText(String(nextRow + 1), lx - 13, cy);
    }
  }
}

/**
 * Vista compatta della zona attuale (usata nella schermata del contagiri).
 */
export function drawZoneView(canvas, project, plan, done, { width, height }) {
  const ctx = setupCanvas(canvas, width, height);
  if (!plan.total) return;
  const pal = makePalette(project);
  const gutter = 34;
  const avail = width - gutter - 8;
  const cellW = Math.max(1.5, Math.min(18, avail / project.stitches));
  const rowH = Math.max(7, Math.min(16, cellW * 0.72));
  const fabricW = cellW * project.stitches;
  const x0 = gutter + Math.max(0, (avail - fabricW) / 2);
  const visible = Math.ceil(height / rowH) + 1;
  const focus = Math.min(done, plan.total - 1);
  // il prossimo giro sta a ~38% dal basso
  const below = Math.floor((height * 0.38) / rowH);
  let rFrom = focus - below;
  let rTo = rFrom + visible;
  if (rTo > plan.total - 1) { rTo = plan.total - 1; rFrom = Math.max(0, rTo - visible + 1); }
  if (rFrom < 0) { rFrom = 0; rTo = Math.min(plan.total - 1, visible - 1); }
  const baseY = height - 4; // bordo inferiore del giro rFrom
  const yOf = r => baseY - (r - rFrom + 1) * rowH;
  drawRows(ctx, { project, plan, pal, done, rFrom, rTo, x0, yOf, cellW, rowH, gutter, labelEvery: 5 });
}

/* ------------------------------------------------------------------ */
/* Vista completa con scorrimento e zoom (schermata Schema)            */
/* ------------------------------------------------------------------ */

export class SchemaView {
  constructor({ scroller, spacer, canvas, overview, project, plan, getDone, onZoom }) {
    Object.assign(this, { scroller, spacer, canvas, overview, project, plan, getDone, onZoom });
    this.zoom = 1;
    this.pad = 24;
    this.gutter = 44;
    this.raf = 0;
    this.layout();
    this.bind();
    this.centerOn(Math.min(getDone(), plan.total - 1));
  }

  get fitCell() {
    const w = this.scroller.clientWidth - this.gutter - this.pad;
    return Math.max(2, Math.min(14, w / this.project.stitches));
  }

  layout() {
    this.cellW = this.fitCell * this.zoom;
    this.rowH = Math.max(3, this.cellW * 0.72);
    this.fabricW = this.cellW * this.project.stitches;
    this.contentW = Math.max(this.scroller.clientWidth, this.gutter + this.fabricW + this.pad);
    this.contentH = this.plan.total * this.rowH + this.pad * 2;
    this.spacer.style.width = this.contentW + 'px';
    this.spacer.style.height = this.contentH + 'px';
  }

  rowAtContentY(y) {
    return Math.floor((this.contentH - this.pad - y) / this.rowH);
  }

  centerOn(row) {
    const y = this.contentH - this.pad - (row + 0.5) * this.rowH;
    this.scroller.scrollTop = y - this.scroller.clientHeight / 2;
    this.scroller.scrollLeft = 0;
    this.draw();
  }

  setZoom(z, anchorClientY = null) {
    z = Math.max(0.35, Math.min(6, z));
    if (Math.abs(z - this.zoom) < 0.001) return;
    const h = this.scroller.clientHeight;
    const ay = anchorClientY == null ? h / 2 : anchorClientY;
    const rowFloat = (this.contentH - this.pad - (this.scroller.scrollTop + ay)) / this.rowH;
    const fracX = (this.scroller.scrollLeft + this.scroller.clientWidth / 2) / this.contentW;
    this.zoom = z;
    this.layout();
    this.scroller.scrollTop = this.contentH - this.pad - rowFloat * this.rowH - ay;
    this.scroller.scrollLeft = fracX * this.contentW - this.scroller.clientWidth / 2;
    this.draw();
    if (this.onZoom) this.onZoom(z);
  }

  bind() {
    this.onScroll = () => this.schedule();
    this.scroller.addEventListener('scroll', this.onScroll, { passive: true });
    this.onResize = () => { this.layout(); this.schedule(); };
    window.addEventListener('resize', this.onResize);

    // zoom con ctrl/⌘ + rotella (e pinch del trackpad)
    this.onWheel = e => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = this.scroller.getBoundingClientRect();
      this.setZoom(this.zoom * Math.exp(-e.deltaY * 0.01), e.clientY - rect.top);
    };
    this.scroller.addEventListener('wheel', this.onWheel, { passive: false });

    // pinch con due dita
    let pinch = null;
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    this.onTouchStart = e => {
      if (e.touches.length === 2) {
        const rect = this.scroller.getBoundingClientRect();
        pinch = { d: dist(e.touches), z: this.zoom, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top };
      }
    };
    this.onTouchMove = e => {
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        this.setZoom(pinch.z * dist(e.touches) / pinch.d, pinch.y);
      }
    };
    this.onTouchEnd = e => { if (e.touches.length < 2) pinch = null; };
    this.scroller.addEventListener('touchstart', this.onTouchStart, { passive: true });
    this.scroller.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.scroller.addEventListener('touchend', this.onTouchEnd);

    // tocco/trascinamento sulla panoramica per spostarsi
    if (this.overview) {
      let dragging = false;
      const go = e => {
        const rect = this.overview.getBoundingClientRect();
        const frac = 1 - (e.clientY - rect.top) / rect.height;
        this.centerOnSilent(Math.max(0, Math.min(this.plan.total - 1, Math.round(frac * this.plan.total))));
      };
      this.overview.addEventListener('pointerdown', e => { dragging = true; this.overview.setPointerCapture(e.pointerId); go(e); });
      this.overview.addEventListener('pointermove', e => { if (dragging) go(e); });
      this.overview.addEventListener('pointerup', () => { dragging = false; });
      this.overview.addEventListener('pointercancel', () => { dragging = false; });
    }
  }

  centerOnSilent(row) {
    const y = this.contentH - this.pad - (row + 0.5) * this.rowH;
    this.scroller.scrollTop = y - this.scroller.clientHeight / 2;
    this.schedule();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.scroller.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onResize);
    this.scroller.removeEventListener('wheel', this.onWheel);
  }

  schedule() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.draw(); });
  }

  draw() {
    const w = this.scroller.clientWidth, h = this.scroller.clientHeight;
    const ctx = setupCanvas(this.canvas, w, h);
    const st = this.scroller.scrollTop, sl = this.scroller.scrollLeft;
    const done = this.getDone();
    const pal = makePalette(this.project);
    const top = this.rowAtContentY(st);
    const bottom = this.rowAtContentY(st + h);
    const rFrom = Math.max(0, bottom - 1), rTo = Math.min(this.plan.total - 1, top + 1);
    const x0 = this.gutter - sl + Math.max(0, (this.contentW - this.gutter - this.pad - this.fabricW) / 2);
    const yOf = r => this.contentH - this.pad - (r + 1) * this.rowH - st;
    const labelEvery = this.rowH >= 12 ? 1 : this.rowH >= 7 ? 5 : this.rowH >= 4 ? 10 : 50;
    drawRows(ctx, { project: this.project, plan: this.plan, pal, done, rFrom, rTo, x0, yOf, cellW: this.cellW, rowH: this.rowH, gutter: this.gutter, labelEvery });
    if (this.overview) {
      const r = this.overview.parentElement.getBoundingClientRect();
      drawOverview(this.overview, this.project, this.plan, done, {
        width: r.width, height: r.height, orientation: 'vertical',
        viewport: [Math.max(0, bottom), Math.min(this.plan.total, top + 1)],
      });
    }
  }
}
