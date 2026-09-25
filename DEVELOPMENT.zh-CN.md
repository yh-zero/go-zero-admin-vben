# web-antdv-next 开发文档（接入 go-zero-admin）

后续 38 个接口的实施顺序、前后端修复点与逐项验收见 [剩余接口接入开发流程](./DEVELOPMENT-WORKFLOW.zh-CN.md)。最新约定允许前后端配合修改，以简单易懂为原则；本文 P0 记录中的“需要修改后端就停止”仅为历史阶段约束。

业务开发统一使用 `web-antdv-next`。开发过程中优先新增独立业务文件，通过框架提供的配置和扩展点实现需求，尽量减少对上游源码的修改，降低以后升级 vue-vben-admin 时的冲突。独立文件能减少文本冲突，但框架 API 变化仍需要适配和验证。

本文同时作为 `go-zero-admin` 后端的接入指南。第 5 节按本地后端和前端源码核对，涵盖环境、响应、登录、菜单权限和业务接口。本次先编写第 11 节全部 41 个接口的接入计划，再实现 P0 登录与动态菜单。前端已关闭 Mock，验证码已连接本地真实后端；实际账号登录和菜单授权的联调状态见第 11.4 节。

## 1. 项目定位与保留范围

业务前端统一使用 `apps/web-antdv-next`，组件库为 `antdv-next`。不再开发 `web-antd`、`web-ele`、`web-naive`、`web-tdesign`，这些应用当前已从工作目录删除。不要把 `ant-design-vue` 的组件示例直接当作 `antdv-next` API 使用。

必须保留 `packages/`、`internal/` 和构建脚本：应用通过 `workspace:*` 引用这些源码，不能只拷贝一个 apps 目录运行。`apps/backend-mock` 源码暂时保留作为参考，但开发环境已禁用，不参与业务登录或菜单。`docs/`、`playground/`、`.changeset/`、上游 `.github/`、Gitpod/tea 配置和重复的上游 README 已清理；需要示例或文档时可查看上游仓库。

本文依据本地源码编写。当前上游基线为 `c5204a69b8374682c59cb35e7a43d474cf125a82`。以后完成框架升级后更新此处，以实际接入的上游提交为准。

## 2. 环境和常用命令

在 `vue-vben-admin` 根目录执行，不在单个应用目录单独安装：

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check:type:antdv-next
pnpm build
pnpm preview
```

- Node 要求见根 `package.json`：`^22.18.0 || ^24.12.0`；pnpm 按 `packageManager` 固定为 `11.16.0`。
- 默认开发地址为 `http://localhost:5999`。后端由开发者单独启动在 7001，前端 /api 代理到该地址，不启动 Mock。端口占用时 Vite 会选择后续端口，以终端输出为准。
- 默认构建为 `web-antdv-next`，产物为 `apps/web-antdv-next/dist`。
- 提交前执行 `pnpm lint`；框架或共享包变更另运行 `pnpm check:type` 和 `pnpm test:unit`。
- 不同 pnpm 版本可能造成锁文件噪声；不要为了安装失败直接删除锁文件或全量升级依赖。

### 本地开发 / AI 调试账号

按项目所有者要求，将已验证可登录的本地开发账号直接记录在本文件，供开发者和 AI 调试查阅：

| 项目 | 值 |
| --- | --- |
| 前端登录地址 | `http://127.0.0.1:5999/auth/login` |
| 后端地址 | `http://127.0.0.1:7001` |
| 登录账号 | `admin` |
| 登录密码 | `123456` |

调试时使用以上账号走真实登录接口；图片验证码每次从当前登录页获取并填写，不使用固定验证码或 `Isdev` 绕过头。若前端端口被占用，以启动终端输出地址为准。后续账号变更时同步更新此处。

## 3. 业务代码新增目录，避免覆盖上游文件

推荐以下目录约定（按需创建，当前不预置空业务页面）：

```text
apps/web-antdv-next/src/
  views/business/<模块>/       业务页面和页面私有组件
  api/business/<模块>.ts       业务接口及请求/响应类型
  adapter/business/           后端用户、菜单和权限数据转换
  components/business/        多页面复用的业务组件
  composables/business/       业务组合函数
  store/business/             业务状态
  router/routes/modules/business/<模块>.ts  仅 frontend/mixed 模式需要
  locales/langs/zh-CN/business.json
  locales/langs/en-US/business.json
```

业务页面不要覆盖 `views/dashboard`、`views/demos` 或 `views/_core`。可以参考已有页面，再新建业务文件，替换示例中的静态数据并调用自己的接口。不要将真实业务数据、账号或令牌写入示例、Mock 公共数据或共享框架包。

`packages/@core`、`packages/effects`、`internal` 尽量保持上游实现。优先使用组件属性、插槽、组合函数、包装组件扩展。应用品牌、首页、权限模式等通过应用的 `src/preferences.ts` 覆盖；不要改共享包的默认值。偏好设置有浏览器缓存，修改默认值后需清理相应缓存再验证。

确需改动框架或应用入口时，保持改动范围最小，并在本文第 7 节记录文件、原因和回归项；将这类修改与业务功能分开提交。

## 4. 新增业务页面

### 原有页面保留，业务页面另外开发

保留上游原有页面源码和示例数据，作为升级对照与开发参考；不要直接覆盖、删除或改造成业务页面。业务开发统一新增到 `src/views/business/`。当前按开发要求使用 mixed 模式：登录后保留原有工作台、分析页、组件示例及项目链接菜单，并追加后端授权业务菜单。原有页面仅为前端示例，不代表对应业务接口已经接入；业务接口和按钮权限仍由后端控制。

尚未开发的菜单统一显示“尚未接入”，由独立的 `src/views/business/access/pending.vue` 承载，不替换原有页面文件。后续接入一个业务模块时：

1. 在 `src/views/business/<模块>/` 新建页面，并在 `src/api/business/` 新增对应接口文件。
2. 在 `src/adapter/business/menu.ts` 的 `pageMap` 中，将后端已有的 `component` 值映射到新业务页面；不要为了匹配前端目录修改后端原有菜单数据。
3. 验证菜单跳转、刷新、权限及接口，再更新本文第 11 节的接入状态。未接入的其他菜单继续显示“尚未接入”。

原有页面与新增业务页面分开维护，升级时重点检查应用入口和菜单适配文件；共享框架包及原有页面尽量保持上游实现。后续接入允许前后端配合改动，具体步骤遵循单独的接口接入流程文档。

例如新建 `src/views/business/system/user/index.vue`，实现本后端的用户管理：

```vue
<script setup lang="ts">
import { Page } from '@vben/common-ui';

// 接入后端菜单时，组件名与约定的路由 name 保持一致。
defineOptions({ name: 'BusinessSystemUser' });
</script>

<template>
  <Page title="用户管理">
    <div class="bg-card rounded-xl p-4">在这里接入用户列表与管理操作。</div>
  </Page>
</template>
```

