/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const AUDIO_ENABLED_STORAGE_KEY = 'rvlry.audioEnabled';
const AudioCueContext = createContext(null);

const readAudioEnabled = () => {
  try {
    const stored = window.localStorage.getItem(AUDIO_ENABLED_STORAGE_KEY);
    return stored === null ? true : stored !== 'false';
  } catch {
    return true;
  }
};

let sharedAudioContext = null;

const getAudioContext = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const Context = window.AudioContext ?? window.webkitAudioContext;
  if (!Context) {
    return null;
  }

  if (!sharedAudioContext) {
    sharedAudioContext = new Context();
  }

  return sharedAudioContext;
};

const CUE_PATTERNS = {
  'turn-start': [
    { at: 0, duration: 0.08, frequency: 659.25, type: 'triangle', gain: 0.035 },
    { at: 0.1, duration: 0.08, frequency: 783.99, type: 'triangle', gain: 0.04 },
    { at: 0.2, duration: 0.12, frequency: 987.77, type: 'triangle', gain: 0.045 }
  ],
  'warning-5': [
    { at: 0, duration: 0.06, frequency: 1174.66, type: 'square', gain: 0.028 },
    { at: 0.12, duration: 0.06, frequency: 1174.66, type: 'square', gain: 0.028 }
  ],
  'turn-end': [
    { at: 0, duration: 0.08, frequency: 659.25, type: 'sawtooth', gain: 0.03 },
    { at: 0.1, duration: 0.09, frequency: 493.88, type: 'sawtooth', gain: 0.03 },
    { at: 0.22, duration: 0.18, frequency: 349.23, type: 'sawtooth', gain: 0.026 }
  ],
  'phase-change': [
    { at: 0, duration: 0.08, frequency: 523.25, type: 'triangle', gain: 0.03 },
    { at: 0.1, duration: 0.08, frequency: 659.25, type: 'triangle', gain: 0.034 },
    { at: 0.2, duration: 0.12, frequency: 783.99, type: 'triangle', gain: 0.04 }
  ],
  'results-reveal': [
    { at: 0, duration: 0.08, frequency: 523.25, type: 'triangle', gain: 0.03 },
    { at: 0.1, duration: 0.08, frequency: 659.25, type: 'triangle', gain: 0.032 },
    { at: 0.2, duration: 0.08, frequency: 783.99, type: 'triangle', gain: 0.036 },
    { at: 0.32, duration: 0.18, frequency: 1046.5, type: 'triangle', gain: 0.04 }
  ],
  handoff: [
    { at: 0, duration: 0.05, frequency: 523.25, type: 'sine', gain: 0.022 },
    { at: 0.08, duration: 0.05, frequency: 659.25, type: 'sine', gain: 0.022 }
  ],
  submit: [
    { at: 0, duration: 0.05, frequency: 880, type: 'triangle', gain: 0.022 }
  ]
};

const schedulePattern = (audioContext, pattern) => {
  const now = audioContext.currentTime;

  for (const tone of pattern) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const startAt = now + tone.at;
    const stopAt = startAt + tone.duration;

    oscillator.type = tone.type;
    oscillator.frequency.setValueAtTime(tone.frequency, startAt);

    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(tone.gain, startAt + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(stopAt + 0.01);
  }
};

export function AudioCueProvider({ children }) {
  const [audioEnabled, setAudioEnabledState] = useState(readAudioEnabled);

  const primeAudio = useCallback(async () => {
    const audioContext = getAudioContext();
    if (!audioContext) {
      return;
    }

    if (audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
      } catch {
        // Ignore resume errors until the next gesture.
      }
    }
  }, []);

  useEffect(() => {
    const handlePointerDown = () => {
      primeAudio();
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [primeAudio]);

  const playCue = useCallback(
    async (cueName) => {
      if (!audioEnabled) {
        return;
      }

      const audioContext = getAudioContext();
      const pattern = CUE_PATTERNS[cueName];
      if (!audioContext || !pattern) {
        return;
      }

      if (audioContext.state === 'suspended') {
        try {
          await audioContext.resume();
        } catch {
          return;
        }
      }

      schedulePattern(audioContext, pattern);
    },
    [audioEnabled]
  );

  const setAudioEnabled = useCallback((nextValue) => {
    setAudioEnabledState((currentValue) => {
      const resolvedValue =
        typeof nextValue === 'function' ? nextValue(currentValue) : nextValue;
      window.localStorage.setItem(AUDIO_ENABLED_STORAGE_KEY, String(resolvedValue));
      return resolvedValue;
    });
  }, []);

  const value = useMemo(
    () => ({
      audioEnabled,
      setAudioEnabled,
      primeAudio,
      playCue
    }),
    [audioEnabled, primeAudio, playCue, setAudioEnabled]
  );

  return <AudioCueContext.Provider value={value}>{children}</AudioCueContext.Provider>;
}

export function useAudioCues() {
  const context = useContext(AudioCueContext);
  if (!context) {
    throw new Error('useAudioCues must be used within an AudioCueProvider');
  }

  return context;
}
