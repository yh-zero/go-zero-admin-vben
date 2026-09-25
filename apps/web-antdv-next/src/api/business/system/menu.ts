import type { Menu } from './types';

import { requestClient } from '#/api/request';
export const getMenus = () =>
  requestClient.get<{ list: Menu[] | null }>('/v1/sys/menu/getMenuList');
export const getMenuTree = () =>
  requestClient.get<{ list: Menu[] | null }>('/v1/sys/menu/getBaseMenuTree');
export const getAuthorityMenus = (authorityId: number) =>
  requestClient.get<{ list: Menu[] | null }>('/v1/sys/menu/getMenuAuthority', {
    params: { authorityId },
  });
export const getMenu = (id: number) =>
  requestClient.get<{ sysBaseMenu: Menu }>('/v1/sys/menu/getBaseMenuById', {
    params: { id },
  });
export const createMenu = (data: Menu) =>
  requestClient.post('/v1/sys/menu/addBaseMenu', data);
export const updateMenu = (data: Menu) =>
  requestClient.put('/v1/sys/menu/updateBaseMenu', data);
export const deleteMenu = (id: number) =>
  requestClient.delete('/v1/sys/menu/deleteBaseMenu', { data: { id } });
export const getAuthorityButtons = (authorityId: number) =>
  requestClient.get<{ menuBtnIds: null | number[] }>(
    '/v1/sys/menu/getAuthorityButtons',
    { params: { authorityId } },
  );
export const saveAuthorityButtons = (
  authorityId: number,
  menuBtnIds: number[],
) =>
  requestClient.put('/v1/sys/menu/updateAuthorityButtons', {
    authorityId,
    menuBtnIds,
  });
