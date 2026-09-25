import type { Authority, PageQuery, PageResult } from './types';

import { requestClient } from '#/api/request';
export const getAuthorities = (params: PageQuery) =>
  requestClient.get<PageResult<Authority>>(
    '/v1/sys/authority/getAuthorityList',
    { params },
  );
export const createAuthority = (data: Authority) =>
  requestClient.post('/v1/sys/authority/createAuthority', data);
export const updateAuthority = (data: Authority) =>
  requestClient.put('/v1/sys/authority/updateAuthority', data);
export const deleteAuthority = (id: number) =>
  requestClient.delete('/v1/sys/authority/deleteAuthority', { data: { id } });
export const saveAuthorityMenus = (authorityId: number, ids: number[]) =>
  requestClient.post('/v1/sys/authority/addAuthorityMenu', {
    authorityId,
    menuIds: [...new Set(ids)].join(','),
  });
// The API pages root roles; each root contains its complete descendants.
export async function getAllAuthorities() {
  const result: Authority[] = [];
  for (let pageNo = 1; ; pageNo++) {
    const page = await getAuthorities({ pageNo, pageSize: 100 });
    const rows = page.list ?? [];
    result.push(...rows);
    if (rows.length === 0 || result.length >= page.total) return result;
  }
}
