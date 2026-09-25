import type { LoginResult } from '../business/session';

import { requestClient } from '#/api/request';
export namespace AuthApi {
  export interface LoginParams {
    username?: string;
    password?: string;
    captcha?: string;
    captchaId?: string;
  }
}
export function loginApi(data: AuthApi.LoginParams) {
  return requestClient.post<LoginResult>('/v1/sys/login', data);
}
export function getCaptchaApi() {
  return requestClient.get<{ captchaId: string; captchaImg: string }>('/v1/sys/randomImage');
}
