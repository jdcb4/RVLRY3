import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DrawNGuessLocalView } from '../components/local/DrawNGuessLocalView';
import { ImposterLocalView } from '../components/local/ImposterLocalView';
import { WhoWhatWhereLocalView } from '../components/local/WhoWhatWhereLocalView';
import { HatGamePlay } from './gameplay/HatGamePlay';
import { WhoWhatWherePlay } from './gameplay/WhoWhatWherePlay';
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

const renderLobbyScreen = (initialEntry = '/play/whowhatwhere/lobby/ROOM42') =>
  render(
    <MemoryRouter
      initialEntries={[initialEntry]}
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
    const rebalanceTeams = vi.fn();

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
      roomExitNotice: null,
      error: '',
      setError: vi.fn(),
      clearRoomExitNotice: vi.fn(),
      pendingAction: '',
      ensureRoom: vi.fn(),
      assignTeam: vi.fn(),
      updateTeamName: vi.fn(),
      rebalanceTeams,
      updateRoomSettings: vi.fn(),
      submitHatClues: vi.fn(),
      kickPlayer: vi.fn(),
      setReady: vi.fn(),
      startGame: vi.fn()
    });

    renderLobbyScreen();

    expect(screen.getByText('Each team needs at least 2 players')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start' }).disabled).toBe(true);
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

    expect(screen.getByText('Pass phone to Alex.')).toBeTruthy();
    expect(screen.queryByText('Volcano')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Alex ready' }));

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

    await user.click(screen.getByRole('button', { name: 'Blair ready' }));

    expect(screen.getByRole('img', { name: 'Sketch to guess' })).toBeTruthy();
    expect(
      screen.getByRole('textbox', { name: 'What does this drawing say?' })
    ).toBeTruthy();
  });

  it('lets the host rebalance teams from the shared team options panel', async () => {
    const user = userEvent.setup();
    const rebalanceTeams = vi.fn().mockResolvedValue({ ok: true });

    mockedUsePlaySession.mockReturnValue({
      game: {
        id: 'whowhatwhere',
        name: 'Who, What, Where',
        minPlayers: 4
      },
      playerName: 'Alex',
      playerId: 'p1',
      currentPlayer: { id: 'p1', name: 'Alex', ready: false, teamId: 'team-1' },
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
          { id: 'p1', name: 'Alex', ready: false, teamId: 'team-1' },
          { id: 'p2', name: 'Blair', ready: false, teamId: 'team-1' },
          { id: 'p3', name: 'Casey', ready: false, teamId: 'team-2' },
          { id: 'p4', name: 'Drew', ready: false, teamId: 'team-2' }
        ]
      },
      lobbyPrivateState: null,
      error: '',
      setError: vi.fn(),
      pendingAction: '',
      ensureRoom: vi.fn(),
      assignTeam: vi.fn(),
      updateTeamName: vi.fn(),
      rebalanceTeams,
      updateRoomSettings: vi.fn(),
      submitHatClues: vi.fn(),
      setReady: vi.fn(),
      startGame: vi.fn()
    });

    renderLobbyScreen();

    await user.click(screen.getByText('Options'));
    await user.click(screen.getByRole('button', { name: 'Rebalance teams' }));

    expect(rebalanceTeams).toHaveBeenCalledWith('ROOM42');
  });

  it('keeps HatGame team controls collapsed and lets the host remove players', async () => {
    const user = userEvent.setup();
    const kickPlayer = vi.fn().mockResolvedValue({ ok: true });

    mockedUsePlaySession.mockReturnValue({
      game: {
        id: 'hatgame',
        name: 'HatGame',
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
          cluesPerPlayer: 6,
          skipsPerTurn: 1
        },
        lobbyState: {
          requiredCluesPerPlayer: 6,
          clueCountsByPlayerId: {
            p1: 6,
            p2: 6,
            p3: 6,
            p4: 6
          }
        },
        teams: [
          { id: 'team-1', name: 'Team Alpha', score: 0, captainId: 'p1' },
          { id: 'team-2', name: 'Team Bravo', score: 0, captainId: 'p3' }
        ],
        players: [
          { id: 'p1', name: 'Alex', ready: true, teamId: 'team-1', seat: 0 },
          { id: 'p2', name: 'Blair', ready: false, teamId: 'team-1', seat: 1 },
          { id: 'p3', name: 'Casey', ready: true, teamId: 'team-2', seat: 2 },
          { id: 'p4', name: 'Drew', ready: false, teamId: 'team-2', seat: 3 }
        ]
      },
      lobbyPrivateState: {
        submittedCount: 6,
        clues: ['A', 'B', 'C', 'D', 'E', 'F'],
        hasSubmitted: true
      },
      roomExitNotice: null,
      error: '',
      setError: vi.fn(),
      clearRoomExitNotice: vi.fn(),
      pendingAction: '',
      ensureRoom: vi.fn(),
      assignTeam: vi.fn(),
      updateTeamName: vi.fn(),
      rebalanceTeams: vi.fn(),
      updateRoomSettings: vi.fn(),
      submitHatClues: vi.fn(),
      kickPlayer,
      setReady: vi.fn(),
      startGame: vi.fn()
    });

    renderLobbyScreen('/play/hatgame/lobby/ROOM42');

    const teamsSummary = screen.getByRole('heading', { name: 'Teams' }).closest('summary');
    const teamsDisclosure = teamsSummary?.closest('details');

    expect(teamsDisclosure?.hasAttribute('open')).toBe(false);

    await user.click(teamsSummary);

    expect(teamsDisclosure?.hasAttribute('open')).toBe(true);
    expect(screen.getByRole('button', { name: 'Edit Team Alpha' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Alex ready' })).toBeTruthy();

    await user.click(screen.getByLabelText('Hat Game clue writing tips'));

    expect(
      screen.getByText('Write names most of the room should know, real or fictional.')
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Remove Drew' }));

    expect(kickPlayer).toHaveBeenCalledWith('ROOM42', 'p4');
  });

  it('keeps team scoreboard context collapsed until requested in team gameplay', async () => {
    const user = userEvent.setup();

    render(
      <WhoWhatWherePlay
        roomCode="ROOM42"
        roomState={{
          hostId: 'p1',
          players: [
            { id: 'p1', name: 'Alex', teamId: 'team-1' },
            { id: 'p2', name: 'Blair', teamId: 'team-1' },
            { id: 'p3', name: 'Casey', teamId: 'team-2' },
            { id: 'p4', name: 'Drew', teamId: 'team-2' }
          ],
          teams: [
            { id: 'team-1', name: 'Team 1', score: 2 },
            { id: 'team-2', name: 'Team 2', score: 1 }
          ],
          gamePublicState: {
            stage: 'ready',
            roundNumber: 1,
            totalRounds: 3,
            activeTeamId: 'team-1',
            activeDescriberId: 'p1',
            activeDescriberName: 'Alex',
            lastTurnSummary: {
              teamName: 'Team 2',
              describerName: 'Casey',
              scoreDelta: 1,
              correctCount: 1,
              skippedCount: 0,
              words: [{ word: 'Piano', status: 'correct' }]
            }
          }
        }}
        privateState={{
          teamId: 'team-2',
          isActiveTeam: false,
          canStartTurn: false
        }}
        playerId="p3"
        isHost={false}
        pendingAction=""
        sendGameAction={vi.fn()}
        returnRoomToLobby={vi.fn()}
      />
    );

    const scoreboardHeading = screen.getByText('Scoreboard');
    const scoreboardDisclosure = scoreboardHeading.closest('details');

    expect(scoreboardDisclosure?.hasAttribute('open')).toBe(false);

    await user.click(scoreboardHeading);

    expect(scoreboardDisclosure?.hasAttribute('open')).toBe(true);
    expect(screen.getByText('Latest turn')).toBeTruthy();
  });

  it('hides HatGame rule details behind an info popover and lets the describer return skipped clues', async () => {
    const user = userEvent.setup();
    const sendGameAction = vi.fn();

    render(
      <HatGamePlay
        roomCode="ROOM42"
        roomState={{
          hostId: 'p1',
          players: [
            { id: 'p1', name: 'Alex', teamId: 'team-1' },
            { id: 'p2', name: 'Blair', teamId: 'team-1' },
            { id: 'p3', name: 'Casey', teamId: 'team-2' },
            { id: 'p4', name: 'Drew', teamId: 'team-2' }
          ],
          teams: [
            { id: 'team-1', name: 'Team 1', score: 2 },
            { id: 'team-2', name: 'Team 2', score: 1 }
          ],
          gamePublicState: {
            stage: 'turn',
            roundNumber: 1,
            phaseNumber: 1,
            phaseName: 'Describe',
            phaseInstruction: 'Use as many words as you want, but do not say any part of the name.',
            activeTeamId: 'team-1',
            activeDescriberId: 'p1',
            activeDescriberName: 'Alex',
            turn: {
              endsAt: new Date(Date.now() + 30_000).toISOString(),
              score: 2,
              correctCount: 2,
              skipsRemaining: 0,
              skippedCluePending: true
            }
          }
        }}
        privateState={{
          teamId: 'team-1',
          isActiveTeam: true,
          isDescriber: true,
          clue: 'Batman',
          skipsRemaining: 0,
          skippedCluePending: true,
          skippedClueText: 'Batman',
          canSkip: false,
          canReturnSkippedClue: true
        }}
        playerId="p1"
        isHost
        pendingAction=""
        sendGameAction={sendGameAction}
        returnRoomToLobby={vi.fn()}
      />
    );

    const currentClueCard = screen.getByText('Current clue').closest('.role-card');
    const ruleInfoButton = screen.getByLabelText('What does Describe mean?');

    expect(currentClueCard).toBeTruthy();
    expect(
      within(currentClueCard).queryByText(
        'Use as many words as you want, but do not say any part of the name.'
      )
    ).toBeNull();

    await user.click(ruleInfoButton);

    expect(
      screen.getByText('Use as many words as you want, but do not say any part of the name.')
    ).toBeTruthy();
    expect(screen.queryByText('A skipped clue must come back before you can skip again.')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Go back to skipped clue' }));

    expect(sendGameAction).toHaveBeenCalledWith('ROOM42', 'return-skipped-clue');
  });
});
