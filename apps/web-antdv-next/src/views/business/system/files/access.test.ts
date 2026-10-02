/* eslint-disable vue/one-component-per-file -- Minimal controls isolate authorization and stale URL responses. */
import type { App } from 'vue';

import type { FileResource } from '#/api/business/system/files';

import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Access from './access.vue';

const mocks = vi.hoisted(() => ({ url: vi.fn(), success: vi.fn() }));
vi.mock('#/api/business/system/files', () => ({ getFileURL: mocks.url }));
vi.mock('antdv-next', async () => {
  const { defineComponent, h } = await import('vue');
  const panel = defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  return {
    Modal: panel,
    Space: panel,
    Spin: panel,
    Alert: defineComponent({
      props: { message: { type: String, default: '' } },
      setup: (props) => () => h('p', props.message),
    }),
    Button: defineComponent({
      props: { disabled: Boolean, loading: Boolean },
      setup:
        (props, { attrs, slots }) =>
        () =>
          h(
            'button',
            { ...attrs, disabled: props.disabled || props.loading },
            slots.default?.(),
          ),
    }),
    message: { success: mocks.success },
  };
});
function resource(id: number): FileResource {
  return {
    id,
    name: `image-${id}.png`,
    mime: 'image/png',
    size: 100,
    ownerId: 10,
    departmentId: 2,
    references: 0,
    visibility: 'private',
    status: 'active',
    createdAt: '2026-10-02T10:00:00Z',
  };
}
async function flush() {
  for (let index = 0; index < 8; index++) await Promise.resolve();
  await nextTick();
}

describe('authorized file access', () => {
  let app: App;
  let element: HTMLDivElement;
  beforeEach(() => {
    vi.resetAllMocks();
    element = document.createElement('div');
    document.body.append(element);
    app = createApp(Access);
  });
  afterEach(() => {
    app.unmount();
    element.remove();
  });
  function mount() {
    return app.mount(element) as unknown as {
      show: (row: FileResource) => Promise<void>;
    };
  }
  it('keeps a failed authorization retryable and refreshes rather than caches signed URLs', async () => {
    mocks.url
      .mockRejectedValueOnce({
        response: { data: { message: '文件不存在或不在可访问范围' } },
      })
      .mockResolvedValueOnce({
        url: 'https://storage.example.test/image.png?Signature=fresh',
        expiresIn: 300,
      });
    await mount().show(resource(7));
    await nextTick();
    expect(element.textContent).toContain('不在可访问范围');
    expect(element.querySelector('img')).toBeNull();
    const refresh = [
      ...element.querySelectorAll<HTMLButtonElement>('button'),
    ].find((button) => button.textContent?.includes('重新获取地址'))!;
    expect(refresh.disabled).toBe(false);
    refresh.click();
    await flush();
    expect(mocks.url.mock.calls.map((call) => call[0])).toEqual([7, 7]);
    expect(element.querySelector('img')?.getAttribute('src')).toContain(
      'Signature=fresh',
    );
    expect(element.textContent).toContain('私有地址有效至');
  });
  it('discards an old response when switching files and rejects unsafe URL schemes', async () => {
    let complete!: (value: { url: string; expiresIn: number }) => void;
    mocks.url
      .mockReturnValueOnce(
        new Promise((resolve) => {
          complete = resolve;
        }),
      )
      .mockResolvedValueOnce({
        url: 'https://storage.example.test/latest.png',
        expiresIn: 300,
      });
    const view = mount();
    const previous = view.show(resource(1));
    await view.show(resource(2));
    complete({ url: 'https://storage.example.test/stale.png', expiresIn: 300 });
    await previous;
    await nextTick();
    expect(element.querySelector('img')?.getAttribute('src')).toContain(
      'latest.png',
    );
    mocks.url.mockResolvedValueOnce({
      url: 'javascript:alert(1)',
      expiresIn: 300,
    });
    await view.show(resource(3));
    await nextTick();
    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('a')).toBeNull();
    expect(element.textContent).toContain('文件访问地址无效');
  });
});