本项目业务页面采用第 5.5 节的后端菜单授权方式，与原有本地示例菜单合并：通过后端菜单 name、path、component 和应用适配器关联该页面，并为角色配置菜单及 API 权限。同一页面无需再额外维护一份本地业务路由。

当前 mixed 模式保留现有本地示例路由；仅无需后端菜单授权的通用页面才新增本地路由，业务管理页默认通过后端菜单映射接入。现有入口递归加载 `modules/**/*.ts`，无需反复改入口。路由名称及完整路径必须全局唯一，不能与后端下发菜单重复。

业务多语言文案放独立 `business.json`，通过 `$t('business.system.user.title')` 引用，避免改上游 page.json。不要把业务页面放入免鉴权的 coreRoutes；按钮隐藏也不能代替后端接口鉴权。

## 5. 接入 go-zero-admin 后端

### 5.1 后端结构与契约来源

核对日期：2026-09-25。后端 HEAD 为 `3e994f5a3336eaaee94c2a8f0c048f39efb8fc27`，工作区另有 Docker、OSS 初始化与上传等未提交修改；本文以工作区实际源码为准，不能仅凭该 SHA 推断线上行为。

请求链路：浏览器 → Vite/Nginx 代理 → `applet-api:7001` → `applet-rpc:6001` → MySQL。Redis 用于验证码及权限策略同步，etcd 用于 RPC 注册和服务发现。前端只调用 HTTP API，不直连 RPC、数据库或 Redis。API 层通过 JWT 获取当前用户，受保护接口再通过 RPC 执行 Casbin 校验；菜单权限与接口权限分别管理。

以下后端路径均相对于 `go-zero-admin` 根目录：

| 内容 | 源码位置 |
| --- | --- |
| 实际注册的 HTTP 方法、路径、鉴权 | `application/applet/api/internal/handler/routes.go` |
| API 定义、请求与响应字段 | `application/applet/api/desc/sys_base/user.api`、`application/applet/api/desc/sys_base/user_struct.api`；同时核对 `application/applet/api/internal/types/types.go` |
| 业务实现是否完整、字段是否生效 | `application/applet/api/internal/logic/`、`application/applet/rpc/internal/logic/` |
| 统一响应与错误码 | `pkg/result/httpResult.go`、`pkg/result/responseBean.go`、`pkg/result/xerr/errCode.go` |
| JWT 失败与接口权限 | `application/applet/api/applet.go`、`application/applet/api/internal/middleware/authority_middleware.go` |
| 启动与运行环境 | `docker-compose.yml`、`docker/api.yaml.template`、`docker/rpc.yaml.template` |

最新生成的接口文档为后端的 `data/api/generated/go-zero-admin.swagger.json`，可导入 Apifox 或 Swagger UI。旧的 `data/api/go-zero-admin.openapi.json` 是历史 Apifox 文档，保留参考，不作为最新契约。路由存在不代表业务已实现，契约有差异时以注册路由、实际类型和逻辑共同核对。

#### 生成和使用 Swagger

在 **go-zero-admin 根目录**，使用 Windows 自带的 PowerShell 5.1 或 PowerShell 7 执行，无需额外安装 PowerShell 7：

```powershell
.\test\sh\swagger.ps1
```

若 Windows 提示禁止运行脚本，可仅对这次生成启动一个允许执行脚本的进程，不修改系统执行策略：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\test\sh\swagger.ps1
```

`pwsh` 是 PowerShell 7 的命令；出现“无法识别 pwsh”时使用上面的命令即可。脚本优先使用 PATH 中的 goctl，否则从 `go env GOBIN/GOPATH` 查找。当前验证版本为 goctl `1.10.2`；没有安装时执行 `go install github.com/zeromicro/go-zero/tools/goctl@v1.10.2`。也可以通过 `-GoctlPath` 指定工具完整路径。go.mod 中的 go-zero 版本不会自动决定本机 goctl 版本。

维护脚本时保留 `swagger.ps1` 的 UTF-8 BOM，确保 Windows PowerShell 5.1 正确读取中文。生成的 Swagger JSON 仍使用 UTF-8 无 BOM。

- 生成范围：从 `application/applet/api/desc/applet.api` 及其导入文件读取接口，当前共 41 个；不需要启动 API、RPC、数据库或 Redis。
- 生成方式：脚本调用官方 `goctl api swagger`，只在临时副本中添加文档元信息，再补充本项目的响应包装、JWT 和上传参数；不会重写 `.api`、handler、logic、types 或 go.mod。
- 产物格式：Swagger 2.0 JSON。可导入 Apifox，也可使用下面的独立 Docker Swagger UI；后端没有新增 `/swagger` 页面。
- 默认服务地址：`http://localhost:7001`。需要更换时执行 `.\test\sh\swagger.ps1 -ApiHost 'localhost:其他端口'`，参数填写不带协议和路径的主机名及端口；也可以在接口工具中配置实际服务地址。
- 鉴权：登录、验证码接口公开，其余当前 39 个接口使用 `Authorization: Bearer <accessToken>`；Swagger UI 的 Authorize 中填写完整的 `Bearer ...`。
- 响应：已补充 `code/message/result/returnData/success/timestamp`。业务错误和 JWT 失效可能使用 HTTP 200；先检查业务码。权限拒绝和鉴权服务异常分别为 HTTP 403/500。
- 上传：`multipart/form-data`，文件字段 `file_img`。实际调试仍需可用的后端及 OSS 配置。

