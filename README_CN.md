# Cookie-share 油猴脚本

*注：仅供学习交流，严禁用于商业用途，请于24小时内删除，禁止在社交平台传播。如果本项目对你有用麻烦点个 star 这对我很有帮助，谢谢！*

[![GitHub Stars](https://img.shields.io/github/stars/fangyuan99/cookie-share?style=social)](https://github.com/fangyuan99/cookie-share)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black) ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white) ![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white) ![Tampermonkey](https://img.shields.io/badge/Tampermonkey-333333?style=flat-square&logo=tampermonkey&logoColor=white)

**有问题请先看 [issues](https://github.com/fangyuan99/cookie-share/issues) | [discussions](https://github.com/fangyuan99/cookie-share/discussions)**

[English](./README.md) | [简体中文](./README_CN.md) | [Update Log](./update.md)

---

## 概述

Cookie-share 是一个 Tampermonkey 油猴脚本，允许用户在不同设备或浏览器之间发送和接收 cookies，可以用于**多账号切换、视频会员共享、星球合租**等场景。后端支持自建 Cloudflare Worker 或 Node.js 服务器，保障数据安全。

![image](./images/cs1.png)

---

![image](./images/cs2.png)

---



 [油猴脚本一键安装](https://github.com/fangyuan99/cookie-share/raw/refs/heads/main/tampermonkey/cookie-share.user.js) | [镜像加速](https://fastly.jsdelivr.net/gh/https://github.com/fangyuan99/cookie-share/raw/refs/heads/main/tampermonkey/cookie-share.user.js)

### 效果与应用场景
**很多网站不支持多账号切换，不想退出重登？**

**开了视频会员，好兄弟老是让你扫码嫌麻烦？**

**开了某星球，和同学合租回回血？**

**单纯懒得掏出手机或者输密码换设备登录？**

1. 进入已登录网站的主页（任何含有 Cookie 的地址都可以）
2. 使用油猴菜单命令，自定义一个 ID（仅支持字母和数字），发送 Cookie
3. 没有登录的设备访问登录页，用刚刚的 ID 获取 Cookie，等待脚本显示 Cookie 获取并设置成功后刷新网页即可

已测试的网站:
1. 某星球
2. 某艺
3. 某 L 站

## 功能

- 为 cookie 共享生成随机唯一 ID
- 将当前标签页的 cookies 发送到服务器
- 从服务器接收并设置 cookies 到当前标签页
- 在本地保存 cookies，无需后端（v0.1.0 新增）
- 通过 Cookie List 管理 cookies（区分本地与云端数据）
- 管理员功能，用于管理存储的 cookies
- 可以支持普通页面 JS 无法访问的 `HTTPOnly` Cookie

## 使用方法

### 油猴脚本使用方法

1. 安装 [油猴](https://www.crxsoso.com/webstore/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo) 或者其他脚本管理器:
2. [一键安装](https://github.com/fangyuan99/cookie-share/raw/refs/heads/main/tampermonkey/cookie-share.user.js) | [镜像加速](https://github.site/fangyuan99/cookie-share/raw/refs/heads/main/tampermonkey/cookie-share.user.js)
3. 若出现 cookie 权限问题，请在油猴设置中开启
![tm_cn](./images/tm_cn.png)
1. 在已登录的浏览器页面发送 Cookie
2. 在未登录的浏览器页面接受 Cookie
3. 注意地址后面不要加 `/`，示例: `https://your-worker-name.your-subdomain.workers.dev/{PATH_SECRET}`
4. 如果你使用 Cloudflare Worker 后端，油猴脚本只需要填写 `Transport Secret`。发送、接收、云端列表、云端删除都会使用同一个 `TRANSPORT_SECRET`
5. 管理面板访问 `https://your-worker-name.your-subdomain.workers.dev/{PATH_SECRET}/admin`

### 后端部署指南

#### 选项 1: Cloudflare Worker + D1 (推荐)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/fangyuan99/cookie-share&env=ADMIN_PASSWORD&env=PATH_SECRET&env=TRANSPORT_SECRET&d1=COOKIE_DB)

通过 Cloudflare 一键部署：

1. 点击上面的 Deploy 按钮并授权 Cloudflare
2. 在部署表单中填写 `ADMIN_PASSWORD`、`PATH_SECRET` 和 `TRANSPORT_SECRET`
3. 完成部署后，Cloudflare 会自动创建并绑定名为 `COOKIE_DB` 的 D1 数据库
4. 不需要再手动创建 KV 或手动绑定 D1；Worker 会在第一次写入请求时自动创建所需表结构
5. 在油猴脚本中使用 `https://your-worker-domain/{PATH_SECRET}` 作为后端地址

通过 Wrangler 本地部署：

1. 执行 `npm install`
2. 执行 `npx wrangler login`
3. 复制 `.dev.vars.example` 为 `.dev.vars`，用于本地开发
   - 如果没有 `.dev.vars`，`wrangler dev` 在 localhost 下会自动回落到 `PATH_SECRET=dev`、`ADMIN_PASSWORD=dev-password` 和 `TRANSPORT_SECRET=dev-transport-secret`
4. 生产部署前先设置远端密钥：
   - `npx wrangler secret put ADMIN_PASSWORD`
   - `npx wrangler secret put PATH_SECRET`
   - `npx wrangler secret put TRANSPORT_SECRET`
5. 执行 `npm run deploy`
6. 可选：首次部署完成后执行 `npm run db:migrate`，让 Wrangler 的 D1 migration 元数据也同步创建

仓库现在已经在 [wrangler.jsonc](./wrangler.jsonc) 中声明了 D1 绑定，因此 Cloudflare 在部署时可以自动创建并绑定数据库。

如果您需要更高的性能或对数据存储有更多控制，可以部署独立的 Node.js 服务器：

#### 选项 2: Node.js 服务器

*注意：自建服务器可能会遭受攻击以及其他安全问题，请自行承担风险！*

1. [克隆](https://github.com/fangyuan99/cookie-share-server) cookie-share-server 代码仓库
2. 使用 `npm install` 安装依赖
3. 创建 `.env` 文件并包含以下变量：

   - `PORT`：服务器端口（默认为 3000）
   - `ADMIN_PASSWORD`：设置一个强密码用于管理员访问
   - `PATH_SECRET`：设置一个强字符串以防止暴力破解
   - `DB_PATH`：SQLite 数据库文件路径（默认为 ./data/cookie_share.db）
4. 使用 `npm start` 启动服务器
5. 通过 `http://your-server-ip:port/{PATH_SECRET}` 访问服务器

Node.js 服务器实现具有以下优势：
- Cookie 加密以增强安全性
- 持久化 SQLite 数据库存储
- 没有请求限制或存储配额
- 自托管，完全控制您的数据

### 无后端本地使用

从 v0.1.0 版本开始，Cookie-share 现在支持本地存储功能。这意味着您可以在不设置后端服务器的情况下使用该脚本：

- 勾选"保存到本地"复选框以将 Cookie 存储在本地
- Cookie 列表现在区分本地数据和云端数据
- 非常适合在单个设备上个人使用或高度关注隐私的场景

要在不同设备或浏览器之间共享 Cookie，您仍需要按照下文所述设置后端。

## 安全注意事项

- 确保 `ADMIN_PASSWORD` 设置为强密码并定期更改
- 确保 `TRANSPORT_SECRET` 足够随机，并与管理员密码独立轮换
- 不要在代码中硬编码 `ADMIN_PASSWORD`，始终使用环境变量
- 不要复用 `ADMIN_PASSWORD` 作为传输加密密钥
- 定期审查 D1 中存储的数据，删除不必要的 Cookie 数据
- 考虑为 Cookie 数据设置过期时间，以降低长期存储敏感信息的风险
- 在 Worker 配置中使用 `PATH_SECRET` 以防止暴力破解攻击
- 设置复杂的项目名称并禁用内置的 workers.dev 域名

## 后端 API 端点

**如果 `/{PATH_SECRET}/admin/*` 端点出现问题，请先确认是否带上了 `X-Admin-Password`，并检查 `ADMIN_PASSWORD` 与 `PATH_SECRET` 是否配置正确**

两种后端实现均提供以下端点：

注意：
- `GET /{PATH_SECRET}/admin` 是明文 HTML 页面
- `OPTIONS` 仍然是明文 CORS 预检
- 油猴脚本相关 JSON 接口使用基于 `TRANSPORT_SECRET` 的加密信封
- 管理页相关 JSON 接口使用 `ADMIN_PASSWORD` 同时完成鉴权和页面侧加密
- 油猴脚本和管理页会自动处理加解密；如果直接用 `curl`，需要你自己实现对应的客户端加密逻辑

可用端点：
- `POST /{PATH_SECRET}/send-cookies`：存储与唯一 ID 关联的 Cookie
- `GET /{PATH_SECRET}/receive-cookies/{id}`：读取指定 ID 的 Cookie
- `GET /{PATH_SECRET}/list-cookies-by-host/{host}`：油猴脚本云端列表接口
- `DELETE /{PATH_SECRET}/delete?key={id}`：油猴脚本云端删除接口
- `GET /{PATH_SECRET}/admin`：打开管理页面壳层
- `GET /{PATH_SECRET}/admin/list-cookies`：列出所有存储的 Cookie ID 和 URL
- `GET /{PATH_SECRET}/admin/list-cookies-by-host`：按主机名筛选列出 Cookie
- `POST /{PATH_SECRET}/admin/create`：从管理页创建记录
- `DELETE /{PATH_SECRET}/admin/delete`：删除给定键的数据
- `PUT /{PATH_SECRET}/admin/update`：更新给定键的数据
- `GET /{PATH_SECRET}/admin/export-all`：导出全部记录为加密 JSON
- `POST /{PATH_SECRET}/admin/import-all`：导入加密 JSON，并按 ID 执行 upsert
- `OPTIONS /{PATH_SECRET}/`：处理 CORS 预检请求

管理员管理页面提供了用户友好的界面，用于管理 Cookie 和其他数据，包括查看已存储的 Cookie、创建新条目、更新现有条目以及删除单个记录。

要访问管理页面，请在浏览器中打开 `https://your-backend-address/{PATH_SECRET}/admin`。页面本身可以直接访问，管理页只需要 `ADMIN_PASSWORD`；油猴脚本只需要 `TRANSPORT_SECRET`。

**所有 `/admin/*` API 端点都需要使用管理员密码进行身份验证。**

## 文件结构

- `tampermonkey/cookie-share.user.js`：油猴脚本
- `_worker.js`：用于后端操作的 Cloudflare Worker 脚本
- `wrangler.jsonc`：Cloudflare Worker 与 D1 配置
- `migrations/0001_init.sql`：初始 D1 表结构
- `.dev.vars.example`：本地开发变量示例
- `package.json`：Wrangler 相关脚本

## 开发

修改脚本：

1. 编辑 `tampermonkey/cookie-share.user.js`
2. 在 Tampermonkey 中重新安装或刷新脚本以验证更改

修改后端：

1. 对于 Cloudflare Worker：编辑 `_worker.js`，使用 `npm run check` 校验后，再执行 `npm run deploy`
2. 如需显式应用仓库中的 SQL migration，可在 Worker 已存在后执行 `npm run db:migrate`
3. 对于 Node.js 服务器：编辑 cookie-share-server 代码仓库中的文件

## 发布前 Smoke Checklist

- 通过 Cloudflare Deploy 按钮部署，并确认 D1 数据库被自动创建和绑定
- 完整验证 `POST /send-cookies -> GET /receive-cookies/{id} -> GET /admin/list-cookies -> GET /admin/list-cookies-by-host/{host} -> PUT /admin/update -> DELETE /admin/delete -> GET /admin/export-all -> POST /admin/import-all`
- 验证当 `TRANSPORT_SECRET` 缺失或错误时，油猴脚本的云端操作会明确失败
- 验证非法 ID、缺失 key、非法 URL、错误的 cookie JSON、错误管理密码都返回预期的 4xx
- 打开 `/{PATH_SECRET}/admin`，确认 Pico CSS 管理页的刷新、删除、导出、导入都正常
- 确认油猴脚本仍能同时显示本地/云端数据，并且空列表时不再报错

## 贡献

[aBER0724 (aBER)](https://github.com/aBER0724) - 贡献了最初的油猴脚本版本

欢迎贡献！随时提交 Pull Requests。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=fangyuan99/cookie-share&type=Date)](https://star-history.com/#fangyuan99/cookie-share&Date)

## License

MIT
