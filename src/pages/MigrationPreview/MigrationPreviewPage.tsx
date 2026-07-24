import { useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';

import {
  MAX_V1_BACKUP_FILE_SIZE_BYTES,
  type PreviewV1BackupInput,
} from '../../application/migration';
import type {
  MigrationPreviewDomain,
  MigrationPreviewReport,
  MigrationPreviewStatus,
} from '../../schemas/v1';
import { Button, Card } from '../../ui/components';
import './migration-preview.css';

export interface MigrationPreviewPageProps {
  previewBackup: (input: PreviewV1BackupInput) => Promise<MigrationPreviewReport>;
  serializeReport: (report: MigrationPreviewReport) => string;
}

const DOMAIN_LABELS: Record<MigrationPreviewDomain, string> = {
  words: '词条',
  overrides: '内置词覆盖',
  folders: '文件夹',
  favorites: '收藏',
  studyRecords: '学习记录',
  mastery: '掌握状态',
  groupProgress: '组完成次数',
  fsrsCards: 'FSRS 卡',
  fsrsLogs: 'FSRS 日志',
  wrongBook: '错题本',
  aiConversations: 'AI 会话',
  aiQuizHistory: 'AI 测验',
  recycleBin: '回收站',
  preferences: '偏好设置',
  unknown: '未知字段',
};

const STATUS_COPY: Record<
  MigrationPreviewStatus,
  { label: string; title: string; description: string }
> = {
  ready: {
    label: '可以继续',
    title: '备份结构通过预检',
    description: '没有发现阻断问题。正式写入仍需在 Task 010 中再次确认。',
  },
  review: {
    label: '需要检查',
    title: '备份可以识别，但有项目需要复核',
    description: '请查看跳过、冲突和警告项；本次预检没有写入任何数据。',
  },
  blocked: {
    label: '暂时阻断',
    title: '发现会破坏关系完整性的问题',
    description: '请先处理阻断项。当前学习进度和数据库完全未被修改。',
  },
};

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return '未知';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function MigrationPreviewPage({
  previewBackup,
  serializeReport,
}: MigrationPreviewPageProps) {
  const [report, setReport] = useState<MigrationPreviewReport | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';

    if (!file) {
      return;
    }

    setSelectedFileName(file.name);
    setReport(null);
    setInputError(null);

    if (file.size > MAX_V1_BACKUP_FILE_SIZE_BYTES) {
      setInputError('备份文件超过 25 MB。请确认选择的是钟日 JSON 备份。');
      setIsAnalyzing(false);
      return;
    }

    setIsAnalyzing(true);

    void file
      .text()
      .then((text) =>
        previewBackup({
          fileName: file.name,
          fileSize: file.size,
          text,
        }),
      )
      .then(setReport)
      .catch((error: unknown) => {
        setInputError(error instanceof Error ? error.message : '无法预检此备份，请重新选择文件。');
      })
      .finally(() => {
        setIsAnalyzing(false);
      });
  };

  const downloadReport = () => {
    if (!report) {
      return;
    }

    const blob = new Blob([serializeReport(report)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `zhongri-migration-preview-${report.source.fileDigestSha256.slice(0, 12)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const statusCopy = report ? STATUS_COPY[report.status] : null;

  return (
    <main className="migration-preview">
      <header className="migration-preview__header">
        <Link className="migration-preview__back" to="/study-demo">
          返回学习演示
        </Link>
        <p className="migration-preview__eyebrow">Phase 1 · Task009</p>
        <h1>旧版数据迁移预检</h1>
        <p>
          选择从钟日 v1 导出的 JSON 备份。系统只读取并生成报告，不会导入、覆盖或删除任何 v2 数据。
        </p>
      </header>

      <Card className="migration-preview__upload">
        <div>
          <h2>选择 v1 备份</h2>
          <p id="migration-file-help">
            支持 zhongri-backup v5+（含 v10）和旧 v4 JSON，最大{' '}
            {formatBytes(MAX_V1_BACKUP_FILE_SIZE_BYTES)}。
          </p>
        </div>
        <label className="migration-preview__file-label" htmlFor="migration-file">
          选择 v1 备份文件
        </label>
        <input
          accept=".json,application/json"
          aria-describedby="migration-file-help"
          disabled={isAnalyzing}
          id="migration-file"
          onChange={handleFileChange}
          type="file"
        />
        {selectedFileName && (
          <p className="migration-preview__selected">已选择：{selectedFileName}</p>
        )}
        {isAnalyzing && <p role="status">正在校验备份并生成 SHA-256 报告…</p>}
        {inputError && <p role="alert">{inputError}</p>}
        <p className="migration-preview__privacy">
          API Key 明文不会进入报告；如果检测到旧密钥，只会标记“需要重新输入”。
        </p>
      </Card>

      {report && statusCopy && (
        <>
          <Card className="migration-preview__result" data-status={report.status}>
            <div className="migration-preview__result-heading">
              <div>
                <p className="migration-preview__status-label">{statusCopy.label}</p>
                <h2>{statusCopy.title}</h2>
                <p>{statusCopy.description}</p>
              </div>
              <Button onClick={downloadReport} variant="secondary">
                导出迁移报告
              </Button>
            </div>

            <dl className="migration-preview__source">
              <div>
                <dt>备份格式</dt>
                <dd>
                  {report.source.format === 'modern' ? '现代备份' : '旧 v4'} · v
                  {report.source.backupVersion}
                </dd>
              </div>
              <div>
                <dt>导出时间</dt>
                <dd>{formatDate(report.source.exportDate)}</dd>
              </div>
              <div>
                <dt>文件大小</dt>
                <dd>{formatBytes(report.source.fileSize)}</dd>
              </div>
              <div>
                <dt>SHA-256</dt>
                <dd title={report.source.fileDigestSha256}>
                  {report.source.fileDigestSha256.slice(0, 16)}…
                </dd>
              </div>
            </dl>

            <dl aria-label="迁移预检总计" className="migration-preview__totals">
              <div>
                <dt>源记录</dt>
                <dd>{report.totals.source}</dd>
              </div>
              <div>
                <dt>可迁移</dt>
                <dd>{report.totals.migratable}</dd>
              </div>
              <div>
                <dt>跳过</dt>
                <dd>{report.totals.skipped}</dd>
              </div>
              <div>
                <dt>冲突</dt>
                <dd>{report.totals.conflicts}</dd>
              </div>
              <div>
                <dt>错误</dt>
                <dd>{report.totals.errors}</dd>
              </div>
            </dl>
          </Card>

          <section aria-labelledby="migration-domains-title" className="migration-preview__section">
            <div className="migration-preview__section-heading">
              <h2 id="migration-domains-title">数据域覆盖</h2>
              <p>每条源记录只归入一种预检结果，避免重复计数。</p>
            </div>
            <ul className="migration-preview__domains">
              {report.domains.map((domain) => (
                <li key={domain.domain}>
                  <article>
                    <div className="migration-preview__domain-heading">
                      <h3>{DOMAIN_LABELS[domain.domain]}</h3>
                      <span>{domain.sourceCount} 条</span>
                    </div>
                    <dl>
                      <div>
                        <dt>可迁移</dt>
                        <dd>{domain.migratableCount}</dd>
                      </div>
                      <div>
                        <dt>跳过</dt>
                        <dd>{domain.skippedCount}</dd>
                      </div>
                      <div>
                        <dt>冲突</dt>
                        <dd>{domain.conflictCount}</dd>
                      </div>
                      <div>
                        <dt>错误</dt>
                        <dd>{domain.errorCount}</dd>
                      </div>
                    </dl>
                    {domain.notes.map((note) => (
                      <p key={note}>{note}</p>
                    ))}
                  </article>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="migration-issues-title" className="migration-preview__section">
            <div className="migration-preview__section-heading">
              <h2 id="migration-issues-title">需要关注</h2>
              <p>
                {report.issues.length > 0
                  ? `共 ${report.issues.length} 类问题。`
                  : '没有发现问题。'}
              </p>
            </div>
            {report.issues.length > 0 ? (
              <ul className="migration-preview__issues">
                {report.issues.map((issue, index) => (
                  <li data-severity={issue.severity} key={`${issue.code}:${index}`}>
                    <div>
                      <span>
                        {issue.severity === 'blocking'
                          ? '阻断'
                          : issue.severity === 'warning'
                            ? '警告'
                            : '说明'}
                      </span>
                      <strong>{DOMAIN_LABELS[issue.domain]}</strong>
                      <code>{issue.code}</code>
                    </div>
                    <p>
                      {issue.message}（{issue.count} 项）
                    </p>
                    <p>{issue.recovery}</p>
                    {issue.sampleRefs.length > 0 && <p>示例：{issue.sampleRefs.join('、')}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <Card>
                <p>这份备份没有发现需要人工处理的预检问题。</p>
              </Card>
            )}
          </section>

          <details className="migration-preview__assumptions">
            <summary>查看本次使用的 Q1–Q12 默认决策</summary>
            <ol>
              {report.assumptions.map((assumption) => (
                <li key={assumption.id}>
                  <strong>{assumption.id}</strong>
                  <span>{assumption.decision}</span>
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
    </main>
  );
}
