<script setup lang="ts">
import type { Menu } from '#/api/business/system/types';

import { computed, ref } from 'vue';

import { Button, Drawer, Space, Spin, Tree } from 'antdv-next';

import { saveAuthorityMenus } from '#/api/business/system/authority';
import { getAuthorityMenus, getMenuTree } from '#/api/business/system/menu';

import { confirmAction, flattenTree, refreshRoleAccess } from '../shared';
import { includeMenuParents, permissionChanges } from './authorization';
const emit = defineEmits<{ saved: [] }>();
const open = ref(false);
const loading = ref(false);
const loaded = ref(false);
let loadVersion = 0;
const saving = ref(false);
const roleId = ref(0);
const title = ref('');
const menus = ref<Menu[]>([]);
const checked = ref<number[]>([]);
const original = ref<number[]>([]);
const changes = computed(() =>
  permissionChanges(
    original.value,
    includeMenuParents(checked.value, menus.value),
  ),
);
const labels = computed(
  () =>
    new Map(flattenTree(menus.value).map((menu) => [menu.ID, menu.meta.title])),
);
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
  original.value = [];
  try {
    const [all, assigned] = await Promise.all([
      getMenuTree(),
      getAuthorityMenus(id),
    ]);
    if (version !== loadVersion) return;
    menus.value = all.list ?? [];
    tree.value = toTree(menus.value);
    checked.value = flattenTree(assigned.list ?? []).map((menu) => menu.ID);
    original.value = [...checked.value];
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
    open.value = false;
    emit('saved');
    refreshRoleAccess(roleId.value);
  } finally {
    saving.value = false;
  }
}
function save() {
  if (!loaded.value || loading.value || saving.value) return;
  if (changes.value.total === 0 || changes.value.removed.length)
    confirmAction(
      changes.value.total === 0
        ? '清空此角色的全部业务菜单？'
        : '确认修改菜单授权？',
      persist,
      `新增 ${changes.value.added.length} 项，撤销 ${changes.value.removed.length} 项，保存后共 ${changes.value.total} 项（含必要父菜单）。撤销菜单会同时清理对应按钮授权；接口权限不会随之修改。`,
    );
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
      <p class="mb-3 text-sm">
        已选 {{ changes.total }} 项 · 新增 {{ changes.added.length }} 项 · 撤销
        {{ changes.removed.length }} 项
      </p>
      <details
        v-if="changes.added.length || changes.removed.length"
        class="mb-3 rounded border p-3 text-sm"
      >
        <summary class="cursor-pointer">查看本次菜单授权变更</summary>
        <ul class="mt-2 space-y-1">
          <li v-for="id in changes.added" :key="`add-${id}`">
            新增：{{ labels.get(id) ?? id }}
          </li>
          <li v-for="id in changes.removed" :key="`remove-${id}`">
            撤销：{{ labels.get(id) ?? id }}
          </li>
        </ul>
      </details>
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
