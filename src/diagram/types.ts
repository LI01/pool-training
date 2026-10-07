export type Pt = { x: number; y: number }; // inches, origin top-left cushion nose
export type PocketId = 'TL' | 'TM' | 'TR' | 'BL' | 'BM' | 'BR';

export type DiagramEl =
  | { t: 'ball'; at: Pt; kind: 'cue' | 'cue6dot' | 'object' | 'ghost'; num?: number; label?: string }
  | { t: 'line'; from: Pt; to: Pt; style: 'aim' | 'cuePath' | 'objPath'; arrow?: boolean; label?: string }
  | { t: 'zone'; shape: 'circle'; at: Pt; r: number; label?: string }
  | { t: 'zone'; shape: 'rect'; at: Pt; w: number; h: number; label?: string } // at = top-left corner
  | { t: 'marker'; at: Pt; text: string }
  | { t: 'label'; at: Pt; text: string }
  | { t: 'pocket'; id: PocketId; label?: string };

export interface Diagram {
  id: string;
  title: string;
  caption: string; // 1–2 short lines under the table
  panels: DiagramEl[][]; // 1 panel normally; 2 for left/right cut setups
  showMeasurements?: boolean; // full-screen inch offsets from rails (5-ball test)
}
