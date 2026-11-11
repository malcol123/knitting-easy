// Logica pura del contagiri: nessun accesso al DOM o allo storage.
// Tutto lo stato di avanzamento deriva da un solo numero: project.done
// (giri completati in totale, da 0 a plan.total).

export const WORKS = {
  dritto: 'Tutti i giri a dritto',
  rovescio: 'Tutti i giri a rovescio',
  alternato: 'Un giro a dritto e uno a rovescio',
};
export const BLOCK_WORKS = {
  eredita: 'Come il progetto',
  ...WORKS,
};
export const ROW_DRITTO = 0;
export const ROW_ROVESCIO = 1;
export const SECTIONS = { intro: 'Giri iniziali', repeat: 'Sequenza da ripetere', outro: 'Giri finali' };

const HISTORY_LIMIT = 200;
export const MAX_ROWS = 20000;
export const MAX_STITCHES = 1000;

export function uid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

const toInt = (v, d = 0) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : d;
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ------------------------------------------------------------------ */
/* Piano dei giri                                                      */
/* ------------------------------------------------------------------ */

function resolveWork(blockWork, project) {
  return blockWork && blockWork !== 'eredita' && WORKS[blockWork] ? blockWork : project.work;
}

/** Tipo del giro r (0-based) per una lavorazione. L'alternanza dipende
 *  dalla posizione assoluta nel progetto, non dall'inizio del blocco. */
export function rowTypeFor(work, r, startWith) {
  if (work === 'dritto') return ROW_DRITTO;
  if (work === 'rovescio') return ROW_ROVESCIO;
  const first = startWith === 'rovescio' ? ROW_ROVESCIO : ROW_DRITTO;
  return r % 2 === 0 ? first : 1 - first;
}

export function sum(blocks) {
  return (blocks || []).reduce((a, b) => a + Math.max(0, toInt(b.rows)), 0);
}

/**
 * Costruisce il piano completo dei giri a partire dalla configurazione.
 * Restituisce i blocchi colore (blocchi consecutivi dello stesso colore
 * vengono uniti), array per riga e un elenco di avvisi.
 */
