import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from './auth';

const mocks = vi.hoisted(() => ({
  access: { accessToken: 'old-token', setAccessToken: vi.fn() },
  user: { setUserInfo: vi.fn() },
  logout: vi.fn(),
  getUser: vi.fn(),
  replace: vi.fn(),
  warning: vi.fn(),
  clear: vi.fn(),
}));
vi.mock('vue-router', () => ({
  useRouter: () => ({
    currentRoute: { value: { fullPath: '/account', query: {} } },
    replace: mocks.replace,
  }),
}));
vi.mock('@vben/constants', () => ({ LOGIN_PATH: '/auth/login' }));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => mocks.access,
  useUserStore: () => mocks.user,
  resetAllStores: () => {
    mocks.access.accessToken = '';
  },
}));
vi.mock('antdv-next', () => ({
  notification: { warning: mocks.warning, success: vi.fn() },
}));
vi.mock('#/api', () => ({
  logoutApi: mocks.logout,
  getUserInfoApi: mocks.getUser,
  loginApi: vi.fn(),
}));
vi.mock('#/router', () => ({ resetRoutes: vi.fn() }));
vi.mock('#/adapter/business/session', () => ({
  clearSessionCache: mocks.clear,
  safeRedirect: () => '/account',
  saveSession: vi.fn(),
  SESSION_HOME: '/_session/home',
  StaleSessionResponseError: class extends Error {},
}));

describe('logout and current-user request races', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mocks.access.accessToken = 'old-token';
  });
  it('clears local state even when server logout fails', async () => {
    mocks.logout.mockRejectedValueOnce(new Error('network'));
    await useAuthStore().logout(false);
    expect(mocks.access.accessToken).toBe('');
    expect(mocks.clear).toHaveBeenCalledOnce();
    expect(mocks.replace).toHaveBeenCalledOnce();
    expect(mocks.warning).toHaveBeenCalledOnce();
  });
  it('does not erase a newer login when an old logout finishes', async () => {
    let finish!: () => void;
    mocks.logout.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = useAuthStore().logout();
    mocks.access.accessToken = 'new-token';
    finish();
    await pending;
    expect(mocks.access.accessToken).toBe('new-token');
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it('does not request logout again for an already rejected token', async () => {
    await useAuthStore().logout(true, false);
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(mocks.access.accessToken).toBe('');
  });
  it('does not update the store with a previous login user response', async () => {
    let finish!: (value: object) => void;
    mocks.getUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = useAuthStore().fetchUserInfo();
    mocks.access.accessToken = 'new-token';
    finish({ username: 'previous-user' });
    await expect(pending).rejects.toThrow();
    expect(mocks.user.setUserInfo).not.toHaveBeenCalled();
  });
});
