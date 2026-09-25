import { beforeEach, describe, expect, it } from 'vitest';

import {
  isCurrentSessionRequest,
  readSession,
  refreshSessionUser,
  saveSession,
} from './session';

describe('current user response replaces cached display data', () => {
  beforeEach(() => localStorage.clear());
  it('refreshes identity and homepage without extending token expiry or storing secrets', () => {
    const expiry = Math.floor(Date.now() / 1000) + 1000;
    saveSession({
      accessToken: 'test',
      accessExpire: expiry,
      userInfo: { ID: 1, userName: 'admin', authorityId: 1 },
    });
    const current = {
      ID: 1,
      userName: 'admin',
      nickName: 'New name',
      authorityId: 1,
      authority: { defaultRouter: 'menu' },
      password: 'never-store',
      sessionVersion: 10,
    };
    const display = refreshSessionUser(current, 'test');
    expect(display.realName).toBe('New name');
    expect(readSession('test').defaultRouter).toBe('menu');
    expect(readSession('test').expiresAt).toBe(expiry);
    expect(localStorage.getItem('go-zero-admin:session:v1')).not.toContain(
      'never-store',
    );
    expect(localStorage.getItem('go-zero-admin:session:v1')).not.toContain(
      'sessionVersion',
    );
    expect(() => refreshSessionUser(current, 'another-token')).toThrow();
  });
});

describe('authentication failures are bound to their original request', () => {
  it('ignores delayed failures for a previous token or public request', () => {
    const error = {
      response: { status: 401 },
      config: { headers: { Authorization: 'Bearer old-token' } },
    };
    expect(isCurrentSessionRequest(error, 'old-token')).toBe(true);
    expect(isCurrentSessionRequest(error, 'new-token')).toBe(false);
    expect(isCurrentSessionRequest(error, null)).toBe(false);
    expect(
      isCurrentSessionRequest({ response: { status: 401 } }, 'new-token'),
    ).toBe(false);
  });
});
