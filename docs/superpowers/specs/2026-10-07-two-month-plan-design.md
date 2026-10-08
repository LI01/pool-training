# Two-month progressive plan — design

Approved 2026-10-07. Replaces the fixed daily AM/PM plan with an 8-week, 48-training-day plan built on the
Pan Xiaoting three-day course (accuracy → position → break and run-outs) and her high/low-ball daily plan sheets.

## Decisions (from the user)
- One session per day, 60–90 minutes.
- 6 training days a week; the 7th is rest or the standard test.
- Progress-based: the plan is "day 1 … day 48". A missed day is not skipped; the next session is the next unfinished day.
- Break practice comes in during weeks 7–8.
- Old records stay valid; old backups still import.

## Plan shape
- `plan.blocks`: the block library (the 10 existing blocks keep their ids, so history still matches, plus 26 new ones).
- `plan.daily`: `{ start: [...], end: [...] }` — the basics done every day (~25 min):
  `basic-dry-stroke` (5), `basic-spot-shot` (10), `basic-stop` (5) at the start; `pm-review` (5) at the end.
- `plan.weeks[0..7]`: `{ title, focus, a: blockIds, b: blockIds }`. Day n: week = ceil(n/6); day-in-week 1/3/5 → A,
  2/4/6 → B. Day blocks = daily.start + focus + daily.end.

| Week | Phase | A days | B days |
|---|---|---|---|
| 1 | Accuracy · basics | stroke-straight, cue-left-check, am-straight-warmup, am-precision-pocket | stroke-straight, cut-small, am-straight-warmup, am-precision-pocket |
| 2 | Accuracy · harder | pm-cut-blocks, micro-angle, awkward-bridge, am-precision-pocket | rail-balls, pm-cut-blocks, micro-angle |
| 3 | Stop & draw | am-stop-ladder, draw-straight, tip-accuracy, cue-left-check | am-draw-ladder, draw-angle, am-stop-ladder, tip-accuracy |
| 4 | Follow & five levels | am-follow-ladder, follow-angle, five-levels | five-levels, am-draw-ladder, draw-angle |
| 5 | Position · tangent line | separation-line, separation-targets, pm-one-rail | separation-targets, rail-spin, pm-one-rail |
| 6 | Position · two halves & lines | two-halves, pm-3ball, track-line, pm-cut-blocks | leave-angle, pm-3ball, homework-route, two-halves |
| 7 | Run-outs & break | break-dry, break-square, pm-5ball, pm-3ball | trouble-first, pm-5ball, break-tech, break-square |
| 8 | Match play | break-square, pm-5ball, match-sim | break-tech, match-sim, leave-angle |

## App
- Session records gain `dayNumber`; new sessions use `sessionId: 'day'` (`'am' | 'pm'` stay valid for old records and backups).
- Current day = 1 + number of distinct plan days completed (capped at 48; after 48 the user can restart at day 1).
  Settings: "Current progress: day N" can be changed (replaces the start date).
- Today: one card "Day N · Week W · phase"; the test card stays. After finishing day 6 of a week, suggest rest or the test.
- Plan overview screen: 8 weeks × 6 days, each day's blocks and minutes; tap a day to start it (repeat or jump ahead).
- Progress: one calendar mark per day, weekly table by plan week (1–8), "best" instead of "30-day best".
- Block time labels are computed from the day's order, not stored.
- A block's `diagramId` may be `figure:<lesson figure>` for setups that are not a table layout.
- Every new block has speech, three illustrated key points, a diagram and recorded voice, in English and Chinese.
