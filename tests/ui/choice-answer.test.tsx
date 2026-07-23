import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChoiceAnswer } from '../../src/ui/components/learning';

const options = [
  { id: 'clock', label: '钟表' },
  { id: 'phone', label: '电话' },
] as const;

function ChoiceHarness() {
  const [value, setValue] = useState<string | null>(null);

  return <ChoiceAnswer label="选择释义" onChange={setValue} options={options} value={value} />;
}

describe('ChoiceAnswer', () => {
  it('updates the selected state after user input', () => {
    render(<ChoiceHarness />);
    const option = screen.getByRole('button', { name: '钟表' });

    fireEvent.click(option);

    expect(option).toHaveAttribute('aria-pressed', 'true');
    expect(option).toHaveAttribute('data-state', 'selected');
  });

  it('shows correct and incorrect states without judging internally', () => {
    render(
      <ChoiceAnswer
        correctOptionId="clock"
        label="结果状态"
        onChange={() => undefined}
        options={options}
        status="incorrect"
        value="phone"
      />,
    );

    expect(screen.getByRole('button', { name: /钟表/ })).toHaveAttribute('data-state', 'correct');
    expect(screen.getByRole('button', { name: /电话/ })).toHaveAttribute('data-state', 'incorrect');
  });
});
