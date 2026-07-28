import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import type { LegacyV1DataStatus } from '../../application/settings';
import type { Language, LearnerSettings } from '../../schemas/v1';
import { Card } from '../../ui/components';
import './settings-data.css';

export interface SettingsDataPageProps {
  detectLegacyData: () => Promise<LegacyV1DataStatus>;
  loadSettings: () => Promise<LearnerSettings | null>;
}

const focusLabels: Record<LearnerSettings['focus'], string> = {
  balanced: '均衡推进',
  review: '巩固复习',
  'new-content': '接触新内容',
  foundations: '基础训练',
};

const legacyStatusCopy: Record<
  LegacyV1DataStatus,
  { description: string; label: string; tone: 'info' | 'neutral' | 'warning' }
> = {
  detected: {
    label: '检测到旧版本地来源',
    description: '旧版数据保持原样。你可以进入迁移预检，先看报告，再决定是否创建隔离暂存。',
    tone: 'warning',
  },
  'not-detected': {
    label: '没有检测到旧版本地来源',
    description: '当前设备没有发现可识别的 v1 来源；这不会影响你继续使用 v2。',
    tone: 'neutral',
  },
  unavailable: {
    label: '旧版来源暂时无法检测',
    description: '检测没有完成，但没有阻止其他设置。之后可以再次打开本页重试。',
    tone: 'info',
  },
};

function languageLabel(language: Language): string {
  return language === 'ja' ? '日语' : '英语';
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '时间未知';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function SettingsDataPage({ detectLegacyData, loadSettings }: SettingsDataPageProps) {
  const [settings, setSettings] = useState<LearnerSettings | null>(null);
  const [legacyStatus, setLegacyStatus] = useState<LegacyV1DataStatus | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void Promise.all([
      loadSettings().catch(() => {
        if (active) {
          setLoadError('暂时无法读取本地设置；你仍可以进入首次设置重新保存。');
        }
        return null;
      }),
      detectLegacyData().catch(() => 'unavailable' as const),
    ]).then(([loadedSettings, detectedLegacyStatus]) => {
      if (!active) {
        return;
      }

      setSettings(loadedSettings);
      setLegacyStatus(detectedLegacyStatus);
      setIsReady(true);
    });

    return () => {
      active = false;
    };
  }, [detectLegacyData, loadSettings]);

  if (!isReady) {
    return (
      <main className="settings-data settings-data--loading">
        <p role="status">正在读取设置与数据状态…</p>
      </main>
    );
  }

  const legacyCopy = legacyStatus ? legacyStatusCopy[legacyStatus] : null;

  return (
    <main className="settings-data">
      <section aria-labelledby="settings-data-title" className="settings-data__content">
        <header className="settings-data__header">
          <Link className="settings-data__back" to="/today">
            返回今日学习
          </Link>
          <p className="settings-data__eyebrow">我的 · 设置与数据</p>
          <h1 id="settings-data-title">把学习目标和数据边界放在手边</h1>
          <p className="settings-data__lead">
            这里展示的是保存在本机的 v2 设置。迁移会先经过只读报告，不会悄悄改写旧数据。
          </p>
        </header>

        {loadError && (
          <p className="settings-data__notice settings-data__notice--error" role="alert">
            {loadError}
          </p>
        )}

        <div className="settings-data__sections">
          <Card className="settings-data__card">
            <div className="settings-data__card-heading">
              <p className="settings-data__label">学习目标</p>
              <h2>{settings ? '当前目标' : '还没有完成首次设置'}</h2>
            </div>
            {settings ? (
              <>
                <dl className="settings-data__facts">
                  <div>
                    <dt>学习语言</dt>
                    <dd lang={settings.language}>{languageLabel(settings.language)}</dd>
                  </div>
                  <div>
                    <dt>每日时长</dt>
                    <dd>{settings.dailyMinutes} 分钟</dd>
                  </div>
                  <div>
                    <dt>学习重点</dt>
                    <dd>{focusLabels[settings.focus]}</dd>
                  </div>
                  <div>
                    <dt>声音偏好</dt>
                    <dd>{settings.audioEnabled ? '保留声音' : '暂不使用声音'}</dd>
                  </div>
                </dl>
                <p className="settings-data__meta">
                  最近保存：{formatUpdatedAt(settings.updatedAt)}
                </p>
                <Link
                  className="settings-data__action settings-data__action--primary"
                  to="/onboarding"
                >
                  调整学习目标
                </Link>
              </>
            ) : (
              <>
                <p className="settings-data__description">
                  先完成语言、时长、学习重点和声音偏好，今日课程才能按你的目标开始。
                </p>
                <Link
                  className="settings-data__action settings-data__action--primary"
                  to="/onboarding"
                >
                  进入首次设置
                </Link>
              </>
            )}
          </Card>

          <Card className="settings-data__card">
            <div className="settings-data__card-heading">
              <p className="settings-data__label">数据与迁移</p>
              <h2>先看清楚，再决定是否迁移</h2>
            </div>
            {legacyCopy && (
              <div
                aria-live="polite"
                className={`settings-data__status settings-data__status--${legacyCopy.tone}`}
                role="status"
              >
                <strong>{legacyCopy.label}</strong>
                <p>{legacyCopy.description}</p>
              </div>
            )}
            <p className="settings-data__description">
              v1 预检、隔离暂存、验证和激活是分开的步骤。当前页面只提供入口，不会替你执行迁移。
            </p>
            <div className="settings-data__actions">
              <Link className="settings-data__action" to="/migration-preview">
                检查旧版备份
              </Link>
              <Link className="settings-data__action" to="/today">
                返回今日学习
              </Link>
            </div>
          </Card>

          <Card className="settings-data__card">
            <div className="settings-data__card-heading">
              <p className="settings-data__label">本地安全</p>
              <h2>你的学习记录留在这台设备</h2>
            </div>
            <ul className="settings-data__list">
              <li>当前版本不需要账号；设置和学习记录通过本地应用存储读取。</li>
              <li>旧版 API Key 不会写入迁移报告或新设置；需要时必须由你重新输入。</li>
              <li>数据清除、备份恢复和迁移激活都需要独立的明确操作。</li>
            </ul>
          </Card>
        </div>
      </section>
    </main>
  );
}
