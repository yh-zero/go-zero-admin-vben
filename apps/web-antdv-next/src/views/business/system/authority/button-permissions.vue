<script setup lang="ts">
import { ref } from 'vue';

import { Button, CheckboxGroup, Drawer, Space, Spin } from 'antdv-next';

import {
  getAuthorityButtons,
  getAuthorityMenus,
  saveAuthorityButtons,
} from '#/api/business/system/menu';

import { confirmAction, flattenTree, refreshAccess } from '../shared';
const open = ref(false);
const loading = ref(false);
const loaded = ref(false);
let loadVersion = 0;
const saving = ref(false);
const roleId = ref(0);
const title = ref('');
const selected = ref<number[]>([]);
const options = ref<Array<{ label: string; value: number }>>([]);
async function show(id: number, name: string) {
  const version = ++loadVersion;
  roleId.value = id;
  title.value = `${name} · 按钮授权`;
  open.value = true;
  loading.value = true;
  loaded.value = false;
  selected.value = [];
  options.value = [];
  try {
    const [assigned, menus] = await Promise.all([
      getAuthorityButtons(id),
      getAuthorityMenus(id),
    ]);
    if (version !== loadVersion) return;
    selected.value = assigned.menuBtnIds ?? [];
    options.value = flattenTree(menus.list ?? []).flatMap((menu) =>
      (menu.menuBtn ?? [])
        .filter((button) => button.ID)
        .map((button) => ({
          label: `${menu.meta.title} / ${button.desc || button.name} (${menu.name}:${button.name})`,
          value: button.ID!,
        })),
    );
    loaded.value = true;
  } finally {
    if (version === loadVersion) loading.value = false;
  }
}
async function persist() {
  if (!loaded.value || loading.value || saving.value) return;
  saving.value = true;
  try {
    await saveAuthorityButtons(roleId.value, selected.value);
    open.value = false;
    refreshAccess();
  } finally {
    saving.value = false;
  }
}
function save() {
  if (!loaded.value || loading.value || saving.value) return;
  if (!selected.value.length) confirmAction('清空此角色的按钮权限？', persist);
  else void persist();
}
defineExpose({ show });
</script>
<template>
  <Drawer
    v-model:open="open"
    :title="title"
    :size="600"
    :mask-closable="!saving"
    :closable="!saving"
  >
    <Spin :spinning="loading">
      <p class="mb-4">
        只展示此角色已授权菜单下的按钮。接口访问权限需单独保存。
      </p>
      <CheckboxGroup
        v-model:value="selected"
        :options="options"
        :disabled="saving || loading"
        class="flex flex-col gap-3"
      />
      <p v-if="!loading && !options.length">没有可授权按钮，请先分配菜单。</p>
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
          保存按钮授权
        </Button>
      </Space>
    </template>
  </Drawer>
</template>