export function buildPlan(project) {
  const total = clamp(toInt(project.totalRows), 0, MAX_ROWS);
  const seq = project.sequence || {};
  const intro = (seq.intro || []).filter(b => toInt(b.rows) > 0);
  const repeat = (seq.repeat || []).filter(b => toInt(b.rows) > 0);
  const outro = (seq.outro || []).filter(b => toInt(b.rows) > 0);
  const colorName = id => (project.colors.find(c => c.id === id) || {}).name || 'colore';

  const issues = []; // {level: 'error'|'warn'|'info', text}
  const segments = []; // {colorId, work, start, len, section}
  const introLen = sum(intro), repeatLen = sum(repeat), outroLen = sum(outro);
  const mainEnd = Math.max(0, total - outroLen);
  let pos = 0;

  // Giri iniziali
  for (const b of intro) {
    const len = Math.min(toInt(b.rows), mainEnd - pos);
    if (len <= 0) {
      issues.push({ level: 'warn', text: `Il blocco iniziale «${colorName(b.colorId)}» non verrà lavorato: il totale non basta.` });
      continue;
    }
    if (len < toInt(b.rows)) issues.push({ level: 'warn', text: `Il blocco iniziale «${colorName(b.colorId)}» sarà parziale: ${len} giri invece di ${toInt(b.rows)}.` });
    segments.push({ colorId: b.colorId, work: resolveWork(b.work, project), start: pos, len, section: 'intro' });
    pos += len;
  }

  // Sequenza ripetuta
  let fullCycles = 0, partialRows = 0;
  if (repeatLen > 0 && pos < mainEnd) {
    while (pos < mainEnd) {
      let cyclePos = 0;
      for (let i = 0; i < repeat.length && pos < mainEnd; i++) {
        const b = repeat[i];
        const len = Math.min(toInt(b.rows), mainEnd - pos);
        segments.push({ colorId: b.colorId, work: resolveWork(b.work, project), start: pos, len, section: 'repeat' });
        pos += len;
        cyclePos += len;
        if (len < toInt(b.rows) || (pos >= mainEnd && i < repeat.length - 1)) {
          const uniqueColors = new Set(repeat.map(x => x.colorId)).size;
          if (uniqueColors > 1 || repeat.some(x => (x.work || 'eredita') !== (repeat[0].work || 'eredita'))) {
            let t = `L'ultima ripetizione è parziale: `;
            t += len < toInt(b.rows)
              ? `il blocco «${colorName(b.colorId)}» avrà ${len} giri invece di ${toInt(b.rows)}`
              : `si ferma dopo il blocco «${colorName(b.colorId)}»`;
            const skipped = repeat.slice(i + 1).map(x => `«${colorName(x.colorId)}»`);
            if (skipped.length) t += ` e ${skipped.length === 1 ? 'il blocco' : 'i blocchi'} ${skipped.join(', ')} non verr${skipped.length === 1 ? 'à' : 'anno'} lavorat${skipped.length === 1 ? 'o' : 'i'}`;
            issues.push({ level: 'warn', text: t + '.' });
          }
        }
      }
      if (cyclePos === repeatLen) fullCycles++;
      else partialRows = cyclePos;
    }
  }

  // Giri finali
  const outroStart = pos;
  for (const b of outro) {
    const len = Math.min(toInt(b.rows), total - pos);
    if (len <= 0) {
      issues.push({ level: 'warn', text: `Il blocco finale «${colorName(b.colorId)}» non verrà lavorato: il totale non basta.` });
      continue;
    }
    if (len < toInt(b.rows)) issues.push({ level: 'warn', text: `Il blocco finale «${colorName(b.colorId)}» sarà parziale: ${len} giri invece di ${toInt(b.rows)}.` });
    segments.push({ colorId: b.colorId, work: resolveWork(b.work, project), start: pos, len, section: 'outro' });
    pos += len;
  }

  const covered = pos;
  if (total < 1) issues.push({ level: 'error', text: 'Il numero totale di giri deve essere almeno 1.' });
  if (!intro.length && !repeat.length && !outro.length) issues.push({ level: 'error', text: 'Aggiungi almeno un blocco alla sequenza.' });
  else if (covered < total) {
    issues.push({
      level: 'error',
      text: `La sequenza copre ${covered} giri ma il totale è ${total}: mancano ${total - covered} giri. Aggiungi una sequenza da ripetere, allunga i blocchi oppure porta il totale a ${covered}.`,
      fixTotal: covered,
    });
  }
  if (outroLen > 0 && outroStart !== mainEnd && covered >= total) {
    // caso raro: niente ripetizione e giri iniziali più corti; già coperto dall'errore sopra
  }

  // Suggerimenti di totale che chiudono con una ripetizione completa
  let suggestions = [];
  if (repeatLen > 0) {
    const base = introLen + outroLen;
    const k = Math.floor((total - base) / repeatLen);
    const lower = base + Math.max(1, k) * repeatLen;
    const upper = base + Math.max(1, k + 1) * repeatLen;
    if ((total - base) % repeatLen !== 0 || total < base + repeatLen) {
      suggestions = [...new Set([lower, upper])].filter(v => v !== total && v >= 1 && v <= MAX_ROWS);
    }
  }

  // Blocchi colore (consecutivi dello stesso colore uniti) e array per riga
  const n = Math.min(covered, total);
  const blocks = [];
  const rowColor = new Uint16Array(n);
  const rowWork = new Uint8Array(n);
  const rowBlock = new Uint32Array(n);
  const colorIdx = new Map(project.colors.map((c, i) => [c.id, i]));
  for (const s of segments) {
    let last = blocks[blocks.length - 1];
    if (!last || last.colorId !== s.colorId) {
      last = { colorId: s.colorId, start: s.start, len: 0 };
      blocks.push(last);
    }
    last.len += s.len;
    const ci = colorIdx.has(s.colorId) ? colorIdx.get(s.colorId) : 0;
    for (let r = s.start; r < s.start + s.len && r < n; r++) {
      rowColor[r] = ci;
      rowWork[r] = rowTypeFor(s.work, r, project.startWith);
      rowBlock[r] = blocks.length - 1;
    }
  }

  return {
    total: n,
    requestedTotal: total,
    blocks, rowColor, rowWork, rowBlock, segments,
    issues,
    valid: !issues.some(i => i.level === 'error'),
    summary: { introLen, repeatLen, outroLen, fullCycles, partialRows, covered },
    suggestions,
  };
}

