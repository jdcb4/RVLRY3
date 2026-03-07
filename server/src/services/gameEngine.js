import { getWords } from './wordStore.js';

function pickRandom(words, fallback) {
  if (!words.length) {
    return fallback;
  }

  const index = Math.floor(Math.random() * words.length);
  return words[index].word || words[index] || fallback;
}

function startImposterRound(room) {
  const words = getWords('describing');
  const secretWord = pickRandom(words, 'Mystery Word');
  const imposterIndex = Math.floor(Math.random() * room.players.length);

  return {
    name: 'imposter',
    secretWord,
    imposterPlayerId: room.players[imposterIndex]?.id
  };
}

function startWhoWhatWhereRound() {
  const words = getWords('guessing');

  return {
    name: 'whowhatwhere',
    prompt: pickRandom(words, 'Default Guessing Word'),
    secondsRemaining: 60
  };
}

function startDrawNGuessRound() {
  const words = getWords('describing');

  return {
    name: 'drawnguess',
    initialPrompt: pickRandom(words, 'Sketch this!'),
    chain: []
  };
}

const roundFactory = {
  imposter: startImposterRound,
  whowhatwhere: startWhoWhatWhereRound,
  drawnguess: startDrawNGuessRound
};

export function startRound(room) {
  const roundBuilder = roundFactory[room.gameKey];
  if (!roundBuilder) {
    return { name: 'unknown' };
  }

  return roundBuilder(room);
}
