export const getHatGamePhaseTone = (phaseNumber) => {
  if (phaseNumber === 2) {
    return 'one-word';
  }

  if (phaseNumber === 3) {
    return 'charades';
  }

  return 'describe';
};

export const getHatGamePhaseCueName = (phaseNumber) => {
  if (phaseNumber === 2) {
    return 'hatgame-phase-one-word';
  }

  if (phaseNumber === 3) {
    return 'hatgame-phase-charades';
  }

  return 'phase-change';
};
