export interface AIGatewayRuntimeConfig {
  readonly gatewayUrl: string | null;
}

/**
 * Normalize the public URL without accepting credentials, query strings or
 * fragments. The URL is configuration only; no provider secret belongs here.
 */
export function normalizeAIGatewayBaseUrl(value: string): string {
  const url = new URL(value.trim());

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('AI gateway URL must use http or https');
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error('AI gateway URL cannot contain credentials, query strings or fragments');
  }

  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString().replace(/\/$/, '');
}

/** Read the public Gateway URL from Vite runtime configuration. */
export function readAIGatewayRuntimeConfig(
  env: Record<string, unknown> = import.meta.env,
): AIGatewayRuntimeConfig {
  const configuredUrl = env.VITE_AI_GATEWAY_URL;

  if (typeof configuredUrl !== 'string' || configuredUrl.trim().length === 0) {
    return { gatewayUrl: null };
  }

  try {
    return { gatewayUrl: normalizeAIGatewayBaseUrl(configuredUrl) };
  } catch {
    return { gatewayUrl: null };
  }
}
