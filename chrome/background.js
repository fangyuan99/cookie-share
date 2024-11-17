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

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkUpdate") {
    checkForUpdates().then(sendResponse);
    return true;
  }
  
  if (request.action === "receiveCookies") {
    // 获取当前标签页
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        const currentTab = tabs[0];
        // 将 cookieId 设置到 popup 的输入框中
        chrome.runtime.sendMessage({ 
          action: "setCookieId", 
          cookieId: request.cookieId 
        });
        // 打开 popup
        chrome.browserAction.openPopup();
      }
    });
  }
  
  if (request.action === "contentReceiveCookies") {
    handleContentReceiveCookies(request, sendResponse);
    return true; // 保持消息通道开放
  }
});

// 添加处理 content script cookies 请求的函数
async function handleContentReceiveCookies(request, sendResponse) {
  try {
    const { cookieId, customUrl, url } = request;
    
    // 清除现有的 cookies
    await clearAllCookies(url);

    // 获取新的 cookies
    const response = await fetch(`${customUrl}/receive-cookies/${cookieId}`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to receive cookies");
    }

    // 设置新的 cookies
    const promises = data.cookies.map(cookie => {
      return new Promise((resolve) => {
        chrome.cookies.set({
          url: url,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain || new URL(url).hostname,
          path: cookie.path || "/",
          secure: cookie.secure || false,
          httpOnly: cookie.httpOnly || false,
          sameSite: cookie.sameSite || "lax",
          expirationDate: cookie.expirationDate || Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
        }, (result) => {
          if (chrome.runtime.lastError) {
            console.error("Error setting cookie:", chrome.runtime.lastError);
          }
          resolve();
        });
      });
    });

    await Promise.all(promises);
    sendResponse({ success: true });
  } catch (error) {
    console.error("Error in handleContentReceiveCookies:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// 添加 clearAllCookies 辅助函数
function clearAllCookies(url) {
  return new Promise((resolve) => {
    chrome.cookies.getAll({ url }, (cookies) => {
      const clearPromises = cookies.map((cookie) => {
        return new Promise((resolveDelete) => {
          chrome.cookies.remove(
            {
              url,
              name: cookie.name,
            },
            () => resolveDelete()
          );
        });
      });
      Promise.all(clearPromises).then(resolve);
    });
  });
}

// 启动时检查一次
autoCheckUpdate();

// 监听浏览器启动
chrome.runtime.onStartup.addListener(() => {
  autoCheckUpdate();
});
