// @ts-ignore
import { describe, expect, it } from 'vitest';
import { getCloudStatus, setCloudMode, subscribeCloudStatus } from './cloudStatus';

describe('Real-Time Cloud Connection Status Monitor', () => {
  it('defaults to offline status when initialized', () => {
    const status = getCloudStatus();
    expect(status.mode).toBe('offline');
    expect(status.label).toBe('Offline Fallback Active');
    expect(status.isOnline).toBe(false);
  });

  it('updates status and notifies subscribers when connection mode changes', () => {
    let notified = 0;
    const unsubscribe = subscribeCloudStatus(() => {
      notified += 1;
    });

    setCloudMode('postgresql');
    let status = getCloudStatus();
    expect(status.mode).toBe('postgresql');
    expect(status.label).toBe('PostgreSQL Connected');
    expect(status.isOnline).toBe(true);
    expect(notified).toBe(1);

    setCloudMode('offline');
    status = getCloudStatus();
    expect(status.mode).toBe('offline');
    expect(status.label).toBe('Offline Fallback Active');
    expect(notified).toBe(2);

    unsubscribe();
  });
});
