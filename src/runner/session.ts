import type { Block, ErrorCodeId, RecordKind, SessionId } from '../plan';
import type { BlockResult, SessionRecord } from '../db/types';
import { localDate } from '../stats/dates';

export interface SessionRunState {
  kind: 'session'; sessionId: SessionId; startedAt: number;
  blockIndex: number; blockStartedAt: number; pausedAt: number | null;
  pausedTotalMs: number; sessionPausedMs: number; extraMs: number;
  results: Record<string, BlockResult>; finished: boolean;
}
export type EntryInput = Partial<Pick<BlockResult, 'draw' | 'runs' | 'generic' | 'notes' | 'skipped'>>;

export const startSession = (sessionId: SessionId, now: number): SessionRunState => ({
  kind: 'session', sessionId, startedAt: now, blockIndex: 0, blockStartedAt: now, pausedAt: null,
  pausedTotalMs: 0, sessionPausedMs: 0, extraMs: 0, results: {}, finished: false,
});

export const pause = (s: SessionRunState, now: number): SessionRunState => (s.pausedAt !== null || s.finished ? s : { ...s, pausedAt: now });
export const resume = (s: SessionRunState, now: number): SessionRunState => {
  if (s.pausedAt === null || s.finished) return s;
  const d = now - s.pausedAt;
  return { ...s, pausedAt: null, pausedTotalMs: s.pausedTotalMs + d, sessionPausedMs: s.sessionPausedMs + d };
};
export const addTime = (s: SessionRunState, ms: number): SessionRunState => (s.finished ? s : { ...s, extraMs: s.extraMs + ms });

export function remainingMs(s: SessionRunState, blocks: Block[], now: number): number {
  const eff = s.pausedAt ?? now;
  return blocks[s.blockIndex].minutes * 60000 + s.extraMs - (eff - s.blockStartedAt - s.pausedTotalMs);
}

export function formatClock(ms: number): string {
  const over = ms < 0;
  const secs = over ? Math.floor(-ms / 1000) : Math.ceil(ms / 1000);
  const t = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  return over ? `+${t}` : t;
}

const resetBlock = (s: SessionRunState, now: number, blockIndex: number): SessionRunState =>
  ({ ...s, blockIndex, blockStartedAt: now, pausedAt: null, pausedTotalMs: 0, extraMs: 0 });

export function next(s0: SessionRunState, blocks: Block[], now: number, entry?: EntryInput): SessionRunState {
  if (s0.finished) return s0;
  const s = resume(s0, now);
  const block = blocks[s.blockIndex];
  const result: BlockResult = { blockId: block.id, startedAt: s.blockStartedAt, endedAt: now, ...(entry ?? {}) };
  const results = { ...s.results, [block.id]: result };
  if (s.blockIndex === blocks.length - 1) return { ...s, results, finished: true };
  return { ...resetBlock(s, now, s.blockIndex + 1), results };
}

export function back(s0: SessionRunState, now: number): SessionRunState {
  const s = resume(s0, now);
  return { ...resetBlock(s, now, s.finished ? s.blockIndex : Math.max(0, s.blockIndex - 1)), finished: false };
}

/** Ends the session early: records the current block (keeping an existing entry, else skipped) and finishes. */
export function endSession(s0: SessionRunState, blocks: Block[], now: number): SessionRunState {
  if (s0.finished) return s0;
  const s = resume(s0, now);
  const block = blocks[s.blockIndex];
  const prev = s.results[block.id];
  const result: BlockResult = prev && !prev.skipped
    ? { ...prev, startedAt: s.blockStartedAt, endedAt: now }
    : { blockId: block.id, startedAt: s.blockStartedAt, endedAt: now, skipped: true };
  return { ...s, results: { ...s.results, [block.id]: result }, finished: true };
}

export function toRecord(s0: SessionRunState, blocks: Block[], planVersion: number, now: number): SessionRecord {
  // A finished session ends when its last block was recorded, not when Finish is tapped.
  const end = (s0.finished ? s0.results[blocks[s0.blockIndex]?.id]?.endedAt : undefined) ?? now;
  const s = resume(s0, end);
  return {
    id: crypto.randomUUID(), date: localDate(s.startedAt), sessionId: s.sessionId, planVersion,
    startedAt: s.startedAt, endedAt: end,
    activeMinutes: Math.round((end - s.startedAt - s.sessionPausedMs) / 60000),
    blocks: blocks.filter((b) => s.results[b.id]).map((b) => s.results[b.id]),
  };
}

type V = { ok: true; entry: EntryInput } | { ok: false; error: string };
const num = (v: string | undefined, max: number, integer: boolean): number | null => {
  if (v === undefined || v.trim() === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max || (integer && !Number.isInteger(n))) return null;
  return n;
};

export function validateEntry(kind: RecordKind, raw: Record<string, string>): V {
  switch (kind) {
    case 'draw': {
      const b = num(raw.bestIn, 120, false), t = num(raw.typicalIn, 120, false);
      if (b === null || t === null) return { ok: false, error: 'Enter inches between 0 and 120.' };
      if (t > b) return { ok: false, error: 'Typical cannot be more than best.' };
      return { ok: true, entry: { draw: { bestIn: b, typicalIn: t } } };
    }
    case 'runs': {
      const sc = num(raw.success, 100, true), at = num(raw.attempts, 100, true);
      if (sc === null || at === null || at === 0) return { ok: false, error: 'Enter whole numbers; attempts at least 1.' };
      if (sc > at) return { ok: false, error: 'Successes cannot exceed attempts.' };
      const failTags = (raw.failTags ?? '').split(',').map((x) => x.trim()).filter((x): x is ErrorCodeId => ['P', 'C', 'S', 'D'].includes(x));
      return { ok: true, entry: { runs: { success: sc, attempts: at, failTags } } };
    }
    case 'generic': {
      const m = num(raw.made, 200, true), at = num(raw.attempts, 200, true);
      if (m === null || at === null || at === 0) return { ok: false, error: 'Enter whole numbers; attempts at least 1.' };
      if (m > at) return { ok: false, error: 'Makes cannot exceed attempts.' };
      return { ok: true, entry: { generic: { made: m, attempts: at } } };
    }
    case 'notes':
      return { ok: true, entry: { notes: (raw.notes ?? '').trim() } };
    default:
      return { ok: true, entry: {} };
  }
}
