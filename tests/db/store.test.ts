import { createStore, validateBackup, BackupError } from '../../src/db/store';
import type { SessionRecord, TestRecord } from '../../src/db/types';

let n = 0;
const fresh = () => createStore(`test-db-${++n}`);
const sess: SessionRecord = { id: 's1', date: '2026-10-07', sessionId: 'am', planVersion: 1, startedAt: 1, endedAt: 2, activeMinutes: 60, blocks: [] };
const tst: TestRecord = { id: 't1', date: '2026-10-07', planVersion: 1, startedAt: 1, endedAt: 2, straight: [{ ok: true }] };
const wrap = (o: object) => ({ app: 'pool-training', schema: 1, exportedAt: 1, sessions: [], tests: [], settings: { soundOn: true }, ...o });

test('put and list records', async () => {
  const s = fresh();
  await s.putSession(sess); await s.putTest(tst);
  expect(await s.listSessions()).toEqual([sess]);
  expect(await s.listTests()).toEqual([tst]);
});

test('settings default and save', async () => {
  const s = fresh();
  expect(await s.getSettings()).toEqual({ soundOn: true });
  await s.saveSettings({ soundOn: false, startDate: '2026-10-07' });
  expect(await s.getSettings()).toEqual({ soundOn: false, startDate: '2026-10-07' });
});

test('active state set and clear', async () => {
  const s = fresh();
  await s.setActive({ type: 'test', payload: { x: 1 }, updatedAt: 5 });
  expect((await s.getActive())?.payload).toEqual({ x: 1 });
  await s.setActive(undefined);
  expect(await s.getActive()).toBeUndefined();
});

test('export → reset → import round-trip restores everything', async () => {
  const s = fresh();
  await s.putSession(sess); await s.putTest(tst); await s.saveSettings({ soundOn: false });
  const b = await s.exportBackup(1000);
  expect(b.settings.lastExportAt).toBe(1000);
  expect((await s.getSettings()).lastExportAt).toBeUndefined(); // building a backup does not stamp
  await s.resetAll();
  expect(await s.listSessions()).toEqual([]);
  await s.importBackup(JSON.parse(JSON.stringify(b)));
  expect(await s.listSessions()).toEqual([sess]);
  expect(await s.listTests()).toEqual([tst]);
  expect((await s.getSettings()).soundOn).toBe(false);
});

test('markExported stamps lastExportAt and keeps other settings', async () => {
  const s = fresh();
  await s.saveSettings({ soundOn: false, startDate: '2026-10-01' });
  await s.markExported(2000);
  expect(await s.getSettings()).toEqual({ soundOn: false, startDate: '2026-10-01', lastExportAt: 2000 });
});

test.each([
  ['null', null],
  ['wrong app', { app: 'other', schema: 1, exportedAt: 1, sessions: [], tests: [], settings: { soundOn: true } }],
  ['wrong schema', { app: 'pool-training', schema: 2, exportedAt: 1, sessions: [], tests: [], settings: { soundOn: true } }],
  ['bad session', { app: 'pool-training', schema: 1, exportedAt: 1, sessions: [{ id: 1 }], tests: [], settings: { soundOn: true } }],
  ['bad date', { app: 'pool-training', schema: 1, exportedAt: 1, sessions: [{ ...sess, date: '7/10/2026' }], tests: [], settings: { soundOn: true } }],
  ['bad shot tag', wrap({ tests: [{ ...tst, straight: [{ ok: false, tag: 'X' }] }] })],
  ['bad shot side', wrap({ tests: [{ ...tst, cut: [{ ok: true, side: 'M' }] }] })],
  ['non-boolean shot ok', wrap({ tests: [{ ...tst, stop: [{ ok: 1 }] }] })],
  ['bad failTag', wrap({ sessions: [{ ...sess, blocks: [{ blockId: 'b', runs: { success: 1, attempts: 2, failTags: ['Z'] } }] }] })],
  ['non-array failTags', wrap({ sessions: [{ ...sess, blocks: [{ blockId: 'b', runs: { success: 1, attempts: 2, failTags: 'P' } }] }] })],
  ['bad draw', wrap({ tests: [{ ...tst, draw: [1, 'x'] }] })],
  ['bad settings', wrap({ settings: { soundOn: 'yes' } })],
])('validateBackup rejects %s', (_, data) => {
  expect(() => validateBackup(data)).toThrow(BackupError);
});

test('validateBackup accepts valid tags and sides', () => {
  const data = wrap({
    tests: [{ ...tst, cut: [{ ok: false, tag: 'C', side: 'L' }], draw: [1.5, 2] }],
    sessions: [{ ...sess, blocks: [{ blockId: 'b', runs: { success: 1, attempts: 2, failTags: ['P', 'D'] } }] }],
  });
  expect(validateBackup(data).tests).toHaveLength(1);
});

test('failed import leaves existing data untouched', async () => {
  const s = fresh();
  await s.putSession(sess);
  await expect(s.importBackup({ app: 'nope' })).rejects.toThrow(BackupError);
  expect(await s.listSessions()).toEqual([sess]);
});
