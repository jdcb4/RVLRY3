import { DrawNGuessLocalView } from './DrawNGuessLocalView';
import { HatGameLocalView } from './HatGameLocalView';
import { ImposterLocalView } from './ImposterLocalView';
import { WhoWhatWhereLocalView } from './WhoWhatWhereLocalView';
import {
  DrawNGuessSettingsCard,
  HatGameSettingsCard,
  ImposterSettingsCard,
  WhoWhatWhereSettingsCard
} from './common';

export const LOCAL_VIEW_COMPONENTS = {
  imposter: ImposterLocalView,
  whowhatwhere: WhoWhatWhereLocalView,
  drawnguess: DrawNGuessLocalView,
  hatgame: HatGameLocalView
};

export const LOCAL_SETTINGS_COMPONENTS = {
  imposter: ImposterSettingsCard,
  drawnguess: DrawNGuessSettingsCard,
  whowhatwhere: WhoWhatWhereSettingsCard,
  hatgame: HatGameSettingsCard
};

export {
  DrawNGuessSettingsCard,
  DrawNGuessLocalView,
  HatGameLocalView,
  HatGameSettingsCard,
  ImposterSettingsCard,
  ImposterLocalView,
  WhoWhatWhereSettingsCard,
  WhoWhatWhereLocalView
};
