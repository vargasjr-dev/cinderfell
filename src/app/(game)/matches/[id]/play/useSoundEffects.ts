/**
 * useSoundEffects — procedural Web Audio API sounds for battle events.
 *
 * No audio files, no external dependencies. All sounds are synthesized
 * from oscillators + gain envelopes at runtime. The AudioContext is created
 * lazily on first interaction (satisfies browser autoplay policy).
 *
 * Sound catalogue:
 *   blip     — command queued (short high blip)
 *   submit   — turn submitted (soft confirmation tone)
 *   resolve  — turn resolved (ascending two-tone chord)
 *   ko       — cinderling KO'd (descending sawtooth)
 *   victory  — match won (C-major arpeggio)
 *   defeat   — match lost (descending minor chord)
 */

"use client";

import { useRef, useCallback } from "react";

export type SoundName = "blip" | "submit" | "resolve" | "ko" | "victory" | "defeat";

// ─── Low-level tone helpers ───────────────────────────────────────────────────

function tone(
  ctx: AudioContext,
  freq: number,
  type: OscillatorType,
  gainPeak: number,
  startOffset: number,
  duration: number,
  freqEnd?: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(
      freqEnd,
      ctx.currentTime + startOffset + duration,
    );
  }

  gain.gain.setValueAtTime(0, ctx.currentTime + startOffset);
  gain.gain.linearRampToValueAtTime(gainPeak, ctx.currentTime + startOffset + 0.01);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    ctx.currentTime + startOffset + duration,
  );

  osc.start(ctx.currentTime + startOffset);
  osc.stop(ctx.currentTime + startOffset + duration + 0.01);
}

// ─── Sound definitions ────────────────────────────────────────────────────────

function playBlip(ctx: AudioContext) {
  // Short high-pitched sine — light tactile feedback for queuing a command
  tone(ctx, 880, "sine", 0.08, 0, 0.1);
}

function playSubmit(ctx: AudioContext) {
  // Soft triangle wave thud — confirms turn submission
  tone(ctx, 440, "triangle", 0.12, 0, 0.18);
  tone(ctx, 660, "sine", 0.06, 0.05, 0.15);
}

function playResolve(ctx: AudioContext) {
  // Ascending two-note chord — satisfying "turn happened" feedback
  tone(ctx, 330, "sine", 0.1, 0, 0.25);
  tone(ctx, 440, "sine", 0.08, 0.1, 0.25);
}

function playKO(ctx: AudioContext) {
  // Descending sawtooth — dramatic KO sound
  tone(ctx, 220, "sawtooth", 0.12, 0, 0.4, 88);
}

function playVictory(ctx: AudioContext) {
  // C-major ascending arpeggio — triumphant win jingle
  [261.63, 329.63, 392.0, 523.25].forEach((freq, i) => {
    tone(ctx, freq, "sine", 0.12, i * 0.13, 0.3);
  });
}

function playDefeat(ctx: AudioContext) {
  // Descending minor chord — somber loss sound
  [220, 196, 174.61].forEach((freq, i) => {
    tone(ctx, freq, "triangle", 0.1, i * 0.15, 0.45);
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSoundEffects() {
  const ctxRef = useRef<AudioContext | null>(null);

  /** Lazily create or resume the AudioContext. Returns null on error. */
  const getCtx = useCallback((): AudioContext | null => {
    try {
      if (!ctxRef.current) {
        ctxRef.current = new AudioContext();
      }
      if (ctxRef.current.state === "suspended") {
        ctxRef.current.resume();
      }
      return ctxRef.current;
    } catch {
      return null;
    }
  }, []);

  /** Play a named sound effect. Silently no-ops if audio is unavailable. */
  const play = useCallback(
    (sound: SoundName) => {
      const ctx = getCtx();
      if (!ctx) return;
      try {
        switch (sound) {
          case "blip":
            playBlip(ctx);
            break;
          case "submit":
            playSubmit(ctx);
            break;
          case "resolve":
            playResolve(ctx);
            break;
          case "ko":
            playKO(ctx);
            break;
          case "victory":
            playVictory(ctx);
            break;
          case "defeat":
            playDefeat(ctx);
            break;
        }
      } catch {
        // Silently ignore audio errors — sound is enhancement only
      }
    },
    [getCtx],
  );

  return { play };
}
