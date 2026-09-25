import type { BackendMenu } from '../business/session';

import { useAccessStore, useUserStore } from '@vben/stores';

import { adaptMenus } from '#/adapter/business/menu';
import { MissingSessionError, readSession } from '#/adapter/business/session';
import { requestClient } from '#/api/request';
export async function getAllMenusApi() {
  const access = useAccessStore();
  const token = access.accessToken;
  const result = await requestClient.get<{ menus: BackendMenu[] | null }>(
    '/v1/sys/menu/getMenu',
  );
  if (token !== access.accessToken) throw new MissingSessionError('会话已切换');
  const session = readSession(token);
  const adapted = adaptMenus(
    result.menus,
    session.defaultRouter,
    session.user.roles?.[0] || '',
  );
  access.setAccessCodes(adapted.codes);
  useUserStore().setUserInfo({ ...session.user, homePath: adapted.homePath });
  return adapted.routes;
}
