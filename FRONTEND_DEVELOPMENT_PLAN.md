# 新增模块前端开发顺序与验收记录

更新日期：2026-10-03。依据后端70个HTTP接口和2026-10-02后端交付记录，优先恢复本地后端，再完成前端业务模块，最后重启联调。本文为本轮实施依据；通用规范继续沿用 DEVELOPMENT.zh-CN.md 和 DEVELOPMENT-WORKFLOW.zh-CN.md。

## 实施原则

- 业务应用固定为 apps/web-antdv-next，沿用 requestClient、Vben 表单、Vxe 表格及 antdv-next，不修改共享框架来绕过业务问题。
- 后端菜单决定管理页面入口，pages.ts 统一登记页面；菜单、按钮与API授权分别维护。个人设备入口放入现有个人中心。
- 新接口在 api/business 下集中定义类型与函数；GET使用query，DELETE使用实际body约定，列表将list/total转换为items/total。
- 操作成功后读取服务端结果；提交中禁用按钮，删除/撤销需确认，错误保留可重试状态，不显示假成功。
- 允许修复必要后端问题。现有本地库先备份，再执行增量迁移；保留现有数据、权限和用户修改，不删除数据卷。
- 不确定的产品扩展和外部服务验收先记录，继续可确定功能。代码检查、接口验证、浏览器验证分别记录。

## 开发顺序

| 顺序 | 范围 | 交付与验收 | 状态 |
| --- | --- | --- | --- |
| 0 | 后端启动恢复 | 复现错误、定位根因、备份迁移或修复代码；API/RPC及依赖恢复 | 已完成 |
| 1 | 文档与契约 | 更新根目录流程，核对70个接口、字段、权限、密码字节规则 | 已完成 |
| 2 | 组织管理 | 部门树、岗位CRUD；用户归属弹窗；角色数据范围抽屉 | 已实现并通过代码回归 |
| 3 | 审计日志 | 分页、类型/结果/操作者/模块/时间过滤、详情 | 已实现并通过代码回归 |
| 4 | 文件资源 | 上传、public/private、资源列表、访问地址、引用保护、删除重试 | 已实现；真实OSS操作待配置验收 |
| 5 | 设备会话 | 个人中心设备列表和撤销；管理员会话页、目标用户筛选 | 已实现并通过代码回归 |
| 6 | 菜单与授权 | 新页面映射、增量菜单/按钮种子、管理员授权、普通角色边界 | 已迁移，隔离SQL和前端权限回归通过 |
| 7 | 重启与复查 | 类型检查、相关测试、构建、后端回归；重启后检查登录/页面/接口 | 检查与启动验证通过；登录后实机验收待人工验证码 |

## 接口与首版范围

| 页面/能力 | 后端接口 | 关键约定 |
| --- | --- | --- |
| 部门 | GET/POST/PUT/DELETE /v1/sys/organization/departments | id/parentId，数字状态1/2；禁止环和有引用删除，后端错误直接展示 |
| 岗位 | GET/POST/PUT/DELETE /v1/sys/organization/positions | id/name/code/sort/status；有人员引用不可删除 |
| 用户归属 | GET/PUT /v1/sys/organization/membership | userId/departmentId/positionIds；真实变更撤销该用户旧会话，操作前说明 |
| 角色范围 | GET/PUT /v1/sys/organization/dataScope | authorityId/scope/departmentIds；all/self/department/department_and_children/custom，角色1固定全部 |
| 审计 | GET /v1/sys/audit/getAuditLogList | pageNo/pageSize、eventType/module/actorId/actorName/result/startTime/endTime；只读，无删除接口 |
| 文件 | GET /v1/sys/files/list、GET /url、DELETE /resource、POST/DELETE /reference | id/fileId、状态active/deleting/deleted；引用维护仅角色1，签名地址300秒 |
| 图片上传 | 原图片上传接口 | multipart file_img；visibility默认public，可选private；保留fileImgUrl并读取fileId |
| 本人设备 | GET /v1/sys/session/devices、DELETE /device | id为字符串；current标记；撤销当前设备后清理本地登录态，不再调用全设备退出 |
| 管理设备 | GET /v1/sys/session/admin/devices、DELETE /device | userId可选；仅角色1，另受API权限保护 |

身份、部门快照、有效数据范围由后端决定。前端只提供选择与解释，不自行推断权限放行。文件数据范围不等于所有旧管理接口的范围，页面文案明确当前作用。

## 页面和文件规划

