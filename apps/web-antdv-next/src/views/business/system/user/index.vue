<script setup lang="ts">
import type { TableQuery } from '../shared';

import type { User } from '#/api/business/system/types';
import type { CreateUser } from '#/api/business/system/user';

import { markRaw, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Button, message, Modal, Space, Tag } from 'antdv-next';

import { isValidPassword } from '#/adapter/business/password';
import { useVbenForm, z } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getAllAuthorities } from '#/api/business/system/authority';
import {
  createUser,
  deleteUser,
  getUsers,
  resetUserPassword,
  updateUser,
} from '#/api/business/system/user';
import ImageUpload from '#/components/business/image-upload.vue';
import { useAuthStore } from '#/store';

import MembershipModal from '../organization/membership-modal.vue';
import {
  confirmAction,
  flattenTree,
  statusOptions,
  usePermission,
} from '../shared';
const can = usePermission('user');
const canTools = usePermission('businessTools');
const userStore = useUserStore();
const access = useAccessStore();
const auth = useAuthStore();
const open = ref(false);
const saving = ref(false);
const imageUploading = ref(false);
const editing = ref<User>();
const rowBusy = ref<number>();
const membership = ref<InstanceType<typeof MembershipModal>>();
let formLoadVersion = 0;
const [Form, form] = useVbenForm<CreateUser>({
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1',
  schema: [
    {
      fieldName: 'userName',
      label: '用户名',
      component: 'Input',
      rules: z.string().trim().min(1, '请输入用户名').max(50),
    },
    {
      fieldName: 'passWord',
      label: '密码',
      component: 'InputPassword',
      dependencies: {
        triggerFields: ['userName'],
        resolve: () => ({ show: !editing.value }),
      },
      rules: z.string().refine(isValidPassword, '密码须为8至72字节').optional(),
    },
    {
      fieldName: 'nickName',
      label: '昵称',
      component: 'Input',
      rules: 'required',
    },
    {
      fieldName: 'authorityIds',
      label: '关联角色',
      component: 'Select',
      componentProps: { mode: 'multiple', options: [] },
      rules: z.array(z.number()).min(1, '至少选择一个角色'),
    },
    {
      fieldName: 'authorityId',
      label: '默认角色',
      component: 'Select',
      componentProps: { options: [] },
      rules: 'selectRequired',
    },
    { fieldName: 'phone', label: '电话', component: 'Input' },
    {
      fieldName: 'email',
      label: '邮箱',
      component: 'Input',
      rules: z
        .union([z.literal(''), z.string().email('邮箱格式错误')])
        .optional(),
    },
    {
      fieldName: 'enable',
      label: '状态',
      component: 'Select',
      componentProps: { options: statusOptions },
      rules: 'selectRequired',
      defaultValue: 1,
    },
    {
      fieldName: 'headerImg',
      label: '头像',
      component: markRaw(ImageUpload),
      componentProps: () => ({
        canUpload: canTools('upload'),
        disabled: saving.value,
        onUploadingChange: (value: boolean) => {
          imageUploading.value = value;
        },
      }),
    },
  ],
});
const [Grid, grid] = useVbenVxeGrid<User>({
  formOptions: {
    schema: [
      {
        fieldName: 'keyword',
        label: '搜索',
        component: 'Input',
        componentProps: { placeholder: '用户名或昵称', allowClear: true },
      },
    ],
    submitOnChange: false,
  },
  gridOptions: {
    columns: [
      { field: 'userName', title: '用户名', minWidth: 130 },
      { field: 'nickName', title: '昵称', minWidth: 120 },
      { field: 'phone', title: '电话', minWidth: 130 },
      { field: 'email', title: '邮箱', minWidth: 180 },
      {
        field: 'enable',
        title: '状态',
        width: 90,
        slots: { default: 'status' },
      },
      {
        title: '操作',
        width: 400,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    pagerConfig: { pageSize: 10 },
    proxyConfig: {
      ajax: {
        query: async ({ page }: TableQuery, values: { keyword?: string }) => {
          const result = await getUsers({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            keyword: values.keyword,
          });
          return { items: result.list ?? [], total: result.total };
        },
      },
    },
    toolbarConfig: { refresh: true },
    rowConfig: { keyField: 'ID' },
  },
});
async function showForm(row?: User) {
  if (saving.value || imageUploading.value) return;
  const version = ++formLoadVersion;
  const token = access.accessToken;
  const authorities = flattenTree(await getAllAuthorities()).map((role) => ({
    label: role.authorityName,
    value: role.authorityId,
  }));
  if (version !== formLoadVersion || access.accessToken !== token) return;
  editing.value = row;
  open.value = true;
  await form.reset();
  if (version !== formLoadVersion || access.accessToken !== token) return;
  form.updateSchema([
    { fieldName: 'userName', componentProps: { disabled: !!row } },
    {
      fieldName: 'authorityIds',
      componentProps: { options: authorities, mode: 'multiple' },
    },
    { fieldName: 'authorityId', componentProps: { options: authorities } },
  ]);
  await form.setValues(
    row
      ? {
          ...row,
          passWord: undefined,
          authorityIds: row.authorities?.map((role) => role.authorityId) ?? [
            row.authorityId,
          ],
        }
      : {
          userName: '',
          passWord: undefined,
          nickName: '',
          authorityIds: [],
          authorityId: undefined,
          phone: '',
          email: '',
          headerImg: '',
          enable: 1,
        },
  );
}
async function save() {
  if (saving.value || imageUploading.value) return;
  saving.value = true;
  const token = access.accessToken;
  const target = editing.value;
  try {
    if (!(await form.validate()).valid) return;
    const values = await form.getValues();
    if (access.accessToken !== token) return;
    if (!values.authorityIds.includes(values.authorityId)) {
      message.warning('默认角色必须属于关联角色');
      return;
    }
    if (!target && !values.passWord) {
      message.warning('请输入新用户密码');
      return;
    }
    if (target) {
      await updateUser({
        ID: target.ID,
        nickName: values.nickName,
        phone: values.phone ?? '',
        email: values.email ?? '',
        headerImg: values.headerImg ?? '',
        enable: values.enable,
        authorityId: values.authorityId,
        authorityIds: values.authorityIds,
      });
      if (access.accessToken !== token) return;
      const previousRoles = [
        ...(target.authorities?.map((role) => role.authorityId) ?? [
          target.authorityId,
        ]),
      ].sort();
      const nextRoles = [...values.authorityIds].sort();
      const sessionChanged =
        target.authorityId !== values.authorityId ||
        target.enable !== values.enable ||
        JSON.stringify(previousRoles) !== JSON.stringify(nextRoles);
      if (sessionChanged) {
        message.info('状态或角色已变更，该用户需要重新登录');
        if (String(target.ID) === String(userStore.userInfo?.userId)) {
          await auth.logout(false, false);
          return;
        }
      } else if (String(target.ID) === String(userStore.userInfo?.userId)) {
        await auth.fetchUserInfo();
      }
    } else await createUser(values);
    if (access.accessToken !== token) return;
    message.success('保存成功');
    open.value = false;
    await grid.query();
  } finally {
    saving.value = false;
  }
}
function remove(row: User) {
  if (rowBusy.value !== undefined) return;
  const token = access.accessToken;
  confirmAction(`删除用户 ${row.userName}？`, async () => {
    if (rowBusy.value !== undefined || access.accessToken !== token) return;
    rowBusy.value = row.ID;
    try {
      await deleteUser(row.ID);
      if (access.accessToken !== token) return;
      message.success('已删除');
      if (String(row.ID) === String(userStore.userInfo?.userId)) {
        await auth.logout(false, false);
        return;
      }
      await grid.reload();
    } finally {
      rowBusy.value = undefined;
    }
  });
}
function resetPassword(row: User) {
  if (rowBusy.value !== undefined) return;
  const token = access.accessToken;
  confirmAction(
    `重置 ${row.userName} 的密码？`,
    async () => {
      if (rowBusy.value !== undefined || access.accessToken !== token) return;
      rowBusy.value = row.ID;
      try {
        await resetUserPassword(row.ID);
        if (access.accessToken !== token) return;
        message.success('密码已重置为服务端配置的默认密码，该用户需要重新登录');
        if (String(row.ID) === String(userStore.userInfo?.userId))
          await auth.logout(false, false);
      } finally {
        rowBusy.value = undefined;
      }
    },
    '将使用服务端配置的默认密码，并立即撤销该用户的旧登录会话。',
  );
}
function toggle(row: User) {
  if (rowBusy.value !== undefined) return;
  const token = access.accessToken;
  confirmAction(
    `${row.enable === 1 ? '冻结' : '启用'}用户 ${row.userName}？`,
    async () => {
      if (rowBusy.value !== undefined || access.accessToken !== token) return;
      rowBusy.value = row.ID;
      try {
        await updateUser({ ID: row.ID, enable: row.enable === 1 ? 2 : 1 });
        if (access.accessToken !== token) return;
        message.success('状态已更新');
        await grid.query();
      } finally {
        rowBusy.value = undefined;
      }
    },
    '状态变更会立即撤销该用户的旧登录会话；冻结后禁止新登录。',
  );
}
</script>
<template>
  <Page>
    <Grid>
      <template #toolbar-tools>
        <Button v-if="can('create')" type="primary" @click="showForm()">
          新增用户
        </Button>
      </template>
      <template #status="{ row }">
        <Tag :color="row.enable === 1 ? 'green' : 'red'">
          {{ row.enable === 1 ? '启用' : '冻结' }}
        </Tag>
      </template>
      <template #actions="{ row }">
        <Space>
          <Button
            v-if="can('update')"
            type="link"
            size="small"
            :disabled="rowBusy === row.ID"
            @click="showForm(row)"
          >
            编辑
          </Button>
          <Button
            v-if="can('update')"
            type="link"
            size="small"
            :disabled="
              rowBusy === row.ID ||
                String(row.ID) === String(userStore.userInfo?.userId)
            "
            @click="toggle(row)"
          >
            {{ row.enable === 1 ? '冻结' : '启用' }}
          </Button>
          <Button
            v-if="can('membership')"
            type="link"
            size="small"
            :disabled="rowBusy === row.ID || saving"
            @click="membership?.show(row.ID, row.userName)"
          >
            部门岗位
          </Button>
          <Button
            v-if="can('resetPassword')"
            type="link"
            size="small"
            :disabled="rowBusy === row.ID"
            @click="resetPassword(row)"
          >
            重置密码
          </Button>
          <Button
            v-if="can('delete')"
            type="link"
            danger
            size="small"
            :disabled="
              rowBusy === row.ID ||
                String(row.ID) === String(userStore.userInfo?.userId)
            "
            @click="remove(row)"
          >
            删除
          </Button>
        </Space>
      </template>
    </Grid>
    <Modal
      v-model:open="open"
      :title="editing ? '编辑用户' : '新增用户'"
      :confirm-loading="saving"
      :mask-closable="false"
      :closable="!saving && !imageUploading"
      :cancel-button-props="{ disabled: saving || imageUploading }"
      :ok-button-props="{ disabled: imageUploading }"
      :force-render="true"
      @ok="save"
    >
      <Form />
    </Modal>
    <MembershipModal ref="membership" @saved="grid.query()" />
  </Page>
</template>
