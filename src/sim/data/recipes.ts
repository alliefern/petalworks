import type { Recipe } from '../types';
import { seconds } from './balance';

export const RECIPES: Record<string, Recipe> = {
  daisy_bundle: {
    id: 'daisy_bundle',
    inputs: { daisy: 2 },
    output: 'daisy_bundle',
    ticks: seconds(5),
  },
  lavender_sachet: {
    id: 'lavender_sachet',
    inputs: { lavender: 2 },
    output: 'lavender_sachet',
    ticks: seconds(7),
  },
  mixed_bouquet: {
    id: 'mixed_bouquet',
    inputs: { daisy_bundle: 1, lavender_sachet: 1 },
    output: 'mixed_bouquet',
    ticks: seconds(8),
  },
};
