import * as M from './model.js';
import { store, requestPersistence } from './store.js';
import { drawOverview, drawZoneView, SchemaView } from './schema.js';
import { esc, $, $$, I, SYM, toast, ask, confirmDanger, sheet, vibrate, canVibrate, wake, modalOpen } from './ui.js';

export const APP_VERSION = '1.1.0';
const HOLD_MS = 700;
const app = document.getElementById('app');

/* ------------------------------------------------------------------ */
/* Piano dei giri con cache                                            */
/* ------------------------------------------------------------------ */

const planCache = new Map();
const structureKey = p => JSON.stringify([p.totalRows, p.work, p.startWith, p.colors, p.sequence]);
function getPlan(p) {
  const key = structureKey(p);
  const c = planCache.get(p.id);
  if (c && c.key === key) return c.plan;
  const plan = M.buildPlan(p);
  planCache.set(p.id, { key, plan });
  return plan;
}
const colorOf = (p, id) => p.colors.find(c => c.id === id) || { name: '—', hex: '#999999' };

/* ------------------------------------------------------------------ */
/* Tema                                                                */
/* ------------------------------------------------------------------ */

const darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const t = store.settings.theme;
  const resolved = t === 'auto' ? (darkMQ.matches ? 'dark' : 'light') : t;
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#1d1a19' : '#faf6f1');
}
darkMQ.addEventListener?.('change', () => { if (store.settings.theme === 'auto') { applyTheme(); render(); } });

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

let cleanup = [];
function onCleanup(fn) { cleanup.push(fn); }

function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean).map(decodeURIComponent);
  if (!parts.length) return { name: 'home' };
  if (parts[0] === 'nuovo') return { name: 'edit', isNew: true };
  if (parts[0] === 'impostazioni') return { name: 'settings' };
  if (parts[0] === 'guida') return { name: 'guide' };
  if (parts[0] === 'p' && parts[1]) {
    const sub = parts[2] || '';
    return { name: { '': 'counter', schema: 'schema', modifica: 'edit', note: 'notes' }[sub] || 'counter', id: parts[1] };
  }
  return { name: 'home' };
}

export function go(hash) {
  if (location.hash === hash) render(); else location.hash = hash;
}

function render() {
  for (const fn of cleanup.splice(0)) { try { fn(); } catch (e) { console.error(e); } }
  const r = parseRoute();
  let p = null;
  if (r.id) {
    p = store.get(r.id);
    if (!p) { toast('Progetto non trovato'); location.hash = '#/'; return; }
  }
  window.scrollTo(0, 0);
  const screens = { home: renderHome, counter: renderCounter, schema: renderSchema, edit: renderEditor, notes: renderNotes, settings: renderSettings, guide: renderGuide };
  screens[r.name](p, r);
  const h = app.querySelector('h1, h2');
  document.title = (p ? p.name + ' · ' : '') + 'Knitting Easy';
  if (h && r.name !== 'counter') { h.setAttribute('tabindex', '-1'); }
}

/* ------------------------------------------------------------------ */
/* Home                                                                */
/* ------------------------------------------------------------------ */

function progressText(p) {
  const plan = getPlan(p), s = M.getState(p, plan);
  const pct = plan.total ? Math.floor((s.done / plan.total) * 100) : 0;
  return { plan, s, pct };
}

function renderHome() {
  const showArchived = store.settings.showArchived;
  const sorted = store.projects.slice().sort((a, b) => (b.lastOpenedAt || b.updatedAt) - (a.lastOpenedAt || a.updatedAt));
  const active = sorted.filter(p => !p.archived);
  const archived = sorted.filter(p => p.archived);
  const list = showArchived ? archived : active;
  const backupOld = store.projects.length && (!store.settings.lastBackupAt || Date.now() - store.settings.lastBackupAt > 30 * 864e5)
    && store.projects.some(p => p.done > 0);

  app.innerHTML = `
  <div class="screen home">
    <header class="topbar">
      <h1 class="topbar-title brand">Knitting Easy</h1>
      <a class="icon-btn" href="#/guida" aria-label="Guida">${I.help}</a>
      <a class="icon-btn" href="#/impostazioni" aria-label="Impostazioni e backup">${I.settings}</a>
    </header>
    <main class="content">
      <div class="home-head">
        <div class="tabs" role="tablist">
          <button role="tab" class="tab ${!showArchived ? 'on' : ''}" aria-selected="${!showArchived}" data-arch="0">In corso <span class="count">${active.length}</span></button>
          <button role="tab" class="tab ${showArchived ? 'on' : ''}" aria-selected="${showArchived}" data-arch="1">Archiviati <span class="count">${archived.length}</span></button>
        </div>
        <a class="btn primary" href="#/nuovo">${I.plus}<span>Nuovo</span></a>
      </div>
      ${backupOld ? `<div class="hint-card">${I.download}<div>Il salvataggio resta su questo dispositivo. <a href="#/impostazioni">Esporta un backup</a> per non perdere i progressi.</div></div>` : ''}
      <ul class="cards">
        ${list.map(p => {
          const { plan, s, pct } = progressText(p);
          const col = colorOf(p, s.colorId);
          return `
          <li class="card project-card" data-id="${esc(p.id)}">
            <button class="thumb" data-open="${esc(p.id)}" aria-label="Apri ${esc(p.name)}"><canvas data-thumb="${esc(p.id)}"></canvas></button>
            <div class="card-body">
              <div class="card-title-row">
                <h2 class="card-title"><a href="#/p/${encodeURIComponent(p.id)}">${esc(p.name)}</a></h2>
                <button class="icon-btn small" data-menu="${esc(p.id)}" aria-label="Opzioni per ${esc(p.name)}">${I.more}</button>
              </div>
              <div class="card-meta">
                ${s.empty ? 'Nessun giro' : s.complete ? '<strong class="ok">Completato</strong>' : `<span class="chip"><span class="swatch xs" style="background:${col.hex}"></span>${esc(col.name)} ${s.inBlock}/${s.blockLen}</span>`}
                <span class="muted">${s.done}/${plan.total} giri · ${pct}%</span>
              </div>
              <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${plan.total}" aria-valuenow="${s.done}" aria-label="Avanzamento"><span style="width:${pct}%"></span></div>
              ${p.archived
                ? `<button class="btn" data-unarchive="${esc(p.id)}">${I.unarchive}<span>Ripristina</span></button>`
                : `<a class="btn primary resume" href="#/p/${encodeURIComponent(p.id)}">${I.play}<span>${s.done === 0 ? 'Inizia' : s.complete ? 'Apri' : 'Riprendi'}</span></a>`}
            </div>
          </li>`;
        }).join('')}
      </ul>
      ${!list.length ? `
        <div class="empty">
          ${showArchived ? '<p>Nessun progetto archiviato.</p>' : `
            <p>Non hai ancora progetti.</p>
            <a class="btn primary" href="#/nuovo">${I.plus}<span>Crea un progetto</span></a>
            <button class="btn" id="add-demo">Aggiungi il progetto di esempio</button>`}
        </div>` : ''}
    </main>
  </div>`;

  for (const c of $$('canvas[data-thumb]')) {
    const p = store.get(c.dataset.thumb);
    drawOverview(c, p, getPlan(p), p.done, { width: 46, height: 96, orientation: 'vertical' });
  }
  $$('[data-arch]').forEach(b => b.addEventListener('click', () => {
    store.settings.showArchived = b.dataset.arch === '1'; store.save(); render();
  }));
  $$('[data-open]').forEach(b => b.addEventListener('click', () => go('#/p/' + encodeURIComponent(b.dataset.open))));
  $$('[data-menu]').forEach(b => b.addEventListener('click', () => projectMenu(store.get(b.dataset.menu))));
  $$('[data-unarchive]').forEach(b => b.addEventListener('click', () => setArchived(store.get(b.dataset.unarchive), false)));
  $('#add-demo')?.addEventListener('click', () => { store.add(M.normalizeProject(M.demoProject())); render(); });
}

