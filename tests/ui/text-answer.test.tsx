import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TextAnswer } from '../../src/ui/components/learning';

function TextHarness({ onSubmit }: { onSubmit: () => void }) {
  const [value, setValue] = useState('');

  return <TextAnswer label="输入答案" onChange={setValue} onSubmit={onSubmit} value={value} />;
}

describe('TextAnswer', () => {
  it('preserves input and submits after user interaction', () => {
    const onSubmit = vi.fn();

    render(<TextHarness onSubmit={onSubmit} />);
    const input = screen.getByRole('textbox', { name: '输入答案' });

    fireEvent.change(input, { target: { value: 'clock' } });
    fireEvent.click(screen.getByRole('button', { name: '提交答案' }));

    expect(input).toHaveValue('clock');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('associates a recoverable error with the input', () => {
    render(
      <TextAnswer
        errorMessage="请检查拼写。"
        label="输入答案"
        onChange={() => undefined}
        onSubmit={() => undefined}
        status="error"
        value="clok"
      />,
    );

    expect(screen.getByRole('textbox', { name: '输入答案' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('请检查拼写。');
  });
});
