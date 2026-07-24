import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import {
  MAX_V1_BACKUP_FILE_SIZE_BYTES,
  MigrationPreviewUseCase,
} from '../../src/application/migration';
import { MigrationPreviewPage } from '../../src/pages/MigrationPreview';
import { ThemeProvider } from '../../src/ui/theme';
import { createModernV1Backup } from '../fixtures/v1-backups';

function createHarness() {
  const useCase = new MigrationPreviewUseCase({
    digest: {
      sha256: async () => 'b'.repeat(64),
    },
    now: () => new Date('2026-07-24T04:00:00.000Z'),
  });

  return {
    previewBackup: useCase.preview.bind(useCase),
    serializeReport: useCase.serialize.bind(useCase),
  };
}

function createBackupFile(value: unknown): File {
  const text = JSON.stringify(value);
  const file = new File([text], 'zhongri-v1-backup.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', {
    configurable: true,
    value: async () => text,
  });
  return file;
}

describe('MigrationPreviewPage', () => {
  it('shows a modern backup report without offering an import action', async () => {
    const harness = createHarness();
    render(
      <MemoryRouter>
        <ThemeProvider initialTheme="light">
          <MigrationPreviewPage {...harness} />
        </ThemeProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('选择 v1 备份文件'), {
      target: { files: [createBackupFile(createModernV1Backup())] },
    });

    expect(await screen.findByRole('heading', { name: '备份结构通过预检' })).toBeInTheDocument();
    expect(within(screen.getByLabelText('迁移预检总计')).getAllByText('13')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '导出迁移报告' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /导入|迁移数据/ })).not.toBeInTheDocument();
    expect(screen.getByText(/不会导入、覆盖或删除/)).toBeInTheDocument();
  });

  it('shows an actionable inline error for an unreadable backup', async () => {
    const harness = createHarness();
    const file = createBackupFile({});
    render(
      <MemoryRouter>
        <ThemeProvider initialTheme="light">
          <MigrationPreviewPage {...harness} />
        </ThemeProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('选择 v1 备份文件'), {
      target: { files: [file] },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '无法识别此备份格式。当前支持 zhongri-backup v5+ 和旧 v4 JSON。',
    );
    expect(screen.getByLabelText('选择 v1 备份文件')).toBeEnabled();
  });

  it('rejects an oversized backup before reading its content', async () => {
    const harness = createHarness();
    const file = createBackupFile(createModernV1Backup());
    const readText = vi.fn();
    Object.defineProperties(file, {
      size: { value: MAX_V1_BACKUP_FILE_SIZE_BYTES + 1 },
      text: { value: readText },
    });
    render(
      <MemoryRouter>
        <ThemeProvider initialTheme="light">
          <MigrationPreviewPage {...harness} />
        </ThemeProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('选择 v1 备份文件'), {
      target: { files: [file] },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      '备份文件超过 25 MB。请确认选择的是钟日 JSON 备份。',
    );
    expect(readText).not.toHaveBeenCalled();
  });
});
