// Test della logica: node tests/model.test.mjs
import assert from 'node:assert/strict';
import * as M from '../js/model.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('✓', name); };

function scarfB() {
  const nero = { id: 'n', name: 'Nero', hex: '#222222' };
  const verde = { id: 'v', name: 'Verdino', hex: '#9fd36b' };
  return M.newProject({
    stitches: 30, totalRows: 900, work: 'alternato', startWith: 'dritto',
    colors: [nero, verde],
    sequence: { intro: [], repeat: [M.block('n', 30), M.block('v', 30)], outro: [] },
    done: 0, history: [],
  });
}

test('Esempio A: un solo colore = un solo blocco', () => {
  const c = { id: 'a', name: 'Blu', hex: '#3355aa' };
  const p = M.newProject({ stitches: 50, totalRows: 900, work: 'dritto', colors: [c], sequence: { intro: [], repeat: [M.block('a', 30)], outro: [] } });
  const plan = M.buildPlan(p);
  assert.equal(plan.total, 900);
  assert.equal(plan.blocks.length, 1);
  assert.equal(plan.blocks[0].len, 900);
  assert.ok(plan.valid);
  assert.equal(plan.issues.length, 0);
  const s = M.getState(p, plan);
  assert.equal(M.nextInstruction(s), 'Prossimo giro: 1 · tutto a dritto');
});

test('Esempio B: 30 neri + 10 verdini → numero grande 10, totali 10/30 e 40/900', () => {
  const p = scarfB();
  const plan = M.buildPlan(p);
  assert.equal(plan.blocks.length, 30);
  for (let i = 0; i < 40; i++) M.increment(p, plan);
  const s = M.getState(p, plan);
  assert.equal(s.inBlock, 10);
  assert.equal(s.blockLen, 30);
  assert.equal(s.done, 40);
  assert.equal(s.colorId, 'v');
  assert.equal(M.nextInstruction(s), 'Prossimo giro: 41 · tutto a dritto');
});

test('Passaggio automatico al blocco successivo con numero grande a 0', () => {
  const p = scarfB(); const plan = M.buildPlan(p);
  let ev;
  for (let i = 0; i < 30; i++) ev = M.increment(p, plan);
  assert.equal(ev.type, 'colorForward');
  const s = M.getState(p, plan);
  assert.equal(s.colorId, 'v'); assert.equal(s.inBlock, 0); assert.equal(s.done, 30);
});

test('Correzione all\'indietro attraverso un cambio colore: 0/30 verdini → 29/30 neri', () => {
  const p = scarfB(); const plan = M.buildPlan(p);
  for (let i = 0; i < 30; i++) M.increment(p, plan);
  const ev = M.decrement(p, plan);
  assert.equal(ev.type, 'colorBack');
  const s = M.getState(p, plan);
  assert.equal(s.colorId, 'n'); assert.equal(s.inBlock, 29); assert.equal(s.done, 29);
  assert.equal(M.nextInstruction(s), 'Prossimo giro: 30 · tutto a rovescio');
});

test('Alternanza continua attraverso i cambi colore (inizio a dritto)', () => {
  const p = scarfB(); const plan = M.buildPlan(p);
  for (let r = 0; r < 900; r++) assert.equal(plan.rowWork[r], r % 2 === 0 ? M.ROW_DRITTO : M.ROW_ROVESCIO);
  p.done = 30; // primo giro verde = giro 31 → dritto
  assert.equal(M.nextInstruction(M.getState(p, plan)), 'Prossimo giro: 31 · tutto a dritto');
});

test('Alternanza con inizio a rovescio', () => {
  const p = scarfB(); p.startWith = 'rovescio'; const plan = M.buildPlan(p);
  assert.equal(plan.rowWork[0], M.ROW_ROVESCIO);
  assert.equal(plan.rowWork[1], M.ROW_DRITTO);
  assert.equal(plan.rowWork[30], M.ROW_ROVESCIO);
});

test('Il conteggio non scende sotto zero', () => {
  const p = scarfB(); const plan = M.buildPlan(p);
  assert.equal(M.decrement(p, plan), null);
  assert.equal(p.done, 0);
});

test('Completamento: non supera il totale, mostra l\'ultimo blocco pieno, si può correggere', () => {
  const p = scarfB(); const plan = M.buildPlan(p);
  let ev;
  for (let i = 0; i < 900; i++) ev = M.increment(p, plan);
  assert.equal(ev.type, 'complete');
  assert.equal(M.increment(p, plan), null);
  let s = M.getState(p, plan);
  assert.equal(s.done, 900); assert.ok(s.complete); assert.equal(s.inBlock, 30); assert.equal(s.blockLen, 30);
  assert.equal(M.nextInstruction(s), 'Progetto completato');
  M.decrement(p, plan);
  s = M.getState(p, plan);
  assert.equal(s.done, 899); assert.ok(!s.complete); assert.equal(s.inBlock, 29);
  assert.equal(M.nextInstruction(s), 'Prossimo giro: 900 · tutto a rovescio');
});