- 审计：views/business/system/audit/index.vue、api/business/system/audit.ts。
- 组织：views/business/system/organization/departments.vue、positions.vue；用户归属、角色范围使用独立弹窗或抽屉，接现有用户/角色页面。
- 文件：views/business/system/files/index.vue、api/business/system/files.ts；上传、详情/引用可拆小组件。
- 会话：views/business/system/sessions/index.vue 与个人中心设备组件；api/business/device-sessions.ts。
- 页面统一注册到 adapter/business/pages.ts，沿用 backend menu.name:button 访问码；后端新迁移提供菜单与初始管理员按钮授权。
- 密码表单统一按UTF-8字节验证8至72字节；历史短密码可登录，登录页不误加新密码限制。

## 验证方式

1. 针对API请求字段、菜单映射、权限边界、设备当前会话处理、字节密码规则和必要页面逻辑补回归。
2. 前端运行 pnpm check:type:antdv-next、pnpm test:unit 和 pnpm build；格式和lint按项目脚本检查本轮文件。
3. 后端执行必要Go测试/静态检查；涉及SQL的迁移先验证再备份应用。
4. 重新启动本项目API/RPC/前端，核对实际端口和日志。优先复用合法现有登录态；需验证码且不能自主继续时记录实际阻断，不删除鉴权或伪造令牌。
5. 浏览器检查菜单、路由、表格、弹窗、错误和空状态；真实外部服务未配置时明确记未验收。

## 跳过与待确认

| 项目 | 处理 |
| --- | --- |
| OSS/SMTP真实外部操作 | 无可用测试配置时跳过真实上传/邮件；完成前端处理、后端mock回归及未配置提示 |
| 多租户、审批、refreshToken、异常登录通知 | 本轮不扩展，先完成已有后端接口的页面 |
| 文件引用自动接具体业务对象、历史对象导入、对账回收 | 缺少业务生命周期和存量归属，保留后端首版边界并在页面说明 |
| 登录后的浏览器完整验收 | 当前浏览器没有合法有效登录态；需要人工完成验证码。按用户离席时可跳过的指示保留待验收，不伪造令牌、不关闭验证 |
| 文件引用明细、所有者/部门名称联查 | 现有契约只返回引用数和归属ID；展示真实ID，引用仅提供已知objectType/objectId的登记/移除，不虚构明细 |
| 老浏览器兼容及上游测试告警 | 本轮沿用现有构建目标；依赖BigInt目标提示、Happy DOM网络清理/上游mock提示记录如下，另行安排框架兼容治理 |
| 生产发布 | 本轮恢复本地开发运行环境，生产部署另按部署文档进行 |

## 实施和最终验收记录

### 后端启动恢复

RPC启动失败来自本地开发库未执行2026-10-02新增迁移，报MySQL 1146：`sys_policy_versions`不存在；API虽然占用7001端口，RPC6001未监听。先备份现有库再增量迁移，未重建数据库或Docker卷。

- 第一次备份：后端 `bin/db-backups/gozero-development-20261003-004017-276.sql`及校验文件，随后补六份模块迁移。
- 前端菜单迁移前再次备份：`bin/db-backups/gozero-development-20261003-005345-389.sql`，应用 `20261003_frontend_modules.sql`，共13份迁移全部APPLIED。
- 新增 `test/sh/dev.ps1` 管理本项目API/RPC启动、停止、重启和状态；启动前检查待迁移，按精确进程和二进制路径停止，日志及PID清单位于后端 `bin/dev/managed/services.json`。
- 增量菜单验证覆盖重复执行、保留已有定制组件/路径、冲突时跳过，不覆盖用户菜单；种入5个菜单和12个按钮并授予内置管理员。普通角色仍需分别配置菜单、API和按钮。
- 跨端复核实际开发库：20个新增管理接口加原图片上传，共21个依赖API均有角色1授权。最后一次后端重启已包含组织保留停用关联的修复，日志目录 `bin/dev/managed/20261003-011152-ea444e8a`。

### 已交付入口

| 入口 | 页面能力及边界 |
| --- | --- |
| `/admin/organization/departments` | 部门完整树、名称/编码/状态筛选、新增/编辑/删除；过滤保留祖先，编辑排除自身及后代 |
| `/admin/organization/positions` | 岗位筛选、分页、新增/编辑/删除；有人员引用时展示后端拒绝原因 |
| 用户管理的“归属” | 部门/多岗位选择、未分配及清空，读取失败禁写，切换对象后丢弃旧响应；真实归属变更使该用户重新登录 |
| 角色管理的“数据范围” | 五种范围及指定部门，内置角色1只读全部；说明当前只影响文件资源数据范围 |
| `/admin/audit` | 服务端分页和类型、结果、操作者、模块、时间过滤；只读详情、RFC3339时间转换和白名单参数展示 |
| `/admin/files` | 公开/私有图片上传、真实分页、受控预览/下载、管理员手工引用；有引用禁止删除，删除失败刷新deleting状态后重试 |
| `/admin/sessions` | 内置管理员查看有效设备、按用户筛选和撤销单设备 |
| `/account` | 本人登录设备；撤销当前设备后仅清理本地登录态，不调用全部设备注销 |

