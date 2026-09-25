import type { Policy } from './types';

import { requestClient } from '#/api/request';
export const getPolicies = (authorityId: number) =>
  requestClient.get<{ list: null | Policy[] }>(
    '/v1/sys/casbin/getPathByAuthorityId',
    { params: { authorityId } },
  );
export const savePolicies = (authorityId: number, casbinInfoList: Policy[]) =>
  requestClient.put('/v1/sys/casbin/updateCasbinData', {
    authorityId,
    casbinInfoList,
  });
export const savePolicyApiIds = (authorityId: number, apiIds: number[]) =>
  requestClient.put('/v1/sys/casbin/updateCasbinDataByApiIds', {
    authorityId,
    apiIds,
  });