async function projectMenu(p) {
  const v = await sheet(p.name, [
    { label: 'Modifica', value: 'edit', icon: I.edit },
    { label: 'Duplica', value: 'dup', icon: I.copy },
    { label: p.archived ? 'Ripristina dall\'archivio' : 'Archivia', value: 'arch', icon: p.archived ? I.unarchive : I.archive },
    { label: 'Esporta questo progetto', value: 'export', icon: I.download },
    { label: 'Elimina', value: 'del', icon: I.trash, kind: 'danger' },
  ]);
  if (v === 'edit') go(`#/p/${encodeURIComponent(p.id)}/modifica`);
  else if (v === 'dup') {
    const copy = M.normalizeProject(M.duplicateProject(p));
    store.add(copy);
    toast(`Creato «${copy.name}» (avanzamento azzerato)`);
    render();
  } else if (v === 'arch') setArchived(p, !p.archived);
  else if (v === 'export') exportBackup([p], `knitting-easy-${slug(p.name)}`);
  else if (v === 'del') deleteProject(p);
}

function setArchived(p, value) {
  p.archived = value;
  store.touch(p);
  render();
  toast(value ? 'Progetto archiviato' : 'Progetto ripristinato', {
    action: 'Annulla', onAction: () => { p.archived = !value; store.touch(p); render(); },
  });
}

async function deleteProject(p) {
  const ok = await confirmDanger('Eliminare il progetto?', `«${p.name}» e il suo avanzamento verranno eliminati da questo dispositivo. L'operazione non si può annullare. Se vuoi conservarlo, esporta prima un backup.`, 'Elimina');
  if (!ok) return;
  store.remove(p.id);
  planCache.delete(p.id);
  toast('Progetto eliminato');
  go('#/');
}

/* ------------------------------------------------------------------ */
/* Contagiri                                                           */
/* ------------------------------------------------------------------ */

