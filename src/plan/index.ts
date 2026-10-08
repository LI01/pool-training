import rawEn from './plan.json';
import rawZh from './plan.zh.json';
import { getLang } from '../i18n';
import type { Block, DrillRef, Plan, TestDef, TestId, Week } from './types';

const PLANS = { en: rawEn as unknown as Plan, zh: rawZh as unknown as Plan };

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

/** Training days per week (the 7th is rest or the test) and in the whole plan. */
export const DAYS_PER_WEEK = 6;
export const PLAN_DAYS = 48;

export interface PlanDay { n: number; week: number; info: Week; blocks: Block[]; minutes: number }

export const getBlock = (id: string): Block | undefined => plan.blocks.find((b) => b.id === id);

/** Plan day `n` (1–48): its week and the blocks in order (daily basics, the week's A or B focus, the review). */
export function getDay(n: number): PlanDay {
  const week = Math.ceil(n / DAYS_PER_WEEK);
  const info = plan.weeks[week - 1];
  const focus = (n - 1) % DAYS_PER_WEEK % 2 === 0 ? info.a : info.b;
  const blocks = [...plan.daily.start, ...focus, ...plan.daily.end].map((id) => getBlock(id)!);
  return { n, week, info, blocks, minutes: blocks.reduce((m, b) => m + b.minutes, 0) };
}

export const getDrillRef = (id: string): DrillRef | undefined => plan.drillRefs.find((d) => d.id === id);
export const getTestDef = (id: TestId): TestDef => plan.tests.find((t) => t.id === id)!;
export const TEST_ORDER: TestId[] = ['straight', 'cut', 'stop', 'draw', 'fiveBall'];
export * from './types';
