import { DrawNGuessLobby } from './DrawNGuessLobby';
import { HatGameLobby } from './HatGameLobby';
import { ImposterLobby } from './ImposterLobby';
import { StandardLobby } from './StandardLobby';
import { WhoWhatWhereLobby } from './WhoWhatWhereLobby';

export const LOBBY_COMPONENTS = {
  standard: StandardLobby,
  imposter: ImposterLobby,
  drawnguess: DrawNGuessLobby,
  whowhatwhere: WhoWhatWhereLobby,
  hatgame: HatGameLobby
};

export {
  DrawNGuessLobby,
  HatGameLobby,
  ImposterLobby,
  StandardLobby,
  WhoWhatWhereLobby
};
