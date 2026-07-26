import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { LearnerSettings } from '../../schemas/v1';
import { Button, Card } from '../../ui/components';
import './launch.css';

export interface LaunchPageProps {
  loadSettings: () => Promise<LearnerSettings | null>;
}

export function LaunchPage({ loadSettings }: LaunchPageProps) {
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    void loadSettings()
      .then((settings) => {
        if (!active) {
          return;
        }
        void navigate(settings?.setupCompleted ? '/today' : '/onboarding', { replace: true });
      })
      .catch(() => {
        if (active) {
          setError(true);
        }
      });

    return () => {
      active = false;
    };
  }, [loadSettings, navigate]);

  if (error) {
    return (
      <main className="launch">
        <Card className="launch__card">
          <p className="launch__eyebrow">钟日 v2</p>
          <h1>暂时无法读取本地设置</h1>
          <p role="alert">你的学习数据没有被修改。可以重试，或直接进入首次设置。</p>
          <div className="launch__actions">
            <Button onClick={() => window.location.reload()} variant="secondary">
              重新读取
            </Button>
            <Button onClick={() => navigate('/onboarding', { replace: true })}>进入首次设置</Button>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="launch" aria-live="polite">
      <p role="status">正在准备你的学习空间…</p>
    </main>
  );
}
