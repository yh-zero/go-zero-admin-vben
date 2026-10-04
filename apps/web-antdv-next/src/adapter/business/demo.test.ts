import { afterEach, describe, expect, it, vi } from 'vitest';

describe('public demo build flag', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([undefined, 'false', '1', 'TRUE', ''])('stays off for %s', async (value) => {
    vi.resetModules();
    vi.stubEnv('VITE_PUBLIC_DEMO', value);
    expect((await import('./demo')).isPublicDemo).toBe(false);
  });

  it('enables the optional UI only for an explicit true value', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_PUBLIC_DEMO', 'true');
    expect((await import('./demo')).isPublicDemo).toBe(true);
  });
});
