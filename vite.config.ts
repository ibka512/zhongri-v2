import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function validateBasePath(basePath: string): string {
  if (!basePath.startsWith('/') || !basePath.endsWith('/')) {
    throw new Error('VITE_BASE_PATH must start and end with "/"');
  }

  return basePath;
}

export default defineConfig(({ mode }) => {
  const base = validateBasePath(mode === 'pages' ? '/zhongri-v2/' : '/');

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['icon.svg'],
        manifest: {
          name: '钟日 v2',
          short_name: '钟日',
          description: '面向中文母语者的本地优先语言学习伙伴',
          theme_color: '#f7f5ef',
          background_color: '#f7f5ef',
          display: 'standalone',
          start_url: base,
          scope: base,
          icons: [
            {
              src: `${base}icon.svg`,
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
            {
              src: `${base}icon.svg`,
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          navigateFallback: `${base}index.html`,
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{html,js,css,json,svg}'],
        },
      }),
    ],
  };
});