菜单组件统一登记到 `adapter/business/pages.ts`。新权限前缀为 `organization-departments`、`organization-positions`、`audit`、`files`、`sessions`；原用户和角色页增加 `user:membership`、`authority:dataScope`。用户归属读取依赖部门、岗位、归属三个GET接口；角色范围依赖部门和数据范围GET接口，授权时一并配置。

文件私有访问链接有效期300秒，每次下载重新请求授权地址，不向对象存储发送应用JWT。OSS跨域未允许时提示打开图片另存为。头像和原工具页继续默认公开上传，避免把临时私有签名存为长期头像。

### 复查时补充修复

- 个人改密在校验开始前锁定提交，阻止重复请求；改密和撤销设备捕获当前token，旧响应不会退出后来建立的新登录。
- 新建用户与本人改密按UTF-8字节校验8至72字节，历史短密码仍可用于登录。
- 前端菜单与保留路由的完整路径按大小写不敏感方式检查，避免Vue Router默认匹配产生冲突。
- 后端组织更新允许保留同一对象原有的停用部门/岗位关联，但关联对象及部门祖先必须存在；新增、切换或移除后重加仍要求启用。数据范围仅原本为custom时可保留原关联，非custom遗留记录不能借此扩大范围。真实归属变更仍撤销旧会话，无变更不撤销，审计失败整事务回滚。

### 首轮实际验证结果（2026-10-03，第二次复查前）

| 检查 | 结果 |
| --- | --- |
| `pnpm check:type:antdv-next` | 通过，包括本轮所有页面及测试 |
| 本轮变更文件ESLint | 通过，无错误/警告；Vue模板另统一缩进 |
| `pnpm test:unit` | 107个文件、676项通过；日志 `.temp/dev/final-unit-tests.log` |
| `pnpm build` | 11个构建任务成功，应用9324个模块完成转换；产物 `apps/web-antdv-next/dist`及`dist.zip` |
| 后端统一检查 | 345个Go文件格式、vet、非缓存测试、构建通过；组织边界修复另跑组织/范围/用户/权限事务/设备回归与构建 |
| 隔离MySQL迁移 | 13份迁移、菜单/按钮/管理员关联、重复执行及定制保留回归通过 |
| 实际启动和代理 | API7001/RPC6001/前端5999重新启动；前端HTML200，`/api/v1/sys/randomImage`返回200及验证码ID/图片 |
| 鉴权冒烟 | 未登录的个人设备和审计接口按现有协议返回业务100003，不暴露数据；浏览器直访`/admin/files`跳转登录 |
| 浏览器启动 | 登录页、验证码图片加载正常，无控制台error；尚未操作登录后管理页面 |

前端测试仍有上游Happy DOM网络请求清理/超时输出及sortable mock位置提示，但最终全部测试通过且退出码0。生产构建保留依赖`@v-c/mini-decimal`关于BigInt与目标环境的提示；本轮未更改浏览器支持范围。Vben表单slot迁移提示为原有开发提示。并行全量检查期间后端出现过短时权限版本轮询超时，随后自动恢复；这些提示不计为新增功能验收，也不隐去。

最终重启中Vite预热约31秒，首次40秒就绪探测超时；并行重启API期间出现一次代理连接拒绝。随后重新实测前端HTML200、代理业务200、验证码ID和图片均存在，服务已恢复正常。最终前端运行记录 `.temp/dev/services.json`，对应日志前缀 `20261003-011107`；后台运行PID以清单和实时端口为准。

### 启动、日志与剩余人工验收

在后端根目录执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File test/sh/dev.ps1 -Action Status
powershell.exe -NoProfile -ExecutionPolicy Bypass -File test/sh/dev.ps1 -Action Start
# 已有受脚本管理的进程需要重启时：
powershell.exe -NoProfile -ExecutionPolicy Bypass -File test/sh/dev.ps1 -Action Restart
# 有待执行迁移时，为Start或Restart添加-Migrate，脚本会先备份再迁移。
```

前端根目录执行 `pnpm dev`。本轮已启动 `http://127.0.0.1:5999`，运行记录和日志在 `.temp/dev/`；再次运行前先确认5999是否已被本项目占用，避免误启另一个端口。所有命令针对本地开发环境。

人工完成正常验证码登录后，按以下顺序继续；以下不是本轮已通过的实机验收：

