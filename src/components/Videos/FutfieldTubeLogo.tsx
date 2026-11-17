import React from 'react';

interface FutfieldTubeLogoProps {
  size?: number;
  className?: string;
}

/**
 * Custom Futfield Tube Brand Icon:
 * Futfield 'F' integrated with a play triangle inside a #00C853 stadium green badge.
 */
export const FutfieldTubeLogo: React.FC<FutfieldTubeLogoProps> = ({ size = 28, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Futfield Tube Logo"
    >
      <rect x="2" y="4" width="32" height="28" rx="9" fill="#00C853" />
      <path
        d="M10.5 11.5H19.5V14.8H14V16.8H18.4V19.9H14V24.8H10.5V11.5Z"
        fill="#05080D"
      />
      <path
        d="M21 13.5L28 18L21 22.5V13.5Z"
        fill="#FFFFFF"
      />
    </svg>
  );
};

/**
 * Synthesizes an energetic stadium crowd cheer audio burst using Web Audio API
 * (zero external copyrighted audio samples).
 */
export function playCrowdCheerSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const duration = 1.65;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.55);
    filter.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + duration);
    filter.Q.value = 1.4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.008, ctx.currentTime + duration);

    // Subtle stadium horn/chord undertone
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.45);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.005, ctx.currentTime);
    oscGain.gain.linearRampToValueAtTime(0.09, ctx.currentTime + 0.2);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.1);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    noise.start();
    osc.start();
    noise.stop(ctx.currentTime + duration);
    osc.stop(ctx.currentTime + 1.15);
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, Math.round(duration * 1000) + 250);
  } catch {}
}