function renderCounter(p) {
  p.lastOpenedAt = Date.now();
  store.touch(p, { content: false });
  const left = store.settings.plusSide === 'left';

  app.innerHTML = `
  <div class="screen counter-screen">
    <header class="topbar">
      <a class="icon-btn" href="#/" aria-label="Torna ai progetti">${I.back}</a>
      <h1 class="topbar-title" id="c-name">${esc(p.name)}</h1>
      <button class="icon-btn" id="wake" aria-pressed="false" aria-label="Mantieni lo schermo acceso">${I.sun}</button>
      <button class="icon-btn" id="more" aria-label="Altre opzioni">${I.more}</button>
    </header>
    <main class="counter">
      <section class="counter-main">
        <div class="color-line">
          <span class="swatch lg" id="c-sw"></span>
          <span class="color-name" id="c-color"></span>
          <span class="muted small" id="c-block"></span>
        </div>
        <div class="instruction" id="c-instr"></div>
        <div class="notice-slot" id="c-notice" role="status" aria-live="polite"></div>
        <div class="big" id="c-big" aria-label="Giri completati nel blocco colore attuale">0</div>
        <div class="pad ${left ? 'plus-left' : ''}">
          <button class="btn-minus" id="minus" type="button" aria-label="Togli un giro: tieni premuto per circa un secondo">
            <span class="ring" aria-hidden="true"></span>
            <span class="minus-sym" aria-hidden="true">−</span>
            <span class="minus-hint" aria-hidden="true">tieni premuto</span>
          </button>
          <button class="btn-plus" id="plus" type="button" aria-label="Giro completato: aggiungi un giro">+</button>
        </div>
        <div class="totals">
          <span id="c-tcol"></span>
          <span id="c-tproj"></span>
        </div>
        <div class="under-pad">
          <button class="link-btn" id="undo" type="button">${I.undo}<span>Annulla ultima modifica</span></button>
        </div>
      </section>
      <section class="counter-side">
        <button class="preview" id="preview" type="button" aria-label="Apri lo schema completo">
          <div class="preview-zone"><canvas id="c-zone"></canvas></div>
          <div class="preview-over"><canvas id="c-over"></canvas></div>
        </button>
        <div class="preview-caption muted small">Schema indicativo · <a href="#/p/${encodeURIComponent(p.id)}/schema">apri e ingrandisci</a></div>
      </section>
    </main>
  </div>`;

  const el = id => document.getElementById(id);
  const plus = el('plus'), minus = el('minus'), undoBtn = el('undo'), big = el('c-big');

  function draw() {
    const plan = getPlan(p);
    const z = $('.preview-zone'), o = $('.preview-over');
    drawZoneView(el('c-zone'), p, plan, M.getState(p, plan).done, { width: z.clientWidth, height: z.clientHeight });
    drawOverview(el('c-over'), p, plan, M.getState(p, plan).done, { width: o.clientWidth, height: o.clientHeight, orientation: 'vertical' });
  }

  function update(ev) {
    const plan = getPlan(p);
    const s = M.getState(p, plan);
    const col = colorOf(p, s.colorId);
    el('c-sw').style.background = col.hex;
    el('c-color').textContent = col.name;
    el('c-block').textContent = plan.blocks.length > 1 ? `blocco ${s.blockIndex + 1} di ${plan.blocks.length}` : '';
    if (s.complete) {
      el('c-instr').innerHTML = `<span class="done-label">Progetto completato</span>`;
    } else {
      const w = s.nextWork === M.ROW_ROVESCIO ? 'rovescio' : 'dritto';
      el('c-instr').innerHTML = `${SYM[w]}<span>Prossimo giro: <strong>${s.nextRow}</strong> · <strong>${M.workLabel(s.nextWork)}</strong></span>`;
      el('c-instr').setAttribute('aria-label', M.nextInstruction(s));
    }
    big.textContent = String(s.inBlock);
    big.style.setProperty('--col', col.hex);
    el('c-tcol').textContent = `Totale colore: ${s.inBlock}/${s.blockLen} giri`;
    el('c-tproj').textContent = `Totale progetto: ${s.done}/${s.total} giri`;
    plus.disabled = s.complete || s.empty;
    minus.disabled = s.done <= 0;
    const change = -M.lastUndoDelta(p); // variazione introdotta dall'ultima modifica
    undoBtn.disabled = !p.history.length;
    undoBtn.querySelector('span').textContent = p.history.length && change !== 0
      ? `Annulla ultima modifica (${change > 0 ? '+' : '−'}${Math.abs(change)})`
      : 'Annulla ultima modifica';

    // Avvisi
    const items = [];
    if (s.complete) items.push(`<div class="notice success">🎉 <span><strong>Progetto completato!</strong> Puoi ancora correggere il conteggio.</span></div>`);
    else if (s.done === 0) items.push(`<div class="notice info"><span class="swatch sm" style="background:${col.hex}"></span><span>Inizia con <strong>${esc(col.name)}</strong></span></div>`);
    else if (s.inBlock === 0) items.push(`<div class="notice change ${ev && ev.type === 'colorForward' ? 'flash' : ''}"><span class="swatch sm" style="background:${col.hex}"></span><span>Cambia colore: ora passa a <strong>${esc(col.name)}</strong></span></div>`);
    const rem = M.remindersFor(p, s);
    for (const r of rem.now) items.push(`<div class="notice reminder">📌 <span><strong>Giro ${r.row}:</strong> ${esc(r.text)}</span></div>`);
    if (!items.length) {
      for (const r of rem.soon.slice(0, 1)) {
        const n = r.row - s.nextRow;
        items.push(`<div class="notice soon">⏳ <span>Tra ${n} ${n === 1 ? 'giro' : 'giri'} (giro ${r.row}): ${esc(r.text)}</span></div>`);
      }
    }
    el('c-notice').innerHTML = items.join('');

    if (ev) {
      big.classList.remove('pop', 'drop'); void big.offsetWidth;
      big.classList.add(ev.dir === 'down' ? 'drop' : 'pop');
      if (ev.type === 'colorForward' || ev.type === 'colorBack') {
        el('c-sw').classList.remove('pulse'); void el('c-sw').offsetWidth; el('c-sw').classList.add('pulse');
      }
    }
    draw();
  }

  function apply(fn, dir) {
    const plan = getPlan(p);
    const ev = fn(p, plan);
    if (!ev) return false;
    if (!store.touch(p)) toast('Attenzione: salvataggio non riuscito sul dispositivo', { kind: 'error' });
    ev.dir = dir;
    update(ev);
    const vib = store.settings.vibration;
    if (ev.type === 'complete') { vibrate(vib, [60, 80, 60, 80, 160]); toast('Progetto completato! 🎉', { kind: 'success' }); }
    else if (ev.type === 'colorForward') vibrate(vib, [40, 70, 40]);
    else vibrate(vib, dir === 'down' ? 30 : 12);
    return true;
  }

  const doPlus = () => {
    if (plus.disabled) return;
    plus.classList.remove('bump'); void plus.offsetWidth; plus.classList.add('bump');
    apply(M.increment, 'up');
  };
  plus.addEventListener('click', doPlus);

  // Pressione prolungata su − : un solo giro per pressione, nessuna ripetizione
  let hold = null;
  const setP = v => minus.style.setProperty('--p', v.toFixed(3));
  function holdStart() {
    if (minus.disabled || hold) return;
    hold = { t0: performance.now(), fired: false, raf: 0 };
    minus.classList.add('holding');
    const tick = () => {
      if (!hold) return;
      const k = Math.min(1, (performance.now() - hold.t0) / HOLD_MS);
      setP(k);
      if (k >= 1 && !hold.fired) {
        hold.fired = true;
        minus.classList.add('fired');
        apply(M.decrement, 'down');
        return;
      }
      hold.raf = requestAnimationFrame(tick);
    };
    hold.raf = requestAnimationFrame(tick);
  }
  function holdEnd() {
    if (!hold) return;
    cancelAnimationFrame(hold.raf);
    const short = !hold.fired && performance.now() - hold.t0 < 350;
    hold = null;
    minus.classList.remove('holding', 'fired');
    setP(0);
    if (short && !minus.disabled) toast('Tieni premuto − per togliere un giro', { duration: 1800 });
  }
  minus.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    e.preventDefault();
    try { minus.releasePointerCapture(e.pointerId); } catch { /* */ }
    holdStart();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => minus.addEventListener(t, holdEnd));
  minus.addEventListener('contextmenu', e => e.preventDefault());
  plus.addEventListener('contextmenu', e => e.preventDefault());
  // tastiera sul pulsante −: tenere premuto Invio o Spazio
  minus.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); holdStart(); }
  });
  minus.addEventListener('keyup', e => { if (e.key === 'Enter' || e.key === ' ') holdEnd(); });
  minus.addEventListener('blur', holdEnd);

  undoBtn.addEventListener('click', () => {
    const before = p.done;
    if (apply(M.undo, 'undo')) toast(`Annullato: ${before} → ${p.done} giri totali`, { duration: 2000 });
  });

  // Scorciatoie da tastiera (computer)
  const onKey = e => {
    if (modalOpen()) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undoBtn.click(); return; }
    if (tag === 'button' || tag === 'a') return;
    if (e.key === '+' || e.key === 'ArrowUp' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) doPlus(); }
    else if ((e.key === '-' || e.key === 'ArrowDown') && !e.repeat) { e.preventDefault(); holdStart(); }
  };
  const onKeyUp = e => { if (e.key === '-' || e.key === 'ArrowDown') holdEnd(); };
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKeyUp);
  onCleanup(() => { document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKeyUp); holdEnd(); });

  el('preview').addEventListener('click', () => go(`#/p/${encodeURIComponent(p.id)}/schema`));
  el('more').addEventListener('click', async () => {
    const v = await sheet(p.name, [
      { label: 'Schema completo', value: 'schema', icon: I.grid },
      { label: 'Note e promemoria', value: 'note', icon: I.note },
      { label: 'Modifica progetto', value: 'edit', icon: I.edit },
      { label: 'Impostazioni', value: 'settings', icon: I.settings },
    ]);
    const base = `#/p/${encodeURIComponent(p.id)}`;
    if (v === 'schema') go(base + '/schema');
    else if (v === 'note') go(base + '/note');
    else if (v === 'edit') go(base + '/modifica');
    else if (v === 'settings') go('#/impostazioni');
  });

  // Schermo acceso
  const wakeBtn = el('wake');
  const refreshWake = () => {
    wakeBtn.setAttribute('aria-pressed', String(wake.wanted));
    wakeBtn.classList.toggle('on', wake.wanted && wake.active);
    wakeBtn.title = !wake.supported ? 'Schermo sempre acceso: non supportato da questo browser'
      : wake.wanted ? (wake.active ? 'Schermo sempre acceso: attivo' : 'Schermo sempre acceso: in attesa') : 'Mantieni lo schermo acceso';
  };
  wake.onchange = refreshWake;
  wakeBtn.addEventListener('click', async () => {
    if (!wake.supported) { toast('Questo browser non permette di mantenere lo schermo acceso'); return; }
    if (wake.wanted) { await wake.disable(); store.settings.keepAwake = false; toast('Schermo acceso: disattivato'); }
    else {
      const ok = await wake.enable();
      store.settings.keepAwake = true;
      toast(ok ? 'Lo schermo resterà acceso mentre lavori' : 'Non è stato possibile mantenere lo schermo acceso');
    }
    store.save();
  });
  if (store.settings.keepAwake && wake.supported) wake.enable(); else refreshWake();
  onCleanup(() => { wake.onchange = null; if (wake.wanted) wake.disable(); });

  const ro = new ResizeObserver(() => draw());
  ro.observe($('.preview-zone'));
  onCleanup(() => ro.disconnect());
  const off = store.on(t => { if (t === 'external-change') { const np = store.get(p.id); if (np) { p = np; update(); } } });
  onCleanup(off);

  update();
}

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

function legendHTML(p, plan) {
  const used = [...new Set(plan.blocks.map(b => b.colorId))].map(id => colorOf(p, id));
  return `
  <div class="legend">
    ${used.map(c => `<span class="legend-item"><span class="swatch-pair"><span style="background:${c.hex}"></span><span style="background:${M.futureTint(c.hex)}"></span></span>${esc(c.name)}</span>`).join('')}
    <span class="legend-item muted"><span class="swatch-pair"><span class="lg-done"></span><span class="lg-todo"></span></span>pieno = fatto · chiaro = da fare</span>
    <span class="legend-item">${SYM.dritto} dritto</span>
    <span class="legend-item">${SYM.rovescio} rovescio</span>
    <span class="legend-item"><span class="lg-marker">▶</span> prossimo giro</span>
  </div>`;
}

