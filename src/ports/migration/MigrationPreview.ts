export interface TextDigestPort {
  sha256: (text: string) => Promise<string>;
}
