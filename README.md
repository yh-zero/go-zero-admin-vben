# 管理后台前端

基于 vue-vben-admin，业务应用统一使用 **web-antdv-next**（Vue 3 + TypeScript + antdv-next）。

开发目录、接入 go-zero-admin 的接口契约与实施步骤、减少上游升级冲突的规则均见 [开发文档](./DEVELOPMENT.zh-CN.md)。后端接入说明依据本地源码整理，当前前端仍使用 Mock。

## 本地开发

在仓库根目录执行，Node 和 pnpm 版本以 package.json 为准。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

默认开发地址为 http://localhost:5999，当前仍使用本地 Mock 登录与菜单。

## 检查与构建

```sh
pnpm check:type:antdv-next
pnpm build
```

构建产物位于 apps/web-antdv-next/dist。真实上线前请按开发文档配置自己的后端接口。

## 仓库范围

保留业务应用、Mock、共享框架包、构建和检查工具；已移除其他 UI 应用、上游文档站、playground 及上游 GitHub/Changesets 配置。

.vscode 保留团队编辑器配置；依赖、构建产物和本地环境文件由 .gitignore 排除。上传自己的仓库前检查 Git 远端地址，保留已有 Git 历史以便后续同步上游。

## 来源与许可

本项目基于 [vue-vben-admin](https://github.com/vbenjs/vue-vben-admin)。保留上游版权与 [MIT 许可证](./LICENSE)。