function renderSchema(p) {
  const plan = getPlan(p);
  const s = M.getState(p, plan);
  app.innerHTML = `
  <div class="screen schema-screen">
    <header class="topbar">
      <a class="icon-btn" href="#/p/${encodeURIComponent(p.id)}" aria-label="Torna al contagiri">${I.back}</a>
      <h1 class="topbar-title">Schema · ${esc(p.name)}</h1>
    </header>
    <div class="schema-top">
      ${legendHTML(p, plan)}
      <div class="schema-tools">
        <span class="muted small">${p.stitches} maglie · ${plan.total} giri · ${M.nextInstruction(s)}</span>
        <div class="tool-group">
          <button class="icon-btn" id="z-out" aria-label="Riduci">${I.zoomOut}</button>
          <span class="zoom-val" id="z-val">100%</span>
          <button class="icon-btn" id="z-in" aria-label="Ingrandisci">${I.zoomIn}</button>
          <button class="btn small" id="z-fit">Adatta</button>
          <button class="btn small" id="z-here">${I.target}<span>Giro attuale</span></button>
        </div>
      </div>
    </div>
    <div class="schema-body">
      <div class="schema-over" title="Panoramica: tocca per spostarti"><canvas id="s-over"></canvas></div>
      <div class="schema-detail">
        <div class="schema-scroll" id="s-scroll"><div id="s-spacer"></div></div>
        <canvas id="s-canvas" class="schema-canvas"></canvas>
      </div>
    </div>
    <p class="schema-note muted small">Rappresentazione indicativa del lavoro, non una simulazione realistica del tessuto. Il giro 1 è in basso.</p>
  </div>`;

  const view = new SchemaView({
    scroller: $('#s-scroll'), spacer: $('#s-spacer'), canvas: $('#s-canvas'), overview: $('#s-over'),
    project: p, plan, getDone: () => p.done,
    onZoom: z => { $('#z-val').textContent = Math.round(z * 100) + '%'; },
  });
  onCleanup(() => view.destroy());
  $('#z-in').addEventListener('click', () => view.setZoom(view.zoom * 1.4));
  $('#z-out').addEventListener('click', () => view.setZoom(view.zoom / 1.4));
  $('#z-fit').addEventListener('click', () => view.setZoom(1));
  $('#z-here').addEventListener('click', () => view.centerOn(Math.min(p.done, plan.total - 1)));
  const ro = new ResizeObserver(() => { view.layout(); view.draw(); });
  ro.observe($('.schema-detail'));
  onCleanup(() => ro.disconnect());
}

/* ------------------------------------------------------------------ */
/* Editor progetto                                                     */
/* ------------------------------------------------------------------ */

const PRESET_COLORS = ['#232323', '#f4f1ea', '#9fd36b', '#6fa8a1', '#7d9cc9', '#c97b84', '#e8b04a', '#b5651d', '#8e6bb3', '#d9d4cc', '#e98f6f', '#3e5a7e'];

