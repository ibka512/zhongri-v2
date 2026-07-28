import { describe, expect, it, vi } from 'vitest';

import { createBrowserSpeechSynthesis } from '../../src/infrastructure/audio';

interface FakeUtterance {
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  rate: number;
  text: string;
}

function createFakeSpeech() {
  const utterances: FakeUtterance[] = [];
  const synthesis = {
    cancel: vi.fn(),
    speak: vi.fn(),
  } as unknown as SpeechSynthesis;
  const createUtterance = (text: string) => {
    const utterance: FakeUtterance = { lang: '', onend: null, onerror: null, rate: 1, text };
    utterances.push(utterance);
    return utterance as unknown as SpeechSynthesisUtterance;
  };

  return { createUtterance, synthesis, utterances };
}

describe('createBrowserSpeechSynthesis', () => {
  it('speaks with the requested language and rate and resolves on end', async () => {
    const fake = createFakeSpeech();
    const speech = createBrowserSpeechSynthesis(fake);

    expect(speech.supported).toBe(true);
    const result = speech.speak({ language: 'ja-JP', rate: 0.8, text: 'あ' });

    expect(fake.synthesis.cancel).toHaveBeenCalledTimes(1);
    expect(fake.utterances[0]).toMatchObject({ lang: 'ja-JP', rate: 0.8, text: 'あ' });
    fake.utterances[0]?.onend?.();

    await expect(result).resolves.toBeUndefined();
  });

  it('cancels and resolves the previous utterance before starting another one', async () => {
    const fake = createFakeSpeech();
    const speech = createBrowserSpeechSynthesis(fake);
    const first = speech.speak({ language: 'ja-JP', rate: 0.8, text: 'あ' });
    const second = speech.speak({ language: 'ja-JP', rate: 0.8, text: 'い' });

    await expect(first).resolves.toBeUndefined();
    expect(fake.synthesis.cancel).toHaveBeenCalledTimes(2);
    fake.utterances[1]?.onend?.();
    await expect(second).resolves.toBeUndefined();
  });

  it('ignores a late end event from a canceled utterance', async () => {
    const fake = createFakeSpeech();
    const speech = createBrowserSpeechSynthesis(fake);
    const first = speech.speak({ language: 'ja-JP', rate: 0.8, text: 'あ' });
    const second = speech.speak({ language: 'ja-JP', rate: 0.8, text: 'い' });

    fake.utterances[0]?.onend?.();
    fake.utterances[1]?.onend?.();

    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
  });

  it('normalizes browser errors into a rejected promise', async () => {
    const fake = createFakeSpeech();
    const speech = createBrowserSpeechSynthesis(fake);
    const result = speech.speak({ language: 'ja-JP', rate: 0.8, text: 'う' });

    fake.utterances[0]?.onerror?.();

    await expect(result).rejects.toThrow('浏览器没有完成这次朗读');
  });

  it('reports unsupported environments without calling a browser API', async () => {
    const speech = createBrowserSpeechSynthesis({ synthesis: null });

    expect(speech.supported).toBe(false);
    await expect(speech.speak({ language: 'ja-JP', rate: 0.8, text: 'え' })).rejects.toThrow(
      '当前浏览器不支持语音朗读',
    );
  });
});
