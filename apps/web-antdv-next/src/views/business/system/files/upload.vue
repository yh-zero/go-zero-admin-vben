<script setup lang="ts">
import type { FileVisibility, UploadedImage } from '#/api/business/base';

import { ref } from 'vue';

import { Alert, Button, message, Modal, Select, Space } from 'antdv-next';

import { uploadImage } from '#/api/business/base';

import { fileError, fileSize, validateUpload } from './format';

const emit = defineEmits<{ saved: [file: UploadedImage] }>();
const open = ref(false);
const busy = ref(false);
const input = ref<HTMLInputElement>();
const selected = ref<File>();
const visibility = ref<FileVisibility>('private');
const error = ref('');

function show() {
  if (busy.value) return;
  selected.value = undefined;
  visibility.value = 'private';
  error.value = '';
  open.value = true;
}
function selectFile(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';
  if (!file || busy.value) return;
  try {
    validateUpload(file);
    selected.value = file;
    error.value = '';
  } catch (failure) {
    selected.value = undefined;
    error.value = fileError(failure, '图片选择失败');
  }
}
async function save() {
  if (busy.value || !selected.value) return;
  busy.value = true;
  error.value = '';
  try {
    const result = await uploadImage(selected.value, visibility.value);
    if (
      !Number.isSafeInteger(result.fileId) ||
      result.fileId <= 0 ||
      !result.fileImgUrl
    )
      throw new Error('文件资源登记未完成，请联系管理员核查后再试');
    message.success(`图片已保存，文件 ID：${result.fileId}`);
    open.value = false;
    emit('saved', result);
  } catch (failure) {
    error.value = fileError(failure, '上传未完成，请检查文件存储服务后重试');
  } finally {
    busy.value = false;
  }
}
defineExpose({ show });
</script>

<template>
  <Modal
    v-model:open="open"
    title="上传图片"
    :force-render="true"
    :mask-closable="false"
    :closable="!busy"
    :confirm-loading="busy"
    :ok-button-props="{ disabled: !selected }"
    :cancel-button-props="{ disabled: busy }"
    ok-text="上传"
    @ok="save"
  >
    <div class="space-y-4">
      <label class="block space-y-2">
        <span>访问范围</span>
        <Select
          v-model:value="visibility"
          class="w-full"
          :disabled="busy"
          :options="[
            { label: '私有：授权生成短时访问地址', value: 'private' },
            { label: '公开：获得地址的访客均可访问', value: 'public' },
          ]"
        />
      </label>
      <input
        ref="input"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        hidden
        @change="selectFile"
      />
      <Space direction="vertical">
        <Button :disabled="busy" @click="input?.click()">选择图片</Button>
        <span v-if="selected" class="break-all">
          {{ selected.name }} · {{ fileSize(selected.size) }}
        </span>
      </Space>
      <p class="text-muted-foreground text-sm">
        支持 JPG、PNG、GIF、WebP，最大 10 MB。所有者与部门由服务端登记。
      </p>
      <Alert v-if="error" type="error" show-icon :message="error" />
    </div>
  </Modal>
</template>
