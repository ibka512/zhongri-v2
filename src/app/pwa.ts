import { registerSW } from 'virtual:pwa-register';

export const PWA_STATUS_EVENT = 'zhongri:pwa-status';

export type PwaStatus = 'offline-ready' | 'update-available';

function announcePwaStatus(status: PwaStatus): void {
  window.dispatchEvent(
    new CustomEvent<PwaStatus>(PWA_STATUS_EVENT, {
      detail: status,
    }),
  );
}

export function registerPwa(): void {
  registerSW({
    immediate: true,
    onNeedRefresh: () => {
      announcePwaStatus('update-available');
    },
    onOfflineReady: () => {
      announcePwaStatus('offline-ready');
    },
  });
}
