/**
 * browserNotifications.ts — Wrapper peste Browser Notification API
 *
 * Cere permisiune la prima utilizare și trimite notificări native care
 * funcționează și când tab-ul e în fundal / ecranul blocat (Android PWA).
 */

let permissionState: NotificationPermission = 'default';

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') {
    permissionState = 'granted';
    return true;
  }
  if (Notification.permission === 'denied') {
    permissionState = 'denied';
    return false;
  }
  const result = await Notification.requestPermission();
  permissionState = result;
  return result === 'granted';
}

export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

export function canNotify(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

export interface JobNotificationOptions {
  jobId: string;
  priority: 'NORMAL' | 'URGENT' | 'CRITIC';
  orderRef?: string | null;
  itemsCount?: number;
}

export function notifyJobAssigned(opts: JobNotificationOptions): void {
  if (!canNotify()) return;

  const { jobId, priority, orderRef, itemsCount } = opts;

  const titles: Record<string, string> = {
    NORMAL: '📦 Job nou alocat',
    URGENT: '⚠️ Job URGENT alocat!',
    CRITIC: '🚨 Job CRITIC — Acțiune imediată!',
  };

  const body = [
    orderRef ? `Comandă: ${orderRef}` : `Job #${jobId.slice(0, 8)}`,
    itemsCount ? `${itemsCount} produse de cules` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const notif = new Notification(titles[priority] || titles.NORMAL, {
    body,
    icon: '/wms-icon.png',
    badge: '/wms-badge.png',
    tag: `pick-job-${jobId}`, // înlocuiește notificările anterioare pt același job
    requireInteraction: priority === 'CRITIC', // rămâne afișat până dismiss
  });

  notif.onclick = () => {
    window.focus();
    notif.close();
  };
}
