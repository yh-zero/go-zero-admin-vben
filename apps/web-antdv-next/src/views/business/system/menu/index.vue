<script setup lang="ts">
import type { Menu, MenuButton } from '#/api/business/system/types';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Alert, Button, Input, message, Modal, Space } from 'antdv-next';

import { businessPages } from '#/adapter/business/pages';
import { useVbenForm, z } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createMenu,
  deleteMenu,
  getMenu,
  getMenus,
  updateMenu,
} from '#/api/business/system/menu';

import {
  confirmAction,
  flattenTree,
  refreshAccess,
  usePermission,
} from '../shared';
import { changedMenuButtons, prepareMenuButtons } from './buttons';
const can = usePermission('menu');
const open = ref(false);
const saving = ref(false);
const editing = ref<Menu>();
const rows = ref<Menu[]>([]);
const buttons = ref<MenuButton[]>([]);
const components = businessPages.map(({ label, value }) => ({ label, value }));
const [Form, form] = useVbenForm({
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1',
  schema: [
    {
      fieldName: 'title',
      label: '标题',
      component: 'Input',
      rules: 'required',
    },
    {
      fieldName: 'name',
      label: '路由名称',
      component: 'Input',
      rules: z.string().regex(/^[A-Za-z][\w-]*$/, '使用英文字母开头的唯一名称'),
    },
    {
      fieldName: 'path',
      label: '路径',
      component: 'Input',
      rules: z.string().min(1, '请输入路径'),
    },
    {
      fieldName: 'parentId',
      label: '父菜单',
      component: 'Select',
      componentProps: {
        class: 'w-full',
        options: [],
        showSearch: { optionFilterProp: 'label' },
      },
      rules: 'selectRequired',
    },
    {
      fieldName: 'component',
      label: '页面组件',
      component: 'Select',
      componentProps: {
        class: 'w-full',
        options: components,
        popupMatchSelectWidth: true,
        showSearch: { optionFilterProp: 'label' },
      },
      rules: 'required',
    },
    {
      fieldName: 'icon',
      label: '图标',
      component: 'IconPicker',
      componentProps: { class: 'w-full', prefix: 'lucide' },
      help: '点击选择或输入图标名称，留空使用默认图标',
    },
    {
      fieldName: 'sort',
      label: '排序',
      component: 'InputNumber',
      componentProps: { precision: 0, min: 0 },
      defaultValue: 0,
    },
    {
      fieldName: 'hidden',
      label: '隐藏菜单',
      component: 'Switch',
      defaultValue: false,
    },
    {
      fieldName: 'keepAlive',
      label: '缓存页面',
      component: 'Switch',
      defaultValue: false,
    },
  ],
});
const [Grid, grid] = useVbenVxeGrid<Menu>({
  gridOptions: {
    columns: [
      { field: 'meta.title', title: '菜单', minWidth: 180, treeNode: true },
      { field: 'name', title: '名称', minWidth: 130 },
      { field: 'path', title: '路径', minWidth: 150 },
      { field: 'component', title: '组件', minWidth: 250 },
      { field: 'sort', title: '排序', width: 75 },
      {
        title: '操作',
        width: 150,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    treeConfig: { rowField: 'ID', childrenField: 'children', expandAll: true },
    pagerConfig: { enabled: false },
    proxyConfig: {
      ajax: {
        query: async () => {
          rows.value = (await getMenus()).list ?? [];
          return { items: rows.value };
        },
      },
    },
    toolbarConfig: { refresh: true },
    rowConfig: { keyField: 'ID' },
  },
});
async function showForm(row?: Menu) {
  const detail = row ? (await getMenu(row.ID)).sysBaseMenu : undefined;
  editing.value = detail;
  buttons.value = (detail?.menuBtn ?? []).map((button) => ({ ...button }));
  open.value = true;
  await form.reset();
  const excluded = new Set(
    detail ? flattenTree([row!]).map((item) => item.ID) : [],
  );
  const parents = [
    { label: '根菜单', value: 0 },
    ...flattenTree(rows.value)
      .filter((item) => !excluded.has(item.ID))
      .map((item) => ({ label: item.meta.title, value: item.ID })),
  ];
  const choices = [...components];
  if (detail && !choices.some((item) => item.value === detail.component))
    choices.push({
      label: `${detail.component}（原值）`,
      value: detail.component,
    });
  form.updateSchema([
    { fieldName: 'parentId', componentProps: { options: parents } },
    { fieldName: 'component', componentProps: { options: choices } },
  ]);
  await form.setValues(
    detail
      ? {
          ...detail,
          title: detail.meta.title,
          icon: detail.meta.icon,
          keepAlive: detail.meta.keepAlive ?? false,
        }
      : {
          parentId: 0,
          title: '',
          name: '',
          path: '',
          component: undefined,
          icon: '',
          sort: 0,
          hidden: false,
          keepAlive: false,
        },
  );
}
async function save() {
  if (saving.value) return;
  saving.value = true;
  try {
    if (!(await form.validate()).valid) return;
    let menuBtn: MenuButton[];
    try {
      menuBtn = prepareMenuButtons(buttons.value);
    } catch (error) {
      message.warning((error as Error).message);
      return;
    }
    const values = await form.getValues();
    const data: Menu = {
      ID: editing.value?.ID ?? 0,
      parentId: values.parentId,
      path: values.path,
      name: values.name,
      component: values.component,
      sort: values.sort ?? 0,
      hidden: !!values.hidden,
      meta: {
        ...editing.value?.meta,
        title: values.title,
        icon: values.icon ?? '',
        keepAlive: !!values.keepAlive,
        closeTab: editing.value?.meta.closeTab ?? false,
      },
      parameters: editing.value?.parameters ?? [],
      menuBtn,
    };
    const changed = changedMenuButtons(editing.value?.menuBtn ?? [], menuBtn);
    const renamed =
      editing.value && editing.value.name !== data.name && menuBtn.length > 0;
    const persist = async () => {
      saving.value = true;
      try {
        await (data.ID ? updateMenu(data) : createMenu(data));
        open.value = false;
        refreshAccess();
      } finally {
        saving.value = false;
      }
    };
    if (changed.length || renamed) {
      confirmAction(
        '确认修改按钮权限定义？',
        persist,
        `${renamed ? `菜单名称由 ${editing.value!.name} 改为 ${data.name}，将改变此菜单全部按钮的权限码前缀。` : ''}${changed.length ? `以下按钮被删除或修改标识：${changed.map((button) => `${button.desc} (${button.name})`).join('、')}。` : ''}删除会撤销关联角色的按钮授权；修改标识会改变页面使用的权限码，请同步业务代码。`,
      );
    } else await persist();
  } finally {
    saving.value = false;
  }
}
function remove(row: Menu) {
  confirmAction(
    `删除菜单 ${row.meta.title}？`,
    async () => {
      await deleteMenu(row.ID);
      message.success('已删除');
      await grid.query();
      refreshAccess();
    },
    '有子菜单或角色引用时需要先清理依赖。',
  );
}
</script>
<template>
  <Page>
    <Grid>
      <template #toolbar-tools>
        <Button v-if="can('create')" type="primary" @click="showForm()">
          新增菜单
        </Button>
      </template>
      <template #actions="{ row }">
        <Space>
          <Button
            v-if="can('update')"
            size="small"
            type="link"
            @click="showForm(row)"
          >
            编辑
          </Button>
          <Button
            v-if="can('delete')"
            size="small"
            type="link"
            danger
            @click="remove(row)"
          >
            删除
          </Button>
        </Space>
      </template>
    </Grid>
    <Modal
      v-model:open="open"
      :width="640"
      :title="editing ? '编辑菜单' : '新增菜单'"
      :confirm-loading="saving"
      :force-render="true"
      :mask-closable="false"
      :cancel-button-props="{ disabled: saving }"
      :closable="!saving"
      @ok="save"
    >
      <div class="max-h-[65vh] overflow-y-auto pr-2">
        <Form />
        <div class="mb-3 flex items-center justify-between border-t pt-4">
          <span class="font-medium">页面按钮</span>
          <Button
            :disabled="saving"
            @click="buttons.push({ name: '', desc: '' })"
            >新增按钮</Button
          >
        </div>
        <Alert
          class="mb-3"
          type="info"
          message="按钮名称用于授权展示，权限标识用于页面代码（菜单名称:按钮标识）。按钮授权和接口授权分别维护。"
        />
        <div
          v-for="(button, index) in buttons"
          :key="button.ID ?? `new-${index}`"
          class="mb-3 flex items-center gap-2"
        >
          <Input
            v-model:value="button.desc"
            :disabled="saving"
            :maxlength="100"
            placeholder="按钮名称，如新增"
            :aria-label="`按钮 ${index + 1} 名称`"
          />
          <Input
            v-model:value="button.name"
            :disabled="saving"
            :maxlength="64"
            placeholder="权限标识，如 create"
            :aria-label="`按钮 ${index + 1} 权限标识`"
          />
          <Button danger :disabled="saving" @click="buttons.splice(index, 1)"
            >删除</Button
          >
        </div>
        <p v-if="!buttons.length" class="text-muted-foreground mb-3 text-sm">
          尚未定义按钮。
        </p>
        <p class="text-muted-foreground text-xs">
          已有菜单参数和未删除按钮的 ID 会保留。
        </p>
      </div>
    </Modal>
  </Page>
</template>
