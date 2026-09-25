# 接口接入开发流程与实现记录（前后端配合）

更新日期：2026-09-26。适用项目：`go-zero-admin-vben/apps/web-antdv-next` 与 `go-zero-admin`。

本文记录本轮接口接入的实际实现、后续开发规则及验收清单。环境、调试账号、框架升级规则见 [开发文档](./DEVELOPMENT.zh-CN.md)。开发完成与真实 HTTP 验收分开记录，最终联调结果填写在第 9 节。

## 1. 目标、现状与约定

原有 41 个 HTTP 接口中，验证码、登录、当前菜单 3 个已在上一阶段接入。其余 38 个接口的前后端代码已完成，后来增加 2 个角色按钮授权、3 个本人资料/会话和 2 个 API 资源同步接口，当前共 **48 个接口**。用户、菜单、角色、API/Casbin、字典、个人中心及工具页已创建，保留 Vben 原有工作台、分析页和示例菜单。业务、会话与 API 同步 HTTP 回归已完成，结果见第 9 节；OSS 图片上传与 SMTP 邮件实际发送因外部服务未配置，暂跳过成功流程验收。

本次要求已调整：**前端和后端都允许修改，遇到后端缺口直接安排对应修复，再继续接前端。** 旧开发文档中“需要改后端就停止”是上一阶段约束，后续接口开发以本文为准。允许修改不等于覆盖现有业务数据；数据库变更用可重复执行的增量脚本，保留现有用户、角色和授权。

持续遵守以下规则：

- 保留原有工作台、分析页、演示页面和菜单。业务页面在 `views/business/` 下另外开发；混合菜单模式保持不变。
- 业务页面完成后才把对应菜单从“尚未接入”切换到真实页面。原有演示页面的保存提示和示例统计不算业务接入完成。
- 默认复用现有 API、RPC、模型与组件，不重写框架，不新增通用 CRUD 引擎、复杂配置平台或多层基类。
- 一个模块先做列表，再做新增和编辑，最后做删除、授权等操作。每一步前后端一起验证。
- 修改契约时同时更新 `.api`、必要的 `.proto`、生成代码、实现、前端类型和 Swagger，避免文档与行为不一致。

## 2. 模块实施顺序

| 顺序 | 模块 | 完成后能做什么 |
| --- | --- | --- |
| S0 | 联调基础与接口契约修正 | 浏览器能够正确传参，测试角色能够访问对应接口 |
| S1 | 用户管理与本人会话；先接角色列表供下拉选择 | 查询、新增、编辑、冻结、删除用户及重置密码；真实个人中心、修改本人密码和注销 |
| S2 | 菜单管理 | 维护菜单树、按钮定义；页面组件在 pages.ts 登记一次 |
| S3 | 角色与菜单授权 | 维护角色，给指定角色分配菜单及默认首页 |
| S4 | API 管理和角色接口授权 | 维护 API 资源，预览/选择/同步契约差异，控制角色真正可以调用的接口 |
| S5 | 字典与字典项 | 维护字典，供业务下拉框和状态显示使用 |
| S6 | 图片上传、邮箱验证码 | 接通实际 OSS 和邮件服务，并提供可用入口 |
| S7 | 全量回归与交付 | 当前 48 个接口逐项有验证结果，前后端和文档一致 |

S0 至 S6 的代码已按下述约定实现，S7 的实际回归与外部服务跳过项见第 9 节。后续新增模块仍按“修正契约 → 列表 → 新增/编辑 → 删除/授权 → 实际联调”的顺序开发，避免一次保存混入多个未经验证的功能。

## 3. 每个模块都用同一个开发流程

1. **核对请求与返回。** 对照 `.api`、handler、API logic、RPC logic/model 和 Swagger，写清 query/body、字段大小写、空值、分页以及错误码。
2. **先修后端缺口。** 修改声明和逻辑，必要时补 RPC 字段或增量 SQL；先用接口工具确认成功和失败请求都符合约定。
3. **补前端 API 文件。** 使用现有 `requestClient`，只定义当前模块实际需要的类型和函数；解包后的结果直接使用，不再取一层 `result`。
4. **新增业务页面。** 一个列表页配一个编辑弹窗或抽屉，新增/编辑共用表单。授权用独立抽屉，避免把整个模块塞进一个巨型组件。
5. **接入菜单与权限。** 在 `adapter/business/pages.ts` 登记页面组件一次，由菜单编辑选项和路由适配共同读取；确认菜单授权、按钮授权及 Casbin 的路径/方法一致。
6. **联调成功与失败。** 列表空数据、查询、翻页、保存失败、重复提交、无权限都验证；写操作成功后重新查列表，不先假装成功。
7. **更新产物和状态。** 生成 Swagger，运行相关检查，在第 8 节把接口标为已验收，并记录实际验证结果。

### 文件放置

本轮主要文件如下；新增目录按需建立，不预先生成大量空文件。

```text
go-zero-admin-vben/apps/web-antdv-next/src/
  api/business/system/
    user.ts  menu.ts  authority.ts  api.ts  casbin.ts  dictionary.ts  types.ts
  api/business/base.ts
  api/business/account.ts
  api/business/session.ts
  views/business/system/
    user/index.vue
    menu/index.vue
    authority/index.vue
    authority/menu-permissions.vue
    authority/api-permissions.vue
    authority/button-permissions.vue
    api/index.vue
    api/sync.vue
    dictionary/index.vue
    dictionary/items.vue
    shared.ts
  views/business/tools/index.vue
  views/business/account/index.vue
  components/business/image-upload.vue
  adapter/business/menu.ts
  adapter/business/pages.ts

go-zero-admin/
  application/applet/api/desc/sys_base/user.api
  application/applet/api/desc/sys_base/user_struct.api
  application/applet/api/internal/logic/<模块>/
  application/applet/rpc/desc/applet.proto
  application/applet/rpc/internal/logic/<模块>/
  application/applet/rpc/internal/logic/accessutil/
  application/applet/rpc/internal/model/
  data/db/migrations/                  # 按文件名排序执行的增量迁移
  test/sh/db.ps1                      # Windows PowerShell 5.1
  test/sh/db.sh                       # Linux
```

