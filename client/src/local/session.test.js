import { describe, expect, it } from 'vitest';
import {
  applyLocalAction,
  buildLocalSession,
  createLocalPlayers,
  DEFAULT_LOCAL_HATGAME_SETTINGS,
  DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS,
  getActiveImposterPlayer,
  getLocalStartError,
  getImposterSecretForPlayer,
  getWhoWhatWhereContext,
  rebalanceWhoWhatWherePlayers
} from './session';
import {
  getNextLocalPlayerName,
  rotateLocalRoundPlayers
} from '../components/local/helpers';

const TEST_DRAWING = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AApMBgZVp0QAAAABJRU5ErkJggg==';

describe('local pass-and-play session engine', () => {
  it('plays a full local Imposter round from reveal to results', () => {
    const players = createLocalPlayers(4);
    let session = buildLocalSession({
      gameId: 'imposter',
      players,
      prompt: 'Volcano',
      settings: { rounds: 2, imposterCount: 1 },
      rng: (() => {
        const values = [0.6, 0.7, 0.8, 0.1];
        let index = 0;
        return () => values[index++] ?? 0.9;
      })()
    });

    const imposterId = players.find(
      (player) => getImposterSecretForPlayer(session, player.id).role === 'imposter'
    )?.id;
    expect(imposterId).toBeTruthy();

    for (let index = 0; index < 4; index += 1) {
      const activePlayer = getActiveImposterPlayer(session);
      expect(activePlayer).toBeTruthy();
      session = applyLocalAction(session, { type: 'next-reveal' });
    }

    expect(session.stage).toBe('clues');

    session = applyLocalAction(session, { type: 'complete-clue-rounds' });
    expect(session.stage).toBe('discussion');
    session = applyLocalAction(session, { type: 'reveal-imposters' });

    expect(session.stage).toBe('results');
    expect(session.results.imposterId).toBe(imposterId);
    expect(session.results.secretWord).toBe('Volcano');
  });

  it('plays a complete local WhoWhatWhere match across two teams', () => {
    const players = rebalanceWhoWhatWherePlayers(createLocalPlayers(4), 2);
    const settings = {
      ...DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS,
      totalRounds: 1,
      teamCount: 2
    };

    let session = buildLocalSession({
      gameId: 'whowhatwhere',
      players,
      settings
    });

    expect(getWhoWhatWhereContext(session).activeTeamPlayers).toHaveLength(2);

    session = applyLocalAction(session, {
      type: 'start-turn',
      payload: {
        category: 'Animals',
        words: ['Lion', 'Tiger', 'Panda']
      }
    });
    session = applyLocalAction(session, { type: 'mark-correct' });
    session = applyLocalAction(session, { type: 'skip-word' });
    expect(session.activeTurn.skippedWords).toHaveLength(1);
    session = applyLocalAction(session, { type: 'return-skipped-word' });
    expect(session.activeTurn.currentWordSource).toBe('skipped');
    session = applyLocalAction(session, { type: 'mark-correct' });
    session = applyLocalAction(session, { type: 'skip-word' });
    expect(session.activeTurn.currentWordSource).toBe('skipped');
    expect(session.activeTurn.currentSkippedWord).toMatchObject({ word: 'Panda' });
    session = applyLocalAction(session, { type: 'end-turn' });

    expect(session.stage).toBe('ready');
    expect(session.teams[0].score).toBe(2);

    session = applyLocalAction(session, {
      type: 'start-turn',
      payload: {
        category: 'Music',
        words: ['Piano', 'Guitar', 'Drums']
      }
    });
    session = applyLocalAction(session, { type: 'mark-correct' });
    session = applyLocalAction(session, { type: 'end-turn' });

    expect(session.stage).toBe('results');
    expect(session.results.leaderboard).toHaveLength(2);
    expect(session.results.winnerTeamIds).toHaveLength(1);
  });

  it('supports multiple selectable skipped words in local WhoWhatWhere', () => {
    const players = rebalanceWhoWhatWherePlayers(createLocalPlayers(4), 2);
    let session = buildLocalSession({
      gameId: 'whowhatwhere',
      players,
      settings: {
        ...DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS,
        teamCount: 2,
        skipLimit: 3
      }
    });

    session = applyLocalAction(session, {
      type: 'start-turn',
      payload: {
        category: 'Animals',
        words: ['Lion', 'Tiger', 'Panda', 'Falcon', 'Otter']
      }
    });

    session = applyLocalAction(session, { type: 'skip-word' });
    session = applyLocalAction(session, { type: 'skip-word' });
    session = applyLocalAction(session, { type: 'skip-word' });

    expect(session.activeTurn.skippedWords.map((entry) => entry.word)).toEqual([
      'Lion',
      'Tiger',
      'Panda'
    ]);

    session = applyLocalAction(session, {
      type: 'return-skipped-word',
      payload: { skippedWordId: session.activeTurn.skippedWords[1].id }
    });

    expect(session.activeTurn.currentWordSource).toBe('skipped');
    expect(session.activeTurn.currentSkippedWord.word).toBe('Tiger');
    expect(session.activeTurn.skippedWords.map((entry) => entry.word)).toEqual(['Lion', 'Panda']);

    session = applyLocalAction(session, { type: 'mark-correct' });
    session = applyLocalAction(session, { type: 'skip-word' });

    expect(session.activeTurn.skippedWords.map((entry) => entry.word)).toEqual([
      'Lion',
      'Panda',
      'Falcon'
    ]);
  });

  it('plays a complete local DrawNGuess chain from prompt to reveal', () => {
    const players = createLocalPlayers(4);
    let session = buildLocalSession({
      gameId: 'drawnguess',
      players,
      prompt: 'Castle'
    });

    session = applyLocalAction(session, {
      type: 'submit-drawing',
      payload: { imageData: TEST_DRAWING }
    });
    session = applyLocalAction(session, {
      type: 'submit-guess',
      payload: { text: 'dragon' }
    });
    session = applyLocalAction(session, {
      type: 'submit-drawing',
      payload: { imageData: TEST_DRAWING }
    });
    session = applyLocalAction(session, {
      type: 'submit-guess',
      payload: { text: 'fortress' }
    });

    expect(session.stage).toBe('results');
    expect(session.results.chain.map((entry) => entry.type)).toEqual([
      'prompt',
      'drawing',
      'guess',
      'drawing',
      'guess'
    ]);
  });

  it('plays a full local HatGame across describe, one-word, and charades', () => {
    const players = rebalanceWhoWhatWherePlayers(createLocalPlayers(4), 2);
    const settings = {
      ...DEFAULT_LOCAL_HATGAME_SETTINGS,
      teamCount: 2,
      cluesPerPlayer: 3
    };

    let session = buildLocalSession({
      gameId: 'hatgame',
      players,
      settings,
      lobbyState: {
        clueSubmissions: {
          [players[0].id]: { clues: ['Albert Einstein', 'Wonder Woman', 'Sherlock Holmes'] },
          [players[1].id]: { clues: ['Beyonce', 'Black Panther', 'Darth Vader'] },
          [players[2].id]: { clues: ['Hermione Granger', 'Spider-Man', 'Oprah Winfrey'] },
          [players[3].id]: { clues: ['Batman', 'Taylor Swift', 'Indiana Jones'] }
        }
      },
      rng: () => 0.5
    });

    expect(getWhoWhatWhereContext(session).activeTeamPlayers).toHaveLength(2);

    let usedSkipReturn = false;

    while (session.stage !== 'results') {
      if (session.stage === 'ready') {
        session = applyLocalAction(session, {
          type: 'start-turn',
          payload: {}
        });
        continue;
      }

      if (
        !usedSkipReturn &&
        (session.activeTurn?.skippedClues?.length ?? 0) === 0 &&
        session.activeTurn?.currentSkippedCluePoolIndex === null
      ) {
        const skippedClue = session.activeTurn.clueQueue[session.activeTurn.queueIndex].text;
        session = applyLocalAction(session, { type: 'skip-clue' });
        expect(session.activeTurn.skippedClues.map((entry) => entry.text)).toContain(skippedClue);
        expect(session.activeTurn.clueQueue[session.activeTurn.queueIndex].text).not.toBe(
          skippedClue
        );

        session = applyLocalAction(session, {
          type: 'return-skipped-clue',
          payload: { poolIndex: session.activeTurn.skippedClues[0].poolIndex }
        });
        expect(session.activeTurn.clueQueue[session.activeTurn.queueIndex].text).toBe(skippedClue);
        usedSkipReturn = true;
        continue;
      }

      session = applyLocalAction(session, { type: 'mark-correct' });
    }

    expect(session.stage).toBe('results');
    expect(session.results.totalClues).toBe(12);
    expect(session.results.leaderboard).toHaveLength(2);
    expect(session.results.bestTurn.teamName).toBeTruthy();
    expect(session.results.bestTurn.describerName).toBeTruthy();
    expect(session.results.bestTurn.score).toBeGreaterThan(0);
  });

  it('rolls HatGame into the next phase without resetting the turn timer', () => {
    const players = rebalanceWhoWhatWherePlayers(createLocalPlayers(4), 2);
    const settings = {
      ...DEFAULT_LOCAL_HATGAME_SETTINGS,
      teamCount: 2,
      cluesPerPlayer: 1
    };

    let session = buildLocalSession({
      gameId: 'hatgame',
      players,
      settings,
      lobbyState: {
        clueSubmissions: {
          [players[0].id]: { clues: ['Albert Einstein'] },
          [players[1].id]: { clues: ['Beyonce'] },
          [players[2].id]: { clues: ['Spider-Man'] },
          [players[3].id]: { clues: ['Batman'] }
        }
      },
      rng: () => 0.5
    });

    session = applyLocalAction(session, {
      type: 'start-turn',
      payload: {}
    });
    const turnEndsAt = session.activeTurn.endsAt;

    for (let index = 0; index < 4; index += 1) {
      session = applyLocalAction(session, { type: 'mark-correct' });
    }

    expect(session.stage).toBe('turn');
    expect(session.phaseNumber).toBe(2);
    expect(session.activeTurn.endsAt).toBe(turnEndsAt);

    for (let index = 0; index < 4; index += 1) {
      session = applyLocalAction(session, { type: 'mark-correct' });
    }

    expect(session.stage).toBe('turn');
    expect(session.phaseNumber).toBe(3);
    expect(session.activeTurn.endsAt).toBe(turnEndsAt);

    for (let index = 0; index < 4; index += 1) {
      session = applyLocalAction(session, { type: 'mark-correct' });
    }

    expect(session.stage).toBe('results');
  });

  it('returns skipped and unfinished HatGame clues to the pool on the next turn', () => {
    const players = rebalanceWhoWhatWherePlayers(createLocalPlayers(4), 2);
    const settings = {
      ...DEFAULT_LOCAL_HATGAME_SETTINGS,
      teamCount: 2,
      cluesPerPlayer: 1
    };

    let session = buildLocalSession({
      gameId: 'hatgame',
      players,
      settings,
      lobbyState: {
        clueSubmissions: {
          [players[0].id]: { clues: ['Albert Einstein'] },
          [players[1].id]: { clues: ['Beyonce'] },
          [players[2].id]: { clues: ['Spider-Man'] },
          [players[3].id]: { clues: ['Batman'] }
        }
      },
      rng: () => 0.5
    });

    session = applyLocalAction(session, {
      type: 'start-turn',
      payload: {}
    });

    const initialQueue = session.activeTurn.clueQueue.map((clue) => clue.text);
    session = applyLocalAction(session, { type: 'mark-correct' });
    const skippedClue = session.activeTurn.clueQueue[session.activeTurn.queueIndex].text;
    const unfinishedClue = session.activeTurn.clueQueue[session.activeTurn.queueIndex + 1].text;

    session = applyLocalAction(session, { type: 'skip-clue' });
    session = applyLocalAction(session, { type: 'end-turn' });
    session = applyLocalAction(session, {
      type: 'start-turn',
      payload: {}
    });

    const nextQueue = session.activeTurn.clueQueue.map((clue) => clue.text);

    expect(nextQueue).toContain(skippedClue);
    expect(nextQueue).toContain(unfinishedClue);
    expect(nextQueue).not.toContain(initialQueue[0]);
  });

  it('restores HatGame skip capacity after the skipped clue is guessed', () => {
    const players = rebalanceWhoWhatWherePlayers(createLocalPlayers(4), 2);
    const settings = {
      ...DEFAULT_LOCAL_HATGAME_SETTINGS,
      teamCount: 2,
      cluesPerPlayer: 1,
      skipsPerTurn: 1
    };

    let session = buildLocalSession({
      gameId: 'hatgame',
      players,
      settings,
      lobbyState: {
        clueSubmissions: {
          [players[0].id]: { clues: ['Albert Einstein'] },
          [players[1].id]: { clues: ['Beyonce'] },
          [players[2].id]: { clues: ['Spider-Man'] },
          [players[3].id]: { clues: ['Batman'] }
        }
      },
      rng: () => 0.5
    });

    session = applyLocalAction(session, {
      type: 'start-turn',
      payload: {}
    });

    session = applyLocalAction(session, { type: 'skip-clue' });
    expect(session.activeTurn.skipsRemaining).toBe(0);

    session = applyLocalAction(session, { type: 'mark-correct' });
    session = applyLocalAction(session, { type: 'mark-correct' });
    session = applyLocalAction(session, {
      type: 'return-skipped-clue',
      payload: { poolIndex: session.activeTurn.skippedClues[0].poolIndex }
    });
    session = applyLocalAction(session, { type: 'mark-correct' });

    expect(session.activeTurn.currentSkippedCluePoolIndex).toBeNull();
    expect(session.activeTurn.skipsRemaining).toBe(1);

    session = applyLocalAction(session, { type: 'skip-clue' });
    expect(session.activeTurn.skippedClues).toHaveLength(1);
  });

  it('supports multiple selectable skipped clues in local HatGame', () => {
    const players = rebalanceWhoWhatWherePlayers(createLocalPlayers(4), 2);
    let session = buildLocalSession({
      gameId: 'hatgame',
      players,
      settings: {
        ...DEFAULT_LOCAL_HATGAME_SETTINGS,
        teamCount: 2,
        cluesPerPlayer: 1,
        skipsPerTurn: 3
      },
      lobbyState: {
        clueSubmissions: {
          [players[0].id]: { clues: ['Albert Einstein'] },
          [players[1].id]: { clues: ['Beyonce'] },
          [players[2].id]: { clues: ['Spider-Man'] },
          [players[3].id]: { clues: ['Batman'] }
        }
      },
      rng: () => 0.5
    });

    session = applyLocalAction(session, {
      type: 'start-turn',
      payload: {}
    });

    session = applyLocalAction(session, { type: 'skip-clue' });
    session = applyLocalAction(session, { type: 'skip-clue' });
    session = applyLocalAction(session, { type: 'skip-clue' });

    expect(session.activeTurn.skippedClues).toHaveLength(3);

    const targetSkippedClue = session.activeTurn.skippedClues[1];
    session = applyLocalAction(session, {
      type: 'return-skipped-clue',
      payload: { poolIndex: targetSkippedClue.poolIndex }
    });

    expect(session.activeTurn.clueQueue[session.activeTurn.queueIndex].text).toBe(
      targetSkippedClue.text
    );
    expect(session.activeTurn.skippedClues).toHaveLength(2);

    session = applyLocalAction(session, { type: 'mark-correct' });
    session = applyLocalAction(session, { type: 'skip-clue' });

    expect(session.activeTurn.skippedClues).toHaveLength(3);
  });

  it('requires at least three players for local Imposter', () => {
    expect(
      getLocalStartError({
        gameId: 'imposter',
        players: createLocalPlayers(2)
      })
    ).toBe('Need at least 3 players');
  });

  it('fills the first open default player label after removals', () => {
    expect(
      getNextLocalPlayerName([
        { name: 'Player 1' },
        { name: 'Player 3' },
        { name: 'Alex' }
      ])
    ).toBe('Player 2');
  });

  it('rotates local DrawNGuess player order for the next round', () => {
    const rotatedPlayers = rotateLocalRoundPlayers(createLocalPlayers(4));

    expect(rotatedPlayers.map((player) => player.name)).toEqual([
      'Player 2',
      'Player 3',
      'Player 4',
      'Player 1'
    ]);
    expect(rotatedPlayers.map((player) => player.seat)).toEqual([0, 1, 2, 3]);
  });
});
