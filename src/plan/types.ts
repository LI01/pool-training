export type RecordMode = 'yes' | 'optional' | 'no' | 'notes';
export type RecordKind = 'draw' | 'runs' | 'generic' | 'notes' | null;
export type TestId = 'straight' | 'cut' | 'stop' | 'draw' | 'fiveBall';
export type ErrorCodeId = 'P' | 'C' | 'S' | 'D';
export type SessionId = 'am' | 'pm';

export interface Block {
  id: string;
  timeLabel: string;
  minutes: number;
  name: string;
  setup: string;
  volume: string;
  howToTrain: string;
  successStandard: string;
  purpose: string;
  record: RecordMode;
  recordKind: RecordKind;
  drillRefId?: string;
  diagramId: string;
}

export interface Session {
  id: SessionId;
  title: string;
  blocks: Block[];
}

export interface DrillRef {
  id: string;
  name: string;
  ballPlacement: string;
  executionCue: string;
  commonMistake: string;
  progression: string;
  whenToUseReducer: string;
}

export interface TestDef {
  id: TestId;
  name: string;
  setup: string;
  attempts: number;
  scoring: string;
  measures: string;
  frequency: string;
  notes: string;
  kind: 'makeMiss' | 'makeMissLR' | 'distances' | 'runs';
  diagramId: string;
}

export interface ErrorCode {
  code: ErrorCodeId;
  meaning: string;
}

export interface Plan {
  version: number;
  title: string;
  intro: string;
  sessions: Session[];
  tests: TestDef[];
  errorCodes: ErrorCode[];
  drillRefs: DrillRef[];
  focusMap: Record<ErrorCodeId, { blockIds: string[]; advice: string }>;
}
