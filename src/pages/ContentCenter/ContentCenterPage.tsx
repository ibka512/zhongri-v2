import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import type { CanonicalContentRepositoryPort } from '../../ports';
import type { CanonicalCorpusManifest, Language, LearnerSettings } from '../../schemas/v1';
import { Card } from '../../ui/components';
import './content-center.css';

const MAX_VISIBLE_RESULTS = 50;

export interface ContentCenterPageProps {
  loadContent: () => Promise<CanonicalContentRepositoryPort>;
  loadSettings: () => Promise<LearnerSettings | null>;
}

type PageState =
  | { status: 'loading' }
  | {
      repository: CanonicalContentRepositoryPort;
      settings: LearnerSettings | null;
      status: 'ready';
    }
  | { error: string; status: 'error' };

function languageLabel(language: Language): string {
  return language === 'ja' ? '日语' : '英语';
}

function languageTag(language: Language): 'ja' | 'en' {
  return language;
}

function isCorpusManifest(
  manifest: ReturnType<CanonicalContentRepositoryPort['getManifest']>,
): manifest is CanonicalCorpusManifest {
  return 'languageCounts' in manifest;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function getLanguageCount(
  manifest: ReturnType<CanonicalContentRepositoryPort['getManifest']>,
  language: Language,
): number {
  if (isCorpusManifest(manifest)) {
    return manifest.languageCounts.find((entry) => entry.language === language)?.wordCount ?? 0;
  }

  return manifest.language === language ? manifest.wordCount : 0;
}

function shortCommit(commitSha: string): string {
  return commitSha.slice(0, 7);
}

export function ContentCenterPage({ loadContent, loadSettings }: ContentCenterPageProps) {
  const [pageState, setPageState] = useState<PageState>({ status: 'loading' });
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('all');

  const fetchPage = useCallback(() => {
    void Promise.all([loadContent(), loadSettings().catch(() => null)])
      .then(([repository, settings]) => {
        setPageState({ repository, settings, status: 'ready' });
      })
      .catch(() => {
        setPageState({
          error: '内容中心暂时无法打开。现有学习记录没有被修改，请稍后重试。',
          status: 'error',
        });
      });
  }, [loadContent, loadSettings]);

  const loadPage = useCallback(() => {
    setPageState({ status: 'loading' });
    fetchPage();
  }, [fetchPage]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  const words = useMemo(() => {
    if (pageState.status !== 'ready') {
      return [];
    }

    const language = pageState.settings?.language ?? 'ja';
    return pageState.repository.listByLanguage(language);
  }, [pageState]);

  const levels = useMemo(
    () =>
      Array.from(new Set(words.map((word) => word.level))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [words],
  );

  const filteredWords = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();

    return words.filter((word) => {
      const matchesLevel = level === 'all' || word.level === level;
      if (!matchesLevel) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [word.headword, word.reading, word.phonetic, word.meaning]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
    });
  }, [level, search, words]);

  if (pageState.status === 'loading') {
    return (
      <main className="content-center content-center--loading">
        <p role="status">正在准备内容中心…</p>
      </main>
    );
  }

  if (pageState.status === 'error') {
    return (
      <main className="content-center">
        <Card className="content-center__message">
          <p className="content-center__eyebrow">钟日 · 内容中心</p>
          <h1>内容暂时不可用</h1>
          <p role="alert">{pageState.error}</p>
          <button className="content-center__retry" onClick={loadPage} type="button">
            重新加载内容
          </button>
          <Link className="content-center__secondary-link" to="/today">
            返回今日学习
          </Link>
        </Card>
      </main>
    );
  }

  const { repository, settings } = pageState;
  const language = settings?.language ?? 'ja';
  const manifest = repository.getManifest();
  const visibleWords = filteredWords.slice(0, MAX_VISIBLE_RESULTS);
  const hiddenResultCount = filteredWords.length - visibleWords.length;
  const hasFilters = search.trim().length > 0 || level !== 'all';

  const clearFilters = () => {
    setSearch('');
    setLevel('all');
  };

  return (
    <main className="content-center">
      <section aria-labelledby="content-center-title" className="content-center__content">
        <header className="content-center__header">
          <Link className="content-center__back" to="/today">
            返回今日学习
          </Link>
          <p className="content-center__eyebrow">学习 · 内容中心</p>
          <h1 id="content-center-title">先看清楚，再开始学习</h1>
          <p className="content-center__lead">
            这里展示当前语言的内置内容。它随应用离线发布，不会修改你的学习记录。
          </p>
        </header>

        <div className="content-center__sections">
          <Card className="content-center__overview">
            <div className="content-center__overview-heading">
              <div>
                <p className="content-center__label">当前内容</p>
                <h2 lang={languageTag(language)}>{languageLabel(language)}词库</h2>
              </div>
              <span className="content-center__language-badge">{language.toUpperCase()}</span>
            </div>
            <dl className="content-center__facts">
              <div>
                <dt>可用词条</dt>
                <dd>{formatNumber(getLanguageCount(manifest, language))}</dd>
              </div>
              <div>
                <dt>内容版本</dt>
                <dd>v{manifest.contentVersion}</dd>
              </div>
              <div>
                <dt>发布来源</dt>
                <dd>{manifest.source.repository}</dd>
              </div>
            </dl>
            <p className="content-center__meta">
              来源提交 <code>{shortCommit(manifest.source.commitSha)}</code> ·{' '}
              {manifest.source.licenseSummary}
            </p>
            {!settings && (
              <p className="content-center__notice" role="status">
                还没有保存学习目标，当前先展示日语内容。你可以进入首次设置切换语言。
              </p>
            )}
          </Card>

          <Card className="content-center__browser">
            <div className="content-center__browser-heading">
              <div>
                <p className="content-center__label">只读浏览</p>
                <h2>查找一个词</h2>
              </div>
              <span className="content-center__result-count" aria-live="polite">
                匹配 {formatNumber(filteredWords.length)} 条
              </span>
            </div>
            <div className="content-center__filters">
              <div className="content-center__field">
                <label htmlFor="content-search">搜索词形、读音或释义</label>
                <input
                  id="content-search"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={language === 'ja' ? '例如：猫、ねこ或动物' : '例如：apple or fruit'}
                  type="search"
                  value={search}
                />
              </div>
              <div className="content-center__field">
                <label htmlFor="content-level">词库等级</label>
                <select
                  id="content-level"
                  onChange={(event) => setLevel(event.target.value)}
                  value={level}
                >
                  <option value="all">全部等级</option>
                  {levels.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {visibleWords.length > 0 ? (
              <ol
                aria-label={`${languageLabel(language)}词条结果`}
                className="content-center__word-list"
              >
                {visibleWords.map((word) => (
                  <li key={word.id}>
                    <article className="content-center__word-card">
                      <div className="content-center__word-heading">
                        <div>
                          <h3 lang={languageTag(language)}>{word.headword}</h3>
                          <p className="content-center__pronunciation" lang={languageTag(language)}>
                            {word.reading ?? word.phonetic ?? '暂无读音'}
                          </p>
                        </div>
                        <span className="content-center__level">{word.level}</span>
                      </div>
                      <p className="content-center__meaning">{word.meaning}</p>
                      <p className="content-center__part-of-speech">{word.partOfSpeech}</p>
                    </article>
                  </li>
                ))}
              </ol>
            ) : (
              <div aria-live="polite" className="content-center__empty">
                <h3>没有找到匹配词条</h3>
                <p>试试换一个词形、读音、释义或等级。</p>
                {hasFilters && (
                  <button className="content-center__clear" onClick={clearFilters} type="button">
                    清除筛选
                  </button>
                )}
              </div>
            )}

            {hiddenResultCount > 0 && (
              <p className="content-center__limit" role="status">
                当前先展示前 {MAX_VISIBLE_RESULTS} 条，仍有 {formatNumber(hiddenResultCount)}{' '}
                条匹配结果。缩小搜索范围即可继续查看。
              </p>
            )}
          </Card>
        </div>

        <nav aria-label="内容中心相关入口" className="content-center__links">
          <Link className="content-center__secondary-link" to="/ipa">
            练习英语音标
          </Link>
          <Link className="content-center__secondary-link" to="/onboarding">
            调整学习目标
          </Link>
          <Link className="content-center__secondary-link" to="/settings">
            设置与数据
          </Link>
        </nav>
      </section>
    </main>
  );
}
