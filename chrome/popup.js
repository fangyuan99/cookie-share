document.addEventListener("DOMContentLoaded", function () {
  const sendButton = document.getElementById("sendButton");
  const receiveButton = document.getElementById("receiveButton");
  const generateIdButton = document.getElementById("generateIdButton");
  const messageDiv = document.getElementById("message");
  const errorMessageDiv = document.getElementById("errorMessage");
  const cookieIdInput = document.getElementById("cookieId");
  const customUrlInput = document.getElementById("customUrl");
  const currentVersionSpan = document.getElementById("currentVersion");
  const updateCheckSpan = document.getElementById("updateCheck");
  const clearButton = document.getElementById("clearButton");

  sendButton.addEventListener("click", handleSendCookies);
  receiveButton.addEventListener("click", handleReceiveCookies);
  generateIdButton.addEventListener("click", handleGenerateId);
  clearButton.addEventListener("click", handleClearCookies);

  // 添加 URL 输入框的变化监听器
  customUrlInput.addEventListener("input", function () {
    const customUrl = customUrlInput.value.trim();
    if (customUrl) {
      chrome.storage.sync.set({ customUrl: customUrl });
    }
  });

  // Load the saved URL from storage
  chrome.storage.sync.get(["customUrl"], (result) => {
    if (result.customUrl) {
      customUrlInput.value = result.customUrl;
    }
  });

  function isValidId(id) {
    return /^[a-zA-Z0-9]+$/.test(id);
  }

  function generateRandomId() {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  function showMessage(message) {
    messageDiv.textContent = message;
    messageDiv.classList.remove("hidden");
    errorMessageDiv.classList.add("hidden");
    setTimeout(() => {
      messageDiv.classList.add("opacity-0");
      setTimeout(() => {
        messageDiv.classList.add("hidden");
        messageDiv.classList.remove("opacity-0");
      }, 300);
    }, 3000);
  }

  function showError(message) {
    errorMessageDiv.textContent = message;
    errorMessageDiv.classList.remove("hidden");
    messageDiv.classList.add("hidden");
    setTimeout(() => {
      errorMessageDiv.classList.add("opacity-0");
      setTimeout(() => {
        errorMessageDiv.classList.add("hidden");
        errorMessageDiv.classList.remove("opacity-0");
      }, 300);
    }, 3000);
  }

  function handleSendCookies() {
    const cookieId = cookieIdInput.value.trim();
    const customUrl = customUrlInput.value.trim();
    if (!cookieId) {
      showError("Please enter a cookie ID");
      return;
    }
    if (!isValidId(cookieId)) {
      showError("Invalid ID. Only letters and numbers are allowed.");
      return;
    }
    if (!customUrl) {
      showError("Please enter a custom URL");
      return;
    }
    sendCookies(cookieId, customUrl);
  }

  function handleReceiveCookies() {
    const cookieId = cookieIdInput.value.trim();
    const customUrl = customUrlInput.value.trim();
    if (!cookieId) {
      showError("Please enter a cookie ID");
      return;
    }
    if (!isValidId(cookieId)) {
      showError("Invalid ID. Only letters and numbers are allowed.");
      return;
    }
    if (!customUrl) {
      showError("Please enter a custom URL");
      return;
    }
    receiveCookies(cookieId, customUrl);
  }

  function handleGenerateId() {
    const randomId = generateRandomId();
    cookieIdInput.value = randomId;
    showMessage("Random ID generated: " + randomId);
  }

  function handleClearCookies() {
    if (confirm("Are you sure you want to clear all cookies for this site?")) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.runtime.sendMessage({
          action: "clearAllCookies"
        }, response => {
          if (response.success) {
            showMessage(response.message);
          } else {
            showError(response.message || "Error clearing cookies");
          }
        });
      });
    }
  }

  function sendCookies(cookieId, customUrl) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.runtime.sendMessage({
        action: "sendCookies",
        cookieId,
        customUrl
      }, response => {
        if (response.success) {
          showMessage("Cookies sent successfully!");
        } else {
          showError(response.message || "Error sending cookies");
        }
      });
    });
  }

  function receiveCookies(cookieId, customUrl) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.runtime.sendMessage({
        action: "receiveCookies",
        cookieId,
        customUrl
      }, response => {
        if (response.success) {
          showMessage("Cookies received and set successfully!");
        } else {
          showError(response.message || "Error receiving cookies");
        }
      });
    });
  }

  // 显示当前版本
  const manifest = chrome.runtime.getManifest();
  currentVersionSpan.textContent = `v${manifest.version}`;

  // 检查更新函数
  function checkForUpdates() {
    updateCheckSpan.textContent = "Checking...";
    chrome.runtime.sendMessage({ action: "checkUpdate" }, (response) => {
      if (response.error) {
        updateCheckSpan.textContent = "Check for updates";
        showError("Failed to check for updates: " + response.error);
        return;
      }

      if (response.hasUpdate) {
        updateCheckSpan.classList.add("update-available");
        updateCheckSpan.textContent = `Update available: v${response.latestVersion}`;
        updateCheckSpan.onclick = () => {
          chrome.tabs.create({ url: response.releaseUrl });
        };
        showMessage(`New version ${response.latestVersion} is available!`);
      } else {
        updateCheckSpan.textContent = "Check for updates";
        showMessage("You have the latest version!");
      }
    });
  }

  // 添加更新检查点击事件
  updateCheckSpan.addEventListener("click", checkForUpdates);

  // Admin按钮点击事件
  document.getElementById("adminLink").addEventListener("click", () => {
    const customUrl = customUrlInput.value.trim();
    if (!customUrl) {
      showError("Please enter a custom URL");
      return;
    }
    chrome.tabs.create({ url: `${customUrl}/admin` });
  });

  // 在 DOMContentLoaded 事件监听器中添加
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "setCookieId") {
      // 设置 cookie ID 并触发接收
      const cookieId = request.cookieId;
      const customUrl = customUrlInput.value.trim();
      if (customUrl) {
        cookieIdInput.value = cookieId;
        receiveCookies(cookieId, customUrl);
      }
    }
  });

  // 添加设置区域
  const settingsDiv = document.createElement('div');
  settingsDiv.className = 'settings-section';
  settingsDiv.innerHTML = `
    <div class="settings-header">Settings</div>
    <div class="settings-item">
      <label class="switch">
        <input type="checkbox" id="showFloatButton">
        <span class="slider round"></span>
      </label>
      <span>Show Float Button</span>
    </div>
    <div class="settings-item">
      <label class="switch">
        <input type="checkbox" id="autoHideFullscreen">
        <span class="slider round"></span>
      </label>
      <span>Auto Hide in Fullscreen</span>
    </div>
  `;
  document.querySelector('.container').appendChild(settingsDiv);

  // 加载设置
  chrome.runtime.sendMessage({ action: "getSettings" }, function(settings) {
    if (settings) {
      document.getElementById('showFloatButton').checked = settings.showFloatButton;
      document.getElementById('autoHideFullscreen').checked = settings.autoHideFullscreen;
    }
  });

  // 添加设置变更监听器
  document.getElementById('showFloatButton').addEventListener('change', function(e) {
    chrome.storage.sync.set({ showFloatButton: e.target.checked });
  });

  document.getElementById('autoHideFullscreen').addEventListener('change', function(e) {
    chrome.storage.sync.set({ autoHideFullscreen: e.target.checked });
  });
});
