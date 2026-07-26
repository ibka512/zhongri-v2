import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import type { LegacyV1DataStatus, SaveLearnerSettingsInput } from '../../application/settings';
import type {
  Language,
  LearnerSettings,
  LearnerSettingsDailyMinutes,
  LearnerSettingsFocus,
} from '../../schemas/v1';
import { Button, Card } from '../../ui/components';
import './onboarding.css';

export interface OnboardingPageProps {
  detectLegacyData: () => Promise<LegacyV1DataStatus>;
  loadSettings: () => Promise<LearnerSettings | null>;
  saveSettings: (input: SaveLearnerSettingsInput) => Promise<LearnerSettings>;
}

type OnboardingStep = 1 | 2;

const focusOptions: readonly {
  description: string;
  label: string;
  value: LearnerSettingsFocus;
}[] = [
  { value: 'balanced', label: '均衡推进', description: '复习和新内容保持平衡。' },
  { value: 'review', label: '巩固复习', description: '优先处理该再见的内容。' },
  { value: 'new-content', label: '接触新内容', description: '每天留出空间认识新词。' },
  { value: 'foundations', label: '基础训练', description: '先稳住假名、音标和基础词。' },
];

const durationOptions: readonly {
  label: string;
  value: LearnerSettingsDailyMinutes;
}[] = [
  { value: 5, label: '5 分钟' },
  { value: 10, label: '10 分钟' },
  { value: 15, label: '15 分钟' },
];

function languageLabel(language: Language): string {
  return language === 'ja' ? '日语' : '英语';
}