简单实现优先：表格复用应用 `adapter/vxe-table.ts`，表单复用 `adapter/form.ts`，普通弹窗使用现有组件；不引入第二套表格或表单方案。只有出现明确重复后才抽公共函数。

当前 Vxe 表格适配默认取 `items/total`，后端列表多为 `list/total`。在页面查询函数返回 `{ items: result.list ?? [], total: result.total }`，或在该表格局部指定字段；不要改共享包影响上游演示页面。

## 4. S0：先做好联调基础

### 4.1 环境与权限

- 首次在后端根目录运行 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\test\sh\db.ps1 -Action Init`，启动 MySQL、Redis、etcd、Swagger 并应用待执行迁移；已有环境更新运行 `-Action Migrate`。完整命令见第 7.1 节。API/RPC 继续由 VS Code 单独启动。
- 在前端根目录运行 `pnpm dev`。前端 `/api` 代理到后端 7001，Mock 保持关闭。
- 调试账号见开发文档第 2 节；另准备一个普通测试角色及用户，验证拒绝访问。新增测试数据应可识别并按需清理。
- UI 尚未完成前，先核对测试角色所需 Casbin 策略；缺少的菜单/API/策略用最小增量脚本补齐。按已有路径和 HTTP 方法查找，不依赖写死的数据库主键。
- 不通过关闭鉴权、给所有角色全部权限或删除数据卷来解决 403。

### 4.2 本轮已修正的契约

| 修正项 | 后端实施 | 前端配合 |
| --- | --- | --- |
| GET 参数绑定 | 菜单授权查询的 authorityId、菜单详情 id 改为正确 query 标签；字典项详情的畸形 id 标签修正；列表请求拆分为实际 query 字段，避免直接继承含 JSON body 的完整实体 | GET 统一使用 params，不发送 GET body |
| 目标角色菜单 | getMenuAuthority 使用请求中的目标 authorityId，校验角色存在；getMenu 仍查当前 JWT 角色 | 授权抽屉传正在编辑的角色，不能固定当前登录角色 |
| 新角色默认权限 | create_authority_logic.go 中默认 getMenu 策略由 POST 改为实际 GET；默认首页按现有菜单 name=index 查询，替换写死 ID=1 的关联；已受影响的数据用增量脚本修正 | 新建角色分配测试用户后立即登录，验证菜单可加载，无需重启后端 |
| 用户搜索 | 将 keyword 从 HTTP 传到 RPC 并实际参与查询；固定搜索 userName/nickName，参数化查询 | 搜索后回第一页；清空查询恢复列表 |
| 用户空值更新 | 约定“未传不更新，明确空值允许清空”；API 到 RPC 都保留字段是否提供，使用指针/optional 字段及明确更新字段集合，不能因默认零值误清空其他字段 | 编辑只提交可编辑字段；空电话/邮箱可以保存；密码不跟随资料编辑提交 |
| 新增用户返回 | 保留成功 result=null，声明与 Swagger 同步按实际无数据返回 | 按成功码处理并重新查列表，不依赖新增结果 ID |
| 列表与分页 | 用户/API/字典项真实分页；菜单保持全量树；字典列表保持全量；角色仅根节点分页的规则写清楚 | 树和全量列表不显示假的服务端分页 |
| 状态与合法 ID | 校验 enable/status、角色/用户/菜单是否存在；参数无效和记录不存在返回明确错误 | 状态用 1/2，不用布尔值；避免空 ID 请求 |
| 登录冻结与验证码 | 冻结用户不能新登录，并更新 session_version 撤销已签发会话；验证码强制校验并按 captchaId 隔离，120秒有效、一次提交后消费 | 取图保存 captchaId，登录携带该ID；失败重新取图；旧会话失效后回到登录页 |

验证码流程已调整为：`GET /v1/sys/randomImage` 返回 `{ captchaId, captchaImg }`；`POST /v1/sys/login` 提交 `{ username, password, captchaId, captcha }`。Redis 按随机ID保存答案，120秒有效，提交校验时原子读取并删除；同一图片只能提交一次，多页面取图互不覆盖。登录失败应重新取图，不使用开发开关或请求头跳过验证码。

用户状态为 `enable=1`（启用）或 `enable=2`（冻结）。JWT 默认有效期为 **2 小时**，后端逐次校验用户状态与 `session_version`。改密、重置密码、冻结、删除及默认角色/关联角色集合变更会撤销该账号已有会话；重新启用不会恢复旧令牌。重置密码读取 RPC 配置 `Default.UserPassword`，本地当前值是 **`goZero`**。`POST /v1/sys/logout` 也会注销该账号所有设备。删除、冻结、重置和角色变更均使用专用测试用户，不操作当前管理员。

通用响应继续保持 `code/message/result`；现有业务失效码100003、HTTP401、403按当前前端规则处理，不为了接入而批量改所有返回结构。

## 5. 按模块实施

### S1 用户管理

**已实现：**keyword 查询、空值编辑、角色集合保存、状态校验及数据库错误返回。用户资料与角色关联在同一次 RPC 事务中提交；“未传不更新、传空字符串清空”通过 HTTP 指针字段与 RPC 显式更新字段集合保留。默认角色必须属于已选角色，去掉默认角色但未提供有效替代值会明确失败。登录检查冻结状态，资料编辑不修改密码。

真实个人中心位于 `/account`，使用 `GET /v1/sys/me` 按当前 JWT 读取本人资料；`PUT /v1/sys/changePassword` 提交 `oldPassword/newPassword`，成功后退出并重新登录。它与保留的上游个人资料演示页分开。`me/changePassword/logout` 需要有效会话，不要求额外 Casbin 策略。后端同时保护最后一个可用管理员，不能借冻结、删除、角色或关键授权变更把管理入口全部撤销。

**前端顺序：**

1. 接用户列表、分页和搜索；接角色列表作为新增/编辑下拉选项。角色树跨分页时要取齐可选角色，不能只显示第一页；规模较大再考虑独立选项接口。
2. 新增/编辑共用表单。新增字段使用 `userName/passWord`；编辑主键使用 `ID`；角色用 `authorityId/authorityIds`，各层已支持修改默认角色。
3. 删除/重置密码发送 `{ userId }`。行按钮提交时禁用，成功后刷新；删除最后一条后回退到有效页。
4. 冻结/启用直接使用编辑接口，提交数字1/2并以服务器结果为准。
5. 映射旧组件 `views/superAdmin/user/user.vue` 到新业务用户页。

**验收：**新增后查得到；重复用户名明确失败；搜索确实过滤；清空电话/邮箱生效；角色变更可回显；冻结后按约定限制登录；普通角色无法越权删除或重置密码。使用专门测试用户，不拿当前管理员测试删除/冻结。

### S2 菜单管理

**已实现：**详情 query、name/path 唯一、父菜单存在和循环校验。有子菜单或角色授权引用时拒绝删除。后端同时拒绝前端系统保留名、`/auth`、`/_session`、`/account`、点路径段和规范化后的完整URL冲突，避免保存后使整个菜单加载失败。菜单字段、参数、按钮定义在一个事务中保存。

**前端：**用树表展示 getMenuList 的完整树；新增/编辑读取详情，选择父菜单，维护标题、name、path、component、图标、排序、隐藏及缓存。组件使用 `adapter/business/pages.ts` 的统一白名单，菜单编辑选项与路由映射不再各维护一份。保留旧组件值的映射，未知组件仍显示待接入。没有实际实现的旧参数先不展示为可用功能。

菜单编辑支持按钮定义的增删改，填写 `name` 权限标识和 `desc` 说明；已有按钮保留原 ID，未编辑的 `parameters` 原样提交。后端替换关联项会检查所有错误并回滚，原角色按钮授权不会因普通菜单编辑丢失。删除按钮会清理对应授权，重命名会改变前端权限码，提交前明确提示影响。

**验收：**父子树、排序、隐藏和深层路由正确；修改后刷新当前菜单；本地原有菜单不被覆盖；冲突由前后端清晰提示；删除失败时页面保持原数据。

### S3 角色与菜单授权

**已实现：**getMenuAuthority 查询请求中的目标角色；角色ID、父角色与默认首页均校验。新角色首页按菜单name查询，默认 `index`，并取得 `GET /v1/sys/menu/getMenu` 基础权限。删除有子角色或关联用户的角色时拒绝。菜单授权先验证全部ID，在事务中覆盖、去重并补必要父节点；空集合清空菜单和对应按钮授权。移除默认首页后清空旧首页名称，由前端确定回退页。

角色编辑已支持 parentId=0 移回根节点，并校验父子关系不能成环；通过明确字段更新保存合法零值。新角色创建时可选择现有根级菜单作为默认首页；其他首页应先分配菜单，再修改默认首页。

**前端：**

1. 角色树列表、新增、编辑和删除；主键是 `authorityId`，删除请求字段仍为 `id`。
2. 打开授权抽屉并行获取 getBaseMenuTree 与目标角色 getMenuAuthority；勾选回显后保存到 addAuthorityMenu。
3. 保存 `menuIds` 为逗号分隔字符串，统一包含必要父节点并去重；空选择明确提示清空该角色菜单。
4. 默认首页下拉取目标角色可访问菜单，保存菜单 name，不保存页面 URL。
5. 角色菜单、API、按钮三类授权独立保存；不要让一个“保存”悄悄覆盖另一类授权。API/按钮授权按模块/菜单分组，支持搜索和组内全选，展示已选及新增/撤销数量；搜索后操作只改可见候选，保留其他分组选择。
6. 清空菜单或撤销授权前展示明确确认。修改其他角色仅刷新该行/列表；影响当前登录角色才重新加载当前权限。后端禁止移除最后一个可用管理员的关键管理能力。

**验收：**用两个测试角色验证“查谁、改谁”；保存后重新打开回显一致；父子半选状态正确；取消菜单后重新登录或刷新权限，菜单消失；首页不可访问时有确定回退。

### S4 API 管理与角色接口授权

**已实现：**API按 `method + path` 校验唯一并规范方法大写；列表过滤与排序字段使用白名单。资源改名、删除与相关 Casbin 策略在同一数据库事务中处理；授权保存先校验目标角色和完整集合，再替换策略。提交后重载 Casbin，并通过现有 Redis watcher 通知其他实例。

非法 orderKey、无效ID和查询/保存错误不再返回假成功。按API ID保存先转换为路径/方法，再复用同一段策略替换逻辑。高级模式允许保留该角色已有的未登记规则，新规则必须先登记API资源；前端检测到未登记规则时要求用高级模式处理，避免悄悄丢弃。策略仍常驻内存，允许/拒绝结果不缓存，使权限修改立即参与下一次鉴权。

**前端：**

1. API 列表、筛选、新增、编辑、单条/批量删除；请求路径保持 `/v1/sys/...`，不含前端代理前缀 `/api`。
2. 角色“接口权限”抽屉读取 getAllApiList 与 getPathByAuthorityId，按路径和方法匹配勾选 API ID，保存调用 updateCasbinDataByApiIds。
3. 同一抽屉提供按路径/方法维护的高级模式，单独调用 updateCasbinData。一次保存只选一种模式，不连续调用两个覆盖接口。
4. 遇到策略中有不在 API 清单里的项目时，显示“未登记规则”并保留或要求明确处理，不能默默丢弃。切换保存模式前核对完整集合。
5. API 页的“同步接口”先调用 `GET /v1/sys/api/previewSync`，按新增、变更及不在当前授权清单中的资源显示差异；用户选择后才通过 `POST /v1/sys/api/applySync` 提交 `version/keys`。`obsolete` 包含已移除路由，也可能包含仍存在但无需 Casbin 授权的登录等路由，不代表全部路由已删除。没有自动给角色增加新授权，也不会自动删除这些资源。预览版本失效时重新预览并重新选择，不能盲目重试旧选择。

同步读取 RPC 编译时嵌入的 Swagger：改 `.api` 后先生成 Swagger，再构建并重启 RPC；仅刷新 Swagger UI 不会更新正在运行的 RPC 契约。已有资源更新保留 ID 与关联授权；跨分组选择不会互相覆盖，预览失败时禁用应用并允许重试。

**验收：**授权后普通角色能请求；撤销后接口实际403；只隐藏按钮不算通过；批量删除、空授权、非法ID、接口改路径/方法均正确；更新策略后无需重启服务生效。

**按钮权限已补齐：**`GET /v1/sys/menu/getAuthorityButtons?authorityId=...` 返回 `{ menuBtnIds: number[] }`；`PUT /v1/sys/menu/updateAuthorityButtons` 提交 `{ authorityId, menuBtnIds: number[] }`，空数组清空。API→RPC→关联表均已实现，按钮必须存在且所属菜单已授权给该角色。角色按钮抽屉使用目标角色菜单的 menuBtn 定义作为候选；当前菜单返回的 btns 才是实际授权，前端仍按“菜单name:按钮name”判断。

### S5 字典与字典项

**已实现：**字典项详情使用query id；字典type唯一，字典项所属字典必须存在，同一字典内value唯一。更新允许value=0、sort=0及空扩展值/描述；列表用字段是否提供区分“筛选0”和“不筛选”。有字典项时拒绝删除字典，先删除字典项后再删除字典，不遗留孤儿记录。

**前端：**字典列表与新增/编辑表单；行操作打开字典项抽屉，按 sysDictionaryID 查分页数据；字典项新增、编辑、详情、删除共用表单。getSysDictionaryDetails 用于业务选项或字典预览，不能代替可看到禁用项的管理列表。

管理页读取禁用字典详情时携带其 status，否则当前接口默认 status=1 会查不到。字典项管理列表的 value=0 筛选与“未传value”也要区分，不能把合法值0直接当作不筛选。

**验收：**按正确字典过滤；禁用项管理中可见，业务选项按接口状态约定过滤；值0、排序0可保存；重复类型、错误ID、删除依赖有明确反馈。

### S6 图片上传与邮箱验证码

**已开发，外部成功流程暂跳过：**头像和工具页已接上传，工具页已接邮箱验证码发送。上传限制10MB并按文件内容检查PNG/JPEG/GIF/WebP；配置缺失和外部调用失败返回明确消息。邮箱地址、发件人和SMTP信息已改为配置；验证码5分钟有效，同一邮箱至少间隔60秒，`isForce=true` 也不能跳过60秒限制。发送失败清除本次验证码，响应和日志不输出验证码内容。

实际OSS和SMTP尚未配置，本轮不把“请求返回未配置错误”写成成功上传或邮件送达。只有邮件发送接口，没有邮箱验证码校验/消费接口；本阶段不代表已完成邮箱绑定、注册验证或找回密码。

API配置文件 `go-zero-admin/application/applet/api/etc/applet-api.yaml` 可使用以下SMTP配置（占位值需替换后重启API）：

```yaml
Mail:
  Host: smtp.example.com
  Port: 465
  From: admin@example.com
  Username: admin@example.com
  Password: replace-with-smtp-password
