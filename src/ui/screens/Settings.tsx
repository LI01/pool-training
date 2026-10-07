import { useEffect, useRef, useState } from 'preact/hooks';
import { BackupError, validateBackup } from '../../db/store';
import type { Backup } from '../../db/types';
import { setChimeEnabled } from '../../platform/chime';
import { resolveStartDate } from '../../stats';
import { localDate } from '../../stats/dates';
import { type NowFn } from '../App';
import { BigButton } from '../components/BigButton';
import { Sheet } from '../components/Sheet';
import { useAppData } from '../useAppData';

export function Settings({ now }: { now: NowFn }) {
  const { store, sessions, tests, settings, today, refresh } = useAppData();
  const [startDate, setStartDate] = useState(settings.startDate ?? '');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<Backup | null>(null);
  const [resetArmed, setResetArmed] = useState(false);
  const resetTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => clearTimeout(resetTimer.current), []);
  useEffect(() => setStartDate(settings.startDate ?? ''), [settings.startDate]);

  const resolved = resolveStartDate(settings, sessions, tests) ?? today;

  const saveStart = async () => {
    await store.saveSettings({ ...settings, startDate: startDate || undefined });
    await refresh();
    setMessage('Start date saved.');
  };

  const toggleSound = async () => {
    const soundOn = !settings.soundOn;
    setChimeEnabled(soundOn);
    await store.saveSettings({ ...settings, soundOn });
    await refresh();
  };

  const exportBackup = async () => {
    const b = await store.exportBackup(now());
    const url = URL.createObjectURL(new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `pool-training-backup-${localDate(now())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    await refresh();
    setError(null);
    setMessage('Backup downloaded.');
  };

  const onImportFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    setMessage(null);
    if (!file) return;
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      setError('Invalid file: not JSON');
      return;
    }
    try {
      setPendingImport(validateBackup(data));
      setError(null);
    } catch (err) {
      if (!(err instanceof BackupError)) throw err;
      setError(`Invalid file: not a pool-training backup (${err.message})`);
    }
    input.value = '';
  };

  const confirmImport = async () => {
    const b = pendingImport!;
    setPendingImport(null);
    await store.importBackup(b);
    await refresh();
    setMessage('Backup imported.');
  };

  const onReset = async () => {
    if (!resetArmed) {
      setResetArmed(true);
      resetTimer.current = window.setTimeout(() => setResetArmed(false), 5000);
      return;
    }
    clearTimeout(resetTimer.current);
    setResetArmed(false);
    await store.resetAll();
    await refresh();
    setError(null);
    setMessage('All data erased.');
  };

  return (
    <main class="screen">
      <h1>Settings</h1>

      {error && <p class="notice notice--error" role="alert">{error}</p>}
      {message && <p class="notice notice--ok" role="status">{message}</p>}

      <section class="panel">
        <h2>Start date (Day 1)</h2>
        <div class="row">
          <input type="date" aria-label="Start date" value={startDate} onInput={(e) => setStartDate((e.currentTarget as HTMLInputElement).value)} />
          <BigButton onClick={saveStart}>Save</BigButton>
        </div>
        {!settings.startDate && <p class="muted">Day 1 is currently {resolved}.</p>}
      </section>

      <section class="panel">
        <label class="row row--between toggle">
          <span>Sound</span>
          <input type="checkbox" role="switch" checked={settings.soundOn} onChange={toggleSound} />
        </label>
      </section>

      <section class="panel">
        <h2>Backup</h2>
        <BigButton onClick={exportBackup}>Export backup</BigButton>
        <p class="muted">Last backup: {settings.lastExportAt ? localDate(settings.lastExportAt) : 'Never'}</p>
        <label class="file-button">
          Import backup
          <input type="file" accept="application/json,.json" onChange={onImportFile} />
        </label>
      </section>

      <section class="panel">
        <a class="link-row" href="#/diagrams">Review all diagrams</a>
      </section>

      <section class="panel">
        <h2>Danger zone</h2>
        <BigButton variant="bad" onClick={onReset}>{resetArmed ? 'Tap again to confirm' : 'Reset all data'}</BigButton>
      </section>

      {pendingImport && (
        <Sheet title="Import backup" onClose={() => setPendingImport(null)}>
          <p class="sheet__text">
            Replace all current data with this backup ({pendingImport.sessions.length} sessions, {pendingImport.tests.length} tests)?
          </p>
          <div class="sheet__actions">
            <BigButton onClick={() => setPendingImport(null)}>Cancel</BigButton>
            <BigButton variant="bad" onClick={confirmImport}>Replace</BigButton>
          </div>
        </Sheet>
      )}
    </main>
  );
}