/** Descrizione testuale della composizione della sequenza. */
export function describePlan(plan) {
  const s = plan.summary;
  const parts = [];
  if (s.introLen) parts.push(`${s.introLen} giri iniziali`);
  if (s.fullCycles) parts.push(`${s.fullCycles} ${s.fullCycles === 1 ? 'ripetizione completa' : 'ripetizioni complete'} da ${s.repeatLen} giri`);
  if (s.partialRows) parts.push(`1 ripetizione parziale di ${s.partialRows} giri`);
  if (s.outroLen) parts.push(`${Math.min(s.outroLen, plan.total)} giri finali`);
  return (parts.length ? parts.join(' + ') : 'Nessun giro') + ` = ${plan.total} giri`;
}

/* ------------------------------------------------------------------ */
/* Stato del contagiri                                                 */
/* ------------------------------------------------------------------ */

export function getState(project, plan) {
  const total = plan.total;
  const done = clamp(toInt(project.done), 0, total);
  if (total === 0 || plan.blocks.length === 0) {
    return { done: 0, total: 0, complete: false, empty: true, blockIndex: -1, block: null, inBlock: 0, blockLen: 0, nextRow: null, nextWork: null, colorId: null };
  }
  const complete = done >= total;
  const blockIndex = complete ? plan.blocks.length - 1 : plan.rowBlock[done];
  const block = plan.blocks[blockIndex];
  const inBlock = complete ? block.len : done - block.start;
  return {
    done, total, complete, empty: false,
    blockIndex, block, inBlock, blockLen: block.len,
    colorId: block.colorId,
    nextRow: complete ? null : done + 1,
    nextWork: complete ? null : plan.rowWork[done],
    nextBlock: plan.blocks[blockIndex + 1] || null,
  };
}

export function workLabel(rowType) {
  return rowType === ROW_ROVESCIO ? 'tutto a rovescio' : 'tutto a dritto';
}

/** Riga istruzione, es. "Prossimo giro: 41 · tutto a dritto". */
export function nextInstruction(state) {
  if (state.empty) return 'Progetto senza giri';
  if (state.complete) return 'Progetto completato';
  return `Prossimo giro: ${state.nextRow} · ${workLabel(state.nextWork)}`;
}

function pushHistory(project, value) {
  if (!Array.isArray(project.history)) project.history = [];
  project.history.push(value);
  if (project.history.length > HISTORY_LIMIT) project.history.splice(0, project.history.length - HISTORY_LIMIT);
}

function changeEvent(before, after) {
  if (after.complete && !before.complete) return { type: 'complete' };
  if (after.blockIndex !== before.blockIndex) {
    return { type: after.blockIndex > before.blockIndex ? 'colorForward' : 'colorBack', state: after };
  }
  return { type: 'step' };
}

/** +1 giro. Restituisce null se non è possibile (già al totale). */
export function increment(project, plan) {
  const before = getState(project, plan);
  if (before.empty || before.done >= before.total) return null;
  pushHistory(project, before.done);
  project.done = before.done + 1;
  return changeEvent(before, getState(project, plan));
}

/** −1 giro. Se il blocco attuale è a zero torna al blocco precedente. */
export function decrement(project, plan) {
  const before = getState(project, plan);
  if (before.empty || before.done <= 0) return null;
  pushHistory(project, before.done);
  project.done = before.done - 1;
  return changeEvent(before, getState(project, plan));
}

/** Annulla l'ultima modifica del conteggio. */
export function undo(project, plan) {
  if (!Array.isArray(project.history) || !project.history.length) return null;
  const before = getState(project, plan);
  project.done = clamp(toInt(project.history.pop()), 0, plan.total);
  return changeEvent(before, getState(project, plan));
}

export function lastUndoDelta(project) {
  if (!project.history || !project.history.length) return 0;
  return project.history[project.history.length - 1] - project.done;
}

/** Promemoria per il prossimo giro e quelli in arrivo (entro `ahead` giri). */
export function remindersFor(project, state, ahead = 3) {
  if (!state.nextRow) return { now: [], soon: [] };
  const list = (project.reminders || []).filter(r => r.text && r.text.trim());
  return {
    now: list.filter(r => toInt(r.row) === state.nextRow),
    soon: list.filter(r => toInt(r.row) > state.nextRow && toInt(r.row) <= state.nextRow + ahead)
      .sort((a, b) => a.row - b.row),
  };
}

/* ------------------------------------------------------------------ */
/* Colori                                                              */
/* ------------------------------------------------------------------ */