```

当前实现使用 **implicit TLS（连接时即TLS，通常465端口）**，校验证书；不支持把587端口的STARTTLS配置直接代入。也可设置 `SMTP_HOST`、`SMTP_PORT`、`SMTP_FROM`、`SMTP_USER`、`SMTP_PASSWORD` 环境变量，作为未填写配置项的补充。OSS沿用 `Oss.Endpoint/AccessKeyId/AccessKeySecret/BucketName`，全部可用后重启API，再验收真实上传与返回URL。

**前端：**

- 图片上传先接用户头像表单，使用 FormData 的 `file_img`，返回取 `fileImgUrl`；上传成功只更新表单，用户保存后才写用户资料。请求由浏览器生成 multipart boundary。
- 邮箱验证码接新增的管理工具页，使用已授权接口发送到明确填写的邮箱；处理发送中、成功、限流和失败，默认不强制重发。该页单独配置菜单/API权限；它不代表已经支持匿名注册或找回密码。
- 为覆盖调试和接口验收，工具页可复用同一个图片上传组件，不新增第二套上传实现。

**验收：**有效图片上传、非法类型、超限、OSS失败均可处理；邮件实际送达指定测试邮箱，重复发送受限，服务不可用时前端收到错误。未配置外部服务时记录为“环境阻塞”，不能标为已验收。

## 6. 菜单接入方式

在应用 `src/adapter/business/pages.ts` 中登记页面，`menu.ts` 和菜单编辑下拉共同读取。原有业务菜单值优先保持：

| 后端已有 component | 新业务页面 |
| --- | --- |
| views/superAdmin/user/user.vue | /business/system/user/index.vue |
| views/superAdmin/menu/menu.vue | /business/system/menu/index.vue |
| views/superAdmin/authority/authority.vue | /business/system/authority/index.vue |
| views/superAdmin/api/api.vue | /business/system/api/index.vue |
| views/superAdmin/dictionary/dictionary.vue | /business/system/dictionary/index.vue |
| views/index.vue | 保持 /dashboard/workspace/index.vue |
| views/business/tools/index.vue | /business/tools/index.vue |
| views/business/account/index.vue | /business/account/index.vue（本人入口固定为 /account） |

字典项、角色菜单授权和接口授权优先作为主页面的抽屉，不为每个接口创建一个菜单。旧菜单如尚未授权给测试角色，应通过角色授权功能或增量初始化补齐。新的管理工具页才新增对应后端菜单记录；不能为了显示业务页把它塞进不受角色控制的原有示例路由。

当前登录角色的菜单、API或按钮授权变化后，重新获取当前权限并更新相关展示资料和首页；刷新权限时原有示例菜单仍保留。修改其他角色时仅刷新局部数据，不重载管理员当前页面。

**用户的默认角色或关联角色集合改变后，旧会话立即撤销，必须重新登录，取得新的 JWT。** 不能只清空路由再取菜单并声称切换了 JWT 角色。冻结、删除、改密、重置及服务端注销同样撤销旧会话。前端会隔离退出前或旧账号的迟到响应，避免旧请求清空新登录会话或覆盖新用户资料。

## 7. 后端生成、文档与检查

### 7.1 统一数据库初始化、迁移与备份

在 `go-zero-admin` 根目录使用统一脚本，不再手工挑选两份 SQL。Windows 自带 PowerShell 5.1 即可：

```powershell
# 首次初始化：只启动开发依赖并应用全部待执行迁移
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\test\sh\db.ps1 -Action Init
# 更新已有环境前先检查，再迁移；需要独立备份时单独执行 Backup
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\test\sh\db.ps1 -Action Status
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\test\sh\db.ps1 -Action Backup
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\test\sh\db.ps1 -Action Migrate
```

Linux 对应 `sh test/sh/db.sh init`、`status`、`backup`、`migrate`，需要 Docker Compose 与 `sha256sum`。部署使用独立环境：PowerShell 增加 `-Environment Deploy`，Shell 增加第二参数 `deploy`，例如 `sh test/sh/db.sh migrate deploy`。部署配置、打包清单及启动顺序统一见 [后端 README](../go-zero-admin/README.md#服务器部署)，不要混用开发数据卷。

当前按文件名排序执行六份迁移：业务权限、活跃用户名唯一约束、`20260926_00_method_dictionary.sql` 方法字典历史种子修复、API 同步入口权限、业务唯一约束、用户会话版本。方法字典只修复完全符合旧种子特征的 POST 值，不覆盖用户已编辑的字典项。

`schema_migrations` 记录已执行文件及校验值；已执行且未变化的文件跳过，发现已执行文件内容变化立即停止，因此后续变更应新增迁移文件。存在待执行项时，脚本先自动备份到 `bin/db-backups/` 并生成 `.sha256`，备份失败就不执行迁移。错误立即停止，不登记失败文件；MySQL 的 DDL 可能隐式提交，不能承诺整批 SQL 全部回滚，修正原因后再执行。遇到重名等旧数据冲突时先核实并修复数据，不自动删除或改名。

迁移使用容器内 `/tmp/gozero-db-migrate.lock` 防止并发执行；只有确认没有其他迁移进程后才能清理异常遗留锁。SQL 直接修改权限或会话字段后重启 RPC/API，并重新登录；正常通过管理接口修改授权会自动同步，无需重启。完整迁移清单、备份和故障处理见后端 README。

### 7.2 生成与检查

在 `go-zero-admin` 根目录，按修改范围执行：

```powershell
# .api 变更后：使用项目自定义模板
.\test\sh\api.bat applet

