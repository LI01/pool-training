import rawEn from './plan.json';
import rawZh from './plan.zh.json';
import { getLang } from '../i18n';
import type { Block, DrillRef, Plan, Session, SessionId, TestDef, TestId } from './types';

const PLANS = { en: rawEn as unknown as Plan, zh: rawZh as unknown as Plan };
const BLOCKS = { en: PLANS.en.sessions.flatMap((s) => s.blocks), zh: PLANS.zh.sessions.flatMap((s) => s.blocks) };

/** The plan in the current language; each property reads through to it, so `plan.x` follows language changes. */
export const plan = {} as Plan;
for (const k of Object.keys(PLANS.en) as (keyof Plan)[]) {
  Object.defineProperty(plan, k, { get: () => PLANS[getLang()][k], enumerable: true });
}

export const BLOCK_IDS = {
  drawLadder: 'am-draw-ladder',
  threeBall: 'pm-3ball',
  fiveBall: 'pm-5ball',
} as const;

export const getSession = (id: SessionId): Session => plan.sessions.find((s) => s.id === id)!;
export const getBlock = (id: string): Block | undefined => BLOCKS[getLang()].find((b) => b.id === id);
export const getDrillRef = (id: string): DrillRef | undefined => plan.drillRefs.find((d) => d.id === id);
export const getTestDef = (id: TestId): TestDef => plan.tests.find((t) => t.id === id)!;
export const TEST_ORDER: TestId[] = ['straight', 'cut', 'stop', 'draw', 'fiveBall'];
export * from './types';
