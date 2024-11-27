const GITHUB_REPO = "fangyuan99/cookie-share";
const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours

// 检查更新函数
async function checkForUpdates() {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
    );
    const data = await response.json();

    const currentVersion = browser.runtime.getManifest().version;
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
      currentVersion: browser.runtime.getManifest().version,
      error: error.message,
    };
  }
}

// 自动检查更新（每天一次）
async function autoCheckUpdate() {
  try {
    // 修正 browser.storage.local.get 的使用方式
    const result = await new Promise((resolve) => {
      browser.storage.local.get('lastCheckTime', resolve);
    });
    
    const lastCheckTime = result.lastCheckTime || 0;
    const now = Date.now();

    // 果距离上次检查超过24小时，则进行检查
    if (now - lastCheckTime >= ONE_DAY) {
      await checkForUpdates();
      // 更新检查时间
      await new Promise((resolve) => {
        browser.storage.local.set({ lastCheckTime: now }, resolve);
      });
    }
  } catch (error) {
    console.error("Error in autoCheckUpdate:", error);
  }
}

// 添加存储默认设置的函数
async function initializeSettings() {
  const result = await new Promise(resolve => {
    browser.storage.sync.get({
      showFloatButton: true, // 默认显示浮动按钮
      autoHideFullscreen: true // 默认全屏自动隐藏
    }, resolve);
  });
  return result;
}

// 在启动时初始化设置
initializeSettings();

// 集中处理所有 cookie 相关的操作
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkUpdate") {
    checkForUpdates().then(sendResponse);
    return true;
  }

  // 处理发送 cookies
  if (request.action === "sendCookies") {
    // 从 popup 发来的消息需要先获取当前标签页
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        handleSendCookies(request.cookieId, request.customUrl, tabs[0], sendResponse);
      } else {
        sendResponse({ success: false, message: "No active tab found" });
      }
    });
    return true;
  }

  // 处理接收 cookies
  if (request.action === "receiveCookies") {
    // 从 popup 发来的消息需要先获取当前标签页
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        handleReceiveCookies(request.cookieId, request.customUrl, tabs[0], sendResponse);
      } else {
        sendResponse({ success: false, message: "No active tab found" });
      }
    });
    return true;
  }

  // 处理来自 content 的接收 cookies
  if (request.action === "contentReceiveCookies") {
    handleReceiveCookies(request.cookieId, request.customUrl, sender.tab, sendResponse);
    return true;
  }

  if (request.action === "getSettings") {
    initializeSettings().then(sendResponse);
    return true;
  }

  // 处理清除cookies
  if (request.action === "clearAllCookies") {
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        handleClearCookies(tabs[0], sendResponse);
      } else {
        sendResponse({ success: false, message: "No active tab found" });
      }
    });
    return true;
  }
});

