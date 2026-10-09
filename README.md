# 管理后台前端

基于 [vue-vben-admin](https://github.com/vbenjs/vue-vben-admin)，业务应用统一使用 **web-antdv-next**（Vue3、TypeScript、antdv-next），已接入 go-zero-admin 的真实登录、菜单、组织、审计、文件、设备及 AI 接口。当前共 84 个 HTTP 接口，真实契约以配套后端 `.api`、注册路由、类型/逻辑及生成的 Swagger 为准。

在线演示：[yh9527.top（HTTPS）](https://yh9527.top) · [IP入口](http://175.178.67.80)。账号 `admin / 123456`，需图片验证码；当前为只读演示，AI 未配置 Key。

## 本地开发与启动

在仓库根目录安装依赖；保留 `packages/`、`internal/` 与脚本，应用通过 `workspace:*` 使用这些源码，不能只复制一个 apps 目录运行。Node 要求 `^22.18.0 || ^24.12.0`，pnpm 按 `packageManager` 固定为 `11.16.0`，以实际 package.json 为准。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

默认地址为 [http://127.0.0.1:5999](http://127.0.0.1:5999)，端口占用时以 Vite 输出为准。先在配套后端启动依赖、完成迁移并启动业务 RPC6001、AI RPC6002、API7001；本机后端托管入口为 `test/sh/dev.ps1 -Action Start/Restart/Status/Stop`。依赖和数据库启动不等于后端服务已启动，完整步骤见 [后端 README](https://github.com/yh-zero/go-zero-admin/blob/HEAD/README.md#本地开发启动)。

本地开发账号与初始密码见后端 README；已有库以实际凭据为准。登录始终使用当前图片验证码，失败重新取图，不使用固定验证码或开发请求头。前端停止使用启动终端的 Ctrl+C，再次启动前核对实际端口。开发日志与已有运行清单位于 `.temp/dev/`，不以历史 PID 作为停止依据。

### 环境与代理

应用环境位于 `apps/web-antdv-next/.env*`，本机覆盖可使用 `.env.development.local`：

```dotenv
VITE_GLOB_API_URL=/api
VITE_NITRO_MOCK=false
```

Vite `/api` 代理至 `http://127.0.0.1:7001`，去掉 `/api` 后保留 `/v1/sys` 或 `/v1/ai`。接口函数写完整后端路径，例如 `/v1/sys/menu/getMenu`；不要重复添加 baseURL 或改回 Mock `/api`。

修改环境或代理后重启前端。生产静态产物不包含 Vite 代理；若沿用 `/api`，由 Nginx 等服务去掉该前缀并转发到后端。后端容器/远程主机按实际网络使用可达地址。当前默认 hash 路由，改为 history 时另配置回退至 index.html；部署方法见 [后端部署说明](https://github.com/yh-zero/go-zero-admin/blob/HEAD/docker/部署说明.md)。

模型 Key 仅在后端 AI 进程配置；JWT 密钥、数据库/OSS/SMTP密码、模型 Key 均不进入前端或 `VITE_*`。前端既不连接 RPC，也不直接访问数据库、Redis或对象存储管理凭据。

公开参考站点可在构建时设置 `VITE_PUBLIC_DEMO=true`，默认关闭。演示登录页显示公开账号 `admin / 123456` 和只读说明，个人中心隐藏改密及设备列表，退出仅清除当前浏览器状态，避免共享账号的服务器退出让其他访客掉线。已有令牌仍由后端到期或管理员撤销，应给演示账号配置较短有效期。修改此标记需要重新构建；它只影响界面，后端和反向代理必须另行禁止写操作、注册、设备/审计隐私查询，不给演示角色变更按钮权限。模型模块可以保留并停用，不配置 Key。用户名不决定权限，公开 `admin` 使用普通只读角色，私有维护账号另行配置。

2026-10-04 已验证云端 HTTPS、正常验证码登录、业务读取和禁止写入。完整部署、升级及快速恢复见 [后端部署说明](https://github.com/yh-zero/go-zero-admin/blob/HEAD/docker/部署说明.md) 和 [快速恢复文档](https://github.com/yh-zero/go-zero-admin/blob/HEAD/QUICK_RECOVERY.md)。

## 检查与构建

```sh
pnpm check:type:antdv-next
pnpm test:unit
pnpm build
pnpm preview
```

提交前按变更范围运行 `pnpm lint`；共享包/框架改动另做全工作区类型检查。构建产物为 `apps/web-antdv-next/dist`，`pnpm build:docker` 使用 `scripts/deploy/Dockerfile`。保留锁文件，不以删除锁文件或全量升级依赖处理安装错误。单元测试和构建不能代替真实登录、OSS/SMTP、云模型及生产验收，剩余工作见 [前端后续开发计划](FRONTEND_DEVELOPMENT_PLAN.md)。

## 业务目录与接入流程

业务页面放 `apps/web-antdv-next/src/views/business/<模块>/`，请求和类型放 `src/api/business/`；跨页面组件、组合函数与状态分别放 `components/business/`、`composables/business/`、`store/business/`，按实际复用创建。表格与表单沿用 `adapter/vxe-table.ts`、`adapter/form.ts` 和 antdv-next，不能直接套用 ant-design-vue 的组件 API。

一个模块按“核对契约 → 列表 → 新增/编辑 → 删除/授权 → 真实联调”推进：

1. 对照后端 `.api` / `.proto`、handler/logic 和 Swagger 确认 query/body、字段大小写、空值、分页、返回及错误；必要后端修复与前端配合完成。
2. 在 `api/business/` 使用现有 requestClient，仅定义真实字段。列表按需要将 `list/total` 转为表格 `items/total`，不修改共享表格默认值影响演示页。
3. 新建业务页面与编辑弹窗/授权抽屉，不覆盖上游 dashboard、demos、_core 页面。提交时禁用重复操作；成功后重新读服务端结果，失败保留重试入口。
4. 在 `adapter/business/pages.ts` 单处登记菜单组件，菜单编辑选项与动态路由共用白名单；保留旧 component 值的兼容映射，未知组件显示“尚未接入”。
5. 分别配置菜单、按钮、API权限；一个保存只更新其所属授权。确认非法ID、空数据、字段清空/零值、重复保存、普通角色拒绝及旧响应隔离。
6. 契约变化同步后端定义、生成代码、实现、前端类型及 Swagger。后端先用 `test/sh/swagger.ps1` 生成，再构建 RPC/API，因为 API 同步读取编译时嵌入的文档；不手工维护另一份 Swagger。

业务文案放独立 business 多语言资源。应用品牌、首页和权限偏好使用应用 `src/preferences.ts`，尽量通过属性、插槽、适配器扩展；偏好有浏览器缓存，改默认值后清理对应缓存再验。只有实际重复才抽公共组件，不引入多层 CRUD 基类。

### 请求、登录与会话

`src/api/request.ts` 按 `code:200` 判断成功并解包 `result`，业务函数直接使用结果，不再访问 `res.data/result`。GET 使用 params/query，DELETE按对应契约传 body；注册成功可以为 null。错误优先显示 `error.response.data.message` 并兜底网络、非 JSON 及缺字段，不以 HTTP200判定成功。

请求头为 `Authorization: Bearer <accessToken>`；业务码 `100003` 和真实 HTTP401 清理对应登录态，403只提示无权限，鉴权服务500/网络失败不误判过期。并发失效合并处理，避免重复退出或退出请求递归；旧账号响应、旧401和旧写入不能影响新的登录。

| 接口 | 约定 |
| --- | --- |
| GET `/v1/sys/randomImage` | captchaId、captchaImg；图片为 Data URL，120秒有效，提交后消费 |
| POST `/v1/sys/login` | username/password/captchaId/captcha；返回 accessToken、绝对秒值 accessExpire、userInfo |
| GET `/v1/sys/me` | 刷新时读取服务端最新本人资料，浏览器缓存不是权限依据 |
| PUT `/v1/sys/changePassword` | oldPassword/newPassword，成功重新登录；新密码 UTF-8 8至72字节，历史短密码可登录 |
| POST `/v1/sys/logout` | 撤销该账号所有设备，然后清理 token、资料、路由、按钮和展示缓存 |
| POST `/v1/sys/register` | 管理员新增用户，JWT与Casbin保护，不作为匿名注册入口 |

当前不提供 refreshToken、独立切换 JWT 角色、找回密码、短信/扫码或匿名注册，`enableRefreshToken` 保持 false。`src/store/auth.ts` 消费真实登录资料和权限快照，不恢复不存在的 `/user/info`、`/auth/codes` 调用。资料通过 `/me` 恢复，菜单/按钮/首页通过当前会话 `/v1/sys/permissions/snapshot` 同步；用户状态/角色/session_version及设备由后端校验，改密、冻结、删除、角色/归属变化与重置撤销旧会话。

### 菜单、按钮与 API 权限

应用固定 mixed 模式，保留原有工作台、分析及组件演示，并追加后端授权业务菜单。业务管理页不额外加入无角色限制的本地示例路由。后端 `GET /v1/sys/permissions/snapshot` 返回当前会话 `{revision,fingerprint,authorityId,defaultRouter,menus,codes}`，通过 `adapter/business/menu.ts` 转换 name/path/component/children、隐藏/排序/缓存等；菜单完整路径按父级、重复斜线和大小写判重，路由名称与完整路径全局唯一。

按钮 `permissionKey` 是创建后稳定的权限码，历史定义回填 `菜单name:按钮name`，快照也兼容当前旧码；`menuBtn` 只是按钮定义，不直接放行。已有按钮/菜单参数保留原 ID/值，删除按钮会清理授权；内置页面依赖的标识受后端保护。目标角色授权传其 authorityId，不能固定当前登录角色。

默认首页存后端菜单 name，转换为当前授权完整路径；无可用菜单显示无权限状态。`/account` 是真实个人中心保留路径，上游 Profile 仍为演示。菜单组件只接受 pages.ts 白名单；拒绝覆盖核心路由、保留路径和外部任意文件。

角色菜单、按钮、API和数据范围分开保存，统一编辑快照提供资源、选择和 revision，保存携带 expectedRevision；冲突保留本地并比较最新服务端内容，失效选择显示具体 ID，明确移除后才能保存。搜索/组内全选保留其他分组选择，撤销/清空先确认。API权限使用实际方法和 `/v1/sys/...`、`/v1/ai/...`，不包含代理 `/api`；已有未登记策略不悄然丢弃。按钮/API依赖提示不会自动授权。

导航、窗口焦点和跨标签通知触发权限同步，旧版本/旧登录结果不提交，相同 fingerprint 只推进版本。内容变化同步路由、按钮和首页，清理失效标签及缓存，路径移动保留 query/hash。默认/关联角色变化需重新登录取得新 JWT，不能仅改前端 authorityId。角色/菜单/授权/历史操作绑定 token/对象，真实派发前再次检查固定 token。

菜单改父级先展示影响预览，再提交已绑定版本。角色页授权历史展示四类差异，回滚先预览拒绝原因；后端首版要求无后续配置修改、资源有效且明细完整。新历史/回滚及普通角色编辑能力由管理员明确授予 API 权限；`permissions/edit` 是四类配置统一读取能力。已有数据库必须先完成后端结构迁移及单独管理员恢复步骤，再配套升级前端。

API资源同步只预览并选择新增/说明变更，保留已有 ID 和授权，不自动授予新权限或删除 obsolete。预览版本失效需重新读取再选，不盲重试旧 keys。

### 已有模块的维护边界

| 页面/能力 | 接口或边界 |
| --- | --- |
| `/admin/organization/departments`、positions | departments/positions CRUD；数字状态1/2、编码、父子校验和依赖保护以后端为准 |
| 用户“归属”、角色“数据范围” | membership、dataScope；原停用关联可保留/移除，新增需启用，读失败禁写；范围为 all/self/department/department_and_children/custom，角色1固定全部 |
| 用户删除/资源移交 | 删除前 resources 预览；默认软删保留资源和审计，transfer 独立确认来源/目标 ID及文件/AI选择；AI同库配置未满足时明确不可用 |
| `/admin/audit` | getAuditLogList，分页、类型/结果/操作者/模块/时间过滤，RFC3339时间，白名单详情，只读无删除 |
| `/admin/files` | list/url/resource/reference，归属ID与引用数按真实契约，不虚构引用明细；引用维护仅角色1，有引用不可删，deleting可重试 |
| 图片上传 | multipart file_img，PNG/JPEG/GIF/WebP至10MB；visibility默认public、可选private，读取fileImgUrl/fileId；浏览器生成boundary |
| 私有文件 | 每次请求授权地址，签名300秒，不向OSS发送应用JWT；CORS失败提供另存为提示，头像不存临时私有签名 |
| `/admin/sessions` | admin设备接口，仅内置管理员且受API授权保护，按 userId 筛选/撤销 |
| `/account` 设备列表 | 本人设备/单设备撤销；当前设备撤销只清理本地对应会话，不调用全设备 logout |

前端不自行决定 owner/dept 或数据范围。用户编辑保留“未传不更新、明确空值清空”，角色 parentId=0、字典 value/sort=0 使用真实字段约定；组织归属真实变化会撤销旧会话。五类数据范围当前用于文件，旧用户等管理接口仍按自身权限处理，不能暗示已覆盖所有业务。

## AI 助手

AI 页面为 `src/views/business/ai-agent/index.vue`，请求为 `api/business/ai-agent.ts`，菜单 name 为 ai-agent，提交/停止按钮为 `ai-agent:run` / `ai-agent:cancel`。前端仍经 API7001 调用，内部 AI RPC6002不直接连接。普通模型配置在后端 `application/ai/rpc/etc/ai.yaml`，Key在后端 `.env.local`；Docker使用后端 AI YAML模板与部署环境文件，细节见 [后端 AI 配置](https://github.com/yh-zero/go-zero-admin/blob/HEAD/README.md#ai-agent-本机配置)。

| HTTP | 用途 |
| --- | --- |
| GET `/v1/ai/info` | enabled/configured、provider/model、工具可用性与限制 |
| POST `/v1/ai/runs` | conversationId可选，requestId、message，返回真实任务 |
| GET `/v1/ai/runs/:id` | 状态、答案、工具摘要 |
| POST `/v1/ai/runs/:id/cancel` | 幂等停止，随后GET确认 |
| GET `/v1/ai/conversations` | 本人会话，pageNo/pageSize，items/total |
| GET `/v1/ai/conversations/:id/messages` | 本人消息，pageNo/pageSize，按sequence倒序，前端反转当前页 |

内置只读工具为最多31天审计汇总/最近记录、已知fileId的文件状态/引用数、本人有效设备。不枚举全部文件或返回下载地址，不查其他人设备；工具名称、可用性与描述以服务端为准。发送前说明云模型会收到问题、成功历史与授权结果。AI 回答及历史回复使用受限 Markdown 显示表格、标题、列表、代码和粗体，通过 Vue 转义文本节点渲染，不用 v-html，不执行 HTML、不生成可点击链接或加载图片；用户问题和错误仍以纯文本显示，不展示隐藏推理或伪造结果。

成功查询的答案包含后端生成的“查询明细”，模型省略记录时仍可显示实际授权字段；沿用现有 answer/content 字段，刷新或读取历史后仍可展示。明细区分总数与返回样本，每组最多20条并受后端长度限制，空结果和截断有提示。畸形表格保留为原文，成功但空回复会显示明确提示；完整数据可到对应业务页面查询。

- 未启用/未配置禁用提交，AI服务在线时仍可查历史；离线返回100001安全错误，页面保留重试。AI服务不可用不影响普通后台API启动。
- requestId为UUID，同一会话/输入的结果不确定重试保留该ID；修改输入或新会话生成新ID。已取得任务的模型失败重发时创建新任务。首次成功返回任务/会话ID后才切换，不预写假成功消息。
- 每会话同时一个任务，提交中阻止重复发送和切换。queued/running每2秒查询，前次完成后安排下一次；终态停止，失败暂停并可重新查询。
- 切换会话、token变化、卸载使旧响应失效并停止旧轮询；新提交发起与采纳后都使旧任务GET失效，旧终态不能覆盖新任务或丢失轮询。
- 仅queued/running且有权限显示停止；重复停止合并，POST后再GET服务器实际状态。查询失败解除等待，保留最后已知状态，允许重新查询或幂等停止。
- 历史每页20条，页码越大越早，页内sequence正序，同轮user在assistant前。最近消息runId恢复最新任务，不依赖时间/UUID排序；恢复失败阻止发送，可回第一页重读。最新任务未知时旧任务不可被重新查询或停止。
- 状态为 queued/running/succeeded/failed/cancelled/interrupted；权限、登录和数据范围由后端每次执行重新校验，页面按钮不能替代接口授权。

真实云模型与登录后完整页面验收、费用/RAG/写工具等扩展统一见 [后续计划](FRONTEND_DEVELOPMENT_PLAN.md)。

## 上游维护与仓库范围

保留业务应用、Mock源码、共享框架包、构建与检查工具、`.vscode`团队配置及 Git历史。Mock只用于独立参考/测试，当前登录和菜单不使用。其他UI应用、docs/playground、上游 `.github`/Changesets发布流程已移除；组件使用README及LICENSE保留。依赖、产物、日志与私有环境文件由 `.gitignore` 排除。

最初引入上游基线为 `c5204a69b8374682c59cb35e7a43d474cf125a82`，后续升级以实际Git记录为准。先保存业务版本，在独立分支合并固定上游标签/提交；保留共同历史，按文件处理冲突，不用新版覆盖整个目录或全量更新依赖代替升级。重点复核以下定制：

| 范围 | 保留内容与回归 |
| --- | --- |
| package.json、pnpm-workspace.yaml、锁文件 | 单业务应用入口、实际工作区和工具版本，安装/构建兼容 |
| 清理的应用、docs/playground、发布配置 | 按当前范围处理上游重引入；保留真实共享依赖 |
| tailwind扫描、turbo.json、编辑器/工作区、scripts/deploy/Dockerfile | 不指向已删应用；web-antdv-next产物和调试入口正确 |
| 应用环境、vite.config.ts、preferences.ts | 独立缓存空间、禁用Mock、/api、mixed模式和不支持的认证方式关闭 |
| api/core、api/request.ts、store/auth.ts | 200/result、100003/401失效、403保留登录；真实资料，不恢复虚构接口 |
| router guard/access/index/core、layout/basic、account路由 | 刷新、动态菜单/清理、旧响应隔离、真实登录和/account，保留演示页 |

升级后检查安装、类型、lint、测试、构建及正常登录、授权、路由、缓存和生产API配置；发布保留上版产物与配置。上游已提供同等能力时再评估移除补丁。未完成框架告警和CI/CD安排记录在根计划，不以历史开发记录代替当前验收。

## 来源与许可

保留上游版权和 [MIT许可证](LICENSE)。后端使用 [Apache License 2.0](https://github.com/yh-zero/go-zero-admin/blob/HEAD/LICENSE)，二次开发时保留相应声明。
