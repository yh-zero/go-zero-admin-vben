<script setup lang="ts">
import type { Menu } from '#/api/business/system/types';

import { ref } from 'vue';

import { Button, Drawer, message, Space, Spin, Tree } from 'antdv-next';

import { saveAuthorityMenus } from '#/api/business/system/authority';
import { getAuthorityMenus, getMenuTree } from '#/api/business/system/menu';

import { confirmAction, flattenTree, refreshAccess } from '../shared';
import { includeMenuParents } from './authorization';
const open = ref(false);
const loading = ref(false);
const loaded = ref(false);
let loadVersion = 0;
const saving = ref(false);
const roleId = ref(0);
const title = ref('');
const menus = ref<Menu[]>([]);
const checked = ref<number[]>([]);
const tree = ref<Array<{ key: number; title: string; children?: unknown[] }>>(
  [],
);
function toTree(
  nodes: Menu[],
): Array<{ key: number; title: string; children: ReturnType<typeof toTree> }> {
  return nodes.map((node) => ({
    key: node.ID,
    title: node.meta.title,
    children: toTree(node.children ?? []),
  }));
}
async function show(id: number, name: string) {
  const version = ++loadVersion;
  roleId.value = id;
  title.value = `${name} · 菜单授权`;
  open.value = true;
  loading.value = true;
  loaded.value = false;
  menus.value = [];
  tree.value = [];
  checked.value = [];
  try {
    const [all, assigned] = await Promise.all([
      getMenuTree(),
      getAuthorityMenus(id),
    ]);
    if (version !== loadVersion) return;
    menus.value = all.list ?? [];
    tree.value = toTree(menus.value);
    checked.value = flattenTree(assigned.list ?? []).map((menu) => menu.ID);
    loaded.value = true;
  } finally {
    if (version === loadVersion) loading.value = false;
  }
}
function updateChecked(
  value: Array<number | string> | { checked: Array<number | string> },
) {
  checked.value = (Array.isArray(value) ? value : value.checked).map(Number);
}
async function persist() {
  if (!loaded.value || loading.value || saving.value) return;
  saving.value = true;
  try {
    await saveAuthorityMenus(
      roleId.value,
      includeMenuParents(checked.value, menus.value),
    );
    message.success('菜单授权已保存');
    open.value = false;
    refreshAccess();
  } finally {
    saving.value = false;
  }
}
function save() {
  if (!loaded.value || loading.value || saving.value) return;
  if (!checked.value.length)
    confirmAction('清空此角色的全部业务菜单？', persist);
  else void persist();
}
defineExpose({ show });
</script>
<template>
  <Drawer
    v-model:open="open"
    :title="title"
    :size="520"
    :mask-closable="!saving"
    :closable="!saving"
  >
    <Spin :spinning="loading">
      <p class="mb-4 text-sm">
        保存会包含所选菜单的必要父菜单。取消父菜单时，请同时取消不需要的子菜单。
      </p>
      <Tree
        :tree-data="tree"
        checkable
        check-strictly
        :checked-keys="checked"
        :disabled="saving || loading"
        default-expand-all
        @check="updateChecked"
      />
    </Spin>
    <template #footer>
      <Space>
        <Button :disabled="saving" @click="open = false">取消</Button>
        <Button
          type="primary"
          :loading="saving"
          :disabled="!loaded || loading"
          @click="save"
        >
          保存菜单授权
        </Button>
      </Space>
    </template>
  </Drawer>
</template>