export function hexToRgb(hex) {
  let h = String(hex || '').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return [128, 128, 128];
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
export function mix(hex, withHex, amount) {
  const a = hexToRgb(hex), b = hexToRgb(withHex);
  return rgbToHex(a.map((v, i) => v * (1 - amount) + b[i] * amount));
}
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Versione molto chiara di un colore, per i giri futuri. */
export function futureTint(hex) {
  return mix(hex, '#ffffff', 0.72);
}

/* ------------------------------------------------------------------ */
/* Progetti                                                            */
/* ------------------------------------------------------------------ */

export function block(colorId, rows, work = 'eredita') {
  return { id: uid(), colorId, rows, work };
}

export function newProject(overrides = {}) {
  const c = { id: uid(), name: 'Colore 1', hex: '#c97b84' };
  const now = Date.now();
  return {
    id: uid(),
    name: 'Nuovo progetto',
    stitches: 40,
    totalRows: 200,
    work: 'dritto',
    startWith: 'dritto',
    colors: [c],
    sequence: { intro: [], repeat: [block(c.id, 200)], outro: [] },
    notes: '',
    yarn: { name: '', composition: '', weight: '', lot: '', needles: '', needleType: '' },
    reminders: [],
    done: 0,
    history: [],
    archived: false,
    createdAt: now, updatedAt: now, lastOpenedAt: 0,
    ...overrides,
  };
}

export function demoProject() {
  const nero = { id: uid(), name: 'Nero', hex: '#232323' };
  const verdino = { id: uid(), name: 'Verdino', hex: '#9fd36b' };
  return newProject({
    name: 'Sciarpa nera e verdina (esempio)',
    stitches: 30,
    totalRows: 900,
    work: 'alternato',
    startWith: 'dritto',
    colors: [nero, verdino],
    sequence: { intro: [], repeat: [block(nero.id, 30), block(verdino.id, 30)], outro: [] },
    notes: 'Progetto dimostrativo: sciarpa sottile a righe di 30 giri nere e 30 verdine, un giro a dritto e uno a rovescio.\nPuoi modificarlo, azzerarlo o eliminarlo quando vuoi.',
    yarn: { name: 'Lana merino', composition: '100% merino', weight: '50 g / 125 m', lot: '', needles: '4 mm', needleType: 'Bambù' },
    reminders: [{ id: uid(), row: 60, text: 'Al giro 60 cambia ferri' }],
    done: 40,
  });
}

export function duplicateProject(p) {
  const copy = structuredCloneSafe(p);
  const idMap = new Map();
  copy.id = uid();
  copy.name = p.name + ' (copia)';
  copy.colors.forEach(c => { const n = uid(); idMap.set(c.id, n); c.id = n; });
  for (const k of ['intro', 'repeat', 'outro']) {
    copy.sequence[k].forEach(b => { b.id = uid(); b.colorId = idMap.get(b.colorId) || b.colorId; });
  }
  copy.reminders.forEach(r => { r.id = uid(); });
  copy.done = 0;
  copy.history = [];
  copy.archived = false;
  copy.createdAt = copy.updatedAt = Date.now();
  copy.lastOpenedAt = 0;
  return copy;
}

function structuredCloneSafe(o) {
  return JSON.parse(JSON.stringify(o));
}

/** Rende coerente un progetto letto da storage o da un backup. */
export function normalizeProject(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Progetto non valido');
  const base = newProject();
  const p = { ...base, ...raw };
  p.id = typeof raw.id === 'string' && raw.id ? raw.id : uid();
  p.name = String(raw.name || 'Progetto senza nome').slice(0, 120);
  p.stitches = clamp(toInt(raw.stitches, 40), 1, MAX_STITCHES);
  p.totalRows = clamp(toInt(raw.totalRows, 1), 1, MAX_ROWS);
  p.work = WORKS[raw.work] ? raw.work : 'dritto';
  p.startWith = raw.startWith === 'rovescio' ? 'rovescio' : 'dritto';
  p.colors = Array.isArray(raw.colors) && raw.colors.length
    ? raw.colors.map((c, i) => ({ id: String(c.id || uid()), name: String(c.name || `Colore ${i + 1}`).slice(0, 60), hex: rgbToHex(hexToRgb(c.hex)) }))
    : base.colors;
  const ids = new Set(p.colors.map(c => c.id));
  const seq = raw.sequence || {};
  p.sequence = {};
  for (const k of ['intro', 'repeat', 'outro']) {
    p.sequence[k] = (Array.isArray(seq[k]) ? seq[k] : []).map(b => ({
      id: String(b.id || uid()),
      colorId: ids.has(b.colorId) ? b.colorId : p.colors[0].id,
      rows: clamp(toInt(b.rows, 1), 1, MAX_ROWS),
      work: BLOCK_WORKS[b.work] ? b.work : 'eredita',
    }));
  }
  if (!p.sequence.intro.length && !p.sequence.repeat.length && !p.sequence.outro.length) {
    p.sequence.repeat = [block(p.colors[0].id, p.totalRows)];
  }
  p.notes = String(raw.notes || '');
  p.yarn = { ...base.yarn, ...(raw.yarn && typeof raw.yarn === 'object' ? raw.yarn : {}) };
  for (const k of Object.keys(p.yarn)) p.yarn[k] = String(p.yarn[k] ?? '');
  p.reminders = (Array.isArray(raw.reminders) ? raw.reminders : [])
    .map(r => ({ id: String(r.id || uid()), row: clamp(toInt(r.row, 1), 1, MAX_ROWS), text: String(r.text || '') }))
    .filter(r => r.text.trim());
  p.done = Math.max(0, toInt(raw.done, 0));
  p.history = (Array.isArray(raw.history) ? raw.history : []).map(v => Math.max(0, toInt(v))).slice(-HISTORY_LIMIT);
  p.archived = !!raw.archived;
  p.createdAt = toInt(raw.createdAt, Date.now());
  p.updatedAt = toInt(raw.updatedAt, Date.now());
  p.lastOpenedAt = toInt(raw.lastOpenedAt, 0);
  // l'avanzamento non può superare il totale effettivo del piano
  const plan = buildPlan(p);
  p.done = clamp(p.done, 0, plan.total);
  p.history = p.history.map(v => clamp(v, 0, plan.total));
  return p;
}

/* ------------------------------------------------------------------ */
/* Backup                                                              */
/* ------------------------------------------------------------------ */

export const BACKUP_FORMAT = 'contagiri-maglia-backup';

export function makeBackup(projects, settings) {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: projects.map(structuredCloneSafe),
    settings: settings ? structuredCloneSafe(settings) : undefined,
  };
}

