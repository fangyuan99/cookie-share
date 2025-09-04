# LocalStorage 功能测试指南

## 新增功能说明

插件现在支持同时发送和接收 Cookies 和 LocalStorage 数据，特别针对720yun网站进行了优化。

### 主要新功能

1. **LocalStorage 支持**
   - 可以获取和设置网页的 localStorage 数据
   - 自动检测720yun网站并启用localStorage选项
   - 支持手动选择是否包含localStorage

2. **智能检测**
   - 访问720yun网站时自动勾选"Include localStorage"选项
   - 浮动按钮会自动使用包含localStorage的功能（针对720yun）

3. **新的API端点**
   - `/send-cookies-storage` - 发送cookies和localStorage
   - `/receive-cookies-storage/{id}` - 接收cookies和localStorage

## 测试步骤

### 1. 基本功能测试

1. **重新加载插件**
   - 在 `chrome://extensions/` 中刷新插件
   - 确保版本显示为 v0.3.9

2. **界面测试**
   - 打开插件弹窗
   - 应该能看到新的 "Include localStorage (for 720yun, etc.)" 复选框

### 2. 720yun 网站测试

1. **访问720yun网站**
   - 打开 https://720yun.com 或任何720yun的子页面
   - 打开插件弹窗
   - 应该自动勾选localStorage选项并显示提示信息

2. **登录状态测试**
   - 在720yun网站登录你的账户
   - 确保登录状态正常（检查localStorage中的相关数据）
   - 打开开发者工具 > Application > Local Storage
   - 应该能看到以下关键数据：
     - `720yun_v8_session`
     - `720yun_v8_session_expiry`
     - `720yun_v8_token`

3. **发送数据测试**
   - 输入Cookie ID
   - 输入服务器URL
   - 确保"Include localStorage"已勾选
   - 点击"Send Cookies"
   - 应该显示"Cookies and localStorage sent successfully!"

4. **接收数据测试**
   - 在另一个浏览器或无痕模式中访问720yun
   - 安装插件并设置相同的服务器URL
   - 输入相同的Cookie ID
   - 确保勾选"Include localStorage"
   - 点击"Receive Cookies"
   - 页面应该自动刷新并恢复登录状态

### 3. 浮动按钮测试

1. **720yun页面的浮动按钮**
   - 在720yun网站上应该能看到左下角的浮动按钮
   - 点击浮动按钮打开cookie管理弹窗
   - 选择一个cookie ID并点击"Receive"
   - 应该自动使用包含localStorage的功能

### 4. 其他网站测试

1. **非720yun网站**
   - 访问其他网站（如百度、Google等）
   - 打开插件弹窗
   - localStorage选项应该默认不勾选
   - 手动勾选后可以测试localStorage功能

## 故障排除

### 常见问题

1. **localStorage选项不显示**
   - 确保插件已重新加载
   - 检查popup.html是否正确更新

2. **720yun自动检测不工作**
   - 检查浏览器控制台是否有错误
   - 确保tabs权限正常工作

3. **localStorage数据未传输**
   - 检查服务器是否支持新的API端点
   - 查看background.js中的错误日志
   - 确保scripting权限已正确配置

4. **权限错误**
   - 确保manifest.json中包含"scripting"权限
   - 重新安装插件以获取新权限

### 调试方法

1. **查看背景页面日志**
   - 访问 `chrome://extensions/`
   - 找到Cookie Share插件
   - 点击"service worker"链接查看日志

2. **查看localStorage数据**
   - 开发者工具 > Application > Local Storage
   - 检查数据是否正确传输

3. **网络请求调试**
   - 开发者工具 > Network标签
   - 查看API请求和响应

## 支持的网站

目前已知支持的网站：
- 720yun.com (自动检测)
- 其他需要localStorage的网站（手动启用）

## 注意事项

1. **隐私安全**
   - localStorage可能包含敏感信息
   - 请确保服务器端的安全性

2. **数据完整性**
   - 传输前会清除目标页面的现有localStorage
   - 请确保重要数据已备份

3. **浏览器兼容性**
   - 需要Chrome 88+版本
   - 需要Manifest V3支持

现在你可以按照这个指南测试720yun网站的LocalStorage同步功能了！
