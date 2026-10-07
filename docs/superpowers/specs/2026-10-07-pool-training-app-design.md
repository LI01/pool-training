# Pool Training App — Design Spec

Date: 2026-10-07
Status: Draft for review
Source plan: `30_Day_Pool_Training_Plan_v2.xlsx` (sheets: Training Plan, Standard Test, 30-Day Log, Drill Reference)

## 1. Purpose

A personal phone web app that **guides the daily 2-hour pool training** (60-min morning + 60-min afternoon session) block by block, **runs the standardized skill test** with shot-by-shot scoring, and **shows progress** over the 30-day plan and beyond. It replaces hand-filling the spreadsheet log.

### Context (from the user and prior planning conversation)

- Single user, training at home on a 7 ft GoSports Rustic table (MDF, slow spin-absorbing cloth, ~4.8" pockets), with a pocket reducer (~3.8"), a 6-dot training cue ball, and a Woodscue cue.
- Goals: play APA league; keep Chinese 8-ball (Heyball) precision.
- Known weakness: draw on slow cloth — tracking draw distance at 24" is a key progress signal.
- Plan principles the app must enforce:
  - **Training ≠ testing.** Training is high-volume with feedback; the test is a short, fixed benchmark.
  - **Fixed test conditions.** Same setup, normal pockets, no extra attempts. Reducer scores are never mixed with normal-pocket test scores.
  - **Logging must be fast** (well under a minute), or it won't be kept up.
  - **P/C/S/D error counts steer what to practice next.**
- The plan is expected to evolve (e.g., a later 4-week APA phase with break/safety/kick/bank).

### Success criteria

1. The user can run an entire morning or afternoon session from the phone without consulting the spreadsheet.
2. A full standard test can be scored in-app with no paper, in about the same 20–25 minutes.
3. The Progress screen reproduces the spreadsheet's weekly averages, 30-day bests, and P/C/S/D totals, plus charts.
4. Works offline once installed to the home screen; data survives the phone locking mid-session.

## 2. Decisions

| Topic | Decision |
|---|---|
| Role | Both guide sessions and log/track progress |
| Platform | Installable phone web app (PWA), offline, data stored on the device |
| Input granularity | Shot-by-shot during the test; block-level during training |
| Language | English only |
| Plan changes | Plan lives in `src/plan/plan.json`; edit and redeploy (no in-app editor) |
| Progress views | Test charts + weekly averages/bests; P/C/S/D totals + trend + focus suggestion; streak/calendar + minutes; training-block records charts |
| Hosting | GitHub Pages, deployed by GitHub Actions |
| Stack | Vite + Preact + TypeScript, `vite-plugin-pwa`, IndexedDB via `idb`, Chart.js (bundled), Vitest |
| Block advance | Never auto-advance; chime at zero, user taps **Next** |
| P/C/S/D tags | Always optional (prompted on a miss/fail, dismissible) |

## 3. Screens and Flow

### 3.1 Today (home)

