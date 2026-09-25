<script setup lang="ts">
import { ref } from 'vue';

import { Button, Input, message } from 'antdv-next';

import { uploadImage } from '#/api/business/base';
const props = defineProps<{
  value?: string;
  disabled?: boolean;
  canUpload?: boolean;
}>();
const emit = defineEmits<{
  'update:value': [value: string];
  uploadingChange: [value: boolean];
}>();
const uploading = ref(false);
const fileInput = ref<HTMLInputElement>();
async function selected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || props.disabled || !props.canUpload || uploading.value) return;
  input.value = '';
  if (
    !['image/gif', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  ) {
    message.error('请选择 JPG、PNG、GIF 或 WebP 图片');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    message.error('图片不能超过 10 MB');
    return;
  }
  uploading.value = true;
  emit('uploadingChange', true);
  try {
    emit('update:value', (await uploadImage(file)).fileImgUrl);
    message.success('上传成功，保存用户后头像生效');
  } finally {
    uploading.value = false;
    emit('uploadingChange', false);
  }
}
</script>
<template>
  <div class="w-full space-y-2">
    <Input
      :value="value"
      :disabled="disabled || uploading"
      placeholder="头像 URL（可以清空）"
      @update:value="emit('update:value', $event)"
    />
    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp"
      hidden
      @change="selected"
    />
    <Button
      v-if="canUpload"
      :disabled="disabled"
      :loading="uploading"
      @click="fileInput?.click()"
    >
      上传图片
    </Button>
    <img
      v-if="value"
      :src="value"
      alt="图片预览"
      class="h-16 w-16 rounded object-cover"
    />
  </div>
</template>