# 只有 .proto 变更时才需要
.\test\sh\rpc.bat applet applet

# 更新 Swagger，不要求安装 PowerShell 7
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\test\sh\swagger.ps1
```

生成前保存当前差异，生成后逐项检查；不要把带业务逻辑的文件当作纯生成文件直接覆盖。API生成、RPC生成、Swagger生成是三个不同步骤，生成 Swagger 不会替你更新 Go 类型或业务逻辑。

当前 Swagger 输出为 `data/api/generated/go-zero-admin.swagger.json`，共 48 个方法/路径。旧 `data/api/go-zero-admin.openapi.json` 不作为手工维护的第二套契约源。生成后刷新 [Swagger UI](http://localhost:8080)。API 同步读取 RPC 内嵌的该产物，因此必须**先生成 Swagger，再构建并重启 RPC**；不能只更新磁盘 JSON 后继续使用旧 RPC 预览。

`test/sh/swagger.ps1` 保留统一响应、注册成功null、上传和鉴权等项目适配。本轮GET请求已修正为query参数，当前生成文档不再需要GET body；脚本仍会对未来错误定义的GET body标注限制。后续改变契约时同步核对生成说明，不能只重复生成错误描述。

后端先对修改过的 Go 文件运行 gofmt，再运行相关包的测试；交付前在后端根目录执行 `go test ./...`。测试需要 MySQL/Redis等时明确环境，不把服务未启动写成已通过。重点测试参数绑定、空值更新、角色授权目标、事务回滚和权限生效。

前端在 `go-zero-admin-vben` 根目录执行：

```powershell
pnpm check:type:antdv-next
pnpm test:unit
pnpm build
```

对本次修改文件运行 ESLint；新增有意义的参数转换或权限测试，不为简单文字修改建立重复测试。构建通过后仍需真实接口联调。

后续数据库脚本继续按日期和模块命名，写清目的、执行顺序、重复执行行为和回退方式；必要时新增字段，不重建现有库。本轮后端已增加隔离SQLite测试，覆盖菜单/按钮关联保留与清空、无效授权、注入保存失败回滚、角色parentId=0、API策略即时生效、字典0值，以及HTTP到RPC的目标角色和按钮定义转换。

## 8. 原 38 个接口跟踪表与新增接口

路径统一省略前缀 `/v1/sys`。下表按原接入编号记录 2026-09-26 的实际 HTTP 状态；“通过”表示该接口已实际请求验证，具体成功/失败分支见测试报告，不代表穷尽所有边界。getAuthorityList 只计一次；外部服务成功流程单独保留跳过状态，不能仅因函数存在就标已验收。

| 编号 | 阶段 | 方法 | 路径（接 /v1/sys） | 页面操作 / 验收重点 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 01 | S1 | GET | /getUserList | 查询、搜索、分页 | HTTP 回归通过 |
| 02 | S1 | POST | /register | 管理员新增用户，重复校验 | HTTP 回归通过 |
| 03 | S1 | PUT | /updateUserInfo | 编辑、角色、状态及空值 | HTTP 回归通过 |
| 04 | S1 | PUT | /resetUserPassword | 重置测试用户密码后验证登录 | HTTP 回归通过 |
| 05 | S1 | DELETE | /deleteUser | 删除测试用户，处理关联 | HTTP 回归通过 |
| 06 | S1/S3 | GET | /authority/getAuthorityList | 角色下拉与角色树，根分页 | HTTP 回归通过 |
| 07 | S2 | GET | /menu/getMenuList | 全量菜单树 | HTTP 回归通过 |
| 08 | S2 | POST | /menu/addBaseMenu | 新增菜单及父子校验 | HTTP 回归通过 |
| 09 | S2 | GET | /menu/getBaseMenuById | query id详情回显 | HTTP 回归通过 |
| 10 | S2 | PUT | /menu/updateBaseMenu | 编辑及关联字段保存 | HTTP 回归通过 |
| 11 | S2 | DELETE | /menu/deleteBaseMenu | 子节点/授权引用处理 | HTTP 回归通过 |
| 12 | S3 | GET | /menu/getBaseMenuTree | 角色菜单选择树 | HTTP 回归通过 |
| 13 | S3 | GET | /menu/getMenuAuthority | 指定目标角色菜单回显 | HTTP 回归通过 |
| 14 | S3 | POST | /authority/createAuthority | 新增角色及父角色校验 | HTTP 回归通过 |
| 15 | S3 | PUT | /authority/updateAuthority | 编辑角色、默认首页 | HTTP 回归通过 |
| 16 | S3 | DELETE | /authority/deleteAuthority | 关联用户/子角色处理 | HTTP 回归通过 |
| 17 | S3 | POST | /authority/addAuthorityMenu | 菜单授权覆盖、清空与回显 | HTTP 回归通过 |
| 18 | S4 | GET | /api/getApiList | 过滤、分页与排序 | HTTP 回归通过 |
| 19 | S4 | GET | /api/getAllApiList | API授权完整候选集 | HTTP 回归通过 |
| 20 | S4 | POST | /api/createApi | 新增路径和方法 | HTTP 回归通过 |
| 21 | S4 | PUT | /api/updateApi | 修改资源与关联策略 | HTTP 回归通过 |
| 22 | S4 | DELETE | /api/deleteApi | 单条删除与策略清理 | HTTP 回归通过 |
| 23 | S4 | DELETE | /api/deleteApisByIds | 批量删除及失败回滚 | HTTP 回归通过 |
| 24 | S4 | GET | /casbin/getPathByAuthorityId | 目标角色API策略回显 | HTTP 回归通过 |
| 25 | S4 | PUT | /casbin/updateCasbinData | 按路径/方法授权 | HTTP 回归通过 |
| 26 | S4 | PUT | /casbin/updateCasbinDataByApiIds | 按API ID授权 | HTTP 回归通过 |
| 27 | S5 | GET | /dictionary/getSysDictionaryList | 字典完整列表 | HTTP 回归通过 |
| 28 | S5 | POST | /dictionary/createSysDictionary | 新增字典及type唯一 | HTTP 回归通过 |
| 29 | S5 | GET | /dictionary/getSysDictionaryDetails | id/type详情与业务选项 | HTTP 回归通过 |
| 30 | S5 | PUT | /dictionary/updateSysDictionary | 编辑及空描述保存 | HTTP 回归通过 |
| 31 | S5 | DELETE | /dictionary/deleteSysDictionary | 字典项关联处理 | HTTP 回归通过 |
| 32 | S5 | GET | /dictionary/getSysDictionaryInfoList | 所属字典、过滤及分页 | HTTP 回归通过 |
| 33 | S5 | GET | /dictionary/getSysDictionaryInfoListDetailsById | query id详情回显 | HTTP 回归通过 |
| 34 | S5 | POST | /dictionary/createSysDictionaryInfo | 新增项、所属字典校验 | HTTP 回归通过 |
| 35 | S5 | PUT | /dictionary/updateSysDictionaryInfo | 修改含0值、空值 | HTTP 回归通过 |
| 36 | S5 | DELETE | /dictionary/deleteSysDictionaryInfo | 删除后刷新选项 | HTTP 回归通过 |
| 37 | S6 | POST | /base/uploadFileImg | 头像/工具页上传及失败处理 | 非法文件拒绝通过；OSS成功流程暂跳过 |
| 38 | S6 | POST | /base/sendEmailCode | 实际发送、限流与失败提示 | 非法邮箱拒绝通过；SMTP送达流程暂跳过 |

### 新增的 2 个配套接口（不计入原38个）

| 编号 | 方法 | 路径（接 /v1/sys） | 输入与用途 | 状态 |
| --- | --- | --- | --- | --- |
| B01 | GET | /menu/getAuthorityButtons | query authorityId，读取目标角色menuBtnIds | HTTP 回归通过 |
| B02 | PUT | /menu/updateAuthorityButtons | body authorityId/menuBtnIds，事务覆盖按钮授权 | HTTP 回归通过 |

### 新增的 5 个会话与 API 同步接口

| 方法 | 路径（接 /v1/sys） | 输入与用途 | 状态 |
| --- | --- | --- | --- |
| GET | /me | 按 JWT 读取本人真实资料 | 已开发；真实会话回归通过 |
| PUT | /changePassword | oldPassword/newPassword；成功撤销该账号所有会话 | 已开发；真实会话回归通过 |
| POST | /logout | 注销该账号所有设备 | 已开发；真实会话回归通过 |
| GET | /api/previewSync | 读取嵌入契约并生成资源差异及版本 | 已开发；真实同步回归通过 |
| POST | /api/applySync | version/keys；只应用所选新增或变更资源 | 已开发；真实同步回归通过 |

当前仍未扩展 refreshToken、在线切换 JWT 角色、找回密码、操作日志。OSS 上传与 SMTP 实际送达仍需可用外部配置后验收；这些边界不影响已实现的当前用户查询、改密和服务端注销。

## 9. S7：完成标准与交付记录

每个模块交付时记录一行：`模块｜前端文件｜后端文件｜数据库脚本｜已验收接口编号｜测试结果｜未完成项`。

全量交付必须满足：

- 当前 48 个接口均有真实请求与返回验证；同用途的两个授权保存方式分别验证。外部服务缺配置的成功流程明确列为跳过。
- 保留原有页面；完成的业务菜单打开真实页面，其余占位与接口完成状态一致。
- 管理员、普通测试角色分别验证菜单与接口；非法ID、空数据、重复数据、无权限和服务失败可正常提示。
- 登录、刷新、深层路径、退出再登录、过期及权限变化后刷新通过回归。旧会话和旧路由不会串到新用户。
- 前端类型检查/相关测试/构建、后端相关测试通过；Swagger与实际行为一致。
- 没有一次保存调用两个相互覆盖的授权接口，没有关闭鉴权以通过调试，没有为了初始化而重置已有数据库。

初次接入阶段交付记录（最终结果见下方最新日期）：

| 模块 | 实现位置 | 当前状态 | 待补验收 |
| --- | --- | --- | --- |
| 用户 | 前端business/system/user；后端user API/RPC | 已开发 | 真实账号CRUD、冻结与重新登录 |
| 菜单/角色/按钮 | 前端menu/authority及3个授权抽屉；后端menu/authority | 已开发；隔离事务测试通过 | 实际角色、按钮回显、刷新与撤权 |
| API/Casbin | 前端api、api-permissions；后端api/casbin/accessutil | 已开发；策略事务测试通过 | 普通角色真实允许/403和两种授权方式 |
| 字典 | 前端dictionary与items；后端dictionary | 已开发；0值与依赖测试通过 | 实际增改查删和禁用项显示 |
| 上传/邮箱 | 前端头像上传、tools；后端base | 已开发 | OSS/SMTP未配置，真实上传与送达暂跳过 |
| 初始化 | test/sh/db.ps1、db.sh；data/db/migrations/ | 当前统一管理六份迁移，记录校验值并在迁移前备份 | 使用 Status 核对目标环境；不以迁移成功替代业务回归 |

最终HTTP回归、页面操作、重启后检查及问题修复记录在下方补充。验收时分别写明“通过”“失败已修复后复测”“因环境缺配置跳过”，不把跳过项目写成通过。

### 2026-09-25 初次接入检查记录（历史）

**代码已开发，最终完整业务回归尚未结束。** 原38个接口和新增2个按钮接口均已接入；API/RPC已重新编译并启动，前端已重启。开发地址为 `http://127.0.0.1:5999`、API端口7001、RPC端口6001。日志及本轮权限表备份位于后端 `bin/dev/`；数据库和Docker数据卷未重建。

