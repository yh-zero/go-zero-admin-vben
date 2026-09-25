<script setup lang="ts">
import type { ApiResource, Policy } from '#/api/business/system/types';

import { computed, ref } from 'vue';

import {
  Alert,
  Button,
  CheckboxGroup,
  Drawer,
  message,
  Select,
  Space,
  Spin,
  TextArea,
} from 'antdv-next';

import { getAllApis } from '#/api/business/system/api';
import {
  getPolicies,
  savePolicies,
  savePolicyApiIds,
} from '#/api/business/system/casbin';

import { confirmAction } from '../shared';
import { parsePolicies, policyKey, splitPolicies } from './authorization';
const open = ref(false);
const loading = ref(false);
const loaded = ref(false);
let loadVersion = 0;
const saving = ref(false);
const roleId = ref(0);
const title = ref('');
const mode = ref('ids');
const apis = ref<ApiResource[]>([]);
const selected = ref<number[]>([]);
const unknown = ref<Policy[]>([]);
const text = ref('');
const options = computed(() =>
  apis.value.map((api) => ({
    label: `${api.apiGroup} · ${api.method} ${api.path} · ${api.description}`,
    value: api.ID,
  })),
);
async function show(id: number, name: string) {
  const version = ++loadVersion;
  roleId.value = id;
  title.value = `${name} · 接口授权`;
  open.value = true;
  loading.value = true;
  loaded.value = false;
  apis.value = [];
  selected.value = [];
  unknown.value = [];
  text.value = '';
  mode.value = 'ids';
  try {
    const [all, rules] = await Promise.all([getAllApis(), getPolicies(id)]);
    if (version !== loadVersion) return;
    apis.value = all.apiList ?? [];
    const policies = rules.list ?? [];
    const split = splitPolicies(policies, apis.value);
    selected.value = split.ids;
    unknown.value = split.unknown;
    text.value = policies.map(policyKey).join('\n');
    if (unknown.value.length) mode.value = 'paths';
    loaded.value = true;
  } finally {
    if (version === loadVersion) loading.value = false;
  }
}
function changeMode(value: unknown) {
  if (value === mode.value) return;
  if (value === 'paths') {
    const ids = new Set(selected.value);
    text.value = [
      ...apis.value.filter((api) => ids.has(api.ID)),
      ...unknown.value,
    ]
      .map(policyKey)
      .join('\n');
  } else {
    try {
      const split = splitPolicies(parsePolicies(text.value), apis.value);
      selected.value = split.ids;
      unknown.value = split.unknown;
    } catch (error) {
      message.warning((error as Error).message);
      return;
    }
  }
  mode.value = String(value);
}
async function persist(policies?: Policy[]) {
  if (!loaded.value || loading.value || saving.value) return;
  saving.value = true;
  try {
    if (mode.value === 'ids')
      await savePolicyApiIds(roleId.value, selected.value);
    else await savePolicies(roleId.value, policies ?? []);
    message.success('接口授权已保存，后端立即生效');
    open.value = false;
  } finally {
    saving.value = false;
  }
}
function save() {
  if (!loaded.value || loading.value || saving.value) return;
  if (mode.value === 'ids' && unknown.value.length) {
    message.warning('存在未登记规则，请使用路径模式保存，避免丢失权限');
    return;
  }
  let policies: Policy[] | undefined;
  if (mode.value === 'paths') {
    try {
      policies = parsePolicies(text.value);
    } catch (error) {
      message.warning((error as Error).message);
      return;
    }
  }
  if ((mode.value === 'ids' ? selected.value.length : policies?.length) === 0)
    confirmAction(
      '清空此角色的全部接口权限？',
      () => persist(policies),
      '该角色可能无法加载菜单或使用业务功能。',
    );
  else void persist(policies);
}
defineExpose({ show });
</script>
<template>
  <Drawer
    v-model:open="open"
    :title="title"
    :size="760"
    :mask-closable="!saving"
    :closable="!saving"
  >
    <Spin :spinning="loading">
      <Select
        :value="mode"
        :disabled="saving || loading"
        :options="[
          { label: '按 API 清单选择', value: 'ids' },
          { label: '按路径和方法（高级）', value: 'paths' },
        ]"
        class="mb-4 w-full"
        @change="changeMode"
      />
      <Alert
        v-if="unknown.length"
        type="warning"
        show-icon
        class="mb-4"
        :message="`有 ${unknown.length} 条未登记规则，已保留在路径模式；按 API ID 保存暂不可用。`"
      />
      <template v-if="mode === 'ids'">
        <p class="mb-3 text-sm">
          一次保存仅替换接口权限，不修改菜单与按钮授权。
        </p>
        <CheckboxGroup
          v-model:value="selected"
          :options="options"
          :disabled="saving || loading"
          class="flex flex-col gap-3"
        />
      </template>
      <template v-else>
        <p class="mb-3 text-sm">
          每行一条，例如 GET
          /v1/sys/menu/getMenu。已有未登记规则会保留，删除行代表明确撤销。
        </p>
        <TextArea
          v-model:value="text"
          :rows="22"
          :disabled="saving || loading"
          class="font-mono"
        />
      </template>
    </Spin>
    <template #footer>
      <Space>
        <Button :disabled="saving" @click="open = false">取消</Button>
        <Button
          type="primary"
          :loading="saving"
          :disabled="
            !loaded || loading || (mode === 'ids' && unknown.length > 0)
          "
          @click="save"
        >
          {{ mode === 'ids' ? '保存所选 API 权限' : '保存路径权限' }}
        </Button>
      </Space>
    </template>
  </Drawer>
</template>
