"""Records the spoken drill/test introductions with Microsoft neural voices (edge-tts).

Run from the repo root after changing plan text:  <venv>/bin/python scripts/make_voice.py
Writes src/voice/<lang>-<kind>-<id>.mp3 and src/voice/manifest.json. Unchanged texts are not re-recorded;
the app plays a clip only while its recorded text still matches, otherwise it uses the device voice.
"""
import asyncio, json, pathlib, subprocess, sys

import edge_tts

VOICES = {'zh': 'zh-CN-XiaoxiaoNeural', 'en': 'en-US-JennyNeural'}
RATE = '-5%'
OUT = pathlib.Path('src/voice')


async def main() -> None:
    items = json.loads(subprocess.run(['npx', 'tsx', 'scripts/voice-texts.ts'], check=True, capture_output=True, text=True).stdout)
    path = OUT / 'manifest.json'
    old = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    new = {}
    for it in items:
        file = f"{it['lang']}-{it['key'].replace(':', '-')}.mp3"
        prev = old.get(it['id'])
        if not (prev and prev['text'] == it['text'] and (OUT / file).exists()):
            print('recording', it['id'], file=sys.stderr)
            await edge_tts.Communicate(it['text'], VOICES[it['lang']], rate=RATE).save(str(OUT / file))
        new[it['id']] = {'file': file, 'text': it['text']}
    for f in OUT.glob('*.mp3'):
        if f.name not in {v['file'] for v in new.values()}:
            f.unlink()
    path.write_text(json.dumps(new, ensure_ascii=False, indent=1, sort_keys=True) + '\n', encoding='utf-8')
    print(f'{len(new)} clips', file=sys.stderr)


asyncio.run(main())