1. 管理员菜单进入部门、岗位、审计、文件、设备页面，验证刷新、分页、空数据和错误状态。
2. 用专用测试用户/角色验证组织CRUD、归属清空与停用关联保留、五种数据范围和普通角色按钮/API拒绝；不要冻结或删除当前管理员。
3. 用两个正常登录设备验证撤销单设备、撤销当前设备、其他设备保持有效；个人改密需由用户完成。
4. 配置测试OSS后验证公开/私有上传、300秒签名、下载跨域、引用保护、删除失败重试；SMTP送达按原工具页流程另验。

文件引用自动业务集成、存量文件归属、refreshToken等扩展继续保留在跳过表，先完成上述真实验收再安排下一轮。

## 第二次前后端代码复查（2026-10-03）

复查范围包括新增组织、审计、文件、设备会话页面及对应后端，连同用户/角色接入点、菜单迁移和启动脚本。以下问题已直接修复：

| 问题 | 修复与回归 |
| --- | --- |
| 用户管理页旧请求覆盖新对象或影响新登录 | 表单加载使用请求版本与令牌双重隔离；保存捕获目标用户；删除、重置、启停的确认与响应检查原始令牌，并阻止重复写入。新增5项页面回归 |
| 已分配停用岗位无法单项移除 | 使用服务端原始关联白名单，保留项可单独移除或撤回未保存的编辑，新增停用项不可选；部门与custom数据范围规则一致。使用真实antdv-next Select验证标签关闭与选择状态 |
| 文件引用登记与删除并发漏判 | 后端持有文件锁时通过锁定当前读检查引用；MySQL中复现旧快照漏洞，修复后连续5次通过 |
| 权限已提交但请求等待同步而超时 | 策略重载和Redis通知由单个后台线程有界合并处理，每次鉴权仍检查数据库版本并在失败时拒绝授权 |
| 历史菜单重复斜线造成登录菜单冲突 | 新增 `20261003_frontend_routes_compat.sql`；只修复未定制原始种子，保留已有菜单与授权；定制冲突报告SKIPPED供人工处理 |
| 同时启动/停止覆盖服务PID记录 | 开发服务脚本增加项目级排他文件锁，包含状态查询，拒绝并发操作 |

### 本轮验证

- 前端类型检查通过；本轮业务文件ESLint通过。
- 前端全量 `pnpm test:unit --maxWorkers=4`：109个文件、685项全部通过，退出码0，日志 `.temp/dev/review-unit-tests.log`。
- 后端 `test/sh/verify.ps1`：349个Go源文件格式、全量vet、非缓存测试及构建通过，日志 `bin/dev/review-verify.log`。
- MySQL引用并发回归单独在真实MySQL 8.0.34执行5次通过；默认Go检查未配置测试DSN时会跳过该用例。
- 迁移回归验证旧13份脚本下的重复斜线路由冲突、新增第14份脚本修复、空闲候选路径选择、自定义数据及授权保留、定制种子跳过与重复执行幂等。
- `pnpm build`通过，11个构建任务成功（10个缓存复用，应用本次重新构建），应用9324个模块完成转换；日志 `.temp/dev/review-build.log`。
- 最终类型修复后的测试文件仅调整类型导入排序，ESLint复查通过；该排序不改变运行行为。

### 本轮迁移与重启

实际开发库迁移前备份为后端 `bin/db-backups/gozero-development-20261003-031600-853.sql`；14份迁移全部APPLIED，五个菜单均UNCHANGED，默认入口保持不变。服务操作锁的独立PowerShell回归通过，未启动第二套服务。

后端已重编译重启，日志目录 `bin/dev/managed/20261003-032003-f2de0365`，RPC6001/API7001正常。前端精确核验旧PID后重启，日志前缀 `.temp/dev/20261003-032145`，Vite约4.9秒就绪。运行清单分别为后端 `bin/dev/managed/services.json` 和前端 `.temp/dev/services.json`。

重启后实测前端HTML200、后端及前端代理验证码业务200且包含有效ID；未认证审计/设备请求业务100003。RPC标准错误为空；API错误输出对应主动未登录探测；前端仍有既有Vben表单slot迁移提示。未发现本轮启动失败。

第一次前端全量检查与其他检查并行运行时，8个Vitest工作进程启动超时，退出码1；停止并行检查后单独完整重跑全部通过，未改动测试断言或隐藏失败。Happy DOM网络清理输出与sortable mock位置提示仍存在，记录为上游测试环境待治理项。登录后浏览器操作、真实OSS和SMTP验收仍按上方待验收清单执行，单元测试不替代这些检查。
