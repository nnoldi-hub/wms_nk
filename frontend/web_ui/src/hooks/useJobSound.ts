/**
 * useJobSound.ts — Sunete diferențiate per prioritate job
 *
 * NORMAL  → 2 tonuri scurte (880 Hz)
 * URGENT  → 3 tonuri rapide (1100 Hz)
 * CRITIC  → alarmă pulsată continuă până la dismiss explicit
 */

import { useRef } from 'react';

export type JobPriority = 'NORMAL' | 'URGENT' | 'CRITIC';

function beep(ctx: AudioContext, freq: number, duration: number, startAt: number, gain = 0.4) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = 'sine';
  gainNode.gain.setValueAtTime(0, startAt);
  gainNode.gain.linearRampToValueAtTime(gain, startAt + 0.01);
  gainNode.gain.linearRampToValueAtTime(0, startAt + duration - 0.01);
  osc.start(startAt);
  osc.stop(startAt + duration);
}

export function useJobSound() {
  const criticIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  function getCtx(): AudioContext {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }

  function playNormal() {
    stopCritic();
    const ctx = getCtx();
    const t = ctx.currentTime;
    beep(ctx, 880, 0.15, t);
    beep(ctx, 880, 0.15, t + 0.25);
  }

  function playUrgent() {
    stopCritic();
    const ctx = getCtx();
    const t = ctx.currentTime;
    beep(ctx, 1100, 0.12, t, 0.5);
    beep(ctx, 1100, 0.12, t + 0.18, 0.5);
    beep(ctx, 1100, 0.12, t + 0.36, 0.5);
  }

  function playCriticOnce() {
    const ctx = getCtx();
    const t = ctx.currentTime;
    // Puls descendent + ascendent (woop)
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = 'sawtooth';
    gainNode.gain.setValueAtTime(0.6, t);
    gainNode.gain.linearRampToValueAtTime(0, t + 0.5);
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.linearRampToValueAtTime(800, t + 0.5);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  function startCritic() {
    stopCritic();
    playCriticOnce();
    criticIntervalRef.current = setInterval(() => {
      playCriticOnce();
    }, 800);
  }

  function stopCritic() {
    if (criticIntervalRef.current) {
      clearInterval(criticIntervalRef.current);
      criticIntervalRef.current = null;
    }
  }

  function playForPriority(priority: JobPriority) {
    try {
      if (priority === 'CRITIC') startCritic();
      else if (priority === 'URGENT') playUrgent();
      else playNormal();
    } catch {
      // AudioContext blocat de browser — ignorăm silently
    }
  }

  return { playForPriority, stopCritic };
}
