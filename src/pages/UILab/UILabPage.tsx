import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { AIBubble, type AIBubbleState } from '../../ui/components/ai';
import { AudioControl, type AudioControlStatus } from '../../ui/components/audio';
import { Button, Card, IconButton, Progress } from '../../ui/components';
import { DarkIcon, LightIcon } from '../../ui/components/icons';
import {
  ChoiceAnswer,
  Feedback,
  QuestionFrame,
  TextAnswer,
  type ChoiceOption,
  type TextAnswerStatus,
} from '../../ui/components/learning';
import { useTheme } from '../../ui/theme';
import './ui-lab.css';

const choiceOptions: readonly ChoiceOption[] = [
  { id: 'clock', label: '钟表' },
  { id: 'phone', label: '电话' },
  { id: 'window', label: '窗户' },
];

const colorTokens = [
  { className: 'is-canvas', label: '画布' },
  { className: 'is-paper', label: '内容纸面' },
  { className: 'is-brand', label: '琉璃蓝' },
  { className: 'is-ai', label: 'AI 鸢尾紫' },
  { className: 'is-success', label: '成功' },
  { className: 'is-error', label: '错误' },
] as const;

function LabSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="ui-lab__section">
      <header>
        <h2 className="zr-type-title-2">{title}</h2>
        <p>{description}</p>
      </header>
      {children}
    </section>
  );
}

