<script setup lang="ts">
import type { TableQuery } from '../shared';

import type { Authority } from '#/api/business/system/types';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useAccessStore } from '@vben/stores';

import { Button, message, Modal, Space } from 'antdv-next';

import { updateSessionHome } from '#/adapter/business/session';
import { useVbenForm, z } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createAuthority,
  deleteAuthority,
  getAllAuthorities,
  getAuthorities,
  updateAuthority,
} from '#/api/business/system/authority';
import { getAuthorityMenus } from '#/api/business/system/menu';

import {
  confirmAction,
  flattenTree,
  refreshAccess,
  usePermission,
} from '../shared';
import ApiPermissions from './api-permissions.vue';
import { homeMenuOptions } from './authorization';
import ButtonPermissions from './button-permissions.vue';
import MenuPermissions from './menu-permissions.vue';
const can = usePermission('authority');
const accessStore = useAccessStore();
const open = ref(false);
const saving = ref(false);
const editing = ref<Authority>();
const menus = ref<InstanceType<typeof MenuPermissions>>();
const buttons = ref<InstanceType<typeof ButtonPermissions>>();
const apis = ref<InstanceType<typeof ApiPermissions>>();
const [Form, form] = useVbenForm<Authority>({
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1',
  schema: [
    {
      fieldName: 'authorityId',
      label: '角色 ID',
      component: 'InputNumber',
      componentProps: { min: 1, precision: 0 },
      rules: z.number().int().positive('角色 ID 必须为正整数'),
    },
    {
      fieldName: 'authorityName',
      label: '角色名',
      component: 'Input',
      rules: 'required',
    },
    {
      fieldName: 'parentId',
      label: '父角色',
      component: 'Select',
      componentProps: { options: [] },
      rules: 'selectRequired',
    },
    {
      fieldName: 'defaultRouter',
      label: '默认首页',
      component: 'Select',
      componentProps: { options: [] },
      help: '保存菜单名称；新增角色默认首页为 index。',
    },
  ],
});
const [Grid, grid] = useVbenVxeGrid<Authority>({
  gridOptions: {
    columns: [
      { field: 'authorityName', title: '角色', treeNode: true, minWidth: 180 },
      { field: 'authorityId', title: '角色 ID', width: 100 },
      { field: 'defaultRouter', title: '默认首页', minWidth: 150 },
      {
        title: '操作',
        width: 430,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    treeConfig: {
      rowField: 'authorityId',
      childrenField: 'children',
      expandAll: true,
    },
    pagerConfig: { pageSize: 10 },
    rowConfig: { keyField: 'authorityId' },
    toolbarConfig: { refresh: true },
    proxyConfig: {
      ajax: {
        query: async ({ page }: TableQuery) => {
          const result = await getAuthorities({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
          });
          return { items: result.list ?? [], total: result.total };
        },
      },
    },
  },
});
async function showForm(row?: Authority) {
  const [all, assigned] = await Promise.all([
    getAllAuthorities(),
    row ? getAuthorityMenus(row.authorityId) : Promise.resolve({ list: [] }),
  ]);
  const forbidden = new Set(
    row ? flattenTree([row]).map((role) => role.authorityId) : [],
  );
  const parents = [
    { label: '根角色', value: 0 },
    ...flattenTree(all)
      .filter((role) => !forbidden.has(role.authorityId))
      .map((role) => ({ label: role.authorityName, value: role.authorityId })),
  ];
  const homeOptions = row
    ? homeMenuOptions(assigned.list ?? [])
    : [{ label: '首页', value: 'index' }];
  editing.value = row;
  open.value = true;
  await form.reset();
  form.updateSchema([
    {
      fieldName: 'authorityId',
      componentProps: { disabled: !!row, min: 1, precision: 0 },
    },
    { fieldName: 'parentId', componentProps: { options: parents } },
    {
      fieldName: 'defaultRouter',
      componentProps: { options: homeOptions, allowClear: true },
    },
  ]);
  await form.setValues(
    row
      ? { ...row, parentId: row.parentId ?? 0 }
      : {
          authorityId: undefined,
          authorityName: '',
          parentId: 0,
          defaultRouter: 'index',
        },
  );
}
async function save() {
  if (saving.value) return;
  saving.value = true;
  try {
    if (!(await form.validate()).valid) return;
    const values = await form.getValues();
    const data = {
      authorityId: values.authorityId,
      authorityName: values.authorityName,
      parentId: values.parentId ?? 0,
      defaultRouter: values.defaultRouter ?? '',
    };
    await (editing.value ? updateAuthority(data) : createAuthority(data));
    message.success('保存成功');
    open.value = false;
    if (editing.value) {
      updateSessionHome(
        accessStore.accessToken,
        data.authorityId,
        data.defaultRouter,
      );
      refreshAccess();
    } else await grid.query();
  } finally {
    saving.value = false;
  }
}
function remove(row: Authority) {
  confirmAction(
    `删除角色 ${row.authorityName}？`,
    async () => {
      await deleteAuthority(row.authorityId);
      message.success('已删除');
      await grid.reload();
    },
    '存在子角色或关联用户时，需要先处理依赖。',
  );
}
</script>
<template>
  <Page>
    <Grid>
      <template #toolbar-tools>
        <Button v-if="can('create')" type="primary" @click="showForm()">
          新增角色
        </Button>
      </template>
      <template #actions="{ row }">
        <Space>
          <Button
            v-if="can('update')"
            type="link"
            size="small"
            @click="showForm(row)"
          >
            编辑
          </Button>
          <Button
            v-if="can('menus')"
            type="link"
            size="small"
            @click="menus?.show(row.authorityId, row.authorityName)"
          >
            菜单授权
          </Button>
          <Button
            v-if="can('buttons')"
            type="link"
            size="small"
            @click="buttons?.show(row.authorityId, row.authorityName)"
          >
            按钮授权
          </Button>
          <Button
            v-if="can('apis')"
            type="link"
            size="small"
            @click="apis?.show(row.authorityId, row.authorityName)"
          >
            接口授权
          </Button>
          <Button
            v-if="can('delete')"
            type="link"
            danger
            size="small"
            @click="remove(row)"
          >
            删除
          </Button>
        </Space>
      </template>
    </Grid>
    <Modal
      v-model:open="open"
      :title="editing ? '编辑角色' : '新增角色'"
      :confirm-loading="saving"
      :force-render="true"
      :mask-closable="false"
      :cancel-button-props="{ disabled: saving }"
      :closable="!saving"
      @ok="save"
    >
      <Form />
    </Modal>
    <MenuPermissions ref="menus" />
    <ButtonPermissions ref="buttons" />
    <ApiPermissions ref="apis" />
  </Page>
</template>
