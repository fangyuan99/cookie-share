const GITHUB_REPO = "fangyuan99/cookie-share";
const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours

// 检查更新函数
async function checkForUpdates() {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
    );
    const data = await response.json();

    const currentVersion = chrome.runtime.getManifest().version;
    const latestVersion = data.tag_name.replace("v", "");

    return {
      hasUpdate: latestVersion > currentVersion,
      currentVersion,
      latestVersion,
      releaseUrl: data.html_url,
    };
  } catch (error) {
    console.error("Error checking for updates:", error);
    return {
      hasUpdate: false,
      currentVersion: chrome.runtime.getManifest().version,
      error: error.message,
    };
  }
}

// 自动检查更新（每天一次）
async function autoCheckUpdate() {
  try {
    // 修正 chrome.storage.local.get 的使用方式
    const result = await new Promise((resolve) => {
      chrome.storage.local.get('lastCheckTime', resolve);
    });
    
    const lastCheckTime = result.lastCheckTime || 0;
    const now = Date.now();

    // 如果距离上次检查超过24小时，则进行检查
    if (now - lastCheckTime >= ONE_DAY) {
      await checkForUpdates();
      // 更新检查时间
      await new Promise((resolve) => {
        chrome.storage.local.set({ lastCheckTime: now }, resolve);
      });
    }
  } catch (error) {
    console.error("Error in autoCheckUpdate:", error);
  }
}

// 导出函数供popup使用
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkUpdate") {
    checkForUpdates().then(sendResponse);
    return true; // 保持消息通道开启
  }
  // 添加新的消息处理
  if (request.action === "openListCookies") {
    // 获取当前标签页
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        // 打开扩展的 popup
        chrome.browserAction.openPopup();
        // 触发 List Cookies 按钮点击
        chrome.runtime.sendMessage({ action: "triggerListCookies" });
      }
    });
  }
});

// 启动时检查一次
autoCheckUpdate();

// 监听浏览器启动
chrome.runtime.onStartup.addListener(() => {
  autoCheckUpdate();
});