- Header: **Day N of 30**. Day 1 = the date of the first recorded session or test (overridable in Settings). After day 30 it keeps counting ("Day 34").
- Three cards: **Morning Session**, **Afternoon Session**, **Standard Test**, each with status *Not started / In progress / Done*.
- Test card shows when the last test was, e.g., "Last test: 3 days ago — due". Due rule: due if no test in the last 3 days. The weekly target is 2–3 tests.
- Today's one-line summary, using the latest test of the day if one exists:
  `Straight 7/10 | Cut 14/20 | Stop 8/10 | Draw 12" | 5-ball 3/5 | P6 C8 S3 D5`
  (P/C/S/D = the day's totals across tests and training.) Tests not run show "–".
- Backup reminder banner if the last export was more than 7 days ago, or never and there are at least 3 days of data.
- Navigation: Today · Progress · Settings.

### 3.2 Session Runner (morning or afternoon)

- One block per screen, showing:
  - the time range label (e.g., "22–38 min")
  - the drill name and a **large countdown** for the block's duration
  - Setup, Training Volume, How to Train, Success Standard, Purpose
  - a collapsible **Drill Reference** (Execution Cue, Common Mistake, Progression, When to Use Reducer) when the block links to one
- Controls: **Pause/Resume**, **+2 min**, **Next** (plus **Back** to revisit the previous block).
- At zero: a chime plays and the timer flashes and then counts overtime ("+0:45"). It never auto-advances.
- Screen wake lock is held while the runner is open.
- On **Next**, if the block's `record` is not `no`, a quick-entry sheet appears:
  - `draw`: best and typical draw-back distance (inches)
  - `runs`: successful runs out of layouts attempted, plus an optional P/C/S/D tag for each failed run (3-ball, 5-ball)
  - `generic`: makes out of attempts (optional blocks: stop, follow, one-rail)
  - `notes`: free-text notes (Short review / replay)
  - For `optional` blocks, the sheet has **Skip**. For `yes` blocks, the sheet can also be left empty (nothing is forced).
- After the last block: a summary screen (actual minutes, entered records) and **Finish**, which saves the session.
- If the app is closed or the phone locks, reopening resumes the active session on the same block with the correct remaining time.

### 3.3 Test Runner

- The 5 tests in fixed order. Each test opens with its exact setup text and the reminder: "Normal pockets. Same setup. No extra attempts."
  1. **Long straight pot** — 10 attempts: **Make / Miss**.
  2. **Cut shots** — 10 cutting left, then 10 cutting right: **Make / Miss**. The current side is shown prominently.
  3. **Stop shot** — 10 attempts: **Success / Fail** (OB made and CB within ~3").
  4. **Draw @24"** — 5 numeric inputs (inches). The average is shown live.
  5. **5-ball clearance** — 5 runs: **Cleared / Failed**.
- On Miss/Fail, a P/C/S/D picker pops up (optional; can be dismissed with no tag).
- **Undo last** on every test. Progress shown as "7 of 10".
- **Skip test** is available. Skipped tests are recorded as absent and excluded from averages.
- After the 5th test (or **End test**), a summary screen is shown and the test is saved.
- Tests are always normal-pocket. The app does not record reducer scores in tests.

### 3.4 Progress

1. **Test scores**: one line chart per metric (Straight /10, Cut /20 with left and right shown separately, Stop /10, Draw avg in, 5-ball /5) over time. Below it, a table with Week 1–4 averages, 30-day best and 30-day average, matching the spreadsheet's Weekly Test Summary. Weeks are days 1–7, 8–14, 15–21, and 22–30 (week 4 includes days 29–30, as in the spreadsheet).
2. **Errors**: P/C/S/D totals for the 30 days, a weekly stacked bar chart, and the **focus suggestion** (§5.3).
3. **Consistency**: a calendar grid with AM/PM/Test marks per day, the current streak (consecutive days with at least one session), and a minutes-per-day bar chart.
4. **Training records**: charts of draw best/typical, 3-ball success rate, and 5-ball success rate over time.
- A toggle switches the range between **30-day plan** (days 1–30) and **All time**.

### 3.5 Settings

- Start date (Day 1) override.
- Sound on/off.
- **Export backup** (downloads `pool-training-backup-YYYY-MM-DD.json`) with the last-export date shown.
- **Import backup** (validates the file, asks for confirmation, then replaces all data).
- **Reset all data** (asks for confirmation twice).

## 4. Data

### 4.1 Plan file — `src/plan/plan.json`

Built from the spreadsheet content. Shape (TypeScript types live in `src/plan/types.ts`):

```ts
type RecordMode = 'yes' | 'optional' | 'no' | 'notes';
type RecordKind = 'draw' | 'runs' | 'generic' | 'notes' | null;

interface Block {
  id: string;            // stable, e.g. "am-draw-ladder"
  timeLabel: string;     // "22–38 min"
  minutes: number;       // 16
  name: string;
  setup: string;
  volume: string;
  howToTrain: string;
  successStandard: string;
  purpose: string;
  record: RecordMode;
  recordKind: RecordKind;
  drillRefId?: string;   // links to DrillRef.id
}

interface Session { id: 'am' | 'pm'; title: string; blocks: Block[]; }

interface DrillRef {
  id: string; name: string; ballPlacement: string; executionCue: string;
  commonMistake: string; progression: string; whenToUseReducer: string;
}

interface TestDef {
  id: 'straight' | 'cut' | 'stop' | 'draw' | 'fiveBall';
  name: string; setup: string; attempts: number; scoring: string;
  measures: string; frequency: string; notes: string;
  kind: 'makeMiss' | 'makeMissLR' | 'distances' | 'runs';
}

interface ErrorCode { code: 'P' | 'C' | 'S' | 'D'; meaning: string; }

interface Plan {
  version: number;
  title: string;
  intro: string;             // training vs testing note
  sessions: Session[];
  tests: TestDef[];
  errorCodes: ErrorCode[];
  drillRefs: DrillRef[];
  focusMap: Record<'P'|'C'|'S'|'D', { blockIds: string[]; advice: string }>;
}
```

Block mapping from the spreadsheet ("Record?" column → `record` / `recordKind`):

| Session | Block | record | recordKind |
|---|---|---|---|
| AM | Straight-ball warm-up (0–10) | no | null |
| AM | Stop shot ladder (10–22) | optional | generic |
| AM | Draw ladder (22–38) | yes | draw |
| AM | Follow ladder (38–50) | optional | generic |
| AM | Precision pocket drill (50–60) | no | null |
| PM | Cut-shot blocks (0–12) | no | null |
| PM | One-rail position zones (12–27) | optional | generic |
| PM | 3-ball pattern drill (27–42) | yes | runs |
| PM | 5-ball clearance (42–55) | yes | runs |
| PM | Short review / replay (55–60) | notes | notes |

A build-time schema check (Vitest test) validates `plan.json` against these types: unique IDs, `drillRefId`s that resolve, `focusMap` block IDs that exist, and session minutes summing to 60.

### 4.2 Stored data — IndexedDB (database `pool-training`, schema v1)

```ts
interface BlockResult {
  blockId: string;
  startedAt: number; endedAt?: number;       // epoch ms
  draw?: { bestIn: number; typicalIn: number };
  runs?: { success: number; attempts: number; failTags: ('P'|'C'|'S'|'D')[] };
  generic?: { made: number; attempts: number };
  notes?: string;
  skipped?: boolean;
}

interface SessionRecord {
  id: string;                // uuid
  date: string;              // local YYYY-MM-DD of start
  sessionId: 'am' | 'pm';
  planVersion: number;
  startedAt: number; endedAt: number;
  activeMinutes: number;     // excludes paused time
  blocks: BlockResult[];
}

interface Shot { ok: boolean; tag?: 'P'|'C'|'S'|'D'; side?: 'L'|'R'; }

interface TestRecord {
  id: string; date: string; planVersion: number;
  startedAt: number; endedAt: number;
  straight?: Shot[];         // absent = skipped
  cut?: Shot[];              // side L/R
  stop?: Shot[];
  draw?: number[];           // inches
  fiveBall?: Shot[];
}

interface ActiveState {      // single row, key 'active'
  type: 'session' | 'test';
  payload: unknown;          // runner state, see §5.2
  updatedAt: number;
}

interface Settings {         // single row, key 'settings'
  startDate?: string; soundOn: boolean; lastExportAt?: number;
}
```

Object stores: `sessions` (keyPath `id`, index `date`), `tests` (keyPath `id`, index `date`), `kv` (holds `active` and `settings`).

Scores are **always derived** from the raw shots/inputs and never stored as totals.

Backup format: `{ app: 'pool-training', schema: 1, exportedAt, sessions, tests, settings }`.

## 5. Logic

### 5.1 Code structure

| Unit | Responsibility | Depends on |
|---|---|---|
| `src/plan/` | Load and type `plan.json`, accessors (`getBlock`, `getDrillRef`) | — |
| `src/db/` | IndexedDB store: CRUD, active state, settings, export/import with validation, `navigator.storage.persist()` request | `idb` |
| `src/stats/` | Pure functions over records (see 5.3) | — |
| `src/runner/` | Pure reducers for session and test runners (see 5.2) | plan types |
| `src/ui/` | Preact screens: Today, Session, Test, Progress, Settings; shared components (Timer, BigButton, TagPicker, Chart) | all above |
| `src/platform/` | Wake lock, audio chime (unlocked on Start), small wrappers that fail soft | — |
| PWA | `vite-plugin-pwa`: manifest, icons, precache all assets | — |

### 5.2 Runners

- **Session runner** state: `{ sessionId, blockIndex, blockStartedAt, pausedAt?, pausedTotalMs, extraMs, results[] }`. Actions: `start`, `pause`, `resume`, `addTime(2min)`, `next(result?)`, `back`, `finish`.
  - Remaining time = `minutes*60000 + extraMs − (now − blockStartedAt − pausedTotalMs)`, computed from timestamps so locking or backgrounding the phone doesn't break it.
  - The state is saved to `kv.active` after every action.
- **Test runner** state: `{ testIndex, cutSide, shots per test, skipped set }`. Actions: `record(ok)`, `tag(code)`, `undo`, `setDraw(i, inches)`, `skip`, `next`, `end`. Saved to `kv.active` after every action.

### 5.3 Stats (all pure, all unit-tested)

- `dayNumber(date, startDate)` → 1-based.
- `weekOfPlan(day)` → 1 (days 1–7), 2 (8–14), 3 (15–21), 4 (22–30), null after 30.
- `testScores(test)` → `{ straight: x/10, cutL, cutR, cut: x/20, stop: x/10, drawAvg, fiveBall: x/5 }` (undefined for skipped tests).
- `weeklySummary(tests, startDate)` → per-metric Week 1–4 averages, 30-day best, 30-day average (ignoring undefined values). For draw, "best" = highest average.
- `errorTotals(records, range)` → P/C/S/D counts from test shot tags + session `runs.failTags`.
- `focusSuggestion(records, today)`: over the last 7 days, if total tagged errors ≥ 10 and the top code is ≥ 35% of them, return that code with the `plan.focusMap` advice and block names. Otherwise null.
  - P → Straight-ball warm-up, Precision pocket drill, Cut-shot blocks
  - C → One-rail position zones, 3-ball pattern drill
  - S → Stop, Draw, Follow ladders
  - D → 3-ball pattern, 5-ball clearance ("name all shots and CB zones before shooting")
- `streak(sessions, today)` → consecutive days ending today (or yesterday) with at least one session.
- `minutesByDay(sessions)`.
- `testDue(tests, today)` → `{ daysSinceLast, due: daysSinceLast ≥ 3 || none }`.
- `dailySummaryLine(day records)` → the one-line string.

## 6. Edge Cases and Error Handling

- **Phone locked or app killed mid-block:** resumes from `kv.active`, and the timer is recomputed from timestamps.
- **iOS audio:** the AudioContext is created and unlocked on the **Start** tap. If audio fails, the timer only flashes. Vibration is not used (unsupported on iOS web).
- **Wake lock unsupported or denied:** a one-time tip to increase Auto-Lock in iOS Settings.
- **Storage eviction risk:** request persistent storage at first launch, show the last-export date, show the backup reminder banner (§3.1), and use a single-file JSON export.
- **Import:** validates `app`, `schema`, and record shapes. On failure, shows an error and changes nothing. On success, asks for confirmation and then **replaces** all data (no merge).
- **Two sessions of the same type on one day:** both are kept, minutes are summed, and the calendar marks the slot done.
- **Session crossing midnight:** belongs to its start date.
- **Partial or skipped tests:** excluded from that metric's averages and shown as "–".
- **Plan edits:** records reference block IDs. Stats skip unknown block IDs. Changing text never breaks history. Changing IDs is a deliberate breaking change.
- **Corrupt `kv.active`:** discard it and show a toast ("Previous session couldn't be restored").

## 7. Testing

- **Vitest unit tests, written test-first (TDD)**, covering:
  - `stats/`: day/week bucketing matching the spreadsheet, score derivation, draw average, weekly averages and bests with missing values, error totals, focus thresholds (just below and just above 10 errors and 35%), streak across gaps, test-due
  - `runner/`: timer math across pause, add-time and simulated lock; next/back/record; undo; cut side switching after 10; skip; resume from serialized state
  - `db/`: export → import round-trip (using `fake-indexeddb`) and rejection of a malformed backup
- **Plan schema test** on `plan.json`.
- **Render tests** (`@testing-library/preact`) for the Session and Test runners' main interactions.
- **Manual on-device checklist** (iPhone, home-screen install):
  1. installs and opens offline
  2. lock the phone mid-block, then resume with the correct time
  3. the chime plays at zero
  4. the screen stays awake
  5. a full test can be scored one-handed
  6. export → reset → import restores everything

## 8. Build and Deployment

- Node LTS, `npm`. Scripts: `dev`, `test`, `build`, `preview`.
- Vite `base: '/pool-training/'` for GitHub Pages.
- GitHub Actions workflow on push to `main`: install → test → build → deploy to Pages.
- The phone uses `https://<user>.github.io/pool-training/`, added to the Home Screen.
- The original `.xlsx` stays in the repo as the source reference.

## 9. Out of Scope (v1)

- Cloud sync and accounts
- An in-app plan editor and multiple selectable plans
- A Chinese UI
- Shot-by-shot counting during training
- Browsing session notes (notes are stored and included in backups)
- Reducer-score tracking in tests
- Notifications and reminders