test('Annulla ripristina il valore precedente', () => {
  const p = scarfB(); const plan = M.buildPlan(p);
  M.increment(p, plan); M.increment(p, plan); M.decrement(p, plan);
  assert.equal(p.done, 1);
  M.undo(p, plan); assert.equal(p.done, 2);
  M.undo(p, plan); assert.equal(p.done, 1);
  M.undo(p, plan); assert.equal(p.done, 0);
  assert.equal(M.undo(p, plan), null);
});

test('Stesso colore che ricompare ha un proprio conteggio', () => {
  const p = scarfB(); const plan = M.buildPlan(p);
  p.done = 61; // 30 neri, 30 verdi, 1 nero
  const s = M.getState(p, plan);
  assert.equal(s.colorId, 'n'); assert.equal(s.inBlock, 1); assert.equal(s.blockIndex, 2);
});

test('Sequenza con iniziali, ripetizione a 3 colori e finali; ultima ripetizione parziale segnalata', () => {
  const colors = [{ id: 'a', name: 'A', hex: '#ff0000' }, { id: 'b', name: 'B', hex: '#00ff00' }, { id: 'c', name: 'C', hex: '#0000ff' }];
  const p = M.newProject({ totalRows: 100, colors, work: 'dritto',
    sequence: { intro: [M.block('a', 10)], repeat: [M.block('b', 20), M.block('c', 15, 'rovescio')], outro: [M.block('a', 10)] } });
  const plan = M.buildPlan(p);
  assert.equal(plan.total, 100);
  // 10 + (35 + 35) + 10 = 90; restano 10 giri → B parziale 10/20, C saltato
  assert.ok(plan.valid);
  const warn = plan.issues.find(i => i.level === 'warn');
  assert.ok(warn && /parziale/.test(warn.text) && /«B» avrà 10 giri invece di 20/.test(warn.text) && /«C»/.test(warn.text), warn && warn.text);
  assert.deepEqual(plan.suggestions, [90, 125]);
  assert.equal(plan.rowWork[10 + 20], M.ROW_ROVESCIO); // primo giro del blocco C
  assert.equal(M.describePlan(plan), '10 giri iniziali + 2 ripetizioni complete da 35 giri + 1 ripetizione parziale di 10 giri + 10 giri finali = 100 giri');
});

test('Blocco finale dello stesso colore viene unito al precedente', () => {
  const colors = [{ id: 'a', name: 'A', hex: '#ff0000' }, { id: 'b', name: 'B', hex: '#00ff00' }];
  const p = M.newProject({ totalRows: 100, colors, sequence: { intro: [], repeat: [M.block('a', 20), M.block('b', 20)], outro: [M.block('b', 20)] } });
  const plan = M.buildPlan(p);
  assert.equal(plan.blocks.length, 4);
  assert.equal(plan.blocks[3].len, 40);
});

test('Senza ripetizione e somma diversa dal totale → errore esplicito con correzione', () => {
  const colors = [{ id: 'a', name: 'A', hex: '#ff0000' }];
  const p = M.newProject({ totalRows: 100, colors, sequence: { intro: [M.block('a', 30)], repeat: [], outro: [M.block('a', 30)] } });
  const plan = M.buildPlan(p);
  assert.ok(!plan.valid);
  assert.equal(plan.issues.find(i => i.level === 'error').fixTotal, 60);
});

test('Riduzione del totale sotto l\'avanzamento richiede riduzione', () => {
  const p = scarfB(); p.done = 500;
  const np = { ...p, totalRows: 300 };
  const impact = M.structureChangeImpact(p, np);
  assert.ok(impact.reduce); assert.equal(impact.newDone, 300);
  const np2 = { ...p, totalRows: 1200 };
  assert.ok(!M.structureChangeImpact(p, np2).reduce);
});

test('Backup: esporta e reimporta identico', () => {
  const a = M.normalizeProject(scarfB()); a.done = 123; a.history = [120, 121, 122];
  const b = M.normalizeProject(M.demoProject());
  const text = JSON.stringify(M.makeBackup([a, b], { theme: 'dark' }));
  const { projects, settings } = M.parseBackup(text);
  assert.deepEqual(projects, [a, b]);
  assert.equal(settings.theme, 'dark');
  const merged = M.mergeProjects([a], projects);
  assert.equal(merged.projects.length, 2); assert.equal(merged.added, 1);
  assert.throws(() => M.parseBackup('ciao'), /non è un backup valido/);
  assert.throws(() => M.parseBackup('{"x":1}'), /non contiene progetti/);
});

test('Prestazioni: 20000 giri', () => {
  const p = scarfB(); p.totalRows = 20000;
  const t = performance.now();
  const plan = M.buildPlan(p);
  assert.equal(plan.total, 20000);
  assert.ok(performance.now() - t < 200);
});

test('Promemoria al giro esatto e in arrivo', () => {
  const p = scarfB(); p.reminders = [{ id: 'x', row: 60, text: 'Cambia ferri' }]; const plan = M.buildPlan(p);
  p.done = 59; let r = M.remindersFor(p, M.getState(p, plan));
  assert.equal(r.now.length, 1);
  p.done = 57; r = M.remindersFor(p, M.getState(p, plan));
  assert.equal(r.now.length, 0); assert.equal(r.soon.length, 1);
});

console.log(`\n${passed} test superati`);
