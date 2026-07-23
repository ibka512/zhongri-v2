import { IconButton } from '../IconButton';
import { AudioIcon, PauseIcon, PlayIcon } from '../icons';
import './AudioControl.css';

export type AudioControlStatus = 'idle' | 'loading' | 'playing' | 'paused';

export interface AudioControlProps {
  label: string;
  onToggle?: () => void;
  status?: AudioControlStatus;
}

const statusText: Record<AudioControlStatus, string> = {
  idle: '准备播放',
  loading: '正在加载',
  playing: '播放中',
  paused: '已暂停',
};

export function AudioControl({ label, onToggle, status = 'idle' }: AudioControlProps) {
  const isLoading = status === 'loading';
  const isPlaying = status === 'playing';
  const buttonLabel = isPlaying ? `暂停：${label}` : `播放：${label}`;
  const icon = isLoading ? <AudioIcon /> : isPlaying ? <PauseIcon /> : <PlayIcon />;

  return (
    <div aria-busy={isLoading || undefined} className="zr-audio-control" data-state={status}>
      <IconButton
        disabled={isLoading}
        icon={icon}
        label={buttonLabel}
        onClick={onToggle}
        pressed={isPlaying}
      />
      <div>
        <strong>{label}</strong>
        <span aria-live="polite">{statusText[status]}</span>
      </div>
    </div>
  );
}
