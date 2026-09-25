import { afterEach, describe, expect, it, vi } from 'vitest';

import { refreshRoleAccess } from './shared';

const mocks = vi.hoisted(() => ({
  user: { userInfo: { roles: ['888'] } },
  reload: vi.fn(),
  success: vi.fn(),
}));
vi.mock('@vben/stores', () => ({
  useUserStore: () => mocks.user,
  useAccessStore: vi.fn(),
}));
vi.mock('antdv-next', () => ({
  message: { success: mocks.success },
  Modal: {},
}));

describe('role permission refresh', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });
  it('preserves the working page when updating another role', () => {
    vi.stubGlobal('window', { location: { reload: mocks.reload } });
    refreshRoleAccess(889);
    expect(mocks.reload).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith('授权已保存');
  });
  it('regenerates menus and permission codes when the current role changes', () => {
    vi.stubGlobal('window', { location: { reload: mocks.reload } });
    refreshRoleAccess(888);
    expect(mocks.reload).toHaveBeenCalledOnce();
  });
});
