import './Progress.css';

export type ProgressKind = 'today' | 'question' | 'time';

export interface ProgressProps {
  detail: string;
  kind: ProgressKind;
  label: string;
  max: number;
  value: number;
}

export function Progress({ detail, kind, label, max, value }: ProgressProps) {
  const safeMax = max > 0 ? max : 1;
  const safeValue = Math.min(Math.max(value, 0), safeMax);

  return (
    <div className="zr-progress" data-kind={kind}>
      <div className="zr-progress__labels">
        <span>{label}</span>
        <span className="zr-type-numeric">{detail}</span>
      </div>
      <progress aria-label={label} max={safeMax} value={safeValue} />
    </div>
  );
}