function renderEditor(original, route) {
  const isNew = !!route.isNew;
  const draft = JSON.parse(JSON.stringify(original || M.newProject()));
  const snapshot = () => JSON.stringify({ ...draft, done: 0, history: [] });
  const initialJSON = snapshot();
  let selectedColor = draft.colors[0]?.id;
  const back = isNew ? '#/' : `#/p/${encodeURIComponent(draft.id)}`;

  app.innerHTML = `
  <div class="screen editor">
    <header class="topbar">
      <a class="icon-btn" href="${back}" id="ed-back" aria-label="Indietro">${I.back}</a>
      <h1 class="topbar-title">${isNew ? 'Nuovo progetto' : 'Modifica progetto'}</h1>
    </header>
    <form class="content form" id="ed-form" novalidate autocomplete="off">
      ${isNew ? `
      <section class="card form-card">
        <h2>Parti da un modello</h2>
        <div class="choice-row">
          <button type="button" class="choice" data-template="tinta"><strong>Tinta unita</strong><span>un colore, tutti i giri uguali</span></button>
          <button type="button" class="choice" data-template="righe"><strong>A righe</strong><span>due colori che si ripetono</span></button>
        </div>
      </section>` : ''}

      <section class="card form-card">
        <h2>Progetto</h2>
        <label class="field"><span>Nome</span><input type="text" data-f="name" value="${esc(draft.name)}" maxlength="120" required></label>
        <div class="field-row">
          <label class="field"><span>Maglie per ferro</span><input type="number" inputmode="numeric" min="1" max="${M.MAX_STITCHES}" data-f="stitches" value="${draft.stitches}"></label>
          <label class="field"><span>Giri totali</span><input type="number" inputmode="numeric" min="1" max="${M.MAX_ROWS}" data-f="totalRows" value="${draft.totalRows}"></label>
        </div>
      </section>

      <section class="card form-card">
        <h2>Lavorazione</h2>
        <div class="radio-list" role="radiogroup" aria-label="Lavorazione">
          ${Object.entries(M.WORKS).map(([k, label]) => `
            <label class="radio"><input type="radio" name="work" value="${k}" ${draft.work === k ? 'checked' : ''}>
              <span><strong>${label}</strong>${k === 'alternato' ? '<small>Si alternano <em>giri interi</em>: un ferro tutto a dritto, il successivo tutto a rovescio (non maglie alternate nello stesso ferro).</small>' : ''}</span></label>`).join('')}
        </div>
        <div class="start-with" id="ed-start">
          <span class="field-label">Nei giri alternati, il giro 1 è:</span>
          <div class="seg">
            <label><input type="radio" name="startWith" value="dritto" ${draft.startWith !== 'rovescio' ? 'checked' : ''}><span>a dritto</span></label>
            <label><input type="radio" name="startWith" value="rovescio" ${draft.startWith === 'rovescio' ? 'checked' : ''}><span>a rovescio</span></label>
          </div>
          <small class="muted">L'alternanza segue la posizione nel progetto e continua anche dopo i cambi colore.</small>
        </div>
      </section>

      <section class="card form-card">
        <h2>Colori del filato</h2>
        <div id="ed-colors"></div>
        <div class="presets" aria-label="Colori rapidi">
          <span class="muted small">Colori rapidi per il colore selezionato:</span>
          <div class="preset-row">${PRESET_COLORS.map(c => `<button type="button" class="preset" data-preset="${c}" style="background:${c}" aria-label="Usa ${c}"></button>`).join('')}</div>
        </div>
        <button type="button" class="btn" data-act="add-color">${I.plus}<span>Aggiungi colore</span></button>
      </section>

      <section class="card form-card">
        <h2>Sequenza dei blocchi</h2>
        <p class="muted small">Ogni blocco ha un colore, un numero di giri e una lavorazione. I <strong>giri iniziali</strong> si lavorano una volta, poi la <strong>sequenza da ripetere</strong> si ripete fino a raggiungere il totale, lasciando spazio ai <strong>giri finali</strong>.</p>
        <div id="ed-seq"></div>
      </section>

      <section class="card form-card" id="ed-preview-card">
        <h2>Anteprima del risultato</h2>
        <div class="ed-preview-canvas"><canvas id="ed-preview"></canvas></div>
        <div class="muted small ed-preview-scale"><span>giro 1</span><span id="ed-last">giro ${draft.totalRows}</span></div>
        <p id="ed-summary" class="summary"></p>
        <div id="ed-issues"></div>
      </section>

      <section class="card form-card">
        <h2>Filato e ferri <span class="muted small">(facoltativo)</span></h2>
        <div class="field-row">
          <label class="field"><span>Filato</span><input type="text" data-y="name" value="${esc(draft.yarn.name)}" placeholder="Marca e nome"></label>
          <label class="field"><span>Composizione</span><input type="text" data-y="composition" value="${esc(draft.yarn.composition)}" placeholder="Es. 100% lana merino"></label>
        </div>
        <div class="field-row">
          <label class="field"><span>Peso / metraggio</span><input type="text" data-y="weight" value="${esc(draft.yarn.weight)}" placeholder="Es. 50 g / 125 m"></label>
          <label class="field"><span>Lotto di tintura</span><input type="text" data-y="lot" value="${esc(draft.yarn.lot)}"></label>
        </div>
        <div class="field-row">
          <label class="field"><span>Misura ferri</span><input type="text" data-y="needles" value="${esc(draft.yarn.needles)}" placeholder="Es. 4 mm"></label>
          <label class="field"><span>Tipo di ferri</span><input type="text" data-y="needleType" value="${esc(draft.yarn.needleType)}" placeholder="Es. bambù, circolari"></label>
        </div>
      </section>

      <section class="card form-card">
        <h2>Note</h2>
        <label class="field"><span class="sr-only">Note</span><textarea data-f="notes" rows="4" placeholder="Appunti liberi sul progetto">${esc(draft.notes)}</textarea></label>
        <p class="muted small">I promemoria legati a un giro si gestiscono da <em>Note e promemoria</em> nella schermata di lavoro.</p>
      </section>

      ${!isNew ? `
      <section class="card form-card">
        <h2>Avanzamento</h2>
        <p>Giri completati: <strong>${draft.done}</strong>. Se cambi la struttura, l'avanzamento viene conservato quando possibile; prima di ridurlo ti verrà chiesta conferma.</p>
        <button type="button" class="btn danger-outline" data-act="reset">Azzera avanzamento…</button>
      </section>` : ''}

      <div class="sticky-actions">
        <a class="btn" href="${back}" id="ed-cancel">Annulla</a>
        <button type="submit" class="btn primary" id="ed-save">${isNew ? 'Crea progetto' : 'Salva modifiche'}</button>
      </div>
    </form>
  </div>`;

  const form = $('#ed-form');

  function colorOptions(selected) {
    return draft.colors.map(c => `<option value="${esc(c.id)}" ${c.id === selected ? 'selected' : ''}>${esc(c.name || 'Senza nome')}</option>`).join('');
  }
  function usedColorIds() {
    return new Set(['intro', 'repeat', 'outro'].flatMap(k => draft.sequence[k].map(b => b.colorId)));
  }

  function renderColors() {
    const used = usedColorIds();
    $('#ed-colors').innerHTML = draft.colors.map(c => `
      <div class="color-edit ${c.id === selectedColor ? 'selected' : ''}" data-cid="${esc(c.id)}">
        <label class="color-pick" style="background:${c.hex}"><span class="sr-only">Colore di ${esc(c.name)}</span><input type="color" data-cf="hex" value="${c.hex}"></label>
        <input type="text" data-cf="name" value="${esc(c.name)}" aria-label="Nome del colore" maxlength="60">
        <button type="button" class="icon-btn small" data-act="del-color" ${used.has(c.id) || draft.colors.length <= 1 ? 'disabled' : ''} aria-label="Elimina colore ${esc(c.name)}" title="${used.has(c.id) ? 'Colore usato nella sequenza' : 'Elimina colore'}">${I.trash}</button>
      </div>`).join('');
  }

  function renderSeq() {
    $('#ed-seq').innerHTML = ['intro', 'repeat', 'outro'].map(sec => `
      <div class="seq-section" data-sec="${sec}">
        <h3>${M.SECTIONS[sec]} ${sec !== 'repeat' ? '<span class="muted small">(facoltativi)</span>' : ''}
          <span class="muted small sec-sum">${M.sum(draft.sequence[sec]) ? M.sum(draft.sequence[sec]) + ' giri' + (sec === 'repeat' ? ' per ripetizione' : '') : ''}</span></h3>
        ${draft.sequence[sec].map((b, i, arr) => {
          const c = colorOf(draft, b.colorId);
          return `
          <div class="block-edit" data-bid="${esc(b.id)}">
            <span class="swatch md" style="background:${c.hex}"></span>
            <label class="be-color"><span class="sr-only">Colore</span><select data-bf="colorId">${colorOptions(b.colorId)}</select></label>
            <label class="be-rows"><input type="number" inputmode="numeric" min="1" data-bf="rows" value="${b.rows}" aria-label="Numero di giri"><span>giri</span></label>
            <label class="be-work"><span class="sr-only">Lavorazione</span><select data-bf="work">${Object.entries(M.BLOCK_WORKS).map(([k, l]) => `<option value="${k}" ${b.work === k ? 'selected' : ''}>${k === 'eredita' ? 'Come il progetto' : l}</option>`).join('')}</select></label>
            <div class="be-actions">
              <button type="button" class="icon-btn small" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Sposta su">${I.up}</button>
              <button type="button" class="icon-btn small" data-act="down" ${i === arr.length - 1 ? 'disabled' : ''} aria-label="Sposta giù">${I.down}</button>
              <button type="button" class="icon-btn small" data-act="del-block" aria-label="Elimina blocco">${I.close}</button>
            </div>
          </div>`;
        }).join('')}
        <button type="button" class="btn small" data-act="add-block">${I.plus}<span>Aggiungi blocco</span></button>
      </div>`).join('');
  }

  function blocksValid() {
    return ['intro', 'repeat', 'outro'].every(k => draft.sequence[k].every(b => Number(b.rows) >= 1 && Number.isInteger(Number(b.rows))));
  }

  function refreshPreview() {
    const anyAlt = draft.work === 'alternato' || ['intro', 'repeat', 'outro'].some(k => draft.sequence[k].some(b => b.work === 'alternato'));
    $('#ed-start').hidden = !anyAlt;
    const plan = M.buildPlan(draft);
    const box = $('.ed-preview-canvas');
    drawOverview($('#ed-preview'), draft, plan, isNew ? 0 : Math.min(draft.done, plan.total), { width: box.clientWidth, height: 44, orientation: 'horizontal', marker: !isNew && draft.done > 0 });
    $('#ed-last').textContent = `giro ${plan.total}`;
    $('#ed-summary').textContent = M.describePlan(plan);
    const issues = plan.issues.slice();
    if (!blocksValid()) issues.unshift({ level: 'error', text: 'Ogni blocco deve avere almeno 1 giro (numero intero).' });
    const st = Number(draft.stitches);
    if (!(st >= 1 && st <= M.MAX_STITCHES)) issues.unshift({ level: 'error', text: `Le maglie per ferro devono essere tra 1 e ${M.MAX_STITCHES}.` });
    const tr = Number(draft.totalRows);
    if (!(tr >= 1 && tr <= M.MAX_ROWS)) issues.unshift({ level: 'error', text: `I giri totali devono essere tra 1 e ${M.MAX_ROWS}.` });
    if (!isNew && draft.done > plan.total) issues.push({ level: 'warn', text: `Hai già completato ${draft.done} giri: con questo schema l'avanzamento verrà ridotto a ${plan.total}. Ti verrà chiesta conferma.` });
    if (!issues.length) issues.push({ level: 'ok', text: 'La sequenza coincide esattamente con il totale dei giri.' });
    $('#ed-issues').innerHTML = issues.map(i => `
      <div class="issue ${i.level}">${i.level === 'error' ? '⛔' : i.level === 'warn' ? '⚠️' : '✅'} <span>${esc(i.text)}</span>
        ${i.fixTotal ? `<button type="button" class="btn small" data-fix="${i.fixTotal}">Porta il totale a ${i.fixTotal}</button>` : ''}
      </div>`).join('')
      + (plan.suggestions.length ? `<div class="suggest muted small">Per finire con una ripetizione completa: ${plan.suggestions.map(v => `<button type="button" class="btn small" data-fix="${v}">${v} giri</button>`).join(' ')}</div>` : '');
    return { plan, issues };
  }

  function refreshAll() { renderColors(); renderSeq(); refreshPreview(); }

  form.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.f) {
      draft[t.dataset.f] = ['stitches', 'totalRows'].includes(t.dataset.f) ? (t.value === '' ? '' : Number(t.value)) : t.value;
    } else if (t.dataset.y) {
      draft.yarn[t.dataset.y] = t.value;
    } else if (t.name === 'work' || t.name === 'startWith') {
      draft[t.name] = t.value;
    } else if (t.dataset.cf) {
      const c = draft.colors.find(x => x.id === t.closest('[data-cid]').dataset.cid);
      c[t.dataset.cf] = t.value;
      selectedColor = c.id;
      if (t.dataset.cf === 'hex') t.parentElement.style.background = t.value;
      $$('.color-edit').forEach(x => x.classList.toggle('selected', x.dataset.cid === selectedColor));
      // aggiorna nomi e campioni nei blocchi senza perdere il focus
      $$('.block-edit').forEach(row => {
        const b = findBlock(row.dataset.bid).b;
        row.querySelector('.swatch').style.background = colorOf(draft, b.colorId).hex;
        const sel = row.querySelector('[data-bf="colorId"]');
        [...sel.options].forEach(o => { o.textContent = colorOf(draft, o.value).name || 'Senza nome'; });
      });
    } else if (t.dataset.bf) {
      const { b } = findBlock(t.closest('[data-bid]').dataset.bid);
      b[t.dataset.bf] = t.dataset.bf === 'rows' ? (t.value === '' ? '' : Number(t.value)) : t.value;
      if (t.dataset.bf === 'colorId') {
        t.closest('.block-edit').querySelector('.swatch').style.background = colorOf(draft, b.colorId).hex;
        renderColors();
      }
      if (t.dataset.bf === 'rows') {
        const sec = t.closest('[data-sec]');
        const n = M.sum(draft.sequence[sec.dataset.sec]);
        sec.querySelector('.sec-sum').textContent = n ? n + ' giri' + (sec.dataset.sec === 'repeat' ? ' per ripetizione' : '') : '';
      }
    }
    refreshPreview();
  });
  form.addEventListener('focusin', e => {
    const row = e.target.closest('[data-cid]');
    if (row) { selectedColor = row.dataset.cid; $$('.color-edit').forEach(x => x.classList.toggle('selected', x.dataset.cid === selectedColor)); }
  });

  function findBlock(id) {
    for (const sec of ['intro', 'repeat', 'outro']) {
      const i = draft.sequence[sec].findIndex(b => b.id === id);
      if (i >= 0) return { sec, i, b: draft.sequence[sec][i] };
    }
    return {};
  }

  form.addEventListener('click', async e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.template) {
      const tpl = t.dataset.template;
      const total = Number(draft.totalRows) || 200;
      if (tpl === 'tinta') {
        const c = { id: M.uid(), name: 'Colore principale', hex: '#c97b84' };
        Object.assign(draft, { work: 'dritto', colors: [c], sequence: { intro: [], repeat: [M.block(c.id, total)], outro: [] } });
      } else {
        const a = { id: M.uid(), name: 'Nero', hex: '#232323' }, b = { id: M.uid(), name: 'Verdino', hex: '#9fd36b' };
        Object.assign(draft, { work: 'alternato', startWith: 'dritto', colors: [a, b], sequence: { intro: [], repeat: [M.block(a.id, 30), M.block(b.id, 30)], outro: [] } });
      }
      selectedColor = draft.colors[0].id;
      $$('input[name="work"]').forEach(r => { r.checked = r.value === draft.work; });
      $$('input[name="startWith"]').forEach(r => { r.checked = r.value === draft.startWith; });
      $$('[data-template]').forEach(x => x.classList.toggle('on', x === t));
      refreshAll();
      return;
    }
    if (t.dataset.preset) {
      const c = draft.colors.find(x => x.id === selectedColor) || draft.colors[0];
      c.hex = t.dataset.preset;
      refreshAll();
      return;
    }
    if (t.dataset.fix) {
      draft.totalRows = Number(t.dataset.fix);
      $('[data-f="totalRows"]').value = draft.totalRows;
      refreshPreview();
      toast(`Totale impostato a ${draft.totalRows} giri`);
      return;
    }
    const act = t.dataset.act;
    if (!act) return;
    if (act === 'add-color') {
      const usedHex = new Set(draft.colors.map(c => c.hex));
      const hex = PRESET_COLORS.find(c => !usedHex.has(c)) || '#888888';
      const c = { id: M.uid(), name: `Colore ${draft.colors.length + 1}`, hex };
      draft.colors.push(c);
      selectedColor = c.id;
      refreshAll();
      $(`[data-cid="${CSS.escape(c.id)}"] input[type="text"]`)?.focus();
    } else if (act === 'del-color') {
      const id = t.closest('[data-cid]').dataset.cid;
      draft.colors = draft.colors.filter(c => c.id !== id);
      if (selectedColor === id) selectedColor = draft.colors[0].id;
      refreshAll();
    } else if (act === 'add-block') {
      const sec = t.closest('[data-sec]').dataset.sec;
      const list = draft.sequence[sec];
      const last = list[list.length - 1];
      let colorId = draft.colors[0].id;
      if (last) {
        const i = draft.colors.findIndex(c => c.id === last.colorId);
        colorId = draft.colors[(i + 1) % draft.colors.length].id;
      }
      list.push(M.block(colorId, last ? last.rows : (sec === 'repeat' ? 30 : 10)));
      refreshAll();
    } else if (act === 'del-block' || act === 'up' || act === 'down') {
      const { sec, i } = findBlock(t.closest('[data-bid]').dataset.bid);
      const list = draft.sequence[sec];
      if (act === 'del-block') list.splice(i, 1);
      else {
        const j = act === 'up' ? i - 1 : i + 1;
        [list[i], list[j]] = [list[j], list[i]];
      }
      refreshAll();
    } else if (act === 'reset') {
      const ok = await confirmDanger('Azzerare l\'avanzamento?', `I ${original.done} giri completati torneranno a 0. L'operazione si applica subito.`, 'Azzera');
      if (!ok) return;
      original.history.push(original.done);
      original.done = 0;
      draft.done = 0;
      store.touch(original);
      toast('Avanzamento azzerato (puoi annullare dal contagiri)');
      t.closest('section').querySelector('p strong').textContent = '0';
      refreshPreview();
    }
  });

  let saved = false;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const { plan, issues } = refreshPreview();
    const errors = issues.filter(i => i.level === 'error');
    if (errors.length) {
      $('#ed-preview-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('Correggi gli errori evidenziati prima di salvare', { kind: 'error' });
      return;
    }
    if (!String(draft.name).trim()) draft.name = 'Progetto senza nome';
    const fields = ['name', 'stitches', 'totalRows', 'work', 'startWith', 'colors', 'sequence', 'yarn', 'notes'];
    if (isNew) {
      const p = M.normalizeProject({ ...draft, done: 0, history: [], createdAt: Date.now() });
      store.add(p);
      saved = true;
      toast('Progetto creato');
      go(`#/p/${encodeURIComponent(p.id)}`);
      return;
    }
    const structChanged = structureKey(original) !== structureKey(draft);
    let newDone = original.done;
    if (original.done > plan.total) {
      const ok = await confirmDanger('Ridurre l\'avanzamento?',
        `Il nuovo schema ha ${plan.total} giri, ma ne hai già completati ${original.done}. L'avanzamento verrà ridotto a ${plan.total} giri.`, 'Riduci e salva');
      if (!ok) return;
      newDone = plan.total;
    }
    const merged = M.normalizeProject({
      ...original,
      ...Object.fromEntries(fields.map(f => [f, draft[f]])),
      done: newDone,
      history: structChanged ? [] : original.history,
      updatedAt: Date.now(),
    });
    Object.assign(original, merged);
    store.touch(original);
    saved = true;
    toast(structChanged && newDone > 0 ? `Modifiche salvate · avanzamento conservato: ${newDone} giri` : 'Modifiche salvate');
    go(`#/p/${encodeURIComponent(original.id)}`);
  });

  // Uscita senza salvare
  const isDirty = () => !saved && snapshot() !== initialJSON;
  async function leave(e) {
    if (!isDirty()) return;
    e.preventDefault();
    const ok = await confirmDanger('Uscire senza salvare?', 'Le modifiche a questo progetto andranno perse.', 'Esci senza salvare');
    if (ok) { saved = true; go(back); }
  }
  $('#ed-back').addEventListener('click', leave);
  $('#ed-cancel').addEventListener('click', leave);
  const onBeforeUnload = e => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', onBeforeUnload);
  onCleanup(() => window.removeEventListener('beforeunload', onBeforeUnload));

  const ro = new ResizeObserver(() => refreshPreview());
  ro.observe($('.ed-preview-canvas'));
  onCleanup(() => ro.disconnect());
  refreshAll();
}

