- Tampermonkey Script v0.1.0 / 油猴脚本版v0.1.0
  - 新增保存到本地选项框
  - 在 Cookie List 中区分本地与云端数据
  - 在油猴插件中新增 Cookie List 的打开项
  - 新增 updateURL 用于更新脚本
  - 停用明文传输，改为加密后传输
  - 新增语言选择，当前支持中文和英文
  - Added local storage option checkbox
  - Distinguished between local and cloud data in Cookie List
  - Added Cookie List opening option in Tampermonkey plugin
  - Added updateURL for script updates
  - Disabled plaintext transmission, switched to encrypted transmission
  - Added language selection, currently supports Chinese and English

- Node.js Server v0.0.1 / Node.js 服务器版v0.0.1
  - Added standalone Node.js server implementation in separate repository (cookie-share-server)
  - 在独立仓库中添加了 Node.js 服务器实现 (cookie-share-server)
  - Added cookie encryption using ADMIN_PASSWORD for better security
  - 使用 ADMIN_PASSWORD 对 cookie 数据进行加密，提高安全性
  - SQLite database for persistent storage
  - 使用 SQLite 数据库进行持久化存储

- Tampermonkey Script v0.0.1 / 油猴脚本版v0.0.1
  - Reconstructed using Tampermonkey script for better compatibility and easier installation
  - 使用油猴脚本重构，兼容性更强，安装更方便
  - Added PATH_SECRET in _worker.js to prevent brute force attacks
  - _worker.js 文件中添加了 PATH_SECRET，防止被爆破

- v0.3.8:
  - Added clear all cookies button, for adding multiple accounts like: chatgpt.com...
  - 新增 clear all cookies 按钮，方便添加多个账号：chatgpt.com...
  - Changed the logic of floating button, wait for the page to load before generating
  - 修改浮动按钮的生成逻辑，等待页面加载完成后再生成

- v0.3.7:
  - Refactored worker code
  - 重构 worker 代码
  - Refactored page and modified icons
  - 重构页面，修改图标
  - Added floating button for quick account switching
  - 新增浮动按钮，可以快速切换账号
  - Attempted to fix Firefox browser compatibility issues
  - 尝试修复 Firefox 浏览器兼容问题

- v0.2.0:
  - Significantly refactored the page
  - 大幅重构了页面
  - Added admin redirect link
  - 增加 admin 跳转链接
  - Added list-cookies popup
  - 增加 list-cookies 弹窗
  - Attempted to fix Firefox browser compatibility issues
  - 尝试修复火狐浏览器兼容问题

- v0.1.5:
  - Modified worker code/admin authentication, changed worker code structure, adjusted cookie expiration time
  - 修改 worker 代码/admin 鉴权，修改了 worker 代码结构，调整了 cookie 过期时间

- v0.1.4:
  - Improved interface layout and design
  - 改进界面布局和设计
  - Added GitHub repository link
  - 添加 GitHub 仓库链接
  - Added version display and update check
  - 添加版本显示和更新检查
  - Rearranged version information layout
  - 重新布局版本信息位置
  - Added manual update check feature
  - 添加手动更新检查功能

- v0.1.3:
  - Changed all information to English
  - 所有信息改为英文
  - Removed "Save URL" button, changed to auto-save
  - 移除"保存 URL"按钮，改为自动保存
  - Added build script with version control
  - 添加带版本控制的构建脚本
  - Improved user experience, URL auto-save
  - 改进用户体验，URL 自动保存

- v0.1.2:
  - Added clear cookie confirmation prompt
  - 添加清除 cookie 确认提示

- v0.1.1:
  - Added custom URL save feature
  - 添加自定义 URL 保存功能

- v0.1.0:
  - Initial version
  - 初始版本

