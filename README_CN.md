# Cookie-share Chrome/Edge/Firefox 扩展/油猴脚本

*注：仅供学习交流，严禁用于商业用途，请于24小时内删除，禁止在社交平台传播。如果本项目对你有用麻烦点个 star 这对我很有帮助，谢谢！*

[![GitHub Stars](https://img.shields.io/github/stars/fangyuan99/cookie-share?style=social)](https://github.com/fangyuan99/cookie-share)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black) ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white) ![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white) ![Tampermonkey](https://img.shields.io/badge/Tampermonkey-333333?style=flat-square&logo=tampermonkey&logoColor=white)

**有问题请先看 [issues](https://github.com/fangyuan99/cookie-share/issues) | [discussions](https://github.com/fangyuan99/cookie-share/discussions)**

[English](./README.md) | [简体中文](./README_CN.md) | [Update Log](./update.md)

---

## 概述

Cookie-share 是一个 Chrome/Edge/Firefox 扩展 (同时也有 Tampermonkey 脚本)，允许用户在不同设备或浏览器之间发送和接收 cookies，可以用于**多账号切换、视频会员共享、星球合租**等场景。后端支持自建 Cloudflare Worker 或 Node.js 服务器，保障数据安全。

![image](./images/cs1.png)

---

![image](./images/cs2.png)

---



 [油猴脚本一键安装（推荐）](https://github.com/fangyuan99/cookie-share/raw/refs/heads/main/tampermonkey/cookie-share.user.js) | [镜像加速](https://fastly.jsdelivr.net/gh/https://github.com/fangyuan99/cookie-share/raw/refs/heads/main/tampermonkey/cookie-share.user.js) | [插件下载（不推荐，不再维护）](https://github.com/fangyuan99/cookie-share/releases)

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
- 在本地保存 cookies，无需后端（v0.1.0 新增）
- 通过 Cookie List 管理 cookies（区分本地与云端数据）
- 管理员功能，用于管理存储的 cookies
- 由于插件的权限更大，可以支持 JS 无法访问的 `HTTPOnly` Cookie

## 使用方法

### 油猴脚本使用方法（推荐）

1. 安装 [油猴](https://www.crxsoso.com/webstore/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo) 或者其他脚本管理器:
2. [一键安装](https://github.com/fangyuan99/cookie-share/raw/refs/heads/main/tampermonkey/cookie-share.user.js) | [镜像加速](https://github.site/fangyuan99/cookie-share/raw/refs/heads/main/tampermonkey/cookie-share.user.js)
3. 若出现 cookie 权限问题，请在油猴设置中开启
![tm_cn](./images/tm_cn.png)
1. 在已登录的浏览器页面发送 Cookie
2. 在未登录的浏览器页面接受 Cookie
3. 注意地址后面不要加 `/`，示例: `https://your-worker-name.your-subdomain.workers.dev/{PATH_SECRET}`

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
6. 注意地址后面不要加 `/`，示例: `