| 检查 | 实际结果 |
| --- | --- |
| 后端 `go test ./...` | 全部通过，含用户/权限事务回滚、参数绑定、冻结登录、字典0值、上传输入校验及按钮HTTP响应测试 |
| 前端类型检查 | 通过 |
| 前端全部单元测试 | 84个文件、598项测试通过 |
| 前端生产构建及本轮文件ESLint | 通过；上游构建仍有旧浏览器BigInt目标等非阻断警告 |
| 契约与生成 | `.api`、路由、Swagger共43个方法/路径一致；43个handler使用统一成功响应 |
| 数据初始化 | 两份增量SQL均在备份后执行并重跑通过；权限数据数量不变，活跃用户名唯一约束已生效 |
| 原页面与刷新 | 原Antdv Next演示页面保留；登录中的会话在重启及直接刷新角色深层URL后可恢复 |
| 公开接口与鉴权失败 | 两次同时取图均返回有效图片和不同captchaId；实际请求无效JWT返回失效码100003；Swagger服务实际提供43接口 |
| 用户页 | 最新RPC重启后真实列表正常；搜索admin只返回匹配用户、无匹配时显示空结果、重置恢复列表；当前用户删除/冻结禁用、新增必填校验及完整角色选项已检查 |
| 菜单/角色授权页 | 完整菜单树、指定角色菜单回显、管理员22个按钮授权回显已检查；API授权清单与路径模式可切换并保留规则 |
| API页 | 真实列表、路径筛选后只剩匹配接口已检查 |
| 字典页 | 经真实页面新增字典、读取详情、清空描述、新增字典值0/排序0成功，数据库再次核实持久化正确；测试字典和项已单独软删除清理 |
| 工具页 | 页面及按钮权限正常；非法邮箱前端校验通过。真实OSS上传、SMTP送达未配置，暂跳过 |

