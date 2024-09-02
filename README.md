# Cookie-share Chrome/Edge 扩展

# 注：仅供学习交流，严禁用于商业用途，请于24小时内删除，禁止在社交平台传播。如果本项目对你有用麻烦点个 star 这对我很有帮助，谢谢！

## 概述

Cookie-share是一个 Chrome 扩展，允许用户在不同设备或浏览器之间发送和接收 cookies。它使用 Cloudflare Worker 作为后端来存储和检索 cookie 数据。

### 效果与应用场景

**开了视频会员，好兄弟老是让你扫码嫌麻烦？**

**开了某星球，和同学合租回回血？**

**单纯懒得掏出手机或者输密码换设备登录？**

1. 进入已登录网站的主页 (任何含有 Cookie 的地址都可以)
2. 点击插件图标，自定义一个 id（仅支持字母和数字），发送 Cookie
3. 没有登录的设备访问登录页，用刚刚的 id 获取 Cookie，等待插件显示 Cookie 获取并设置成功后刷新网页即可

已测试的网站:
1. 某星球
2. 某艺
3. 某L站

## 功能

- 为 cookie 共享生成随机唯一 ID
- 将当前标签页的 cookies 发送到服务器
- 从服务器接收并设置 cookies 到当前标签页
- 管理员功能，用于管理存储的 cookies
- 由于插件的权限更大，可以支持 JS 无法访问的 `HTTpOnly` Cookie

## 安装

1. 克隆此仓库或下载源代码。
2. 打开 Chrome 并导航至 `chrome://extensions/`。
3. 在右上角启用"开发者模式"。
4. 点击"加载已解压的扩展程序"并选择包含扩展文件的目录。

## 使用方法

### 插件使用方法
1. 开启 Chrome/Edge 浏览器的开发者模式（[拓展程序地址](chrome://extensions/)）
2. 将修改好的压缩包`cookie-share.zip`直接拖动到浏览器中
3. 点击 Chrome 工具栏中的 Cookie-share图标。
4. 在已登录的浏览器页面发送 Cookie
5. 在未登陆的浏览器页面接受 Cookie
   
### 后端部署教程

1. [注册](https://dash.cloudflare.com/sign-up) Cloudflare 账户并创建一个 Worker。

2. 复制 `_worker.js` 文件的内容到新创建的 Worker 中。

3. 在 Cloudflare Worker 的设置中，添加以下环境变量：
   - `ADMIN_PASSWORD`: 设置一个强密码，用于访问管理员端点
   - `COOKIE_STORE`: 创建一个 KV 命名空间，用于存储 cookie 数据

4. 在 Worker 的设置中，绑定 KV 命名空间：
   - 变量名称：`COOKIE_STORE`
   - KV 命名空间：选择你创建的 KV 命名空间

5. 保存并部署 Worker。

6. 记下 Worker 的 URL，格式类似：`https://your-worker-name.your-subdomain.workers.dev` (被墙请自定义域名)


## 安全注意事项

- 确保将 `ADMIN_PASSWORD` 设置为一个强密码，并定期更改。
- 不要在代码中硬编码 `ADMIN_PASSWORD`，始终使用环境变量。
- 定期审查存储的数据，删除不再需要的 cookie 数据。
- 考虑为 cookie 数据设置过期时间，以减少长期存储敏感信息的风险。

## 后端（Cloudflare Worker）

后端实现为 Cloudflare Worker，提供以下端点：

- `POST /send-cookies`: 存储与唯一 ID 关联的 cookies
- `GET /receive-cookies/:id`: 检索给定 ID 的 cookies
- `GET /admin/list-cookies`: 列出所有存储的 cookie ID 和 URL
- `POST /admin/create`: 创建新的数据条目
- `GET /admin/read`: 读取给定键的数据
- `PUT /admin/update`: 更新给定键的数据
- `DELETE /admin/delete`: 删除给定键的数据
- `DELETE /admin/delete-all`: 删除所有存储的数据
- `GET /admin/list`: 列出所有存储的数据

管理员端点需要使用管理员密码进行身份验证。

## 文件结构

- `manifest.json`: 扩展配置文件
- `popup.html`: 扩展弹出窗口的 HTML 结构
- `popup.js`: 处理用户交互和 cookie 操作的 JavaScript
- `style.css`: 弹出窗口的 CSS 样式
- `_worker.js`: 后端操作的 Cloudflare Worker 脚本

## 开发

修改扩展：

1. 编辑相关文件（`popup.html`、`popup.js`、`style.css`）。
2. 在 Chrome 中重新加载扩展以查看更改。

修改后端：

1. 编辑 `_worker.js` 文件。
2. 将更新后的 worker 部署到 Cloudflare。

## 安全考虑（初版暂未完善）

- 扩展使用 HTTPS 与后端进行所有通信。
- 管理员端点受密码保护。
- 实施输入验证以防止注入攻击。
- Cookies 安全存储在服务器上，没有唯一 ID 无法访问。

## 后续开发计划
- 只提供管理接口，没有管理页面（不知道何时更新）
 
## 贡献

欢迎贡献！请随时提交 Pull Request。

## 许可证

MIT