export function UILabPage() {
  const { theme, toggleTheme } = useTheme();
  const [choiceValue, setChoiceValue] = useState<string | null>(null);
  const [textValue, setTextValue] = useState('');
  const [textStatus] = useState<TextAnswerStatus>('idle');
  const [formNotice, setFormNotice] = useState('');
  const [audioStatus, setAudioStatus] = useState<AudioControlStatus>('idle');
  const [aiState, setAiState] = useState<AIBubbleState>('suggestion');
  const [aiMessage, setAiMessage] = useState('需要提示吗？你可以先查看一个不直接泄露答案的线索。');

  return (
    <main className="ui-lab">
      <header className="ui-lab__hero">
        <div>
          <p className="ui-lab__eyebrow">PHASE 0 · INTERNAL</p>
          <h1 className="zr-type-display">钟日 v2 UI Lab</h1>
          <p>用于验证 Token、组件状态、暗色模式、触控、无障碍与目的性动效。</p>
        </div>
        <div className="ui-lab__hero-actions">
          <Button onClick={toggleTheme} variant="secondary">
            切换为{theme === 'light' ? '暗色' : '日间'}模式
          </Button>
          <Link className="ui-lab__back-link" to="/">
            返回初始化页
          </Link>
        </div>
      </header>

      <LabSection
        description="语义颜色随 Theme Provider 切换；内容层保持实色，玻璃只用于浮动交互。"
        title="Design Token"
      >
        <div className="ui-lab__swatches" role="list">
          {colorTokens.map((token) => (
            <div className="ui-lab__swatch" key={token.label} role="listitem">
              <span aria-hidden="true" className={token.className} />
              <span>{token.label}</span>
            </div>
          ))}
        </div>
        <Card className="ui-lab__type-samples">
          <p className="zr-type-title-1">标题：今天专注一件事</p>
          <p className="zr-type-body">正文：清晰说明当前状态与下一步操作。</p>
          <p className="zr-type-word" lang="ja">
            時計
          </p>
          <p className="zr-type-word" lang="en">
            language
          </p>
          <p className="zr-type-ipa">/ˈlæŋɡwɪdʒ/</p>
          <p className="zr-type-numeric">03 / 08 · 12 min</p>
        </Card>
      </LabSection>

      <LabSection
        description="48px 舒适触控目标；状态同时使用文字、图标、边界与色面表达。"
        title="基础组件"
      >
        <Card className="ui-lab__component-stack">
          <div className="ui-lab__button-grid">
            <Button>默认</Button>
            <Button state="pressed">按下</Button>
            <Button state="loading">加载中</Button>
            <Button state="success">已完成</Button>
            <Button state="error">请重试</Button>
            <Button state="disabled">暂不可用</Button>
            <Button variant="secondary">次要操作</Button>
            <Button variant="tertiary">稍后</Button>
            <Button variant="ai">查看提示</Button>
          </div>
          <div className="ui-lab__icon-row">
            <IconButton icon={<LightIcon />} label="日间模式图标示例" />
            <IconButton icon={<DarkIcon />} label="暗色模式图标示例" pressed />
            <IconButton disabled icon={<LightIcon />} label="禁用图标按钮示例" />
          </div>
        </Card>
      </LabSection>

      <LabSection
        description="QuestionFrame 只组合题目、答案、音频与反馈插槽，不负责判题。"
        title="学习核心组件"
      >
        <QuestionFrame
          answer={
            <ChoiceAnswer
              label="请选择「時計」的中文释义"
              onChange={setChoiceValue}
              options={choiceOptions}
              value={choiceValue}
            />
          }
          current={3}
          feedback={
            choiceValue ? (
              <Feedback title="已记录选择" tone="hint">
                UI Lab 只展示选择状态，当前不会判题或写入学习数据。
              </Feedback>
            ) : undefined
          }
          prompt={
            <>
              <p className="ui-lab__question-instruction">请选择正确的中文释义</p>
              <p className="zr-type-word" lang="ja">
                時計
              </p>
            </>
          }
          total={8}
          typeLabel="选择题组件示例"
        />

        <div className="ui-lab__state-grid">
          <Card>
            <h3 className="zr-type-title-3">答对状态</h3>
            <ChoiceAnswer
              correctOptionId="clock"
              label="答对状态示例"
              onChange={() => undefined}
              options={choiceOptions}
              status="correct"
              value="clock"
            />
          </Card>
          <Card>
            <h3 className="zr-type-title-3">答错状态</h3>
            <ChoiceAnswer
              correctOptionId="clock"
              label="答错状态示例"
              onChange={() => undefined}
              options={choiceOptions}
              status="incorrect"
              value="phone"
            />
          </Card>
        </div>

        <Card className="ui-lab__text-example">
          <h3 className="zr-type-title-3">TextAnswer</h3>
          <TextAnswer
            label="输入示例答案"
            onChange={setTextValue}
            onSubmit={() => setFormNotice('已收到提交操作；UI Lab 不执行判题。')}
            placeholder="请输入英文单词"
            status={textStatus}
            value={textValue}
          />
          {formNotice && (
            <Feedback title="提交反馈" tone="hint">
              {formNotice}
            </Feedback>
          )}
          <TextAnswer
            errorMessage="请保留刚才的输入，再检查拼写。"
            label="错误状态示例"
            onChange={() => undefined}
            onSubmit={() => undefined}
            status="error"
            value="clok"
          />
        </Card>

        <div className="ui-lab__state-grid">
          <Feedback title="正确" tone="success">
            回答已确认，可以带着这个记忆继续。
          </Feedback>
          <Feedback title="先看区别" tone="error">
            保留你的原始答案，并在这里解释差异与恢复方法。
          </Feedback>
          <Feedback title="提示" tone="hint">
            提示提供方向，但不直接泄露答案。
          </Feedback>
        </div>
      </LabSection>

      <LabSection
        description="只展示上下文辅助，不形成聊天消息流；动作最多两个且不会遮挡题目。"
        title="AI Bubble"
      >
        <div className="ui-lab__state-grid">
          <AIBubble message="需要时，可以从这里请求一个提示。" state="idle" />
          <AIBubble message="" reason="用户请求了提示" state="thinking" />
          <AIBubble
            actions={[
              {
                id: 'show-hint',
                label: '查看提示',
                onSelect: () => {
                  setAiState('success');
                  setAiMessage('提示已展开：先关注这个词表示的物品类别。');
                },
              },
              {
                id: 'keep-thinking',
                label: '我再想想',
                onSelect: () => {
                  setAiState('idle');
                  setAiMessage('好的，提示会保持安静，不会打断你。');
                },
                variant: 'tertiary',
              },
            ]}
            message={aiMessage}
            reason="UI Lab 交互示例"
            state={aiState}
          />
          <AIBubble message="提示已经准备好，你可以继续作答。" state="success" />
        </div>
      </LabSection>

      <LabSection
        description="音频仅使用 mock 状态，不播放真实声音；进度用于解释学习状态，不构成游戏经济。"
        title="音频与进度"
      >
        <div className="ui-lab__state-grid">
          <AudioControl
            label="交互式音频状态"
            onToggle={() =>
              setAudioStatus((current) => (current === 'playing' ? 'paused' : 'playing'))
            }
            status={audioStatus}
          />
          <AudioControl label="加载状态" status="loading" />
          <AudioControl label="播放状态" status="playing" />
          <AudioControl label="暂停状态" status="paused" />
        </div>
        <Card className="ui-lab__progress-grid">
          <Progress detail="3 / 5" kind="today" label="今日进度" max={5} value={3} />
          <Progress detail="3 / 8" kind="question" label="题目进度" max={8} value={3} />
          <Progress detail="约 8 分钟" kind="time" label="学习时间示例" max={15} value={8} />
        </Card>
      </LabSection>
    </main>
  );
}
