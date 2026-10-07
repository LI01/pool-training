# Pool Training

An offline-capable PWA for a daily 2-hour pool training routine: a session guide, a standard skill test, a progress log with charts, and table diagrams. Data lives on-device (IndexedDB).

## Develop

```bash
npm install
npm run dev      # dev server at http://localhost:5173/pool-training/
npm test         # vitest (watch); use `npx vitest --run` for one pass
npm run build    # type-check + production build into dist/
npm run preview  # serve dist/ to try the PWA/offline behaviour
```

## Editing content

- **Training plan**: `src/plan/plan.json` (English) and `src/plan/plan.zh.json` (Chinese).
- **Voice clips**: after changing plan text, run `scripts/make_voice.py` (needs `edge-tts`) to re-record the spoken introductions in `src/voice/`. A test fails while any clip is out of date; until then the app reads that drill with the device voice.
- **Drill diagrams**: `src/diagram/diagrams.ts`.
- **Table size**: measure your real table and update the `TABLE` constant in `src/diagram/table.ts` (playing surface in inches, nose to nose).
- **Icons**: `scripts/make_icons.py` regenerates `public/icons/*` (needs Pillow).

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml` (tests, build, publish to GitHub Pages). In the repo settings set Pages source to "GitHub Actions". The app is served under `/pool-training/`.

## Install on iPhone

Open the deployed URL in Safari, tap Share, then "Add to Home Screen". It then launches full-screen and works offline.

## Backup

Progress is stored only in this browser/device. iOS can clear site data for apps that go unused, and deleting the home-screen app erases it. Export a backup from Settings regularly and keep the file somewhere safe (iCloud Drive, email to yourself).
