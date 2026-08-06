/**
 * Real-Time Offline / Online Cloud Connection Status Monitor.
 *
 * Detects actual connection status between the application, Fastify API, and PostgreSQL database.
 * Switches seamlessly between 'postgresql' (Remote Database Connected) and 'offline' (Offline Fallback Active).
 */
import { getManifest } from '@bs/engine';
import { syncDraft } from '@bs/services';

export type CloudMode = 'postgresql' | 'offline';

export interface CloudStatus {
  mode: CloudMode;
  label: string;
  isOnline: boolean;
  lastCheckedAt: number;
}

let currentMode: CloudMode = 'offline';
let lastCheckedAt: number = Date.now();
const listeners = new Set<() => void>();
let pollerTimer: ReturnType<typeof setInterval> | null = null;

function computeLabel(mode: CloudMode): string {
  return mode === 'postgresql' ? 'PostgreSQL Connected' : 'Offline Fallback Active';
}

export function getCloudStatus(): CloudStatus {
  return {
    mode: currentMode,
    label: computeLabel(currentMode),
    isOnline: currentMode === 'postgresql',
    lastCheckedAt,
  };
}

export function setCloudMode(newMode: CloudMode): void {
  const prevMode = currentMode;
  currentMode = newMode;
  lastCheckedAt = Date.now();

  // On transition from offline -> postgresql, sync local draft back to cloud database
  if (prevMode === 'offline' && newMode === 'postgresql') {
    try {
      syncDraft(getManifest());
    } catch (e) {
      console.warn('[cloudStatus] draft auto-sync on reconnect failed', e);
    }
  }

  for (const fn of listeners) fn();
}

export function subscribeCloudStatus(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Check connection against /api/health endpoint with timeout. */
async function checkCloudConnection(): Promise<CloudMode> {
  if (typeof fetch === 'undefined') {
    setCloudMode('offline');
    return 'offline';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch('/api/health', {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const body = (await res.json()) as { ok?: boolean; db?: string };
      if (body.ok) {
        setCloudMode('postgresql');
        return 'postgresql';
      }
    }
    setCloudMode('offline');
    return 'offline';
  } catch {
    clearTimeout(timeout);
    setCloudMode('offline');
    return 'offline';
  }
}

/** Initialize background poller and network event listeners. */
export function initCloudStatusMonitor(): void {
  if (typeof window === 'undefined') return;

  // Initial immediate check
  void checkCloudConnection();

  // Listen to browser network state
  window.addEventListener('online', () => void checkCloudConnection());
  window.addEventListener('offline', () => setCloudMode('offline'));

  // Background poller (every 8 seconds)
  if (!pollerTimer) {
    pollerTimer = setInterval(() => {
      void checkCloudConnection();
    }, 8000);
  }
}
