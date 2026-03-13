import { describe, expect, it } from 'vitest';
import {
  applyLocalAction,
  buildLocalSession,
  createLocalPlayers,
  DEFAULT_LOCAL_HATGAME_SETTINGS,
  DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS,
  getActiveImposterPlayer,
  getImposterSecretForPlayer,
  getWhoWhatWhereContext,
  rebalanceWhoWhatWherePlayers
} from './session';

const TEST_DRAWING = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AApMBgZVp0QAAAABJRU5ErkJggg==';

describe('local pass-and-play session engine', () => {
  it('plays a full local Imposter round from reveal to results', () => {
    const players = createLocalPlayers(4);
    let session = buildLocalSession({
      gameId: 'imposter',
      players,
      prompt: 'Volcano',
      rng: () => 0.99
    });

    expect(getImposterSecretForPlayer(session, players[3].id).role).toBe('imposter');

    for (let index = 0; index < 4; index += 1) {
      const activePlayer = getActiveImposterPlayer(session);
      expect(activePlayer).toBeTruthy();
      session = applyLocalAction(session, { type: 'next-reveal' });
    }

    expect(session.stage).toBe('clues');

    for (let index = 0; index < 4; index += 1) {
      session = applyLocalAction(session, {
        type: 'submit-clue',
        payload: { text: `clue-${index + 1}` }
      });
    }

    expect(session.stage).toBe('voting');

    for (const player of players) {
      session = applyLocalAction(session, {
        type: 'submit-vote',
        payload: {
          targetPlayerId: player.id === players[3].id ? players[0].id : players[3].id
        }
      });
    }

    expect(session.stage).toBe('results');
    expect(session.results.outcome).toBe('crew');
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
    session = applyLocalAction(session, { type: 'end-turn' });

    expect(session.stage).toBe('ready');
    expect(session.teams[0].score).toBe(1);

    session = applyLocalAction(session, {
      type: 'start-turn',
      payload: {
        category: 'Music',
        words: ['Piano', 'Guitar', 'Drums']
      }
    });
    session = applyLocalAction(session, { type: 'mark-correct' });
    session = applyLocalAction(session, { type: 'mark-correct' });
    session = applyLocalAction(session, { type: 'end-turn' });

    expect(session.stage).toBe('results');
    expect(session.results.leaderboard).toHaveLength(2);
    expect(session.results.winnerTeamIds).toHaveLength(1);
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

    for (let phaseNumber = 1; phaseNumber <= 3; phaseNumber += 1) {
      expect(session.phaseNumber).toBe(phaseNumber);

      session = applyLocalAction(session, {
        type: 'start-turn',
        payload: {}
      });

      while (session.stage === 'turn') {
        session = applyLocalAction(session, { type: 'mark-correct' });
      }
    }

    expect(session.stage).toBe('results');
    expect(session.results.totalClues).toBe(12);
    expect(session.results.leaderboard).toHaveLength(2);
  });
});
