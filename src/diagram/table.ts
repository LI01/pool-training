import type { PocketId, Pt } from './types';

/** Playing surface in inches, cushion nose to cushion nose. Measure the real table and update. */
export const TABLE = { width: 78, height: 39, ball: 2.25, pocketMouth: 4.8, rail: 6 } as const;

export const POCKETS: Record<PocketId, Pt> = {
  TL: { x: 0, y: 0 }, TM: { x: TABLE.width / 2, y: 0 }, TR: { x: TABLE.width, y: 0 },
  BL: { x: 0, y: TABLE.height }, BM: { x: TABLE.width / 2, y: TABLE.height }, BR: { x: TABLE.width, y: TABLE.height },
};

/** 3 diamonds between pockets on each long rail half, 3 on each short rail. */
export const DIAMONDS: Pt[] = [
  ...[1, 2, 3, 5, 6, 7].flatMap((i) => [
    { x: (TABLE.width / 8) * i, y: -TABLE.rail / 2 },
    { x: (TABLE.width / 8) * i, y: TABLE.height + TABLE.rail / 2 },
  ]),
  ...[1, 2, 3].flatMap((i) => [
    { x: -TABLE.rail / 2, y: (TABLE.height / 4) * i },
    { x: TABLE.width + TABLE.rail / 2, y: (TABLE.height / 4) * i },
  ]),
];
