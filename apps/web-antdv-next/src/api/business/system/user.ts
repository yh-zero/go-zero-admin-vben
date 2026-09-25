import type { PageQuery, PageResult, User } from './types';

import { requestClient } from '#/api/request';
export interface CreateUser {
  userName: string;
  passWord: string;
  nickName: string;
  headerImg?: string;
  phone?: string;
  email?: string;
  enable: number;
  authorityId: number;
  authorityIds: number[];
}
export type UpdateUser = Partial<Omit<CreateUser, 'passWord' | 'userName'>> & {
  ID: number;
};
export const getUsers = (params: PageQuery) =>
  requestClient.get<PageResult<User>>('/v1/sys/getUserList', { params });
export const createUser = (data: CreateUser) =>
  requestClient.post('/v1/sys/register', data);
export const updateUser = (data: UpdateUser) =>
  requestClient.put('/v1/sys/updateUserInfo', data);
export const deleteUser = (userId: number) =>
  requestClient.delete('/v1/sys/deleteUser', { data: { userId } });
export const resetUserPassword = (userId: number) =>
  requestClient.put('/v1/sys/resetUserPassword', { userId });
