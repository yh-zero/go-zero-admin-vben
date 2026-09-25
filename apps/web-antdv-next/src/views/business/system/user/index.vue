<script setup lang="ts">
import type { TableQuery } from '../shared';

import type { User } from '#/api/business/system/types';
import type { CreateUser } from '#/api/business/system/user';

import { markRaw, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Button, message, Modal, Space, Tag } from 'antdv-next';

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

import {
  confirmAction,
  flattenTree,
  statusOptions,
  usePermission,
} from '../shared';
const can = usePermission('user');
const canTools = usePermission('businessTools');
const userStore = useUserStore();
const auth = useAuthStore();
const open = ref(false);
const saving = ref(false);
const imageUploading = ref(false);
const editing = ref<User>();
const rowBusy = ref<number>();
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
      rules: z.string().min(6, '密码至少 6 位').optional(),
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
        width: 320,
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
  const authorities = flattenTree(await getAllAuthorities()).map((role) => ({
    label: role.authorityName,
    value: role.authorityId,
  }));
  editing.value = row;
  open.value = true;
  await form.reset();
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
  try {
    if (!(await form.validate()).valid) return;
    const values = await form.getValues();
    if (!values.authorityIds.includes(values.authorityId)) {
      message.warning('默认角色必须属于关联角色');
      return;
    }
    if (!editing.value && !values.passWord) {
      message.warning('请输入新用户密码');
      return;
    }
    if (editing.value) {
      await updateUser({
        ID: editing.value.ID,
        nickName: values.nickName,
        phone: values.phone ?? '',
        email: values.email ?? '',
        headerImg: values.headerImg ?? '',
        enable: values.enable,
        authorityId: values.authorityId,
        authorityIds: values.authorityIds,
      });
      if (editing.value.authorityId !== values.authorityId) {
        message.info('默认角色变更需要该用户重新登录');
        if (String(editing.value.ID) === String(userStore.userInfo?.userId)) {
          await auth.logout(false);
          return;
        }
      }
    } else await createUser(values);
    message.success('保存成功');
    open.value = false;
    await grid.query();
  } finally {
    saving.value = false;
  }
}
function remove(row: User) {
  confirmAction(`删除用户 ${row.userName}？`, async () => {
    rowBusy.value = row.ID;
    try {
      await deleteUser(row.ID);
      message.success('已删除');
      await grid.reload();
    } finally {
      rowBusy.value = undefined;
    }
  });
}
function resetPassword(row: User) {
  confirmAction(
    `重置 ${row.userName} 的密码？`,
    async () => {
      rowBusy.value = row.ID;
      try {
        await resetUserPassword(row.ID);
        message.success('密码已重置为 goZero');
      } finally {
        rowBusy.value = undefined;
      }
    },
    '默认密码：goZero',
  );
}
function toggle(row: User) {
  confirmAction(
    `${row.enable === 1 ? '冻结' : '启用'}用户 ${row.userName}？`,
    async () => {
      rowBusy.value = row.ID;
      try {
        await updateUser({ ID: row.ID, enable: row.enable === 1 ? 2 : 1 });
        message.success('状态已更新');
        await grid.query();
      } finally {
        rowBusy.value = undefined;
      }
    },
    '冻结后禁止新登录，已签发令牌到期失效。',
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
  </Page>
</template>
