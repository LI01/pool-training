import raw from './plan.json';
import type { Block, DrillRef, Plan, Session, SessionId, TestDef, TestId } from './types';

export const plan = raw as unknown as Plan;
const blocks = plan.sessions.flatMap((s) => s.blocks);

export const BLOCK_IDS = {
  drawLadder: 'am-draw-ladder',
  threeBall: 'pm-3ball',
  fiveBall: 'pm-5ball',
} as const;

export const getSession = (id: SessionId): Session => plan.sessions.find((s) => s.id === id)!;
export const getBlock = (id: string): Block | undefined => blocks.find((b) => b.id === id);
export const getDrillRef = (id: string): DrillRef | undefined => plan.drillRefs.find((d) => d.id === id);
export const getTestDef = (id: TestId): TestDef => plan.tests.find((t) => t.id === id)!;
export const TEST_ORDER: TestId[] = ['straight', 'cut', 'stop', 'draw', 'fiveBall'];
export * from './types';