已发现并修复后复测的问题：旧库与临时表排序规则不一致；新按钮handler未统一包装；goctl版本目录导致自定义模板未生效；RPC生成重复main入口；授权读取失败可误存空值及晚到响应串角色；头像上传中可提前保存；测试对已移除Element Plus安装路径的硬编码。API模板改用 `test/goctl/api` 的版本无关回退目录，RPC生成显式使用 `--name-from-filename`；以后升级goctl也要继续检查生成差异。

**当时未完成：**正常验证码登录/退出再登录、普通角色实际 HTTP 403、授权及撤销立即生效、用户冻结/重置后的真实登录，以及完整 CRUD 和失败分支的 HTTP 回归。后续执行结果见下方 2026-09-26 记录；历史隔离测试结果不能替代真实 HTTP 验收。

后端已提供可复用回归脚本（需Node.js18或以上，仅允许localhost/127.0.0.1）：

```powershell
# 在 go-zero-admin 根目录，通过正常验证码获取测试会话
node .\test\sh\login.mjs image
# 打开输出的captcha.png，120秒内填入图片内容
node .\test\sh\login.mjs login <验证码>
node .\test\sh\smoke.mjs "$env:TEMP\go-zero-admin-regression\session.json"
node .\test\sh\session-smoke.mjs "$env:TEMP\go-zero-admin-regression\session.json"
node .\test\sh\api-sync-smoke.mjs "$env:TEMP\go-zero-admin-regression\session.json"
```

