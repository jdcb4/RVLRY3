import { DrawNGuessLocalView } from './DrawNGuessLocalView';
import { HatGameLocalView } from './HatGameLocalView';
import { ImposterLocalView } from './ImposterLocalView';
import { WhoWhatWhereLocalView } from './WhoWhatWhereLocalView';
import { HatGameSettingsCard, WhoWhatWhereSettingsCard } from './common';

export const LOCAL_VIEW_COMPONENTS = {
  imposter: ImposterLocalView,
  whowhatwhere: WhoWhatWhereLocalView,
  drawnguess: DrawNGuessLocalView,
  hatgame: HatGameLocalView
};

export const LOCAL_SETTINGS_COMPONENTS = {
  whowhatwhere: WhoWhatWhereSettingsCard,
  hatgame: HatGameSettingsCard
};

export {
  DrawNGuessLocalView,
  HatGameLocalView,
  HatGameSettingsCard,
  ImposterLocalView,
  WhoWhatWhereSettingsCard,
  WhoWhatWhereLocalView
};
