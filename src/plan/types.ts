export type RecordMode = 'yes' | 'optional' | 'no' | 'notes';
export type RecordKind = 'draw' | 'runs' | 'generic' | 'notes' | null;
export type TestId = 'straight' | 'cut' | 'stop' | 'draw' | 'fiveBall';
export type ErrorCodeId = 'P' | 'C' | 'S' | 'D';
/** 'day' for plan-day sessions; 'am' / 'pm' only in records from the earlier fixed daily plan. */
export type SessionId = 'am' | 'pm' | 'day';

/** One illustrated key point: a figure, a short title and text, and what the voice says. */
export interface LessonStep {
  title: string;
  text: string;
  speech: string;
  /** A lesson figure id (src/lesson/figures), or `diagram:<id>` for a drill diagram. */
  figure: string;
}

export interface Block {
  id: string;
  minutes: number;
  name: string;
  setup: string;
  volume: string;
  howToTrain: string;
  successStandard: string;
  /** The spoken introduction: the drill explained the way a coach would say it. */
  speech: string;
  /** Illustrated key points (the "Key points" walkthrough), each read aloud. */
  lesson: LessonStep[];
  purpose: string;
  record: RecordMode;
  recordKind: RecordKind;
  drillRefId?: string;
  /** A table diagram id, or `figure:<id>` for a lesson figure when the setup is not a table layout. */
  diagramId: string;
}

/** One week of the plan: days 1/3/5 run the A blocks, days 2/4/6 the B blocks (between the daily basics). */
export interface Week {
  title: string;
  focus: string;
  a: string[];
  b: string[];
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
  /** The spoken introduction: the test setup explained the way a coach would say it. */
  speech: string;
  /** Illustrated key points (the "Key points" walkthrough), each read aloud. */
  lesson: LessonStep[];
  kind: 'makeMiss' | 'makeMissLR' | 'distances' | 'runs';
  diagramId: string;
}

export interface Plan {
  version: number;
  title: string;
  intro: string;
  /** Block ids done every day: before the week's focus and after it. */
  daily: { start: string[]; end: string[] };
  weeks: Week[];
  blocks: Block[];
  tests: TestDef[];
  drillRefs: DrillRef[];
}
