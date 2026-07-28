export interface SpeechSynthesisRequest {
  readonly language: string;
  readonly rate: number;
  readonly text: string;
}

export interface SpeechSynthesisPort {
  readonly supported: boolean;
  cancel: () => void;
  speak: (request: SpeechSynthesisRequest) => Promise<void>;
}