goctl 目前对本项目同时含 json/form 标签的字段会产生重复参数、响应字段遗漏，脚本用两次官方生成的结果分别保留查询参数与完整 JSON 模型，并修正 `json:"-"` 字段。不要用裸命令直接覆盖项目产物，否则会丢失这些适配。官方使用方式见 [go-zero Swagger 文档](https://go-zero.dev/zh-cn/reference/cli-guide/swagger/)。

文档生成不会修复后端业务问题：`getMenuAuthority`、`getBaseMenuById` 的 GET 必填字段仍只有 json 标签，浏览器无法发送对应 body；文档保留现状并注明限制。部分列表接口含可选 GET body，可省略该 body，使用已列出的 query 参数。字典项详情的 `form:"id":"id"` 标签不规范，脚本依据当前 Go 反射行为补充 `id` 查询参数。注册成功当前返回 `result: null`，文档也按此注明。具体缺口见 5.8。

以后新增或修改接口时：修改 `.api` 和业务实现 → 重新生成 Swagger → 检查方法、路径、参数和响应 → 提交 `.api`、实现及 JSON 产物。不要手改生成的 JSON；统一响应、鉴权方式或上传字段变化时，在 `test/sh/swagger.ps1` 同步调整文档适配。升级 goctl 后检查这些适配是否仍需要，避免与新版生成器重复处理。

#### 本地开发依赖与 Swagger

在 **go-zero-admin 根目录**执行 `docker compose up -d`，只启动 MySQL、Redis、etcd 和 Swagger，不启动 API/RPC，也不需要 `.env` 或 `.env.example`。暂时不联调后端时保持这些依赖运行即可；需要联调时再自行启动本机 Go 服务。

Swagger 页面为 [http://localhost:8080](http://localhost:8080)，JSON 为 [http://localhost:8080/swagger.json](http://localhost:8080/swagger.json)。接口使用、登录鉴权、重新生成文档及调试步骤统一见后端 [README](../go-zero-admin/README.md)。生成 JSON 后刷新页面即可更新；未启动后端时可以查看文档，但不能 Execute 调试接口。

MySQL 使用开发配置 root/123456、数据库 goZero-admin，沿用 go-zero-admin_mysql_data 数据卷。日常暂停使用 `docker compose stop`，不要通过 `down -v` 删除数据。Docker 依赖配置的端口只绑定本机。

服务器部署使用独立的 `docker/deploy-compose.yml` 和服务器专用配置，与本地开发入口分离，参见后端 `docker/部署说明.md`。

### 5.2 联调环境和代理

先准备可用的后端、数据库数据和测试账号。后端要求 Go 1.24 或兼容版本。本地开发的 Docker 不启动 API/RPC，真实联调需要另外启动 Go 服务并核对配置；服务器部署步骤见后端部署说明。检查 API 是否可达：

```sh
curl -i http://127.0.0.1:7001/v1/sys/randomImage
```

本机 API 通常使用 7001 端口，以实际 Go 配置为准。MySQL 空卷首次启动会导入初始化 SQL，已有数据不会重复导入；不要为解决联调问题删除已有数据卷。账号由后端维护者提供，不假定 Vben 演示账号可以登录。

在 `apps/web-antdv-next/.env.development.local` 配置：

```dotenv
VITE_GLOB_API_URL=/api
VITE_NITRO_MOCK=false
```

将应用 `vite.config.ts` 中现有 `/api` 代理替换为以下配置，保留外层 `defineConfig` 结构：

```ts
proxy: {
  '/api': {
    target: 'http://127.0.0.1:7001',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
},
```

统一约定：客户端 baseURL 为 `/api`，每个接口写完整的后端路径 `/v1/sys/...`。例如浏览器请求 `/api/v1/sys/login`，代理转发为 `http://127.0.0.1:7001/v1/sys/login`。目标地址不再带 Mock 的 `/api`，也不要重复拼接 `/v1/sys`。修改配置后重启前端。

生产环境使用自己的 API 地址；若仍采用 `/api`，Nginx 也应去掉 `/api` 后转发，并保留 `/v1/sys`。Vite 代理不会进入生产静态产物。当前 `.env.production` 使用 /api，上线前必须配置反向代理并检查实际构建配置。后端运行在容器、远程主机时，根据网络位置填写真实地址，不能直接套用浏览器或容器中的 `127.0.0.1`。JWT 密钥、数据库密码、OSS 密钥不进入前端或任何 `VITE_*` 变量。

### 5.3 统一响应和错误处理

后端成功响应是：

```json
{
  "code": 200,
  "message": "操作成功!",
  "result": {},
  "returnData": null,
  "success": true,
  "timestamp": 1790294400
}
```

`result` 是真实业务数据，`timestamp` 为 Unix 秒。错误通常只有 `{ "code": 200008, "message": "..." }`，没有 `result`。应用已在 `src/api/request.ts` 按以下约定解包；以后不要追加互相冲突的拦截器：

```ts
defaultResponseInterceptor({
  codeField: 'code',
  dataField: 'result',
  successCode: 200,
});
```

保留 `responseReturn: 'data'`。请求头继续使用 `Authorization: Bearer <accessToken>`，不要改成旧项目的自定义 token 头。完成适配后，业务函数拿到的是 `result` 内的数据，不再访问 `res.data` 或 `res.result`。错误提示优先读取 `error.response.data.message`，同时兼容网络错误、非 JSON 内容和缺失字段。

| 情况 | 当前后端表现 | 前端处理 |
| --- | --- | --- |
| 成功 | HTTP 200，业务 `code: 200` | 返回 `result` |
| 验证码/账号密码错误 | 通常 HTTP 200，`200007` / `200008` | 提示消息，刷新验证码，保持登录页 |
| JWT 无效或过期 | 统一回调写出业务 `100003`，当前实现使用 HTTP 200 | 清理登录状态，要求重新登录 |
| Casbin 拒绝 | HTTP 403，`{ message: '权限不足' }` | 提示无权限，不当作令牌失效反复登录 |
| 权限服务异常 | HTTP 500，`{ message: '鉴权服务异常' }` | 提示服务异常 |
| 参数解析失败 | handler 使用 `httpx.ErrorCtx`，不保证统一 JSON 外壳 | 根据 HTTP 状态和可用消息兜底 |

**业务码 `100003` 不等于 HTTP 401。** Vben 的现有认证拦截器只识别 HTTP 401；必须在应用请求层补充 `100003` 的失效处理，位于解包失败之后、通用消息提示之前。复用应用的清理/重新登录逻辑，并避免并发请求重复退出、重复弹窗和退出请求递归。保留真实 HTTP 401 的处理。不要把所有非 200 业务码都当成登录失效，也不要修改共享 `packages/effects/request` 来适配本项目。

### 5.4 登录、当前用户和退出

| 能力 | 后端现状 | 对接方式 |
| --- | --- | --- |
| 图片验证码 | `GET /v1/sys/randomImage` → `{ captchaImg }` | 将返回的 Data URL 直接作为图片 src，输入框提交字符串 |
| 账号密码登录 | `POST /v1/sys/login` | 请求 `{ username, password, captcha }`，返回 `{ accessToken, accessExpire, userInfo }` |
| 当前用户信息 | 没有按 JWT 查询当前用户的 HTTP 接口 | 首次使用登录返回的 userInfo；刷新恢复方案见下文 |
| 刷新令牌 | 没有 refreshToken HTTP 接口 | 保持 `enableRefreshToken: false`，过期重新登录 |
| 退出登录 | 没有服务端退出 HTTP 接口 | 清理本地状态；不要继续调用 `/auth/logout` |
| 注册 | `POST /v1/sys/register` 是 JWT + Casbin 保护的管理员新增用户接口 | 放在用户管理页，不接到匿名注册入口 |

登录页需要移除演示账号选择与自动填充密码，用图片验证码替换当前返回布尔值的滑块验证码。建议新建 `views/business/auth/login.vue`，复用 Vben 登录容器，仅调整 `router/routes/core.ts` 中 Login 的组件引用并登记该定制；保留根布局和其他核心路由结构。不支持的短信、扫码、找回密码和匿名注册入口先关闭。

后端验证码有现状差异：只有 `Config.Isdev == true` 且请求头 `Isdev` 不为 `"1"` 时才校验，Docker 模板却设置 `Isdev: false`。前端不要通过发送绕过头解决联调问题；上线前由后端明确并修正校验开关。验证码按 `RemoteAddr` 提取的 IP 存 Redis，没有 `captchaId`，同一代理下并发取图可能互相覆盖；请求图片和提交登录应走同一代理。验证码时效与反向代理场景也需后端核验，不能按源码注释直接假定为两分钟。

建议的登录过程：取得图片 → 提交登录 → 保存 accessToken 和过期时间 → 转换 userInfo → 获取当前菜单并生成按钮码 → 动态注册路由 → 跳到实际可访问首页。`accessExpire` 是绝对过期时间，单位为秒，不是有效时长；前端时间判断使用 `accessExpire * 1000`，最终是否有效仍以后端鉴权为准。

当前 `src/store/auth.ts` 已消费登录返回的 userInfo 和菜单适配结果，不再请求后端不存在的 `/user/info` 和 `/auth/codes`；后续升级时保留此适配，不能恢复上游 Mock 调用。

| 后端 userInfo 字段 | Vben 用户字段 | 规则 |
| --- | --- | --- |
| `ID` | `userId` | 转为字符串供前端使用；发回后端的 ID 保持实际契约类型 |
| `userName` | `username` | 注意与登录请求的 `username` 大小写不同 |
| `nickName` | `realName` | 缺失时回退到 userName |
| `headerImg` | `avatar` | 缺失时用应用默认头像 |
| `authorityId` | `roles` | 当前 JWT 角色转换为 `[String(authorityId)]` |
| `authority.defaultRouter` | `homePath` | 后端存的是菜单 name，通过已授权菜单转换为实际路径 |
| 登录 accessToken | `token` | 按当前 `@vben/types` 用户类型补齐；同一登录会话保持一致 |
| 无对应字段 | `desc` | 使用空字符串等应用默认值 |

`authorities` 表示关联角色，不能直接当作当前 JWT 同时拥有的全部角色权限。当前没有切换角色并重新签发 JWT 的 HTTP 接口；不要只修改前端 authorityId 来“切换角色”。`defaultRouter` 可能为 `dashboard` 或 `404`，不能直接赋给要求路径的 homePath；菜单转换后选择可访问首页，无菜单时展示无权限状态。

**页面刷新必须单独设计。** Vben 的用户 store 当前不持久化；路由守卫在用户信息为空时会调用 `fetchUserInfo()`。推荐后端新增按 JWT 查询本人资料的接口，再接回该流程。后端尚未补齐时，可在应用层保存最小的会话资料用于恢复展示，并重新向服务器请求当前菜单校验会话；资料缺失、过期或鉴权失败就清理状态并重新登录。缓存不作为权限依据，不保存密码或验证码，不用管理员用户列表接口代替“当前用户接口”。退出时同时清理该缓存、token、用户、菜单和按钮权限。仅清理浏览器 token 不会让已签发 JWT 在服务器立即失效。

### 5.5 后端菜单、按钮与接口权限

应用 `src/preferences.ts` 使用 `app.accessMode: 'mixed'`，保留 `enableRefreshToken: false`；应用路由生成入口也固定使用 mixed，避免旧缓存偏好改变行为。原有本地示例路由与后端菜单合并，业务页面仍通过后端菜单授权和组件映射接入，不要把需授权的业务页面添加到无角色限制的本地示例菜单中。

`GET /v1/sys/menu/getMenu` 从 JWT 获取当前 authorityId，返回 `{ menus: [...] }`。把 `menus ?? []` 转成 Vben 的路由数组，不能直接把整个对象返回给 `getAllMenusApi`。建议新增 `src/adapter/business/menu.ts` 集中转换：

| 后端菜单字段 | 前端映射/约定 |
| --- | --- |
| `name`、`path`、`children` | 保留唯一 name；规范父子路径，处理 children 为 null 的情况 |
| `hidden` | `meta.hideInMenu` |
| `sort` | `meta.order` |
| `meta.title`、`meta.keepAlive` | 对应字段映射，不按其他后台模板的习惯反转布尔值 |
| `meta.icon` | 显式映射到项目支持的图标，例如 `lucide:users` |
| `component` | 映射到真实业务页面标识；不把旧前端路径原样导入 |
| `meta.activeName`、`meta.closeTab`、`parameters` | 旧前端特有语义，按业务逐项适配，不能直接认作 Vben 配置 |
| `btns` | 当前角色被授予的按钮集合，用于生成稳定的前端权限码 |

现有 Vben 会把 `views/business/system/user/index.vue` 规范化为 `/business/system/user/index.vue`，匹配 `src/views/business/system/user/index.vue`。后端初始化数据中的旧组件路径可能不存在，应在应用适配器维护允许的映射；未知组件应明确记录并显示未接入页面，不能指向任意文件。首级菜单由现有根布局承载，避免每一级重复套 `BasicLayout`。按旧菜单 name 查到首页后，还要累积父路径或用已注册路由解析，不能把相对子路径直接当首页。

后端没有 `/auth/codes`。可由当前菜单树的 `btns` 生成例如 `菜单name:按钮name` 的权限码，并存入 `accessStore`；页面按钮使用同一约定。`menuBtn` 是按钮定义，不等于当前角色已授权按钮，不可据此全部放行。按钮授权维护接口并未完整暴露，缺失的按钮数据要由后端确认，不能在前端默认赋予全部权限。

菜单授权控制“看见什么”，Casbin 控制“请求是否允许”。新增业务接口时，后端必须注册正确的 **路径 + HTTP 方法**，并为角色配置对应策略。代理前缀 `/api` 不进入 Casbin 路径。例如用户列表策略应是 `GET /v1/sys/getUserList`，不是 `/api/v1/sys/getUserList`。能看到菜单仍可能返回 403，此时应检查角色的接口策略。

### 5.6 业务模块接口与字段约定

除登录和验证码外，当前注册的接口都需要 JWT 与 Casbin 权限。下表的方法与路径按源码核对；存在已知限制的接口见 5.8，开发时继续核对实际请求类型。

| 模块 | HTTP 接口 |
| --- | --- |
| 用户 | `GET /v1/sys/getUserList`；`POST /v1/sys/register`；`PUT /v1/sys/updateUserInfo`；`PUT /v1/sys/resetUserPassword`；`DELETE /v1/sys/deleteUser` |
| 当前菜单与菜单查询 | `GET /v1/sys/menu/getMenu`、`getMenuList`、`getBaseMenuTree`、`getMenuAuthority`、`getBaseMenuById`（后四项沿用同一 `/v1/sys/menu/` 前缀） |
| 菜单维护 | `POST /v1/sys/menu/addBaseMenu`；`PUT /v1/sys/menu/updateBaseMenu`；`DELETE /v1/sys/menu/deleteBaseMenu` |
| 角色 | `GET /v1/sys/authority/getAuthorityList`；`POST /v1/sys/authority/createAuthority`、`addAuthorityMenu`；`PUT /v1/sys/authority/updateAuthority`；`DELETE /v1/sys/authority/deleteAuthority` |
| API 清单 | `/v1/sys/api/` 下：GET `getApiList`、`getAllApiList`；POST `createApi`；PUT `updateApi`；DELETE `deleteApi`、`deleteApisByIds` |
| 接口策略 | `/v1/sys/casbin/` 下：GET `getPathByAuthorityId`；PUT `updateCasbinData`、`updateCasbinDataByApiIds` |
| 字典 | `/v1/sys/dictionary/` 下：GET `getSysDictionaryList`、`getSysDictionaryDetails`；POST `createSysDictionary`；PUT `updateSysDictionary`；DELETE `deleteSysDictionary` |
| 字典项 | `/v1/sys/dictionary/` 下：GET `getSysDictionaryInfoList`、`getSysDictionaryInfoListDetailsById`；POST `createSysDictionaryInfo`；PUT `updateSysDictionaryInfo`；DELETE `deleteSysDictionaryInfo` |
| 通用能力 | `POST /v1/sys/base/uploadFileImg`；`POST /v1/sys/base/sendEmailCode` |

用户、API、字典项分页用查询参数 `pageNo`、`pageSize`，默认 1、10；响应为 `{ list, total, page, pageSize }`，请求的 `pageNo` 与响应的 `page` 名称不同。`getMenuList` 实际返回完整菜单树，total 为根节点数，并未实现分页；角色列表仅对根角色分页，附带子角色树。字典列表只有 list，全部 API 列表字段是 apiList。数组可能为 null，适配到表格前统一处理。用户列表虽有公共 keyword 定义，当前逻辑没有把它传给 RPC，不要把传入 keyword 当作搜索已生效。

用户管理特别注意字段大小写：登录为 `username/password`；管理员新增用户为 `userName/passWord/nickName/authorityId/authorityIds`；更新资料使用大写 `ID`；删除和重置密码使用 `userId`。`enable` 用数字 1/2 表示正常/冻结；字典 status 用数字 1/2，不能直接发送布尔值。Go int64 在当前 JSON 中是数值，如果实际 ID 可能超过 JS 安全整数范围，应先与后端统一字符串方案，不自行改变提交类型。

新增用户当前成功时 `result` 实际为 null，与类型声明中的用户对象不同；应按业务成功码处理后重新查询列表，不依赖返回新用户 ID。更新用户逻辑会跳过空字符串和数字 0，不能假定提交空字符串就会清空手机号、邮箱等字段；要支持清空需先明确后端更新契约。角色对象的主键是 authorityId，不是通用 ID。

字典详情 `GET /v1/sys/dictionary/getSysDictionaryDetails` 已有实现，查询参数 id/type 至少提供一个，status 默认 1。解包后直接得到字典对象，其中 sysDictionaryInfoList 是按 sort 排序的启用字典项；不要额外读取不存在的 data 或把禁用项丢失认作前端筛选错误。

角色菜单授权 `addAuthorityMenu` 使用 `{ authorityId, menuIds: '1,2,3' }`，是逗号分隔字符串；该操作覆盖原关联，空字符串会清空授权。API 批量删除使用 `{ ids: [...] }`；按 API 授权使用 `{ authorityId, apiIds: [...] }`。这些维护操作应在页面明确保存范围。

示例：新增 `src/api/business/system/user.ts`，以下代码以完成 5.3 请求适配为前提，UserRow 只列出页面所需字段：

```ts
import { requestClient } from '#/api/request';

export interface UserRow {
  ID: number;
  userName: string;
  nickName: string;
  enable: number;
}

interface UserPage {
  list: UserRow[] | null;
  total: number;
  page: number;
  pageSize: number;
}

export function getUserList(pageNo = 1, pageSize = 10) {
  return requestClient.get<UserPage>('/v1/sys/getUserList', {
    params: { pageNo, pageSize },
  });
}

export function deleteUser(userId: number) {
  return requestClient.delete<{ message: string }>('/v1/sys/deleteUser', {
    data: { userId },
  });
}
```

这里 DELETE 的第二个参数是请求配置，JSON 请求体写在 `data` 中。不要把所有 DELETE 都改成 query 参数；具体以该接口类型标签为准。密码重置是管理员操作，使用后端配置的默认密码，不要在前端硬编码仓库示例密码。

图片上传使用 multipart 字段 **`file_img`**，返回 `result.fileImgUrl`。Vben 通用上传器默认入参是 file，不能直接照搬；在业务上传适配层构造正确的 FormData 并让浏览器生成 boundary，保留鉴权头和统一错误处理。后端需要有效的 OSS 配置，否则返回 `300002`。源码的 `ParseMultipartForm(10 << 20)` 是内存阈值，不是可靠的文件大小限制；与后端/网关约定实际大小和文件类型再设置前端校验。

### 5.7 建议的改造位置和顺序

新增业务 API 放 `api/business/system/`；DTO 与转换函数放同模块或 `adapter/business/`；用户、角色、菜单、字典等页面放 `views/business/system/`。业务实现直接导入业务模块，避免不断修改公共导出入口。

| 已有文件 | 必要的最小适配 |
| --- | --- |
| 应用 `vite.config.ts`、本地环境文件 | 关闭 Mock，代理到后端 |
| `src/api/request.ts` | `200/result` 解包、业务失效码、错误消息 |
| `src/api/core/auth.ts`、`user.ts`、`menu.ts` | 保留稳定的应用接口入口，委托业务适配实现，取消不存在的 Mock URL |
| `src/store/auth.ts` | 消费登录 userInfo，按顺序加载菜单与按钮，处理本地退出和刷新恢复 |
| `src/preferences.ts` | 混合菜单模式、关闭刷新令牌、选择可访问首页 |
| `src/router/routes/core.ts` 的登录组件引用 | 指向新增的业务登录页，保留根布局 |

以上修改完成时登记到第 7 节，不修改 `packages/@core`、`packages/effects` 的通用实现。

实施顺序：环境与响应适配 → 图片验证码和登录 → 用户恢复/退出/失效处理 → 后端菜单、首页和按钮 → 用户管理 → 角色/菜单/API 权限 → 字典与上传。每完成一步验证再继续，避免同时改完所有页面后无法定位问题。

### 5.8 联调前必须确认的后端缺口

- 当前用户 HTTP 接口、服务端注销、令牌刷新、角色切换接口尚未提供；前端不能把这些能力当作已有功能。是否补齐由业务需求决定，本文中推荐新增的接口不等于现有契约。
- `menu/getMenuAuthority` 的逻辑取 JWT 当前角色，忽略请求中的 authorityId；用它回显其他角色菜单会得到错误结果，角色管理接入前需后端修正。
- `GetMenuAuthorityRequest.authorityId` 和 `GetBaseMenuByIdRequest.id` 在 GET 请求类型中仅标注 json，字典项详情 id 标签也不规范。需核对并修正为对应查询参数契约，重新生成类型后联调；不要让浏览器发送 GET body 绕过。
- 用户 keyword 搜索未生效、菜单列表未分页、注册返回 null、空值更新会被忽略，前端按 5.6 的现状开发；需要更完整能力时先补后端契约，不以 OpenAPI 或 handler 存在作为完成依据。
- 当前登录查询没有检查用户 enable，“冻结”字段不等于已经阻止登录。验证码开关、IP 绑定、时效和冻结行为需要后端完善后验收；前端隐藏入口不能补足服务端限制。邮件验证码是受保护接口，且依赖服务端邮件配置，不等于已经支持匿名邮箱注册或找回密码。

### 5.9 验收清单

- 确认浏览器请求实际到达 `/v1/sys/...`，没有残留 `/auth/login`、`/user/info`、`/auth/codes`、`/menu/all`、`/auth/refresh`、`/auth/logout` 的 Mock 请求。
- 正确和错误密码、验证码均按真实后端行为验证；不发送验证码绕过请求头。
- 登录后用户信息、首页、菜单正常；刷新页面、直接打开业务深层链接、退出再换账号不残留旧权限。
- HTTP 200 下的 `100003` 会结束会话，HTTP 403 不会造成登录循环；多个请求同时失效只处理一次。
- 不同角色的菜单、按钮与实际 API 访问结果一致；没有菜单或未知组件时有明确提示。
- 用户列表页码、空列表、更新/删除请求字段正确；验证新增用户返回 null 和空值更新限制。字典详情正确使用 id/type 与启用状态，不把尚未实现的用户搜索当作已完成。
- 角色授权回显目标正确，保存范围正确；上传字段为 file_img，OSS 未配置时显示可理解的错误。
- 执行 `pnpm check:type:antdv-next`、`pnpm lint`、`pnpm build`；生产构建指向自己的后端。静态检查通过不代替真实角色和接口联调。

## 6. 日常开发流程与提交检查

1. **确定业务目录**：先确认需求能否通过新增页面、组件、接口或配置完成，避免直接修改上游示例。
2. **新增业务实现**：页面、路由、接口、状态和语言文件按第 3 节组织。可参考上游示例，但不要复制整套框架后自行维护。
3. **使用公开扩展方式**：优先使用 props、slots、组合函数和业务包装组件；通过框架公开导出引用能力，避免跨目录引用共享包内部源码。
4. **集中处理必要适配**：登录、请求协议和权限差异在应用层集中处理；首页和品牌通过应用配置覆盖，不修改共享默认值。
5. **验证功能**：执行应用类型检查、lint 和构建，手动验证涉及的业务流程。涉及共享包时增加全局类型检查和相关测试。
6. **审阅提交差异**：确认没有无关的框架改动、示例数据修改、批量格式化或依赖升级；必要的上游定制登记到第 7 节。

提交前重点检查：

- 新业务是否放在独立目录，路由名称和语言 key 是否避免与上游重复。
- 是否无意修改了 dashboard、demos、核心页面或共享组件；能否改为配置或包装组件。
- 页面样式是否尽量使用 scoped 或业务类名，避免全局覆盖框架样式及依赖内部 DOM 结构。
- 新依赖是否添加到实际使用的包中，并遵循现有 workspace/catalog 管理方式；锁文件由约定 pnpm 版本生成，避免无关版本变化。
- 本地环境文件、生产凭据和构建产物是否被排除；真实业务数据不能写入上游演示数据。
- 提交是否只包含一个明确目的。业务功能、框架定制和上游升级分开提交，不批量重命名或格式化上游文件。

## 7. 必要的上游定制记录

通常只需新增业务文件，无需逐个登记。修改上游已有文件或保留删除项时，在此表简要记录，便于以后升级逐项核对。

| 文件或范围 | 保留原因 | 升级时检查 |
| --- | --- | --- |
| 已删除的 web-antd、web-ele、web-naive、web-tdesign | 统一使用 web-antdv-next | 保持清理范围，检查上游新加入的应用 |
| 根 package.json、pnpm-workspace.yaml、pnpm-lock.yaml | 默认业务入口、工作区名单及依赖 | 保留单应用配置，兼容新工具链，重新生成并审阅锁文件 |
| docs、playground、.changeset、.github 及关联脚本 | 删除上游演示、文档站和仓库维护流程 | 上游升级可能重新引入，按业务需要保留或清理 |
| internal/tailwind-config/src/theme.css、turbo.json、编辑器配置 | 去掉已删除项目的扫描目录和输出声明 | 保留真实应用及共享包的构建行为 |
| scripts/deploy/Dockerfile | 构建并复制 web-antdv-next 产物 | 运行环境与产物路径正确 |
| vben-admin.code-workspace、.vscode/launch.json | 编辑器和调试入口 | 不引用已删除的应用，端口与开发配置一致 |
| 应用 .env、.env.development、.env.production、vite.config.ts | 独立业务缓存空间、禁用 Mock、/api 代理 | 验证验证码与登录走相同代理，生产配置不依赖 Vite |
| 应用 src/api/core/{auth,user,menu}.ts、src/api/request.ts | 保留稳定入口，适配 200/result，取消不存在的接口 | 业务100003/HTTP401失效；403和网络错误不清理会话 |
| 应用 src/store/auth.ts、src/router/{guard,access,index}.ts | 登录缓存、固定 mixed 合并模式、路由生成及清理 | 刷新重新获取菜单、切换用户不残留路由、网络失败可重试 |
| 应用 src/router/routes/core.ts、src/preferences.ts | 新业务登录页、菜单失败页、混合菜单、禁用不存在的认证方式 | Root布局保持兼容；默认首页由授权菜单决定 |
| 应用 src/layouts/basic.vue | 使用真实登录组件，清除演示通知与假资料、隐藏未接入个人中心 | 布局插槽与用户下拉菜单兼容；不恢复演示信息 |

以上 P0 定制尚未提交，后续提交时补记提交号。以后新增定制时，补充具体文件、修改原因、对应提交和验证方式。上游已经提供同等能力时，优先移除本地补丁，避免长期重复维护。

## 8. 后续升级时的基本约定

保留上游 Git 历史，将自己的业务仓库与官方上游远端区分清楚。整理时 origin 仍指向官方仓库，推送前需确认目标为自己的仓库。

升级在独立分支进行：先保存当前业务版本，审阅目标版本变更，再合并固定的上游标签或提交。不要下载新版覆盖整个目录，也不要用全量更新依赖代替框架升级。合入业务主分支时保留上游合并历史，避免 squash 掉合并关系后，下一次重复处理变更。

冲突按具体文件处理：业务文件保留并适配新版 API；框架文件核对本节前的定制记录；应用配置同时保留业务要求和上游修复。不要对整个仓库一律选择“用我的”或“用上游的”。已删除应用可能再次出现修改/删除冲突，需要确认仍不使用后保持删除。

升级后验证安装、类型检查、lint、测试和构建，并回归登录、权限、菜单、关键业务页面、缓存及生产 API 配置。通过后更新第 1 节的上游基线和第 7 节的定制记录。发布保留上一版产物和配置，前端升级不覆盖真实业务数据。

## 9. 当前项目边界

演示源码暂时保留，实际入口已切换为业务登录页、真实后端菜单和授权首页。未知菜单组件显示“尚未接入”，不代表对应 CRUD 已完成；Mock 已禁用，待真实账号回归后再决定是否删除其源码。上游文档站、playground 和发布工作流已删除。当前没有 GitHub 自动检查或自动部署，后续按自己的仓库需求配置。

## 10. 隐藏目录与上传自己的 GitHub

| 目录 | 用途 | 本项目处理 |
| --- | --- | --- |
| .changeset | 为上游多包项目登记版本变化、生成变更日志 | 已删除；业务系统暂不需要该发布流程，并已移除相关命令和直接依赖 |
| .github | GitHub Actions、Issue/PR 模板、代码所有者及仓库维护规则 | 已删除上游配置；不影响 Git 提交和推送，需要 CI/CD 时按自己的仓库重新添加 |
| .vscode | VS Code 格式化、插件推荐、语言目录和调试设置 | 推荐保留；不使用 VS Code 时可删除，不影响命令行构建，但会失去编辑器配置 |
| .git | 提交历史、分支和远端信息 | 保留；后续通过共同历史合并上游依赖它，不应当作缓存删除 |

虽然 .changeset 已删除，internal/node-utils 使用的 @changesets/git 仍保留，它是开发工具的依赖，与是否使用版本发布流程是两回事。

上传前在 vue-vben-admin 根目录检查 git status 和 git remote -v。origin 应指向自己的仓库，upstream 可指向官方仓库。首次迁移且 origin 仍指向官方、upstream 尚不存在时，可以先将 origin 重命名为 upstream，再添加自己的 origin。不要删除 .git 后重新初始化；.git 本身不会作为普通文件上传。

提交源码、锁文件、构建配置、开发文档和 LICENSE。node_modules、dist、缓存、日志以及 .env.*.local 已由 .gitignore 排除，无需为了上传删除本地依赖；提交前检查暂存文件，确保没有账号、令牌和私有环境配置。建立自己的 GitHub 仓库、提交和推送属于后续操作，本次仅整理本地文件。


## 11. 全部接口接入计划（2026-09-25，先规划后实施）

范围：以当前 41 个 HTTP 接口为清单。本次只实施 P0 登录与动态菜单，不开发其他管理页面，不修改后端源码、数据库记录、Casbin 策略或菜单数据。若 P0 必须修改后端才能继续，停止实施并报告接口、现象、原因和建议；下列未来阶段的已知后端缺口仅记录，不在本次修复。

### 11.1 实施顺序和验收

| 阶段 | 工作 | 验收与约束 |
| --- | --- | --- |
| P0（本次） | 真实代理、统一响应、图片验证码、登录、动态菜单、会话恢复、退出 | 禁用 Mock；Bearer 鉴权；HTTP 200/code100003 退出，403 保持会话；刷新重新获取服务器菜单；未知页面明确显示尚未接入，不伪造业务数据 |
| P1 | 用户列表、新增、编辑、删除、重置密码 | 校验字段大小写、分页、状态1/2；新增成功 result=null；搜索和清空字段问题按后端现状处理，需后端修改时另行确认 |
| P2 | 菜单、角色与菜单授权 | 树形表格、角色授权回显、保存覆盖范围；getMenuAuthority 忽略传入角色及 GET json-only 参数为后端待处理项 |
| P3 | API 资源与 Casbin 策略 | 方法+路径准确，权限策略不包含前端/api代理前缀；替换授权前展示影响范围 |
| P4 | 字典与字典项 | 分页/树/详情字段分别适配；ID、status 数字约定；畸形id标签后续清理，不扩大本次范围 |
| P5 | 图片上传、邮箱验证码 | multipart 字段file_img；OSS/邮件依赖及权限验证；邮件接口不作为匿名登录/找回密码能力 |

所有阶段共用 src/api/business 与 src/adapter/business，业务页面放 views/business，尽量不改 packages/ 和上游演示页面。详尽字段契约和已知问题见第5节。

### 11.2 P0 设计

1. 开发代理 /api → http://127.0.0.1:7001，保持完整 /v1/sys/... 路径；图片与登录走同一代理。验证码由用户填写，或在用户明确授权后协助填写；不发送 Isdev 绕过头。
2. 登录请求 username/password/captcha；读取 accessToken、accessExpire（绝对Unix秒）、userInfo，角色只使用当前 authorityId。
3. 后端没有 /user/info、refresh、logout、/auth/codes：不请求这些不存在的接口。应用保存最小会话展示信息，不保存密码或验证码；刷新时重新取菜单验证令牌。退出清理 token、用户、路由、按钮权限和会话缓存。
4. 从 getMenu 的 menus 生成 Vben 路由与 btns 权限码，再通过 mixed 模式与原有本地菜单合并；保留层级/排序/隐藏规则，使用组件白名单映射，旧组件未开发时显示未接入页面；不伪装成已完成的用户/角色等业务页。
5. 通过当前授权菜单的 defaultRouter/name 解析首页；无菜单显示无权限页面。禁止用所有关联角色或 menuBtn 定义推断授权。
6. 登录失败刷新验证码；网络/500菜单失败可重试，不误判为令牌失效；会话缺失、过期或后端100003/401才要求重新登录。切换用户后不能残留旧路由。
7. 验证：类型检查、构建、菜单适配和会话/错误处理测试；真实后端验证码与代理检查；用户手动登录后检查菜单、刷新、深层路由和退出。未验证项如实标记。

### 11.3 全部接口清单

下表是实施计划，不代表已经接入。P0 的最终状态在本节末尾更新，其余阶段均待实施。

| 阶段 | 方法 | 路径 | 用途 |
| --- | --- | --- | --- |
| P3 | POST | `/v1/sys/api/createApi` | 创建/增加 api列表 |
| P3 | DELETE | `/v1/sys/api/deleteApi` | 删除 api列表 |
| P3 | DELETE | `/v1/sys/api/deleteApisByIds` | 删除多条api |
| P3 | GET | `/v1/sys/api/getAllApiList` | 获取 所有api |
| P3 | GET | `/v1/sys/api/getApiList` | 获取api列表 |
| P3 | PUT | `/v1/sys/api/updateApi` | 更新api |
| P2 | POST | `/v1/sys/authority/addAuthorityMenu` | 增加角色和base_menu关联关系 |
| P2 | POST | `/v1/sys/authority/createAuthority` | 创建角色 |
| P2 | DELETE | `/v1/sys/authority/deleteAuthority` | 删除角色 |
| P2 | GET | `/v1/sys/authority/getAuthorityList` | 获取角色列表 |
| P2 | PUT | `/v1/sys/authority/updateAuthority` | 更新角色 -- 设为首页 |
| P5 | POST | `/v1/sys/base/sendEmailCode` | 邮箱发送验证码 - 暂时用于注册账号 |
| P5 | POST | `/v1/sys/base/uploadFileImg` | 上传图片 |
| P3 | GET | `/v1/sys/casbin/getPathByAuthorityId` | 根据角色id获取对应的casbin数据 |
| P3 | PUT | `/v1/sys/casbin/updateCasbinData` | 更新一个角色的对应的casbin数据 |
| P3 | PUT | `/v1/sys/casbin/updateCasbinDataByApiIds` | 更新一个角色的对应的casbin数据 用api的ids 查数据 |
| P1 | DELETE | `/v1/sys/deleteUser` | 删除用户 |
| P4 | POST | `/v1/sys/dictionary/createSysDictionary` | 新建SysDictionary |
| P4 | POST | `/v1/sys/dictionary/createSysDictionaryInfo` | 创建SysDictionaryInfo |
| P4 | DELETE | `/v1/sys/dictionary/deleteSysDictionary` | 删除SysDictionary |
| P4 | DELETE | `/v1/sys/dictionary/deleteSysDictionaryInfo` | 删除SysDictionaryInfo |
| P4 | GET | `/v1/sys/dictionary/getSysDictionaryDetails` | 根据ID或者type获取SysDictionary |
| P4 | GET | `/v1/sys/dictionary/getSysDictionaryInfoList` | 获取SysDictionaryInfo列表 |
| P4 | GET | `/v1/sys/dictionary/getSysDictionaryInfoListDetailsById` | 根据id获取SysDictionaryInfo详情 |
| P4 | GET | `/v1/sys/dictionary/getSysDictionaryList` | 获取SysDictionary列表 |
| P4 | PUT | `/v1/sys/dictionary/updateSysDictionary` | 更新SysDictionary |
| P4 | PUT | `/v1/sys/dictionary/updateSysDictionaryInfo` | 更新SysDictionaryInfo |
| P1 | GET | `/v1/sys/getUserList` | 分页获取用户列表 |
| P0 | POST | `/v1/sys/login` | 用户登录 |
| P2 | POST | `/v1/sys/menu/addBaseMenu` | 新增 base_menu |
| P2 | DELETE | `/v1/sys/menu/deleteBaseMenu` | 删除系统菜单 |
| P2 | GET | `/v1/sys/menu/getBaseMenuById` | 根据id获取菜单 |
| P2 | GET | `/v1/sys/menu/getBaseMenuTree` | 获取用户动态路由树  -- 用于角色管理的设置权限 |
| P0 | GET | `/v1/sys/menu/getMenu` | 获取菜单 |
| P2 | GET | `/v1/sys/menu/getMenuAuthority` | 获取指定角色menu  -- 用于角色管理的设置权限 |
| P2 | GET | `/v1/sys/menu/getMenuList` | 分页获取base_menu列表 |
| P2 | PUT | `/v1/sys/menu/updateBaseMenu` | 更新系统菜单 |
| P0 | GET | `/v1/sys/randomImage` | 生成验证码 |
| P1 | POST | `/v1/sys/register` | 新增（注册）用户 - 管理员 |
| P1 | PUT | `/v1/sys/resetUserPassword` | 重置用户密码 默认密码：goZero |
| P1 | PUT | `/v1/sys/updateUserInfo` | 修改用户信息 |

### 11.4 本次实施状态

计划已在修改应用代码前写入。P0 前端实现已完成，P1～P5 尚未实施。没有修改后端源码、配置、菜单数据或 Casbin 策略。

业务文件入口：
- 登录页：src/views/business/auth/login.vue；验证码：src/components/business/image-captcha.vue。
- 会话与错误分类：src/adapter/business/session.ts；菜单映射：src/adapter/business/menu.ts。
- 后续新增实际业务页面后，在 menu.ts 的组件白名单中将后端已有 component 值映射到新页面，通常无需改后端菜单记录。
- 当前 views/index.vue 映射原有 /dashboard/workspace/index.vue 工作台，保留其演示数据；其余没有实现的业务页面显示待接入提示。btns 映射为“菜单name:按钮name”，且只取当前 authorityId 的授权。

验证记录：
- 真实后端 randomImage 和前端页面图片加载正常；空表单校验、验证码刷新及清空旧输入已在浏览器验证。自定义验证码组件显式设置 modelPropName: value，以匹配表单绑定。
- 11 项菜单/会话测试通过：层级、排序、隐藏、默认首页、组件白名单、当前角色按钮、空菜单、失效分类、缓存和安全跳转。
- 类型检查、定向 ESLint 和生产构建通过，验证码绑定修复后的最终类型/构建复核也通过。构建仍有上游依赖 BigInt 与旧浏览器目标的提示，本次未扩大范围修改共享构建配置。
- 2026-09-25 已使用用户提供的账号、经明确授权填写验证码完成真实登录：原有菜单与后端业务菜单同时展示，角色管理显示“尚未接入”，原有工作台可访问，刷新 /dashboard/workspace 后会话与合并菜单正常恢复。退出后重新登录、令牌过期和其他角色仍待端到端验收；没有绕过验证码、伪造令牌或修改后端。

开发启动：先在 go-zero-admin 根目录启动开发 Docker 依赖，再由 VS Code 启动后端 API/RPC；在 vue-vben-admin 根目录运行 pnpm dev。浏览器使用终端输出地址，通常为 http://localhost:5999。修改代理或环境文件后重启前端。验证码按后端 IP 缓存，多个标签同时刷新验证码可能互相覆盖，应在当前登录页刷新后立即填写。

若 getMenu 返回403或后端业务错误，记录接口与实际账号并定位原因。后续阶段已允许按接口接入流程配合修改后端策略、数据或源码，修复后重新验收；不能通过关闭鉴权绕过问题。

### 11.5 原有菜单与后端菜单合并

按开发要求保留原有菜单及页面，同时追加后端授权业务菜单：

- 原有菜单来自 src/router/routes/modules/，保持原文件与演示数据。
- 后端菜单来自 getMenu；用户、角色、API、字典等尚未实现的页面继续显示“尚未接入”。
- 后端 views/index.vue 复用原有工作台；业务首页与原有工作台菜单可能同时存在，这是保留两套菜单入口的结果。
- src/router/access.ts 调用框架现有 mixed 生成逻辑；src/adapter/business/menu-conflicts.ts 在合并前检查路由名称及完整路径，冲突时提示菜单加载失败，禁止静默覆盖。处理冲突优先在前端适配层进行，不直接改后端数据。
- 原有页面的统计、个人资料设置等仍为上游示例，不能作为业务功能验收结果。新增需要业务授权的页面，通过后端菜单组件映射接入，不能仅添加到本地示例菜单获得访问入口。
- 本次继续使用原有真实登录和验证码流程。本地调试账号密码按项目所有者要求记录于第 2 节，方便开发者和 AI 调试查阅。

验证结果：本次菜单合并通过类型检查、定向 ESLint、生产构建和 14 项测试（含 3 项路由合并冲突测试）。原有 dashboard、demos 页面和 routes/modules 文件没有修改；本次没有修改后端。浏览器已验证真实登录、合并菜单、原有工作台访问及刷新恢复。
