<script setup lang="ts">
import type {
  DataScope,
  Department,
  RoleDataScope,
} from '#/api/business/system/organization';

import { computed, ref } from 'vue';

import {
  Alert,
  Button,
  Drawer,
  message,
  Select,
  Space,
  Spin,
  Tree,
} from 'antdv-next';

import {
  getDepartments,
  getRoleDataScope,
  updateRoleDataScope,
} from '#/api/business/system/organization';

import { confirmAction } from '../shared';
import { sameIds } from './helpers';

const open = ref(false);
const loading = ref(false);
const loaded = ref(false);
const saving = ref(false);
const authorityId = ref(0);
const roleName = ref('');
const scope = ref<DataScope>('self');
const checked = ref<number[]>([]);
const departments = ref<Department[]>([]);
const original = ref<RoleDataScope>();
let loadVersion = 0;
const scopes: Array<{ label: string; value: DataScope }> = [
  { value: 'all', label: '全部数据' },
  { value: 'self', label: '仅本人创建的数据' },
  { value: 'department', label: '本人当前部门' },
  { value: 'department_and_children', label: '本人当前部门及全部下级' },
  { value: 'custom', label: '指定部门（不自动包含下级）' },
];
interface DepartmentNode {
  key: number;
  title: string;
  disabled: boolean;
  children: DepartmentNode[];
}
function toTree(
  nodes: Department[],
  ancestorDisabled = false,
): DepartmentNode[] {
  return nodes.map((node) => {
    const disabled = ancestorDisabled || node.status !== 1;
    return {
      key: node.id,
      title: `${node.name}${disabled ? '（停用）' : ''}`,
      disabled:
        disabled &&
        !(
          original.value?.scope === 'custom' &&
          original.value.departmentIds.includes(node.id)
        ),
      children: toTree(node.children ?? [], disabled),
    };
  });
}
const tree = computed(() => toTree(departments.value));
async function show(id: number, name: string) {
  if (saving.value) return;
  const version = ++loadVersion;
  authorityId.value = id;
  roleName.value = name;
  open.value = true;
  loading.value = true;
  loaded.value = false;
  original.value = undefined;
  checked.value = [];
  departments.value = [];
  scope.value = 'self';
  try {
    const [assigned, all] = await Promise.all([
      getRoleDataScope(id),
      getDepartments(),
    ]);
    if (version !== loadVersion) return;
    if (
      assigned.authorityId !== id ||
      !scopes.some((item) => item.value === assigned.scope)
    )
      throw new Error('角色数据范围响应不匹配');
    scope.value = id === 1 ? 'all' : assigned.scope;
    checked.value = [...assigned.departmentIds];
    departments.value = all;
    original.value = {
      ...assigned,
      departmentIds: [...assigned.departmentIds],
    };
    loaded.value = true;
  } catch {
    // Keep failed reads visible and block accidental empty writes.
  } finally {
    if (version === loadVersion) loading.value = false;
  }
}
function updateChecked(
  value: Array<number | string> | { checked: Array<number | string> },
) {
  checked.value = (Array.isArray(value) ? value : value.checked).map(Number);
}
async function persist(data: RoleDataScope) {
  if (saving.value || !loaded.value || authorityId.value !== data.authorityId)
    return;
  saving.value = true;
  try {
    await updateRoleDataScope(data);
    loaded.value = false;
    message.success('数据范围已保存，下次查询立即生效');
    open.value = false;
  } finally {
    saving.value = false;
  }
}
function save() {
  if (
    !loaded.value ||
    loading.value ||
    saving.value ||
    authorityId.value === 1 ||
    !original.value
  )
    return;
  if (scope.value === 'custom' && checked.value.length === 0) {
    message.warning('指定部门范围至少选择一个部门');
    return;
  }
  const data = {
    authorityId: authorityId.value,
    scope: scope.value,
    departmentIds: scope.value === 'custom' ? [...new Set(checked.value)] : [],
  };
  if (
    original.value.scope === data.scope &&
    sameIds(original.value.departmentIds, data.departmentIds)
  ) {
    message.info('数据范围没有变化');
    open.value = false;
    return;
  }
  confirmAction(
    `修改 ${roleName.value} 的数据范围？`,
    () => persist(data),
    `将设为“${scopes.find((item) => item.value === data.scope)?.label}”。当前影响文件资源查询，保存后无需重新登录；原有菜单和接口权限仍需单独授权。`,
  );
}
defineExpose({ show });
</script>
<template>
  <Drawer
    v-model:open="open"
    :title="`${roleName} · 数据范围`"
    :size="520"
    :mask-closable="!saving"
    :closable="!saving"
  >
    <Spin :spinning="loading">
      <Alert
        class="mb-4"
        type="info"
        show-icon
        message="当前数据范围用于文件资源查询。菜单和接口权限单独控制；旧管理列表尚未统一接入此范围。"
      />
      <Alert
        v-if="authorityId === 1"
        class="mb-4"
        type="info"
        message="管理员角色 1 固定为全部数据，无法修改。"
      />
      <template v-if="loaded">
        <label class="mb-2 block" for="organization-data-scope">可查询范围</label>
        <Select
          id="organization-data-scope"
          v-model:value="scope"
          class="mb-4 w-full"
          :options="scopes"
          :disabled="saving || authorityId === 1"
        />
        <p class="mb-4 text-sm">
          未配置的普通角色默认为仅本人数据。未分配部门时，部门范围不会返回其他人的数据。
        </p>
        <template v-if="scope === 'custom'">
          <p class="mb-3 text-sm">
            指定部门
            {{ checked.length }}
            项。下级部门需要分别勾选；停用部门不能新增到范围。
          </p>
          <Tree
            :tree-data="tree"
            checkable
            check-strictly
            default-expand-all
            :checked-keys="checked"
            :disabled="saving"
            @check="updateChecked"
          />
          <p v-if="departments.length === 0" class="text-sm">
            暂无部门，请先创建部门或选择其他范围。
          </p>
        </template>
      </template>
      <Alert
        v-else-if="!loading"
        type="error"
        message="数据范围或部门读取失败，保存已禁用。"
      >
        <template #action>
          <Button @click="show(authorityId, roleName)"> 重新读取 </Button>
        </template>
      </Alert>
    </Spin>
    <template #footer>
      <Space>
        <Button :disabled="saving" @click="open = false">取消</Button>
        <Button
          type="primary"
          :loading="saving"
          :disabled="!loaded || loading || authorityId === 1"
          @click="save"
        >
          保存数据范围
        </Button>
      </Space>
    </template>
  </Drawer>
</template>
