// Salvataggio locale (localStorage): ogni modifica viene scritta subito.
import { normalizeProject, demoProject } from './model.js';

const KEY = 'contagiri-maglia:v1';

export const DEFAULT_SETTINGS = {
  theme: 'auto',        // auto | light | dark
  vibration: true,
  keepAwake: false,     // mantieni lo schermo acceso nella schermata di lavoro
  plusSide: 'right',    // right | left
  showArchived: false,
  lastBackupAt: 0,
};

export const store = {
  projects: [],
  settings: { ...DEFAULT_SETTINGS },
  saveError: null,
  listeners: new Set(),

  load() {
    let data = null;
    try {
      const raw = localStorage.getItem(KEY);
      data = raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Lettura dati non riuscita', e);
    }
    if (!data) {
      // primo avvio: progetto dimostrativo
      this.projects = [normalizeProject(demoProject())];
      this.settings = { ...DEFAULT_SETTINGS };
      this.save();
      return { firstRun: true };
    }
    this.projects = [];
    for (const raw of data.projects || []) {
      try { this.projects.push(normalizeProject(raw)); } catch (e) { console.warn('Progetto ignorato', e); }
    }
    this.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}), showArchived: false };
    return { firstRun: false };
  },

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, savedAt: Date.now(), projects: this.projects, settings: this.settings }));
      this.saveError = null;
      return true;
    } catch (e) {
      this.saveError = e;
      console.error('Salvataggio non riuscito', e);
      this.emit('save-error', e);
      return false;
    }
  },

  get(id) { return this.projects.find(p => p.id === id); },

  /** Aggiorna un progetto e salva immediatamente. */
  touch(project, { content = true } = {}) {
    if (content) project.updatedAt = Date.now();
    return this.save();
  },

  add(project) { this.projects.unshift(project); this.save(); },

  remove(id) {
    this.projects = this.projects.filter(p => p.id !== id);
    this.save();
  },

  replaceAll(projects) { this.projects = projects; this.save(); },

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit(type, payload) { for (const fn of this.listeners) fn(type, payload); },
};

// Se l'app è aperta in due schede, mantiene i dati allineati.
window.addEventListener('storage', e => {
  if (e.key === KEY) { store.load(); store.emit('external-change'); }
});

export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const already = await navigator.storage.persisted();
      if (!already) await navigator.storage.persist();
    }
  } catch { /* non supportato */ }
}