登录脚本默认使用开发账号 admin/123456，也支持 `GOZERO_TEST_USER`、`GOZERO_TEST_PASSWORD`。令牌仅保存到系统临时目录，不打印在控制台。批量脚本建立唯一测试记录并在结束时清理，输出 `test/reports/` 下的报告；`smoke.mjs` 验证原 CRUD/授权，`session-smoke.mjs` 验证真实会话撤销，`api-sync-smoke.mjs` 验证资源同步。会话测试仍走正常图片验证码，输入错误时取新图，不能绕过校验。没有报告或仅脚本语法通过，都不代表真实接口测试通过。若清理失败，先按报告中的唯一 prefix 定位测试数据，不批量删除现有数据。

原 CRUD 脚本中冻结和重置只验证写接口与资料状态，旧会话撤销及新密码登录由独立会话脚本验证。真实邮件测试仅在配置 SMTP 且明确设置 `TEST_MAIL_TO` 后发送；报告不会把外部服务跳过项目算成功。

### 2026-09-26 优化后复核记录

| 检查 | 实际结果 |
| --- | --- |
| 前端类型检查 | `pnpm check:type:antdv-next` 通过 |
| 前端全部单元测试 | `pnpm test:unit`：93 个文件、638 项测试通过 |
| 前端生产构建 | `pnpm build` 通过，11/11 个任务完成；最终产物已包含验证码暗色背景可读性修复 |
| 后端检查 | `go test ./...`：11 个测试包通过，44 个顶层用例、包含子用例共 74 项；`go vet ./...` 通过 |
| 业务 HTTP 回归 | `latest-smoke.json`：41 个受保护接口已请求，19 组通过、2 组外部服务成功流程跳过；覆盖业务 CRUD、角色/菜单/按钮/API 授权及相关拒绝分支 |
| 真实会话回归 | 本人资料、改密、冻结、默认角色变更、关联角色变更、重置、注销、删除共 8 个场景通过；两次人工验证码误输入对应场景已针对性重测通过 |
| API 同步 HTTP 回归 | 3 项通过，验证预览、选择应用与版本冲突处理；未自动授予新接口权限或删除过时资源 |
| 额外复核 | 过期验证码实际请求与 RPC 日志凭据屏蔽检查通过；暗色主题验证码白色背景已修复 |

本轮还补齐菜单按钮定义、单一页面注册表、分组授权及变更数量提示、仅当前角色刷新权限、数据库迁移/备份工具和服务端会话撤销。前端修复了旧会话响应覆盖新会话、授权跨组选择丢失和同步预览失败后的重复刷新风险，并在暗色主题下给验证码图片保留白色背景。真实回归以报告和复测记录为准，不能把人工验证码输入错误归为业务代码失败，也不能把外部服务跳过计为通过。
