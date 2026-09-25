import { useAccessStore } from '@vben/stores';

import { readSession } from '#/adapter/business/session';
export async function getUserInfoApi() {
  return readSession(useAccessStore().accessToken).user;
}
