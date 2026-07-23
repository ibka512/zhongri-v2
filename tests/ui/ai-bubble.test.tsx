import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AIBubble } from '../../src/ui/components/ai';

describe('AIBubble', () => {
  it('renders a bounded suggestion and reports action selection', () => {
    const onSelect = vi.fn();

    render(
      <AIBubble
        actions={[{ id: 'hint', label: '查看提示', onSelect }]}
        message="需要提示吗？"
        reason="用户请求了提示"
        state="suggestion"
      />,
    );

    expect(screen.getByText('AI 外教')).toBeInTheDocument();
    expect(screen.getByText('需要提示吗？')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看提示' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('announces a non-interactive thinking state', () => {
    render(<AIBubble message="" state="thinking" />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
