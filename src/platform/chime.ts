let ctx: AudioContext | null = null;
let enabled = true;

export function setChimeEnabled(on: boolean): void {
  enabled = on;
}

export function unlockAudio(): void {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
    }
    void ctx!.resume();
  } catch {
    /* ignore */
  }
}

export function playChime(): void {
  if (!enabled || !ctx) return;
  try {
    const c = ctx;
    const start = c.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = start + i * 0.25;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.15);
    }
  } catch {
    /* ignore */
  }
}
