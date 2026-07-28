import type { SpeechSynthesisPort, SpeechSynthesisRequest } from '../../ports';

export interface BrowserSpeechSynthesisOptions {
  readonly createUtterance?: (text: string) => SpeechSynthesisUtterance;
  readonly synthesis?: SpeechSynthesis | null;
}

function getDefaultSynthesis(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
    ? window.speechSynthesis
    : null;
}

function getDefaultUtteranceFactory(): ((text: string) => SpeechSynthesisUtterance) | null {
  return typeof SpeechSynthesisUtterance === 'undefined'
    ? null
    : (text: string) => new SpeechSynthesisUtterance(text);
}

export function createBrowserSpeechSynthesis(
  options: BrowserSpeechSynthesisOptions = {},
): SpeechSynthesisPort {
  const synthesis = options.synthesis === undefined ? getDefaultSynthesis() : options.synthesis;
  const createUtterance = options.createUtterance ?? getDefaultUtteranceFactory();
  const supported = Boolean(synthesis && createUtterance);
  let activeResolve: (() => void) | null = null;
  let activeToken: object | null = null;

  const cancel = () => {
    synthesis?.cancel();
    activeResolve?.();
    activeResolve = null;
    activeToken = null;
  };

  const speak = (request: SpeechSynthesisRequest): Promise<void> => {
    if (!synthesis || !createUtterance) {
      return Promise.reject(new Error('当前浏览器不支持语音朗读'));
    }

    cancel();

    return new Promise<void>((resolve, reject) => {
      const utterance = createUtterance(request.text);
      const token = {};
      utterance.lang = request.language;
      utterance.rate = request.rate;
      activeResolve = resolve;
      activeToken = token;
      utterance.onend = () => {
        if (activeToken !== token) {
          return;
        }

        activeResolve = null;
        activeToken = null;
        resolve();
      };
      utterance.onerror = () => {
        if (activeToken !== token) {
          return;
        }

        activeResolve = null;
        activeToken = null;
        reject(new Error('浏览器没有完成这次朗读'));
      };
      synthesis.speak(utterance);
    });
  };

  return { cancel, speak, supported };
}
