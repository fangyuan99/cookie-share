# Cookie-share Chrome/Edge/Firefox 扩展/油猴脚本

*注：仅供学习交流，严禁用于商业用途，请于24小时内删除，禁止在社交平台传播。如果本项目对你有用麻烦点个 star 这对我很有帮助，谢谢！*

**有问题请先看 [issues](https://github.com/fangyuan99/cookie-share/issues) | [discussions](https://github.com/fangyuan99/cookie-share/discussions)**

[English](./README.md) | [简体中文](./README_CN.md) | [Update Log](./update.md)

---

## 概述

Cookie-share 是一个 Chrome/Edge/Firefox 扩展 (同时也有 Tampermonkey 脚本)，允许用户在不同设备或浏览器之间发送和接收 cookies，可以用于**多账号切换、视频会员共享、星球合租**等场景。后端支持自建 Cloudflare Worker 或 Node.js 服务器，保障数据安全。

![image](./images/cs1.png)

---

![image](./images/cs2.png)

---




 [油猴脚本一键安装（推荐）](https://github.com/fangyuan99/cookie-share/raw/refs/heads/main/tampermonkey/cookie-share.user.js) | [镜像加速](https://github.site/fangyuan99/cookie-share/raw/refs/heads/main/tampermonkey/cookie-share.user.js) | [插件下载](https://github.com/fangyuan99/cookie-share/releases)

### 效果与应用场景
**很多网站不支持多账号切换，不想退出重登？**

**开了视频会员，好兄弟老是让你扫码嫌麻烦？**

**开了某星球，和同学合租回回血？**

**单纯懒得掏出手机或者输密码换设备登录？**

1. 进入已登录网站的主页（任何含有 Cookie 的地址都可以）
2. 点击插件图标，自定义一个 ID（仅支持字母和数字），发送 Cookie
3. 没有登录的设备访问登录页，用刚刚的 ID 获取 Cookie，等待插件显示 Cookie 获取并设置成功后刷新网页即可

已测试的网站:
1. 某星球
2. 某艺
3. 某 L 站

## 功能

- 为 cookie 共享生成随机唯一 ID
- 将当前标签页的 cookies 发送到服务器
- 从服务器接收并设置 cookies 到当前标签页
- 管理员功能，用于管理存储的 cookies
- 由于插件的权限更大，可以支持 JS 无法访问的 `HTTPOnly` Cookie

## 使用方法

### 油猴脚本使用方法（推荐）

1. 安装 [油猴](https://www.crxsoso.com/webstore/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo) 或者其他脚本管理器:
2. [一键安装](https://github.com/fangyuan99/cookie-share/raw/refs/heads/main/tampermonkey/cookie-share.user.js) | [镜像加速](https://github.site/fangyuan99/cookie-share/raw/refs/heads/main/tampermonkey/cookie-share.user.js)
3. 若出现 cookie 权限问题，请在油猴设置中开启
![1](https://linux.do/uploads/default/optimized/4X/5/3/8/538542cf5469125cfb2f2c3a38f7a8aaba1bd586_2_963x750.png)
![2](https://linux.do/uploads/default/optimized/4X/5/3/8/538542cf5469125cfb2f2c3a38f7a8aaba1bd586_2_963x750.png)
4. 在已登录的浏览器页面发送 Cookie
5. 在未登录的浏览器页面接受 Cookie
6. 注意地址后面不要加 `/`，示例: `https://your-worker-name.your-subdomain.workers.dev/{PATH_SECRET}`

### 插件使用方法
1. 开启浏览器的开发者模式：
   - Chrome/Edge：访问 `chrome://extensions/`
   - Firefox：访问 `about:debugging#/runtime/this-firefox`
2. 加载扩展：
   - Chrome/Edge：将 `cookie-share.zip` 直接拖动到浏览器中
   - Firefox：临时加载 `cookie-share.xpi` 文件或从 Firefox 附加组件安装
3. 点击浏览器工具栏中的 Cookie-share 图标
4. 在已登录的浏览器页面发送 Cookie
5. 在未登录的浏览器页面接受 Cookie
6. 注意地址后面不要加 `/`，示例: `https://your-worker-name.your-subdomain.workers.dev/{PATH_SECRET}`


### 后端部署教程

#### 方式一：Cloudflare Worker（推荐）

1. [注册](https://dash.cloudflare.com/sign-up) Cloudflare 账户并创建一个 Worker。
2. 复制 [_worker.js](./_worker.js) 文件的内容到新创建的 Worker 中。
3. 在 Cloudflare Worker 的设置中，添加以下环境变量：
   - `ADMIN_PASSWORD`: 设置一个强密码，用于访问管理员端点
   - `PATH_SECRET`: 设置一个强字符串，防止被暴力破解
   - `COOKIE_STORE`: 创建一个 KV 命名空间，用于存储 cookie 数据
4. 在 Worker 的设置中，绑定 KV 命名空间：
   - 变量名称：`COOKIE_STORE`
   - KV 命名空间：选择你创建的 KV 命名空间
5. 保存并部署 Worker。
6. 记下 Worker 的 URL，格式类似：`https://your-worker-name.your-subdomain.workers.dev/{PATH_SECRET}`（如果被墙，请自定义域名）

#### 方式二：Node.js 服务器

*注：自建服务器可能存在被攻击等安全性问题，请自行承担风险！*

如果需要更高性能或对数据存储有更多控制，可以部署独立的 Node.js 服务器：


1. 克隆 [cookie-share-server](https://github.com/fangyuan99/cookie-share-server) 仓库
2. 使用 `npm install` 安装依赖
3. 创建 `.env` 文件，包含以下变量：
   - `PORT`: 服务器端口（默认：3000）
   - `ADMIN_PASSWORD`: 设置管理员访问的强密码
   - `PATH_SECRET`: 设置一个强字符串，防止被暴力破解
   - `DB_PATH`: SQLite 数据库文件路径（默认：./data/cookie_share.db）
4. 使用 `npm start` 启动服务器
5. 通过 `http://你的服务器IP:端口/{PATH_SECRET}` 访问服务器

Node.js 服务器实现提供以下优势：
- 使用 Cookie 加密提升安全性
- 持久化 SQLite 数据库存储
- 无请求限制或存储配额
- 自托管，完全控制您的数据

## 安全注意事项

- 确保将 `ADMIN_PASSWORD` 设置为一个强密码，并定期更改。
- 不要在代码中硬编码 `ADMIN_PASSWORD`，始终使用环境变量。
- 定期审查存储的数据，删除不再需要的 cookie 数据。
- 考虑为 cookie 数据设置过期时间，以减少长期存储敏感信息的风险。
- 使用 `PATH_SECRET` 在 worker 配置中防止暴力破解攻击。
- 将项目名称设置得复杂一些，并禁用自带的 workers.dev 域名。

## 后端 API 端点

**若 `/{PATH_SECRET}/admin/*` 接口出现问题，请检查是否添加了 X-Admin-Password 或者使用 cf 官方的 kv 管理页面**

两种后端实现都提供以下端点：

注意添加 `X-Admin-Password: yourpassword`

示例:

`/{PATH_SECRET}/admin/list-cookies`

```sh
curl --location --request GET 'https://你的后端地址/{PATH_SECRET}/admin/list-cookies' \
--header 'X-Admin-Password: yourpassword'
```

`/{PATH_SECRET}/admin/delete`

```sh
curl --location --request DELETE 'https://你的后端地址/{PATH_SECRET}/admin/delete?key={yourid}' \
--header 'X-Admin-Password: yourpassword'
```

可用的端点：
- `POST /{PATH_SECRET}/send-cookies`: 存储与唯一 ID 关联的 cookies
- `GET /{PATH_SECRET}/admin`: 访问管理员管理页面
- `GET /{PATH_SECRET}/admin/list-cookies`: 列出所有存储的 cookie ID 和 URL
- `GET /{PATH_SECRET}/admin/list-cookies-by-host`: 按主机名筛选并列出 cookies
- `DELETE /{PATH_SECRET}/admin/delete`: 删除给定键的数据
- `PUT /{PATH_SECRET}/admin/update`: 更新给定键的数据
- `OPTIONS /{PATH_SECRET}/`: 处理 CORS 预检请求

管理员管理页面提供了一个用户友好的界面，用于管理存储的 cookies 和其他数据。它包括查看所有存储的 cookies、创建新的 cookie 条目、更新现有的 cookies 以及删除单个 cookies 或所有存储的数据等功能。

要访问管理员页面，请在浏览器中导航至 `https://你的后端地址/{PATH_SECRET}/admin`。在访问管理界面之前，您将需要输入管理员密码。

**管理员端点需要使用管理员密码进行身份验证。**

## 文件结构

- `manifest.json`: 扩展配置文件
- `popup.html`: 扩展弹出窗口的 HTML 结构
- `popup.js`: 处理用户交互和 cookie 操作的 JavaScript
- `style.css`: 弹出窗口的 CSS 样式
- `_worker.js`: Cloudflare Worker 脚本，用于后端操作

## 开发

修改扩展：

1. 编辑相关文件（`popup.html`、`popup.js`、`style.css`）。
2. 在 Chrome 中重新加载扩展以查看更改。

修改后端：

1. 对于 Cloudflare Worker：编辑 `_worker.js` 文件并将更新后的 Worker 部署到 Cloudflare。
2. 对于 Node.js 服务器：编辑 cookie-share-server 仓库中的文件。

## 后续开发计划

- 后续主要更新油猴脚本，插件暂时不更新

## 贡献

[aBER0724 (aBER)](https://github.com/aBER0724) - 贡献油猴脚本初版

欢迎贡献！请随时提交 Pull Request。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=fangyuan99/cookie-share&type=Date)](https://star-history.com/#fangyuan99/cookie-share&Date)

## 许可证

MIT