/* ------------------------------------------------------------------ */
/* Note e promemoria                                                   */
/* ------------------------------------------------------------------ */

function renderNotes(p) {
  const plan = getPlan(p);
  const s = M.getState(p, plan);
  const y = p.yarn;
  const yarnRows = [['Filato', y.name], ['Composizione', y.composition], ['Peso / metraggio', y.weight], ['Lotto', y.lot], ['Ferri', y.needles], ['Tipo di ferri', y.needleType]].filter(([, v]) => v && v.trim());
  app.innerHTML = `
  <div class="screen notes-screen">
    <header class="topbar">
      <a class="icon-btn" href="#/p/${encodeURIComponent(p.id)}" aria-label="Torna al contagiri">${I.back}</a>
      <h1 class="topbar-title">Note e promemoria</h1>
    </header>
    <main class="content">
      <section class="card form-card">
        <h2>Note <span class="muted small" id="n-saved"></span></h2>
        <textarea id="n-text" rows="7" placeholder="Appunti liberi: tensione, modifiche, idee…">${esc(p.notes)}</textarea>
      </section>
      <section class="card form-card">
        <h2>Promemoria per giro</h2>
        <p class="muted small">Il promemoria compare nel contagiri quando quel giro sta per iniziare (e qualche giro prima come anticipazione).</p>
        <ul class="reminders" id="n-list"></ul>
        <form class="reminder-add" id="n-add">
          <label class="field narrow"><span>Giro</span><input type="number" inputmode="numeric" min="1" max="${plan.total}" id="n-row" value="${Math.min(plan.total, (s.nextRow || plan.total))}" required></label>
          <label class="field grow"><span>Testo</span><input type="text" id="n-msg" maxlength="200" placeholder="Es. cambia ferri" required></label>
          <button class="btn primary" type="submit">${I.plus}<span>Aggiungi</span></button>
        </form>
      </section>
      <section class="card form-card">
        <h2>Filato e ferri</h2>
        ${yarnRows.length ? `<dl class="kv">${yarnRows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : '<p class="muted">Nessun dato inserito.</p>'}
        <a class="btn small" href="#/p/${encodeURIComponent(p.id)}/modifica">${I.edit}<span>Modifica progetto</span></a>
      </section>
    </main>
  </div>`;

  const ta = $('#n-text');
  let timer;
  const saveNotes = () => {
    clearTimeout(timer);
    if (p.notes === ta.value) return;
    p.notes = ta.value;
    store.touch(p);
    $('#n-saved').textContent = '· salvate';
  };
  ta.addEventListener('input', () => { $('#n-saved').textContent = '· …'; clearTimeout(timer); timer = setTimeout(saveNotes, 400); });
  ta.addEventListener('blur', saveNotes);
  onCleanup(saveNotes);
  window.addEventListener('pagehide', saveNotes);
  onCleanup(() => window.removeEventListener('pagehide', saveNotes));

  const list = () => {
    const items = p.reminders.slice().sort((a, b) => a.row - b.row);
    $('#n-list').innerHTML = items.length ? items.map(r => `
      <li class="${r.row <= s.done ? 'past' : ''}"><span class="rem-row">Giro ${r.row}</span><span class="rem-text">${esc(r.text)}</span>
      <button class="icon-btn small" data-del="${esc(r.id)}" aria-label="Elimina promemoria">${I.trash}</button></li>`).join('')
      : '<li class="muted">Nessun promemoria.</li>';
  };
  list();
  $('#n-list').addEventListener('click', e => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    const removed = p.reminders.find(r => r.id === b.dataset.del);
    p.reminders = p.reminders.filter(r => r.id !== b.dataset.del);
    store.touch(p); list();
    toast('Promemoria eliminato', { action: 'Annulla', onAction: () => { p.reminders.push(removed); store.touch(p); list(); } });
  });
  $('#n-add').addEventListener('submit', e => {
    e.preventDefault();
    const row = Math.round(Number($('#n-row').value));
    const text = $('#n-msg').value.trim();
    if (!(row >= 1 && row <= plan.total)) { toast(`Il giro deve essere tra 1 e ${plan.total}`, { kind: 'error' }); return; }
    if (!text) { toast('Scrivi il testo del promemoria', { kind: 'error' }); return; }
    p.reminders.push({ id: M.uid(), row, text });
    store.touch(p);
    $('#n-msg').value = '';
    list();
    toast(`Promemoria aggiunto al giro ${row}`);
  });
}

/* ------------------------------------------------------------------ */
/* Impostazioni e backup                                               */
/* ------------------------------------------------------------------ */

const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'progetto';
const today = () => new Date().toISOString().slice(0, 10);

async function exportBackup(projects, base = 'knitting-easy-backup') {
  const data = M.makeBackup(projects, projects.length === store.projects.length ? store.settings : undefined);
  const name = `${base}-${today()}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const file = typeof File === 'function' ? new File([blob], name, { type: 'application/json' }) : null;
  const choice = file && navigator.canShare && navigator.canShare({ files: [file] })
    ? await ask({
      title: 'Esporta backup',
      text: `${projects.length} ${projects.length === 1 ? 'progetto' : 'progetti'} nel file «${name}».`,
      buttons: [{ label: 'Annulla', value: null }, { label: 'Condividi…', value: 'share' }, { label: 'Scarica', value: 'download', kind: 'primary' }],
    })
    : 'download';
  if (!choice) return;
  if (choice === 'share') {
    try { await navigator.share({ files: [file], title: 'Backup Knitting Easy' }); }
    catch (e) { if (e.name !== 'AbortError') toast('Condivisione non riuscita, prova con «Scarica»'); return; }
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  if (projects.length === store.projects.length) { store.settings.lastBackupAt = Date.now(); store.save(); }
  toast('Backup esportato');
}

async function importBackup(fileObj) {
  let parsed;
  try {
    const text = await fileObj.text();
    parsed = M.parseBackup(text);
  } catch (e) {
    await ask({ title: 'Importazione non riuscita', text: e.message });
    return;
  }
  const n = parsed.projects.length;
  const choice = await ask({
    title: 'Importa backup',
    text: `Il file contiene ${n} ${n === 1 ? 'progetto' : 'progetti'}. Vuoi aggiungerli a quelli presenti o sostituire tutti i progetti di questo dispositivo?`,
    vertical: true,
    buttons: [
      { label: 'Aggiungi ai miei progetti', value: 'merge', kind: 'primary' },
      { label: 'Sostituisci tutto', value: 'replace', kind: 'danger-outline' },
      { label: 'Annulla', value: null },
    ],
  });
  if (!choice) return;
  if (choice === 'replace') {
    const ok = await confirmDanger('Sostituire tutti i progetti?', `I ${store.projects.length} progetti attuali verranno sostituiti da quelli del backup. Ti consigliamo di esportare prima un backup dei dati attuali.`, 'Sostituisci');
    if (!ok) return;
    store.replaceAll(parsed.projects);
    if (parsed.settings) { store.settings = { ...store.settings, ...parsed.settings, showArchived: false }; store.save(); applyTheme(); }
    planCache.clear();
    toast(`Importati ${n} progetti`);
  } else {
    const r = M.mergeProjects(store.projects, parsed.projects);
    store.replaceAll(r.projects);
    const parts = [];
    if (r.added) parts.push(`${r.added} aggiunti`);
    if (r.copies) parts.push(`${r.copies} importati come copia`);
    toast(parts.length ? `Importazione completata: ${parts.join(', ')}` : 'Nessun progetto nuovo: erano già tutti presenti');
  }
  go('#/');
}

function renderSettings() {
  const st = store.settings;
  const lastBk = st.lastBackupAt ? new Date(st.lastBackupAt).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }) : 'mai';
  app.innerHTML = `
  <div class="screen settings-screen">
    <header class="topbar">
      <a class="icon-btn" href="#/" aria-label="Torna ai progetti" id="set-back">${I.back}</a>
      <h1 class="topbar-title">Impostazioni</h1>
    </header>
    <main class="content">
      <section class="card form-card">
        <h2>Aspetto</h2>
        <div class="field-label">Tema</div>
        <div class="seg wide" role="radiogroup" aria-label="Tema">
          ${[['auto', 'Automatico'], ['light', 'Chiaro'], ['dark', 'Scuro']].map(([v, l]) => `<label><input type="radio" name="theme" value="${v}" ${st.theme === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
        </div>
        <div class="field-label">Posizione del pulsante +</div>
        <div class="seg wide" role="radiogroup" aria-label="Posizione del pulsante più">
          <label><input type="radio" name="plusSide" value="right" ${st.plusSide !== 'left' ? 'checked' : ''}><span>A destra</span></label>
          <label><input type="radio" name="plusSide" value="left" ${st.plusSide === 'left' ? 'checked' : ''}><span>A sinistra</span></label>
        </div>
      </section>

      <section class="card form-card">
        <h2>Durante il lavoro</h2>
        <label class="switch"><input type="checkbox" id="set-vib" ${st.vibration ? 'checked' : ''} ${canVibrate() ? '' : 'disabled'}>
          <span><strong>Vibrazione</strong><small>${canVibrate() ? 'Breve vibrazione a ogni giro e una più evidente al cambio colore.' : 'Non supportata da questo dispositivo o browser (per esempio su iPhone).'}</small></span></label>
        <label class="switch"><input type="checkbox" id="set-wake" ${st.keepAwake ? 'checked' : ''} ${wake.supported ? '' : 'disabled'}>
          <span><strong>Schermo sempre acceso</strong><small>${wake.supported ? 'Nella schermata del contagiri lo schermo non si spegne. Puoi attivarlo anche con il pulsante ☀ in alto.' : 'Non supportato da questo browser.'}</small></span></label>
      </section>

      <section class="card form-card">
        <h2>Backup dei dati</h2>
        <p>I progetti sono salvati <strong>solo su questo dispositivo</strong>, nel browser. Se cancelli i dati del browser, disinstalli l'app o cambi telefono, i progetti non ti seguono.</p>
        <p>Il <strong>backup</strong> è un file che contiene tutti i progetti con il loro avanzamento: serve per trasferirli su un altro dispositivo o per recuperarli.</p>
        <p class="muted small">Ultimo backup completo: ${lastBk}</p>
        <div class="btn-row">
          <button class="btn primary" id="set-export">${I.download}<span>Esporta backup</span></button>
          <label class="btn" tabindex="0" id="set-import-label">${I.upload}<span>Importa backup</span><input type="file" id="set-import" accept=".json,application/json" hidden></label>
        </div>
      </section>

      <section class="card form-card">
        <h2>Progetto di esempio</h2>
        <p class="muted small">Sciarpa sottile con righe di 30 giri neri e 30 verdini, un giro a dritto e uno a rovescio.</p>
        <button class="btn" id="set-demo">${I.plus}<span>Aggiungi progetto di esempio</span></button>
      </section>

      <section class="card form-card">
        <h2>Informazioni</h2>
        <p class="muted small">Knitting Easy · versione ${APP_VERSION}. Funziona anche senza connessione. <a href="#/guida">Leggi la guida</a>.</p>
      </section>
    </main>
  </div>`;

  $$('input[name="theme"]').forEach(r => r.addEventListener('change', () => { st.theme = r.value; store.save(); applyTheme(); }));
  $$('input[name="plusSide"]').forEach(r => r.addEventListener('change', () => { st.plusSide = r.value; store.save(); }));
  $('#set-vib').addEventListener('change', e => { st.vibration = e.target.checked; store.save(); if (st.vibration) vibrate(true, 20); });
  $('#set-wake').addEventListener('change', e => { st.keepAwake = e.target.checked; store.save(); });
  $('#set-export').addEventListener('click', () => exportBackup(store.projects));
  $('#set-import').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importBackup(f); });
  $('#set-import-label').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#set-import').click(); } });
  $('#set-demo').addEventListener('click', () => { store.add(M.normalizeProject(M.demoProject())); toast('Progetto di esempio aggiunto'); });
}

/* ------------------------------------------------------------------ */
/* Guida                                                               */
/* ------------------------------------------------------------------ */

function renderGuide() {
  app.innerHTML = `
  <div class="screen guide-screen">
    <header class="topbar">
      <a class="icon-btn" href="#/" aria-label="Torna ai progetti">${I.back}</a>
      <h1 class="topbar-title">Guida</h1>
    </header>
    <main class="content prose">
      <section class="card">
        <h2>Contare i giri</h2>
        <ul>
          <li>Tocca <strong>+</strong> ogni volta che finisci un giro.</li>
          <li>Per togliere un giro <strong>tieni premuto −</strong> finché l'anello si completa (circa 0,7 secondi). Se lasci prima, non cambia nulla. Ogni pressione toglie un solo giro.</li>
          <li>Il <strong>numero grande</strong> indica i giri già completati nel blocco del colore attuale. Sotto trovi il totale del colore e del progetto.</li>
          <li>Quando finisci l'ultimo giro di un blocco l'app passa da sola al colore successivo e te lo segnala. Se togli un giro mentre il nuovo blocco è a zero, torni al blocco precedente.</li>
          <li><strong>Annulla ultima modifica</strong> ripristina il conteggio precedente.</li>
          <li>Da computer: <kbd>Spazio</kbd>, <kbd>+</kbd> o <kbd>↑</kbd> aggiungono un giro; tieni premuto <kbd>−</kbd> o <kbd>↓</kbd> per toglierlo; <kbd>Ctrl</kbd>+<kbd>Z</kbd> annulla.</li>
        </ul>
      </section>
      <section class="card">
        <h2>Lavorazioni</h2>
        <p>«Un giro a dritto e uno a rovescio» alterna <em>giri interi</em>: un ferro tutto a dritto, il successivo tutto a rovescio. L'alternanza dipende dalla posizione nel progetto e non riparte al cambio colore.</p>
      </section>
      <section class="card">
        <h2>Sequenze</h2>
        <p>Nell'editor puoi impostare giri iniziali, una sequenza da ripetere e giri finali. Se la sequenza non coincide con il totale, l'anteprima mostra chiaramente quale blocco sarà parziale e propone totali che chiudono con una ripetizione completa.</p>
      </section>
      <section class="card">
        <h2>Salvataggio e backup</h2>
        <p>Ogni tocco viene salvato subito <strong>su questo dispositivo</strong>: chiudendo e riaprendo l'app ritrovi il punto esatto. I dati non vengono inviati a nessun server e non serve un account.</p>
        <p>Proprio perché restano sul dispositivo, esporta ogni tanto un <strong>backup</strong> da <a href="#/impostazioni">Impostazioni</a>: è un file che puoi conservare e reimportare per trasferire i progetti su un altro telefono o computer, o per recuperarli.</p>
      </section>
      <section class="card">
        <h2>Installare l'app</h2>
        <ul>
          <li><strong>Android (Chrome):</strong> menu ⋮ → <em>Installa app</em> o <em>Aggiungi a schermata Home</em>.</li>
          <li><strong>iPhone/iPad (Safari):</strong> pulsante Condividi → <em>Aggiungi alla schermata Home</em>.</li>
          <li><strong>Computer (Chrome/Edge):</strong> icona di installazione nella barra degli indirizzi.</li>
        </ul>
        <p>Dopo la prima apertura l'app funziona anche senza connessione.</p>
      </section>
    </main>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Avvio                                                               */
/* ------------------------------------------------------------------ */

function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw && nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          toast('È disponibile una nuova versione dell\'app', { action: 'Aggiorna', onAction: () => nw.postMessage('skipWaiting'), duration: 10000 });
        }
      });
    });
  }).catch(e => console.warn('Service worker non registrato', e));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
}

store.on(t => {
  if (t === 'save-error') toast('Impossibile salvare sul dispositivo: spazio esaurito o archiviazione bloccata', { kind: 'error', duration: 6000 });
  if (t === 'external-change') { const r = parseRoute(); if (r.name !== 'counter' && r.name !== 'edit') render(); }
});

store.load();
applyTheme();
window.addEventListener('hashchange', render);
render();
requestPersistence();
registerSW();
