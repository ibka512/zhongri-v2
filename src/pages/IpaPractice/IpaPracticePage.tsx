import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { selectEnglishIpaStarterWords } from '../../content';
import type { CanonicalContentRepositoryPort } from '../../ports';
import type { CanonicalWord, LearnerSettings } from '../../schemas/v1';
import { Button, Card, Progress } from '../../ui/components';
import './ipa-practice.css';

export interface IpaPracticePageProps {
  loadContent: () => Promise<CanonicalContentRepositoryPort>;
  loadSettings: () => Promise<LearnerSettings | null>;
}

type PracticeMode = 'ipa-to-word' | 'word-to-ipa';

type PageState =
  | { status: 'loading' }
  | {
      settings: LearnerSettings | null;
      status: 'ready';
      words: readonly CanonicalWord[];
    }
  | { error: string; status: 'error' };

const emptyWords: readonly CanonicalWord[] = [];

function getOptions(
  words: readonly CanonicalWord[],
  currentIndex: number,
): readonly CanonicalWord[] {
  const offsets = [0, 2, 4, 6];

  return offsets.map((offset) => words[(currentIndex + offset) % words.length]);
}

function modeLabel(mode: PracticeMode): string {
  return mode === 'ipa-to-word' ? '看音标选词形' : '看词形选音标';
}

