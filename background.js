const GITHUB_REPO = "fangyuan99/cookie-share";
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

// 检查更新函数
async function checkForUpdates() {
  try {
    const response = await fetch('https://api.github.com/repos/fangyuan99/cookie-share/releases/latest');
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

// 导出函数供popup使用
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkUpdate") {
    checkForUpdates().then(sendResponse);
    return true; // 保持消息通道开启
  }
});

// 启动时检查一次，然后每24小时检查一次
checkForUpdates();
setInterval(checkForUpdates, CHECK_INTERVAL);
