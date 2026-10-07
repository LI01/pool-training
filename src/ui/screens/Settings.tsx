import { useEffect, useRef, useState } from 'preact/hooks';
import { BackupError, buildBackup, validateBackup } from '../../db/store';
import type { Backup } from '../../db/types';
import { getLang, t, type Lang } from '../../i18n';
import { setChimeEnabled } from '../../platform/chime';
import { setAutoSpeak } from '../../platform/speech';
import { resolveStartDate } from '../../stats';
import { localDate } from '../../stats/dates';
import { type NowFn } from '../nav';
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

  /** Runs an action; a null result means it was cancelled (no message). */
  const run = async (label: string, fn: () => Promise<string | null>) => {
    try {
      const ok = await fn();
      setError(null);
      setMessage(ok);
    } catch (err) {
      setMessage(null);
      setError(t('settings.failed', { label, error: err instanceof Error ? err.message : String(err) }));
    }
  };

  const saveStart = () => run(t('common.save'), async () => {
    await store.saveSettings({ ...settings, startDate: startDate || undefined });
    await refresh();
    return t('settings.startSaved');
  });

  const toggleSound = () => run(t('common.save'), async () => {
    const soundOn = !settings.soundOn;
    setChimeEnabled(soundOn);
    await store.saveSettings({ ...settings, soundOn });
    await refresh();
    return soundOn ? t('settings.soundOn') : t('settings.soundOff');
  });

  const toggleVoice = () => run(t('common.save'), async () => {
    const voiceOn = settings.voiceOn === false;
    setAutoSpeak(voiceOn);
    await store.saveSettings({ ...settings, voiceOn });
    await refresh();
    return voiceOn ? t('settings.voiceOn') : t('settings.voiceOff');
  });

  // The app re-renders in the new language once the saved settings are reloaded.
  const saveLang = (lang: Lang) => run(t('common.save'), async () => {
    await store.saveSettings({ ...settings, lang });
    await refresh();
    return null;
  });

  const download = (json: string, name: string) => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  // Built synchronously from the loaded data so navigator.share runs inside the tap (iOS needs the user gesture).
  // lastExportAt is stamped only once the file was handed over.
  const exportBackup = () => run(t('settings.export'), async () => {
    const at = now();
    const json = JSON.stringify(buildBackup({ sessions, tests, settings }, at), null, 2);
    const name = `pool-training-backup-${localDate(at)}.json`;
    const file = new File([json], name, { type: 'application/json' });
    let shared = false;
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] }); // iOS share sheet → Save to Files
        shared = true;
      } catch (err) {
        const errName = (err as { name?: string } | null)?.name;
        if (errName === 'AbortError') return null; // user cancelled: nothing was saved
        if (errName !== 'NotAllowedError') throw err;
        download(json, name); // share refused (e.g. gesture expired): fall back
      }
    } else {
      download(json, name);
    }
    await store.markExported(at);
    await refresh();
    return shared ? t('settings.shared') : t('settings.downloaded');
  });

  const onImportFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    setMessage(null);
    if (!file) return;
    try {
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        setError(t('settings.notJson'));
        return;
      }
      try {
        setPendingImport(validateBackup(data));
        setError(null);
      } catch (err) {
        setError(err instanceof BackupError
          ? t('settings.notBackup', { error: err.message })
          : t('settings.invalidFile'));
      }
    } finally {
      input.value = '';
    }
  };

  const confirmImport = () => {
    const b = pendingImport!;
    setPendingImport(null);
    return run(t('settings.import'), async () => {
      await store.importBackup(b);
      await refresh();
      return t('settings.imported');
    });
  };

  const onReset = async () => {
    if (!resetArmed) {
      setResetArmed(true);
      resetTimer.current = window.setTimeout(() => setResetArmed(false), 5000);
      return;
    }
    clearTimeout(resetTimer.current);
    setResetArmed(false);
    await run(t('settings.reset'), async () => {
      await store.resetAll();
      await refresh();
      return t('settings.erased');
    });
  };

  return (
    <main class="screen">
      <h1>{t('settings.title')}</h1>

      {error && <p class="notice notice--error" role="alert">{error}</p>}
      {message && <p class="notice notice--ok" role="status">{message}</p>}

      <section class="panel">
        <h2>{t('settings.startDate')}</h2>
        <div class="row">
          <input type="date" aria-label={t('settings.startDateLabel')} value={startDate} onInput={(e) => setStartDate((e.currentTarget as HTMLInputElement).value)} />
          <BigButton onClick={saveStart}>{t('common.save')}</BigButton>
        </div>
        {!settings.startDate && <p class="muted">{t('settings.dayOneIs', { date: resolved })}</p>}
      </section>

      <section class="panel">
        <label class="row row--between toggle">
          <span>{t('settings.sound')}</span>
          <input type="checkbox" role="switch" checked={settings.soundOn} onChange={toggleSound} />
        </label>
        <label class="row row--between toggle">
          <span>{t('settings.voice')}</span>
          <input type="checkbox" role="switch" checked={settings.voiceOn !== false} onChange={toggleVoice} />
        </label>
      </section>

      <section class="panel">
        <h2>{t('settings.language')}</h2>
        {/* Each language is named in itself, so the buttons are not translated. */}
        <div class="seg" role="group" aria-label={t('settings.language')}>
          {([['en', 'English'], ['zh', '中文']] as [Lang, string][]).map(([l, name]) => {
            const on = getLang() === l;
            return <button type="button" key={l} class={on ? 'seg__on' : ''} aria-pressed={on} onClick={() => saveLang(l)}>{name}</button>;
          })}
        </div>
      </section>

      <section class="panel">
        <h2>{t('settings.backup')}</h2>
        <BigButton onClick={exportBackup}>{t('settings.exportBackup')}</BigButton>
        <p class="muted">{t('settings.lastBackup', { date: settings.lastExportAt ? localDate(settings.lastExportAt) : t('settings.never') })}</p>
        <label class="file-button">
          {t('settings.importBackup')}
          <input type="file" accept="application/json,.json" onChange={onImportFile} />
        </label>
      </section>

      <section class="panel">
        <a class="link-row" href="#/diagrams">{t('settings.reviewDiagrams')}</a>
      </section>

      <section class="panel">
        <h2>{t('settings.danger')}</h2>
        <BigButton variant="bad" onClick={onReset}>{resetArmed ? t('settings.confirmReset') : t('settings.resetAll')}</BigButton>
      </section>

      {pendingImport && (
        <Sheet title={t('settings.importBackup')} onClose={() => setPendingImport(null)}>
          <p class="sheet__text">
            {t('settings.replaceText', { sessions: pendingImport.sessions.length, tests: pendingImport.tests.length })}
          </p>
          <div class="sheet__actions">
            <BigButton onClick={() => setPendingImport(null)}>{t('common.cancel')}</BigButton>
            <BigButton variant="bad" onClick={confirmImport}>{t('settings.replace')}</BigButton>
          </div>
        </Sheet>
      )}
    </main>
  );
}