export function IpaPracticePage({ loadContent, loadSettings }: IpaPracticePageProps) {
  const [pageState, setPageState] = useState<PageState>({ status: 'loading' });
  const [mode, setMode] = useState<PracticeMode>('ipa-to-word');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchPage = useCallback(() => {
    void Promise.all([loadContent(), loadSettings().catch(() => null)])
      .then(([repository, settings]) => {
        setPageState({
          settings,
          status: 'ready',
          words: selectEnglishIpaStarterWords(repository.listByLanguage('en')),
        });
      })
      .catch(() => {
        setPageState({
          error: '英语音标内容暂时无法打开。现有学习记录没有被修改，请稍后重试。',
          status: 'error',
        });
      });
  }, [loadContent, loadSettings]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  const words = pageState.status === 'ready' ? pageState.words : emptyWords;
  const currentWord = words[questionIndex] ?? null;
  const options = useMemo(
    () => (words.length > 0 ? getOptions(words, questionIndex) : []),
    [questionIndex, words],
  );
  const answerStatus = selectedId
    ? selectedId === currentWord?.id
      ? 'correct'
      : 'incorrect'
    : null;

  const chooseAnswer = (id: string) => {
    if (selectedId) {
      return;
    }

    setSelectedId(id);
  };

  const changeMode = (nextMode: PracticeMode) => {
    setMode(nextMode);
    setQuestionIndex(0);
    setSelectedId(null);
  };

  const goToNextQuestion = () => {
    if (words.length === 0) {
      return;
    }

    setQuestionIndex((index) => (index + 1) % words.length);
    setSelectedId(null);
  };

  if (pageState.status === 'loading') {
    return (
      <main className="ipa-practice ipa-practice--loading">
        <p role="status">正在准备英语音标…</p>
      </main>
    );
  }

  if (pageState.status === 'error') {
    return (
      <main className="ipa-practice">
        <Card className="ipa-practice__message">
          <p className="ipa-practice__eyebrow">钟日 · 英语音标</p>
          <h1>英语音标暂时不可用</h1>
          <p role="alert">{pageState.error}</p>
          <div className="ipa-practice__message-actions">
            <Button onClick={fetchPage} variant="secondary">
              重新加载英语音标
            </Button>
            <Link className="ipa-practice__secondary-link" to="/today">
              返回今日学习
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  if (!currentWord) {
    return null;
  }

  const learnerNotice = pageState.settings
    ? pageState.settings.language === 'en'
      ? null
      : '当前学习语言是日语；这里是英语音标入口，你可以先浏览或练习。'
    : '还没有保存学习语言；这里先展示英语音标，你可以进入首次设置调整目标。';

  return (
    <main className="ipa-practice">
      <section aria-labelledby="ipa-practice-title" className="ipa-practice__content">
        <header className="ipa-practice__header">
          <Link className="ipa-practice__back" to="/today">
            返回今日学习
          </Link>
          <p className="ipa-practice__eyebrow">英语 · 发音文字</p>
          <h1 id="ipa-practice-title">英语音标，从词形到读音</h1>
          <p className="ipa-practice__lead">
            先看清真实词条里的 IPA，再做一组短练习。内容随应用离线发布，练习不会修改学习记录。
          </p>
        </header>

        <div className="ipa-practice__sections">
          <Card className="ipa-practice__inventory">
            <div className="ipa-practice__card-heading">
              <div>
                <p className="ipa-practice__label">本轮内容</p>
                <h2>10 个英语词条</h2>
              </div>
              <span className="ipa-practice__count">canonical · CET-4</span>
            </div>
            {learnerNotice && (
              <p className="ipa-practice__notice" role="status">
                {learnerNotice} <Link to="/onboarding">进入首次设置</Link>
              </p>
            )}
            <ul aria-label="英语音标词条" className="ipa-practice__words">
              {words.map((word) => (
                <li key={word.id}>
                  <article>
                    <div className="ipa-practice__word-heading">
                      <h3 lang="en">{word.headword}</h3>
                      <span>{word.level}</span>
                    </div>
                    <p className="ipa-practice__phonetic" lang="en">
                      {word.phonetic}
                    </p>
                    <p className="ipa-practice__meaning">{word.meaning}</p>
                  </article>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="ipa-practice__drill">
            <div className="ipa-practice__card-heading">
              <div>
                <p className="ipa-practice__label">短练习</p>
                <h2>{modeLabel(mode)}</h2>
              </div>
              <span className="ipa-practice__question-count">
                第 {questionIndex + 1} / {words.length} 题
              </span>
            </div>
            <div aria-label="选择音标练习模式" className="ipa-practice__mode-switch" role="group">
              <Button
                aria-pressed={mode === 'ipa-to-word'}
                onClick={() => changeMode('ipa-to-word')}
                variant={mode === 'ipa-to-word' ? 'primary' : 'secondary'}
              >
                看音标选词形
              </Button>
              <Button
                aria-pressed={mode === 'word-to-ipa'}
                onClick={() => changeMode('word-to-ipa')}
                variant={mode === 'word-to-ipa' ? 'primary' : 'secondary'}
              >
                看词形选音标
              </Button>
            </div>

            <Progress
              detail={`${questionIndex + 1} / ${words.length}`}
              kind="question"
              label="英语音标练习进度"
              max={words.length}
              value={questionIndex + 1}
            />

            <div className="ipa-practice__prompt">
              <p className="ipa-practice__prompt-label">
                {mode === 'ipa-to-word'
                  ? '看到音标，选择对应英文词形'
                  : '看到英文词形，选择对应音标'}
              </p>
              <h3 lang="en">
                {mode === 'ipa-to-word' ? currentWord.phonetic : currentWord.headword}
              </h3>
            </div>

            <div aria-label="英语音标候选" className="ipa-practice__options" role="group">
              {options.map((option) => {
                const isCorrect = selectedId !== null && option.id === currentWord.id;
                const isIncorrect = selectedId === option.id && option.id !== currentWord.id;
                const className = [
                  'ipa-practice__option',
                  isCorrect && 'ipa-practice__option--correct',
                  isIncorrect && 'ipa-practice__option--incorrect',
                ]
                  .filter(Boolean)
                  .join(' ');
                const label = mode === 'ipa-to-word' ? option.headword : option.phonetic;

                return (
                  <Button
                    className={className}
                    disabled={selectedId !== null}
                    key={option.id}
                    onClick={() => chooseAnswer(option.id)}
                    variant="secondary"
                  >
                    <span lang="en">{label}</span>
                  </Button>
                );
              })}
            </div>

            {answerStatus && (
              <div
                aria-live="polite"
                className={`ipa-practice__feedback ipa-practice__feedback--${answerStatus}`}
              >
                <p>
                  {answerStatus === 'correct'
                    ? '答对了，这个词形和音标匹配。'
                    : `再看一下：正确答案是 ${currentWord.headword}（${currentWord.phonetic}）。`}
                </p>
                <Button onClick={goToNextQuestion}>
                  {questionIndex === words.length - 1 ? '再练一轮' : '下一题'}
                </Button>
              </div>
            )}
          </Card>
        </div>

        <nav aria-label="英语音标相关入口" className="ipa-practice__links">
          <Link className="ipa-practice__secondary-link" to="/content">
            浏览当前内容
          </Link>
          <Link className="ipa-practice__secondary-link" to="/kana">
            练习五十音
          </Link>
          <Link className="ipa-practice__secondary-link" to="/settings">
            设置与数据
          </Link>
        </nav>
      </section>
    </main>
  );
}