/** Legge un backup e restituisce i progetti normalizzati. Lancia un errore leggibile. */
export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Il file non è un backup valido (JSON non leggibile).'); }
  let list;
  if (data && data.format === BACKUP_FORMAT && Array.isArray(data.projects)) list = data.projects;
  else if (Array.isArray(data)) list = data;
  else if (data && data.sequence && data.colors) list = [data];
  else throw new Error('Il file non contiene progetti del contagiri.');
  const projects = [];
  for (const raw of list) projects.push(normalizeProject(raw));
  if (!projects.length) throw new Error('Il backup non contiene progetti.');
  return { projects, settings: data && data.settings };
}

/** Unisce i progetti importati con quelli esistenti senza sovrascrivere nulla. */
export function mergeProjects(existing, incoming) {
  const result = existing.slice();
  const ids = new Set(existing.map(p => p.id));
  let added = 0, updated = 0;
  for (const p of incoming) {
    const idx = result.findIndex(x => x.id === p.id);
    if (idx >= 0) {
      const same = JSON.stringify({ ...result[idx], lastOpenedAt: 0 }) === JSON.stringify({ ...p, lastOpenedAt: 0 });
      if (same) continue;
      // stesso progetto con dati diversi: lo aggiungo come copia, senza perdere nulla
      const copy = { ...p, id: uid(), name: p.name + ' (importato)' };
      result.push(copy); ids.add(copy.id); updated++;
    } else {
      result.push(p); ids.add(p.id); added++;
    }
  }
  return { projects: result, added, copies: updated };
}

/**
 * Applica una nuova struttura a un progetto esistente conservando
 * l'avanzamento (numero di giri completati). Indica se servirà ridurlo.
 */
export function structureChangeImpact(oldProject, newProject) {
  const newPlan = buildPlan(newProject);
  const done = toInt(oldProject.done);
  return {
    plan: newPlan,
    done,
    reduce: done > newPlan.total,
    newDone: Math.min(done, newPlan.total),
  };
}
