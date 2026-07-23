import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '../../src/ui/components';

describe('Button', () => {
  it('renders and reports user activation', () => {
    const onClick = vi.fn();

    render(<Button onClick={onClick}>继续</Button>);
    fireEvent.click(screen.getByRole('button', { name: '继续' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('exposes loading and disabled states', () => {
    const { rerender } = render(<Button state="loading">继续</Button>);
    const loadingButton = screen.getByRole('button', { name: '处理中' });

    expect(loadingButton).toBeDisabled();
    expect(loadingButton).toHaveAttribute('aria-busy', 'true');

    rerender(<Button state="disabled">继续</Button>);
    expect(screen.getByRole('button', { name: '继续' })).toBeDisabled();
  });
});