export function OnboardingPage({
  detectLegacyData,
  loadSettings,
  saveSettings,
}: OnboardingPageProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<OnboardingStep>(1);
  const [language, setLanguage] = useState<Language>('ja');
  const [dailyMinutes, setDailyMinutes] = useState<LearnerSettingsDailyMinutes>(5);
  const [focus, setFocus] = useState<LearnerSettingsFocus>('balanced');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [existingSettings, setExistingSettings] = useState<LearnerSettings | null>(null);
  const [legacyStatus, setLegacyStatus] = useState<LegacyV1DataStatus | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void Promise.all([
      loadSettings().catch(() => {
        if (active) {
          setLoadError('暂时无法读取已有设置；你可以先用当前选择继续。');
        }
        return null;
      }),
      detectLegacyData().catch(() => 'unavailable' as const),
    ]).then(([settings, detectedLegacyStatus]) => {
      if (!active) {
        return;
      }

      if (settings) {
        setExistingSettings(settings);
        setLanguage(settings.language);
        setDailyMinutes(settings.dailyMinutes);
        setFocus(settings.focus);
        setAudioEnabled(settings.audioEnabled);
      }
      setLegacyStatus(detectedLegacyStatus);
      setIsReady(true);
    });

    return () => {
      active = false;
    };
  }, [detectLegacyData, loadSettings]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError(null);

    if (step === 1) {
      setStep(2);
      return;
    }

    const input: SaveLearnerSettingsInput = {
      audioEnabled,
      dailyMinutes,
      focus,
      language,
    };
    setIsSaving(true);
    void saveSettings(input)
      .then(() => {
        void navigate('/today', { replace: true });
      })
      .catch(() => {
        setSaveError('设置保存失败，刚才的选择仍然保留。请重试。');
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  if (!isReady) {
    return (
      <main className="onboarding onboarding--loading">
        <p role="status">正在读取本地学习设置…</p>
      </main>
    );
  }

  const hasLegacyData = legacyStatus === 'detected';
  const hasDetectionIssue = legacyStatus === 'unavailable';
  const isEditing = existingSettings !== null;

  return (
    <main className="onboarding">
      <section aria-labelledby="onboarding-title" className="onboarding__content">
        <header className="onboarding__header">
          <div>
            <p className="onboarding__eyebrow">钟日 v2 · {isEditing ? '调整目标' : '首次设置'}</p>
            <h1 id="onboarding-title">
              {step === 1 ? '先选一门，今天就能开始' : '给每天留一小段稳定时间'}
            </h1>
            <p className="onboarding__lead">
              钟日会根据你的真实学习记录安排下一次复习。这里的选择随时可以修改，不需要注册账号。
            </p>
          </div>
          {isEditing && (
            <Link className="onboarding__back-link" to="/today">
              返回今日学习
            </Link>
          )}
        </header>

        <ol aria-label="首次设置进度" className="onboarding__progress">
          {[1, 2].map((item) => (
            <li aria-current={step === item ? 'step' : undefined} key={item}>
              <span aria-hidden="true">{item}</span>
              <span>{item === 1 ? '学习语言' : '学习节奏'}</span>
            </li>
          ))}
        </ol>

        {loadError && <p className="onboarding__notice onboarding__notice--info">{loadError}</p>}

        <form className="onboarding__form" onSubmit={submit}>
          {step === 1 ? (
            <Card className="onboarding__card">
              <fieldset>
                <legend>你今天想学什么？</legend>
                <p className="onboarding__helper">先选一个主要语言，之后可以在设置里切换。</p>
                <div className="onboarding__choice-grid onboarding__choice-grid--languages">
                  <label className="onboarding__choice">
                    <input
                      aria-label="日本語 / 日语"
                      checked={language === 'ja'}
                      name="language"
                      onChange={() => setLanguage('ja')}
                      type="radio"
                      value="ja"
                    />
                    <span className="onboarding__choice-body">
                      <strong lang="ja">日本語</strong>
                      <span>日语</span>
                      <small>从真实词条和假名基础开始</small>
                    </span>
                  </label>
                  <label className="onboarding__choice">
                    <input
                      aria-label="English / 英语"
                      checked={language === 'en'}
                      name="language"
                      onChange={() => setLanguage('en')}
                      type="radio"
                      value="en"
                    />
                    <span className="onboarding__choice-body">
                      <strong lang="en">English</strong>
                      <span>英语</span>
                      <small>从单词、拼写和音标基础开始</small>
                    </span>
                  </label>
                </div>
              </fieldset>
            </Card>
          ) : (
            <>
              <Card className="onboarding__card">
                <fieldset>
                  <legend>每天准备学习多久？</legend>
                  <p className="onboarding__helper">这是计划的目标时长，不是倒计时。</p>
                  <div className="onboarding__choice-grid onboarding__choice-grid--durations">
                    {durationOptions.map((option) => (
                      <label
                        className="onboarding__choice onboarding__choice--compact"
                        key={option.value}
                      >
                        <input
                          aria-label={option.label}
                          checked={dailyMinutes === option.value}
                          name="dailyMinutes"
                          onChange={() => setDailyMinutes(option.value)}
                          type="radio"
                          value={option.value}
                        />
                        <span className="onboarding__choice-body">
                          <strong>{option.label}</strong>
                          <small>轻量、可持续</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </Card>

              <Card className="onboarding__card">
                <fieldset>
                  <legend>这段时间更想做什么？</legend>
                  <div className="onboarding__focus-list">
                    {focusOptions.map((option) => (
                      <label className="onboarding__focus-choice" key={option.value}>
                        <input
                          aria-label={option.label}
                          checked={focus === option.value}
                          name="focus"
                          onChange={() => setFocus(option.value)}
                          type="radio"
                          value={option.value}
                        />
                        <span>
                          <strong>{option.label}</strong>
                          <small>{option.description}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="onboarding__audio-toggle">
                  <span>
                    <strong>保留声音偏好</strong>
                    <small>后续音频练习会按这个选择准备播放。</small>
                  </span>
                  <input
                    aria-label="保留声音偏好"
                    checked={audioEnabled}
                    onChange={(event) => setAudioEnabled(event.target.checked)}
                    type="checkbox"
                  />
                </label>
              </Card>

              {hasLegacyData && (
                <aside className="onboarding__notice onboarding__notice--migration">
                  <strong>检测到旧版本地数据</strong>
                  <p>
                    现在只保存你的新目标，不会自动改写旧数据。完成设置后，可以从“检查旧版备份”继续安全迁移。
                  </p>
                </aside>
              )}
              {hasDetectionIssue && (
                <aside className="onboarding__notice onboarding__notice--info">
                  <strong>旧版数据暂时无法检测</strong>
                  <p>这不会阻止你开始学习；之后可在设置与数据页重试检测。</p>
                </aside>
              )}
            </>
          )}

          {saveError && (
            <p className="onboarding__error" role="alert">
              {saveError}
            </p>
          )}

          <div className="onboarding__actions">
            {step === 2 && (
              <Button disabled={isSaving} onClick={() => setStep(1)} variant="tertiary">
                返回上一步
              </Button>
            )}
            <Button
              className="onboarding__primary-action"
              loadingLabel="正在保存设置"
              state={isSaving ? 'loading' : 'default'}
              type="submit"
            >
              {step === 1 ? `继续选择${languageLabel(language)}` : '保存设置并开始学习'}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
