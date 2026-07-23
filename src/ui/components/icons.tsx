import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 24 24" {...props}>
      {children}
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m5 12.5 4.25 4.25L19 7" stroke="currentColor" strokeWidth="2" />
    </IconBase>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 8v5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <circle cx="12" cy="17" fill="currentColor" r="1" />
      <path d="M12 3 3.5 20h17L12 3Z" stroke="currentColor" strokeLinejoin="round" />
    </IconBase>
  );
}

export function LightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </IconBase>
  );
}

export function DarkIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path
        d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </IconBase>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m9 6 9 6-9 6V6Z" fill="currentColor" />
    </IconBase>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 6v12M16 6v12" stroke="currentColor" strokeWidth="2.4" />
    </IconBase>
  );
}

export function AudioIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 10v4h3l4 3V7L8 10H5Z" stroke="currentColor" strokeLinejoin="round" />
      <path
        d="M15 9.25c1.3 1.52 1.3 3.98 0 5.5M17.75 7c2.65 2.75 2.65 7.25 0 10"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </IconBase>
  );
}
