import { openDB } from 'idb';
import type { ActiveState, Backup, SessionRecord, Settings, TestRecord } from './types';

export class BackupError extends Error {}

export interface Store {
  listSessions(): Promise<SessionRecord[]>;
  listTests(): Promise<TestRecord[]>;
  putSession(r: SessionRecord): Promise<void>;
  putTest(r: TestRecord): Promise<void>;
  getActive(): Promise<ActiveState | undefined>;
  setActive(a: ActiveState | undefined): Promise<void>;
  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;
  /** Builds a backup; does not mark it exported (delivery may still fail). */
  exportBackup(now: number): Promise<Backup>;
  /** Records a successfully delivered backup. */
  markExported(now: number): Promise<void>;
  importBackup(data: unknown): Promise<void>;
  resetAll(): Promise<void>;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TAGS = ['P', 'C', 'S', 'D'];
const SHOT_KEYS = ['straight', 'cut', 'stop', 'fiveBall'] as const;

const fail = (msg: string): never => { throw new BackupError(msg); };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isNum = (v: unknown) => typeof v === 'number';

function checkShots(where: string, shots: unknown): void {
  if (!Array.isArray(shots)) fail(`${where}: shots must be an array`);
  (shots as unknown[]).forEach((s, i) => {
    if (!isObj(s) || typeof s.ok !== 'boolean') fail(`${where}[${i}]: shot needs boolean ok`);
    const shot = s as Record<string, unknown>;
    if (shot.tag !== undefined && !TAGS.includes(shot.tag as string)) fail(`${where}[${i}]: invalid tag`);
    if (shot.side !== undefined && shot.side !== 'L' && shot.side !== 'R') fail(`${where}[${i}]: invalid side`);
  });
}

function checkBlock(where: string, b: unknown): void {
  if (!isObj(b) || typeof b.blockId !== 'string') fail(`${where}: block needs string blockId`);
  const runs = (b as Record<string, unknown>).runs;
  if (runs !== undefined) {
    const tags = isObj(runs) ? runs.failTags : undefined;
    if (!Array.isArray(tags) || tags.some(t => !TAGS.includes(t))) fail(`${where}: invalid runs.failTags`);
  }
}

export function validateBackup(data: unknown): Backup {
  if (!isObj(data)) return fail('not an object');
  if (data.app !== 'pool-training') fail('not a pool-training backup');
  if (data.schema !== 1) fail('unsupported schema');
  if (!Array.isArray(data.sessions) || !Array.isArray(data.tests)) fail('sessions/tests must be arrays');
  (data.sessions as unknown[]).forEach((s, i) => {
    const w = `sessions[${i}]`;
    if (!isObj(s)) return fail(`${w}: not an object`);
    if (typeof s.id !== 'string') fail(`${w}: id must be a string`);
    if (typeof s.date !== 'string' || !DATE_RE.test(s.date)) fail(`${w}: invalid date`);
    if (s.sessionId !== 'am' && s.sessionId !== 'pm' && s.sessionId !== 'day') fail(`${w}: invalid sessionId`);
    if (s.dayNumber !== undefined && !(Number.isInteger(s.dayNumber) && (s.dayNumber as number) >= 1)) fail(`${w}: invalid dayNumber`);
    if (!isNum(s.startedAt) || !isNum(s.endedAt) || !isNum(s.activeMinutes)) fail(`${w}: invalid numbers`);
    if (!Array.isArray(s.blocks)) fail(`${w}: blocks must be an array`);
    (s.blocks as unknown[]).forEach((b, j) => checkBlock(`${w}.blocks[${j}]`, b));
  });
  (data.tests as unknown[]).forEach((t, i) => {
    const w = `tests[${i}]`;
    if (!isObj(t)) return fail(`${w}: not an object`);
    if (typeof t.id !== 'string') fail(`${w}: id must be a string`);
    if (typeof t.date !== 'string' || !DATE_RE.test(t.date)) fail(`${w}: invalid date`);
    if (!isNum(t.startedAt) || !isNum(t.endedAt)) fail(`${w}: invalid numbers`);
    for (const k of SHOT_KEYS) if (t[k] !== undefined) checkShots(`${w}.${k}`, t[k]);
    if (t.draw !== undefined && (!Array.isArray(t.draw) || t.draw.some(n => typeof n !== 'number' || !Number.isFinite(n)))) {
      fail(`${w}.draw: must be finite numbers`);
    }
  });
  if (!isObj(data.settings) || typeof data.settings.soundOn !== 'boolean') fail('invalid settings');
  const lang = (data.settings as Record<string, unknown>).lang;
  if (lang !== undefined && lang !== 'en' && lang !== 'zh') fail('invalid settings.lang');
  const voiceOn = (data.settings as Record<string, unknown>).voiceOn;
  if (voiceOn !== undefined && typeof voiceOn !== 'boolean') fail('invalid settings.voiceOn');
  const { planDay, planDaySetAt } = data.settings as Record<string, unknown>;
  if (planDay !== undefined && !(Number.isInteger(planDay) && (planDay as number) >= 1)) fail('invalid settings.planDay');
  if (planDaySetAt !== undefined && !isNum(planDaySetAt)) fail('invalid settings.planDaySetAt');
  return data as unknown as Backup;
}

/** The backup file contents; its settings carry lastExportAt = now. */
export function buildBackup(data: { sessions: SessionRecord[]; tests: TestRecord[]; settings: Settings }, now: number): Backup {
  return {
    app: 'pool-training', schema: 1, exportedAt: now,
    sessions: data.sessions, tests: data.tests, settings: { ...data.settings, lastExportAt: now },
  };
}

export function createStore(dbName = 'pool-training'): Store {
  const dbp = openDB(dbName, 1, {
    upgrade(db) {
      db.createObjectStore('sessions', { keyPath: 'id' }).createIndex('date', 'date');
      db.createObjectStore('tests', { keyPath: 'id' }).createIndex('date', 'date');
      db.createObjectStore('kv');
    },
  });
  const byStart = <T extends { startedAt: number }>(a: T[]) => a.sort((x, y) => x.startedAt - y.startedAt);

  const store: Store = {
    async listSessions() { return byStart(await (await dbp).getAll('sessions')); },
    async listTests() { return byStart(await (await dbp).getAll('tests')); },
    async putSession(r) { await (await dbp).put('sessions', r); },
    async putTest(r) { await (await dbp).put('tests', r); },
    async getActive() { return (await dbp).get('kv', 'active'); },
    async setActive(a) {
      const db = await dbp;
      if (a === undefined) await db.delete('kv', 'active');
      else await db.put('kv', a, 'active');
    },
    async getSettings() { return (await (await dbp).get('kv', 'settings')) ?? { soundOn: true }; },
    async saveSettings(s) { await (await dbp).put('kv', s, 'settings'); },
    async exportBackup(now) {
      const [sessions, tests, settings] = await Promise.all([store.listSessions(), store.listTests(), store.getSettings()]);
      return buildBackup({ sessions, tests, settings }, now);
    },
    async markExported(now) {
      await store.saveSettings({ ...(await store.getSettings()), lastExportAt: now });
    },
    async importBackup(data) {
      const b = validateBackup(data);
      const db = await dbp;
      const tx = db.transaction(['sessions', 'tests', 'kv'], 'readwrite');
      await tx.objectStore('sessions').clear();
      await tx.objectStore('tests').clear();
      await tx.objectStore('kv').delete('active');
      for (const s of b.sessions) await tx.objectStore('sessions').put(s);
      for (const t of b.tests) await tx.objectStore('tests').put(t);
      await tx.objectStore('kv').put(b.settings, 'settings');
      await tx.done;
    },
    async resetAll() {
      const tx = (await dbp).transaction(['sessions', 'tests', 'kv'], 'readwrite');
      await Promise.all([tx.objectStore('sessions').clear(), tx.objectStore('tests').clear(), tx.objectStore('kv').clear(), tx.done]);
    },
  };
  return store;
}

export async function requestPersistence(): Promise<boolean> {
  try {
    return navigator.storage?.persist ? await navigator.storage.persist() : false;
  } catch {
    return false;
  }
}
