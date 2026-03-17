import { useCallback, useRef } from 'react';

// ============================================================
// useScannerFeedback — beep (Web Audio API) + flash + vibrate
// ============================================================

function createBeep(frequency: number, duration: number, volume = 0.4): () => void {
  return () => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration / 1000);
    } catch {
      // Audio context not available (headless / SSR)
    }
  };
}

function createMelody(): () => void {
  return () => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const notes = [523, 659, 784]; // C5, E5, G5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        const start = ctx.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0.35, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
        osc.start(start);
        osc.stop(start + 0.15);
      });
    } catch {
      // ignore
    }
  };
}

const beepSuccessSound = createBeep(880, 100);
const beepErrorSound = createBeep(220, 400);
const melodySound = createMelody();

const SOUND_ENABLED_KEY = 'wms_scanner_sound';
const VOLUME_KEY = 'wms_scanner_volume';

export function useScannerFeedback() {
  const flashRef = useRef<HTMLDivElement | null>(null);

  const isSoundEnabled = () => localStorage.getItem(SOUND_ENABLED_KEY) !== 'false';

  const triggerFlash = useCallback((color: string) => {
    if (!flashRef.current) return;
    const el = flashRef.current;
    el.style.backgroundColor = color;
    el.style.opacity = '0.35';
    el.style.display = 'block';
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => { el.style.display = 'none'; }, 200);
    }, 180);
  }, []);

  const feedbackOK = useCallback(() => {
    if (isSoundEnabled()) beepSuccessSound();
    triggerFlash('#00e676');
    if (navigator.vibrate) navigator.vibrate(50);
  }, [triggerFlash]);

  const feedbackError = useCallback(() => {
    if (isSoundEnabled()) beepErrorSound();
    triggerFlash('#ff1744');
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  }, [triggerFlash]);

  const feedbackDone = useCallback(() => {
    if (isSoundEnabled()) melodySound();
    triggerFlash('#00e5ff');
    if (navigator.vibrate) navigator.vibrate(200);
  }, [triggerFlash]);

  const setSoundEnabled = (enabled: boolean) => {
    localStorage.setItem(SOUND_ENABLED_KEY, enabled ? 'true' : 'false');
  };

  const getSoundEnabled = () => isSoundEnabled();

  const setVolume = (v: number) => {
    localStorage.setItem(VOLUME_KEY, String(v));
  };

  const getVolume = (): number => {
    return parseFloat(localStorage.getItem(VOLUME_KEY) ?? '0.4');
  };

  return { feedbackOK, feedbackError, feedbackDone, flashRef, setSoundEnabled, getSoundEnabled, setVolume, getVolume };
}
