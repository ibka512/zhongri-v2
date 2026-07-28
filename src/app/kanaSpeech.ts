import { createBrowserSpeechSynthesis } from '../infrastructure/audio';
import type { SpeechSynthesisPort } from '../ports';

export function loadKanaSpeech(): SpeechSynthesisPort {
  return createBrowserSpeechSynthesis();
}