// 处理发送 cookies
async function handleSendCookies(cookieId, customUrl, tab, sendResponse) {
  try {
    const url = new URL(tab.url);
    // 获取所有相关域名的 cookies
    const cookies = await getAllCookies(url.hostname);
    
    // 直接使用获取到的 cookies，不需要去重
    const cookieData = cookies.map(cookie => ({
      domain: cookie.domain,
      expirationDate: cookie.expirationDate,
      hostOnly: cookie.hostOnly,
      httpOnly: cookie.httpOnly,
      name: cookie.name,
      path: cookie.path,
      sameSite: cookie.sameSite ? cookie.sameSite.toLowerCase() : null,
      secure: cookie.secure,
      session: cookie.session,
      storeId: cookie.storeId || null,
      value: cookie.value
    }));

    // 发送请求
    const response = await fetch(`${customUrl}/send-cookies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: cookieId,
        url: tab.url,
        cookies: cookieData,
      }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || "Failed to send cookies");
    }

    sendResponse({ success: true, message: "Cookies sent successfully" });
  } catch (error) {
    console.error("Error sending cookies:", error);
    sendResponse({ success: false, message: error.message });
  }
}

// 处理接收 cookies
async function handleReceiveCookies(cookieId, customUrl, tab, sendResponse) {
  try {
    const url = new URL(tab.url);
    
    // 获取当前所有 cookies
    const currentCookies = await getAllCookies(url.hostname);
    
    // 获取新的 cookies
    const response = await fetch(`${customUrl}/receive-cookies/${cookieId}`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to receive cookies");
    }

    // 先删除所有现有的 cookies
    await Promise.all(currentCookies.map(cookie => removeCookie(cookie)));

    // 设置新的 cookies
    const results = await Promise.all(data.cookies.map(async cookie => {
      try {
        return await setCookie(url.origin, cookie);
      } catch (error) {
        console.error("Error setting cookie:", error, cookie);
        return false;
      }
    }));

    // 检查设置结果
    const failedCount = results.filter(r => !r).length;
    if (failedCount > 0) {
      console.warn(`Failed to set ${failedCount} cookies`);
    }

    // 使用 browser.tabs.reload 的回调确保刷新完成
    browser.tabs.reload(tab.id, { bypassCache: true }, () => {
      sendResponse({ success: true });
    });
    
    return true; // 保持消息通道开放
  } catch (error) {
    console.error("Error receiving cookies:", error);
    sendResponse({ success: false, message: error.message });
  }
}

// 改进的 Cookie 操作辅助函数
function getAllCookies(hostname) {
  return new Promise((resolve) => {
    // 不传入 domain 参数，获取所有 cookies
    browser.cookies.getAll({}, (cookies) => {
      // 过滤相关域名的 cookies
      const filteredCookies = cookies.filter(cookie => {
        const cookieDomain = cookie.domain.startsWith('.') ? 
          cookie.domain.slice(1) : cookie.domain;
        return hostname.endsWith(cookieDomain);
      });

      // 按照 domain、path 和 name 排序，确保顺序一致
      const sortedCookies = filteredCookies.sort((a, b) => {
        // 先按域名排序
        if (a.domain !== b.domain) {
          return a.domain.localeCompare(b.domain);
        }
        // 域名相同则按路径排序
        if (a.path !== b.path) {
          return a.path.localeCompare(b.path);
        }
        // 路径相同则按名称排序
        return a.name.localeCompare(b.name);
      });

      resolve(sortedCookies);
    });
  });
}

function removeCookie(cookie) {
  return new Promise((resolve) => {
    const protocol = cookie.secure ? 'https:' : 'http:';
    const cookieUrl = `${protocol}//${cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain}${cookie.path}`;
    
    browser.cookies.remove({
      url: cookieUrl,
      name: cookie.name,
      storeId: cookie.storeId || null
    }, (details) => {
      if (browser.runtime.lastError) {
        console.error("Error removing cookie:", browser.runtime.lastError, cookie);
      }
      resolve(!!details);
    });
  });
}

function setCookie(url, cookie) {
  return new Promise((resolve) => {
    const cookieData = {
      url: `${cookie.secure ? "https:" : "http:"}//${
        cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain
      }${cookie.path || "/"}`,
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || "/",
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      storeId: cookie.storeId || null
    };

    // 处理过期时间
    const now = Math.floor(Date.now() / 1000);
    if (cookie.expirationDate && cookie.expirationDate > now) {
      cookieData.expirationDate = cookie.expirationDate;
    } else {
      cookieData.expirationDate = now + (30 * 24 * 60 * 60); // 30 天后过期
    }

    browser.cookies.set(cookieData, (result) => {
      if (browser.runtime.lastError) {
        console.error("Error setting cookie:", browser.runtime.lastError, cookieData);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

// 添加清除cookies的处理函数
async function handleClearCookies(tab, sendResponse) {
  try {
    const url = new URL(tab.url);
    // 获取所有相关域名的 cookies
    const cookies = await getAllCookies(url.hostname);
    
    // 删除所有cookies
    await Promise.all(cookies.map(cookie => removeCookie(cookie)));

    // 刷新页面
    browser.tabs.reload(tab.id, { bypassCache: true }, () => {
      sendResponse({ success: true, message: `Successfully cleared ${cookies.length} cookies` });
    });
    
    return true;
  } catch (error) {
    console.error("Error clearing cookies:", error);
    sendResponse({ success: false, message: error.message });
  }
}

// 启动时检查一次
autoCheckUpdate();

// 监听浏览器启动
browser.runtime.onStartup.addListener(() => {
  autoCheckUpdate();
});
