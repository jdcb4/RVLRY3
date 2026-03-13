import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DrawNGuessLocalView } from '../components/local/DrawNGuessLocalView';
import { ImposterLocalView } from '../components/local/ImposterLocalView';
import { WhoWhatWhereLocalView } from '../components/local/WhoWhatWhereLocalView';
import {
  applyLocalAction,
  buildLocalSession,
  createLocalPlayers,
  DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS
} from '../local/session';
import { GameLobbyScreen } from './GameLobbyScreen';
import { usePlaySession } from './PlaySessionContext';

vi.mock('./PlaySessionContext', () => ({
  usePlaySession: vi.fn()
}));

vi.mock('../audio/AudioCueContext', () => ({
  useAudioCues: () => ({ playCue: vi.fn() })
}));

vi.mock('../audio/useGameAudio', () => ({
  useStageCue: vi.fn(),
  useTimedTurnAudio: vi.fn()
}));

const mockedUsePlaySession = vi.mocked(usePlaySession);

const renderLobbyScreen = () =>
  render(
    <MemoryRouter
      initialEntries={['/play/whowhatwhere/lobby/ROOM42']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/play/:gameId/lobby/:roomCode" element={<GameLobbyScreen />} />
      </Routes>
    </MemoryRouter>
  );

describe('play UI', () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockedUsePlaySession.mockReset();
  });

  it('shows a neutral start hint when teams are not ready and disables start', () => {
    mockedUsePlaySession.mockReturnValue({
      game: {
        id: 'whowhatwhere',
        name: 'Who, What, Where',
        minPlayers: 4
      },
      playerName: 'Alex',
      playerId: 'p1',
      currentPlayer: { id: 'p1', name: 'Alex', ready: true, teamId: 'team-1' },
      roomState: {
        code: 'ROOM42',
        phase: 'lobby',
        hostId: 'p1',
        settings: {
          teamCount: 2,
          turnDurationSeconds: 45,
          totalRounds: 3,
          freeSkips: 1,
          skipPenalty: 1
        },
        teams: [
          { id: 'team-1', name: 'Team 1', score: 0 },
          { id: 'team-2', name: 'Team 2', score: 0 }
        ],
        players: [
          { id: 'p1', name: 'Alex', ready: true, teamId: 'team-1' },
          { id: 'p2', name: 'Blair', ready: true, teamId: 'team-1' },
          { id: 'p3', name: 'Casey', ready: true, teamId: 'team-1' },
          { id: 'p4', name: 'Drew', ready: true, teamId: 'team-2' }
        ]
      },
      lobbyPrivateState: null,
      error: '',
      setError: vi.fn(),
      pendingAction: '',
      ensureRoom: vi.fn(),
      assignTeam: vi.fn(),
      updateTeamName: vi.fn(),
      updateRoomSettings: vi.fn(),
      submitHatClues: vi.fn(),
      setReady: vi.fn(),
      startGame: vi.fn()
    });

    renderLobbyScreen();

    expect(screen.getByText('Each team needs at least 2 players')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start game' }).disabled).toBe(true);
  });

  it('reveals imposter roles only after the handoff prompt is opened', async () => {
    const user = userEvent.setup();
    const applyAction = vi.fn();

    render(
      <ImposterLocalView
        session={{
          stage: 'reveal',
          revealIndex: 0,
          clueIndex: 0,
          votingIndex: 0,
          players: [
            { id: 'p1', name: 'Alex' },
            { id: 'p2', name: 'Blair' }
          ],
          imposterId: 'p2',
          prompt: 'Volcano',
          clues: []
        }}
        applyAction={applyAction}
        busyAction=""
        onPlayAgain={vi.fn()}
        onResetSetup={vi.fn()}
      />
    );

    expect(screen.getByText('Keep this hidden while you pass the device.')).toBeTruthy();
    expect(screen.queryByText('Volcano')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Reveal' }));

    expect(screen.getByText('Crew')).toBeTruthy();
    expect(screen.getByText('Volcano')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lock and pass' })).toBeTruthy();
  });

  it('auto-ends a local timed turn when the countdown expires', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T09:00:00.000Z'));

    const baseSession = buildLocalSession({
      gameId: 'whowhatwhere',
      players: createLocalPlayers(4, { teamCount: 2 }),
      settings: {
        ...DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS,
        teamCount: 2
      }
    });
    const turnSession = applyLocalAction(baseSession, {
      type: 'start-turn',
      payload: {
        words: ['Piano'],
        category: 'Mixed deck'
      }
    });
    const applyAction = vi.fn();

    render(
      <WhoWhatWhereLocalView
        session={{
          ...turnSession,
          activeTurn: {
            ...turnSession.activeTurn,
            endsAt: new Date(Date.now() + 400).toISOString()
          }
        }}
        applyAction={applyAction}
        busyAction=""
        onStartTurn={vi.fn()}
        onPlayAgain={vi.fn()}
        onResetSetup={vi.fn()}
      />
    );

    expect(screen.getByText('Live turn')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(applyAction).toHaveBeenCalledWith({ type: 'end-turn' });
  });

  it('keeps draw-and-guess artwork hidden until reveal and exposes accessible controls', async () => {
    const user = userEvent.setup();

    render(
      <DrawNGuessLocalView
        session={{
          stage: 'guess',
          stageIndex: 2,
          activePlayerId: 'p2',
          players: [
            { id: 'p1', name: 'Alex' },
            { id: 'p2', name: 'Blair' }
          ],
          prompt: 'Library',
          chain: [
            {
              type: 'drawing',
              imageData: 'data:image/png;base64,test',
              submittedBy: 'p1'
            }
          ]
        }}
        applyAction={vi.fn()}
        busyAction=""
        onPlayAgain={vi.fn()}
        onResetSetup={vi.fn()}
      />
    );

    expect(screen.queryByRole('img', { name: 'Sketch to guess' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Reveal' }));

    expect(screen.getByRole('img', { name: 'Sketch to guess' })).toBeTruthy();
    expect(
      screen.getByRole('textbox', { name: 'What does this drawing say?' })
    ).toBeTruthy();
  });
});
