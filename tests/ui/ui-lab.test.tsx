import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { appRoutes } from '../../src/app/router';
import { ThemeProvider } from '../../src/ui/theme';

describe('UI Lab', () => {
  it('is available from the /ui-lab application route', () => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/ui-lab'],
    });

    render(
      <ThemeProvider initialTheme="light">
        <RouterProvider router={router} />
      </ThemeProvider>,
    );

    expect(screen.getByRole('heading', { name: '钟日 v2 UI Lab' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Design Token' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '学习核心组件' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'AI Bubble' })).toBeInTheDocument();
  });

  it('applies the selected theme to the document', async () => {
    render(
      <ThemeProvider initialTheme="dark">
        <span>theme test</span>
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    });
  });
});
