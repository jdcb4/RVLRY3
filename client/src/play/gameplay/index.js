import { DrawNGuessPlay } from './DrawNGuessPlay';
import { HatGamePlay } from './HatGamePlay';
import { ImposterPlay } from './ImposterPlay';
import { WhoWhatWherePlay } from './WhoWhatWherePlay';

export const GAMEPLAY_COMPONENTS = {
  imposter: ImposterPlay,
  whowhatwhere: WhoWhatWherePlay,
  drawnguess: DrawNGuessPlay,
  hatgame: HatGamePlay
};

export { DrawNGuessPlay, HatGamePlay, ImposterPlay, WhoWhatWherePlay };
