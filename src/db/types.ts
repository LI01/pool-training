import type { ErrorCodeId, SessionId } from '../plan';

export interface BlockResult {
  blockId: string;
  startedAt: number; endedAt?: number;
  draw?: { bestIn: number; typicalIn: number };
  runs?: { success: number; attempts: number; failTags: ErrorCodeId[] };
  generic?: { made: number; attempts: number };
  notes?: string;
  skipped?: boolean;
}
export interface SessionRecord {
  id: string; date: string; sessionId: SessionId; planVersion: number;
  /** The plan day trained (sessions with sessionId 'day'). */
  dayNumber?: number;
  startedAt: number; endedAt: number; activeMinutes: number; blocks: BlockResult[];
}
export interface Shot { ok: boolean; tag?: ErrorCodeId; side?: 'L' | 'R' }
export interface TestRecord {
  id: string; date: string; planVersion: number; startedAt: number; endedAt: number;
  straight?: Shot[]; cut?: Shot[]; stop?: Shot[]; draw?: number[]; fiveBall?: Shot[];
}
export interface Settings {
  /** Only from the earlier 30-day plan; no longer used. */
  startDate?: string;
  soundOn: boolean; lastExportAt?: number; lang?: 'en' | 'zh'; voiceOn?: boolean;
  /** Progress set by hand in Settings: the next plan day as of `planDaySetAt`. */
  planDay?: number; planDaySetAt?: number;
}
export interface ActiveState { type: 'session' | 'test'; payload: unknown; updatedAt: number }
export interface Backup { app: 'pool-training'; schema: 1; exportedAt: number; sessions: SessionRecord[]; tests: TestRecord[]; settings: Settings }
