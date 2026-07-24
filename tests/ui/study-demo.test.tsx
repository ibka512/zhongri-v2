import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { appRoutes } from '../../src/app/router';
import { ThemeProvider } from '../../src/ui/theme';

describe('StudyDemoPage', () => {
  it('completes three mock questions with correct and incorrect feedback', async () => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/study-demo'],
    });

    render(
      <ThemeProvider initialTheme="light">
        <RouterProvider router={router} />
      </ThemeProvider>,
    );

    expect(screen.getByRole('heading', { name: '第一个学习闭环' })).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ねこ' }));
    expect(await screen.findByRole('heading', { name: '理解正确' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '下一题' }));
    expect(screen.getByText('2 / 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '火' }));
    expect(await screen.findByRole('heading', { name: '一起看清这个词' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '下一题' }));
    expect(screen.getByText('3 / 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'としょかん' }));
    await screen.findByRole('heading', { name: '理解正确' });
    fireEvent.click(screen.getByRole('button', { name: '完成练习' }));

    expect(screen.getByRole('heading', { name: '3 道示例题已完成' })).toBeInTheDocument();
    expect(screen.getByText(/生成了 6 条 LearningEvent/)).toBeInTheDocument();
  });
});
