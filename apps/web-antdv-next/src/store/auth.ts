import type { Recordable } from '@vben/types';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { notification } from 'antdv-next';
import { defineStore } from 'pinia';

import {
  clearSessionCache,
  safeRedirect,
  saveSession,
  SESSION_HOME,
} from '#/adapter/business/session';
import { getUserInfoApi, loginApi } from '#/api';
import { resetRoutes } from '#/router';
export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();
  const loginLoading = ref(false);
  function clearSession() {
    clearSessionCache();
    resetRoutes();
    resetAllStores();
  }
  async function authLogin(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    const destination = safeRedirect(
      router.currentRoute.value.query.redirect,
      SESSION_HOME,
    );
    clearSession();
    loginLoading.value = true;
    try {
      const result = await loginApi(params);
      const userInfo = saveSession(result);
      accessStore.setAccessToken(result.accessToken);
      userStore.setUserInfo(userInfo);
      if (onSuccess) await onSuccess();
      else await router.replace(destination);
      if (accessStore.accessToken)
        notification.success({
          title: '登录成功',
          description: userInfo.realName,
          duration: 3,
        });
      return { userInfo };
    } finally {
      loginLoading.value = false;
    }
  }
  async function logout(redirect = true) {
    const destination = safeRedirect(
      router.currentRoute.value.fullPath,
      SESSION_HOME,
    );
    clearSession();
    await router.replace({
      path: LOGIN_PATH,
      query: redirect ? { redirect: encodeURIComponent(destination) } : {},
    });
  }
  async function fetchUserInfo() {
    const userInfo = await getUserInfoApi();
    userStore.setUserInfo(userInfo);
    return userInfo;
  }
  function $reset() {
    loginLoading.value = false;
  }
  return {
    $reset,
    authLogin,
    clearSession,
    fetchUserInfo,
    loginLoading,
    logout,
  };
});
