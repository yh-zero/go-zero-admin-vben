import type { Router } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';
import { startProgress, stopProgress } from '@vben/utils';

import {
  isAuthenticationError,
  MissingSessionError,
  readSession,
  safeRedirect,
  SESSION_HOME,
} from '#/adapter/business/session';
import { accessRoutes, coreRouteNames } from '#/router/routes';
import { useAuthStore } from '#/store';

import { generateAccess } from './access';

/**
 * 通用守卫配置
 * @param router
 */
function setupCommonGuard(router: Router) {
  // 记录已经加载的页面
  const loadedPaths = new Set<string>();

  router.beforeEach((to) => {
    to.meta.loaded = loadedPaths.has(to.path);

    // 页面加载进度条
    if (!to.meta.loaded && preferences.transition.progress) {
      startProgress();
    }
    return true;
  });

  router.afterEach((to) => {
    // 记录页面是否加载,如果已经加载，后续的页面切换动画等效果不在重复执行

    loadedPaths.add(to.path);

    // 关闭页面加载进度条
    if (preferences.transition.progress) {
      stopProgress();
    }
  });
}

/**
 * 权限访问守卫配置
 * @param router
 */
function setupAccessGuard(router: Router) {
  router.beforeEach(async (to) => {
    const accessStore = useAccessStore();
    const userStore = useUserStore();
    const authStore = useAuthStore();
    const login = () => ({
      path: LOGIN_PATH,
      query: {
        redirect: encodeURIComponent(safeRedirect(to.fullPath, SESSION_HOME)),
      },
      replace: true,
    });
    if (accessStore.accessToken) {
      try {
        readSession(accessStore.accessToken);
      } catch {
        authStore.clearSession();
      }
    }
    if (coreRouteNames.includes(to.name as string)) {
      if (to.path === LOGIN_PATH && accessStore.accessToken)
        return safeRedirect(to.query.redirect, SESSION_HOME);
      if (to.name === 'AccessError' && !accessStore.accessToken) return login();
      return true;
    }
    if (!accessStore.accessToken) return login();
    if (accessStore.isAccessChecked) return true;
    try {
      const userInfo = userStore.userInfo || (await authStore.fetchUserInfo());
      const { accessibleMenus, accessibleRoutes } = await generateAccess({
        roles: userInfo.roles ?? [],
        router,
        routes: accessRoutes,
      });
      accessStore.setAccessMenus(accessibleMenus);
      accessStore.setAccessRoutes(accessibleRoutes);
      accessStore.setIsAccessChecked(true);
      return {
        path:
          to.path === SESSION_HOME
            ? userStore.userInfo?.homePath || SESSION_HOME
            : to.path,
        query: to.query,
        hash: to.hash,
        replace: true,
      };
    } catch (error) {
      if (
        error instanceof MissingSessionError ||
        isAuthenticationError(error) ||
        !accessStore.accessToken
      ) {
        authStore.clearSession();
        return login();
      }
      return { name: 'AccessError', replace: true };
    }
  });
}

/**
 * 项目守卫配置
 * @param router
 */
function createRouterGuard(router: Router) {
  /** 通用 */
  setupCommonGuard(router);
  /** 权限访问 */
  setupAccessGuard(router);
}

export { createRouterGuard };
