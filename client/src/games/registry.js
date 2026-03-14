export const gameModules = {
  imposter: {
    lobbyVariant: 'imposter',
    playVariant: 'imposter',
    localVariant: 'imposter',
    localSettingsVariant: 'imposter',
    localLead: 'Reveal roles, speak in person, discuss, then vote in the app.',
    gameplayLead: 'Keep the current move first and the evidence nearby.',
    requiresTeams: false,
    requiresHatClues: false
  },
  whowhatwhere: {
    lobbyVariant: 'whowhatwhere',
    playVariant: 'whowhatwhere',
    localVariant: 'whowhatwhere',
    localSettingsVariant: 'whowhatwhere',
    localLead: 'Set teams once, then hand the phone to each describer.',
    gameplayLead: 'The timer, clue, and active team stay front and center.',
    requiresTeams: true,
    requiresHatClues: false
  },
  drawnguess: {
    lobbyVariant: 'drawnguess',
    playVariant: 'drawnguess',
    localVariant: 'drawnguess',
    localSettingsVariant: 'drawnguess',
    localLead: 'Pass the phone, alternate draw and guess, reveal the chain.',
    gameplayLead: 'The active step stays visible until the reveal matters.',
    requiresTeams: false,
    requiresHatClues: false
  },
  hatgame: {
    lobbyVariant: 'hatgame',
    playVariant: 'hatgame',
    localVariant: 'hatgame',
    localSettingsVariant: 'hatgame',
    localLead: 'Build teams, add clues, then reuse the same deck across all three phases.',
    gameplayLead: 'Phase rule, timer, and current clue stay above the fold.',
    requiresTeams: true,
    requiresHatClues: true
  }
};

export const getGameModule = (gameId) => gameModules[gameId] ?? gameModules.imposter;
