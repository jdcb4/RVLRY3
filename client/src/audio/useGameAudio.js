import { useEffect, useMemo, useRef } from 'react';
import { useAudioCues } from './AudioCueContext';

const getCountdownSeconds = (endsAt) => {
  if (!endsAt) {
    return 0;
  }

  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));
};

export function useStageCue(stage, cueMap) {
  const { playCue } = useAudioCues();
  const previousStageRef = useRef(stage);

  useEffect(() => {
    if (previousStageRef.current !== stage && cueMap[stage]) {
      playCue(cueMap[stage]);
    }

    previousStageRef.current = stage;
  }, [cueMap, playCue, stage]);
}

export function useTimedTurnAudio({ active, turnKey, endsAt }) {
  const { playCue } = useAudioCues();
  const activeTurnKey = useMemo(
    () => (active && turnKey ? `${turnKey}:${endsAt ?? ''}` : ''),
    [active, endsAt, turnKey]
  );
  const startedTurnRef = useRef('');
  const warningTurnRef = useRef('');
  const activeRef = useRef(active);

  useEffect(() => {
    if (!activeTurnKey) {
      startedTurnRef.current = '';
      warningTurnRef.current = '';
      return undefined;
    }

    if (startedTurnRef.current !== activeTurnKey) {
      startedTurnRef.current = activeTurnKey;
      warningTurnRef.current = '';
      playCue('turn-start');
    }

    const intervalId = window.setInterval(() => {
      const secondsRemaining = getCountdownSeconds(endsAt);
      if (secondsRemaining === 5 && warningTurnRef.current !== activeTurnKey) {
        warningTurnRef.current = activeTurnKey;
        playCue('warning-5');
      }
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [activeTurnKey, endsAt, playCue]);

  useEffect(() => {
    if (activeRef.current && !active) {
      playCue('turn-end');
    }

    activeRef.current = active;
  }, [active, playCue]);
}
