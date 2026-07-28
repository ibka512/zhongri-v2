import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { basicHiragana, type KanaSyllable } from '../../content';
import type { SpeechSynthesisPort } from '../../ports';
import type { LearnerSettings } from '../../schemas/v1';
import { AudioControl, Button, Card, Progress } from '../../ui/components';
import './kana-practice.css';

export interface KanaPracticePageProps {
  loadSettings: () => Promise<LearnerSettings | null>;
  loadSpeech: () => SpeechSynthesisPort;
}

type PracticeMode = 'listening' | 'recognition';

function getOptions(currentIndex: number): readonly KanaSyllable[] {
  const offsets = [0, 2, 4, 6];

  return offsets.map((offset) => basicHiragana[(currentIndex + offset) % basicHiragana.length]);
}

function modeLabel(mode: PracticeMode): string {
  return mode === 'recognition' ? '辨认' : '听辨';
}

export function KanaPracticePage({ loadSettings, loadSpeech }: KanaPracticePageProps) {
  const [settings, setSettings] = useState<LearnerSettings | null | undefined>(undefined);
  const [mode, setMode] = useState<PracticeMode>('recognition');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const speech = useMemo(() => loadSpeech(), [loadSpeech]);
  const isMounted = useRef(true);

  useEffect(() => {
    let active = true;

    void loadSettings()
      .then((loadedSettings) => {
        if (active) {
          setSettings(loadedSettings);
        }
      })
      .catch(() => {
        if (active) {
          setSettings(null);
        }
      });

    return () => {
      active = false;
    };
  }, [loadSettings]);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
      speech.cancel();
    };
  }, [speech]);

  const currentKana = basicHiragana[questionIndex];
  const options = useMemo(() => getOptions(questionIndex), [questionIndex]);
  const audioEnabled = settings?.audioEnabled ?? true;
  const speechReady = audioEnabled && speech.supported;
  const answerStatus = selectedId
    ? selectedId === currentKana.id
      ? 'correct'
      : 'incorrect'
    : null;

  const speakCurrentKana = useCallback(() => {
    if (!speechReady || isSpeaking) {
      return;
    }

    setSpeechError(null);
    setIsSpeaking(true);
    void speech
      .speak({ language: 'ja-JP', rate: 0.8, text: currentKana.glyph })
      .catch(() => {
        if (isMounted.current) {
          setSpeechError('这次朗读没有完成。可以重试，或继续用文字练习。');
        }
      })
      .finally(() => {
        if (isMounted.current) {
          setIsSpeaking(false);
        }
      });
  }, [currentKana.glyph, isSpeaking, speech, speechReady]);

  const resetQuestion = useCallback(() => {
    speech.cancel();
    setIsSpeaking(false);
    setSelectedId(null);
    setSpeechError(null);
  }, [speech]);

  const changeMode = (nextMode: PracticeMode) => {
    if (nextMode === 'listening' && !speechReady) {
      return;
    }

    resetQuestion();
    setMode(nextMode);
    setQuestionIndex(0);
  };

  const chooseAnswer = (id: string) => {
    if (selectedId) {
      return;
    }

    setSelectedId(id);
  };

  const goToNextQuestion = () => {
    resetQuestion();
    setQuestionIndex((index) => (index + 1) % basicHiragana.length);
  };

  if (settings === undefined) {
    return (
      <main className="kana-practice kana-practice--loading">
        <p role="status">正在准备假名练习…</p>
      </main>
    );
  }

  const speechNotice = !audioEnabled
    ? '声音偏好已关闭。你仍可以继续辨认练习；需要朗读时可在设置中打开声音。'
    : !speech.supported
      ? '当前浏览器暂不支持语音朗读。文字辨认仍可继续。'
      : null;

  return (
    <main className="kana-practice">
      <section aria-labelledby="kana-practice-title" className="kana-practice__content">
        <header className="kana-practice__header">
          <Link className="kana-practice__back" to="/today">
            返回今日学习
          </Link>
          <p className="kana-practice__eyebrow">日语 · 基础假名</p>
          <h1 id="kana-practice-title">平假名，从两行开始</h1>
          <p className="kana-practice__lead">
            先熟悉あ行和か行。练习只在当前页面进行，不会修改你的学习记录。
          </p>
        </header>

        <div className="kana-practice__sections">
          <Card className="kana-practice__inventory">
            <div className="kana-practice__card-heading">
              <div>
                <p className="kana-practice__label">本轮内容</p>
                <h2>10 个基础平假名</h2>
              </div>
              <span className="kana-practice__count">あ行 · か行</span>
            </div>
            <ul aria-label="基础平假名列表" className="kana-practice__syllables">
              {basicHiragana.map((kana) => (
                <li key={kana.id}>
                  <article>
                    <span className="kana-practice__glyph" lang="ja">
                      {kana.glyph}
                    </span>
                    <span className="kana-practice__romanization">{kana.romanization}</span>
                    <span className="kana-practice__row">{kana.row}</span>
                  </article>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="kana-practice__drill">
            <div className="kana-practice__card-heading">
              <div>
                <p className="kana-practice__label">短练习</p>
                <h2>{modeLabel(mode)}练习</h2>
              </div>
              <span className="kana-practice__question-count">
                第 {questionIndex + 1} / {basicHiragana.length} 题
              </span>
            </div>
            <div aria-label="选择练习模式" className="kana-practice__mode-switch" role="group">
              <Button
                aria-pressed={mode === 'recognition'}
                onClick={() => changeMode('recognition')}
                variant={mode === 'recognition' ? 'primary' : 'secondary'}
              >
                辨认
              </Button>
              <Button
                aria-pressed={mode === 'listening'}
                disabled={!speechReady}
                onClick={() => changeMode('listening')}
                variant={mode === 'listening' ? 'primary' : 'secondary'}
              >
                听辨
              </Button>
            </div>

            {speechNotice && (
              <p className="kana-practice__notice" role="status">
                {speechNotice} {!audioEnabled && <Link to="/settings">打开设置</Link>}
              </p>
            )}

            <Progress
              detail={`${questionIndex + 1} / ${basicHiragana.length}`}
              kind="question"
              label="假名练习进度"
              max={basicHiragana.length}
              value={questionIndex + 1}
            />

            <div className="kana-practice__prompt">
              <p className="kana-practice__prompt-label">
                {mode === 'recognition' ? '看到罗马字，选择对应假名' : '先听读音，再选择对应假名'}
              </p>
              <h3>{mode === 'recognition' ? currentKana.romanization : '听音选择假名'}</h3>
              {mode === 'listening' && speechReady && (
                <AudioControl
                  label={`播放 ${currentKana.glyph} 的读音`}
                  onToggle={speakCurrentKana}
                  status={isSpeaking ? 'loading' : 'idle'}
                />
              )}
            </div>

            {speechError && (
              <p className="kana-practice__error" role="alert">
                {speechError}
              </p>
            )}

            <div aria-label="假名候选" className="kana-practice__options" role="group">
              {options.map((option) => {
                const isCorrect = selectedId !== null && option.id === currentKana.id;
                const isIncorrect = selectedId === option.id && option.id !== currentKana.id;
                const className = [
                  'kana-practice__option',
                  isCorrect && 'kana-practice__option--correct',
                  isIncorrect && 'kana-practice__option--incorrect',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <Button
                    className={className}
                    disabled={selectedId !== null}
                    key={option.id}
                    onClick={() => chooseAnswer(option.id)}
                    variant="secondary"
                  >
                    <span className="kana-practice__option-glyph" lang="ja">
                      {option.glyph}
                    </span>
                    <span>{option.romanization}</span>
                  </Button>
                );
              })}
            </div>

            {answerStatus && (
              <div
                aria-live="polite"
                className={`kana-practice__feedback kana-practice__feedback--${answerStatus}`}
              >
                <p>
                  {answerStatus === 'correct'
                    ? `答对了：${currentKana.glyph} 是 ${currentKana.romanization}。`
                    : `再看一下：正确答案是 ${currentKana.glyph}（${currentKana.romanization}）。`}
                </p>
                <Button onClick={goToNextQuestion}>
                  {questionIndex === basicHiragana.length - 1 ? '再练一轮' : '下一题'}
                </Button>
              </div>
            )}
          </Card>
        </div>

        <nav aria-label="假名练习相关入口" className="kana-practice__links">
          <Link className="kana-practice__secondary-link" to="/content">
            浏览内容
          </Link>
          <Link className="kana-practice__secondary-link" to="/settings">
            设置与数据
          </Link>
          <Link className="kana-practice__secondary-link" to="/onboarding">
            调整学习目标
          </Link>
        </nav>
      </section>
    </main>
  );
}
