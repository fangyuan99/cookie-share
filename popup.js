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

  sendButton.addEventListener("click", handleSendCookies);
  receiveButton.addEventListener("click", handleReceiveCookies);
  generateIdButton.addEventListener("click", handleGenerateId);
  
  // 添加 URL 输入框的变化监听器
  customUrlInput.addEventListener("input", function() {
    const customUrl = customUrlInput.value.trim();
    if (customUrl) {
      browser.storage.sync.set({ customUrl: customUrl });
    }
  });

  // Load the saved URL from storage
  browser.storage.sync.get(["customUrl"]).then((result) => {
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
    errorMessageDiv.textContent = ""; // Clear any error messages
  }

  function showError(message) {
    errorMessageDiv.textContent = message;
    messageDiv.textContent = ""; // Clear any success messages
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

  function sendCookies(cookieId, customUrl) {
    browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const currentTab = tabs[0];
      const url = new URL(currentTab.url);

      browser.cookies.getAll({ url: url.origin }, function (cookies) {
        const cookieData = cookies.map(function (cookie) {
          return {
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            httpOnly: cookie.httpOnly,
            secure: cookie.secure,
            sameSite: cookie.sameSite,
          };
        });

        fetch(`${customUrl}/send-cookies`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: cookieId,
            url: currentTab.url,
            cookies: cookieData,
          }),
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.success) {
              showMessage("Cookies sent successfully!");
            } else {
              showError(data.message || "Error sending cookies");
            }
          })
          .catch((error) => {
            showError("Error sending cookies: " + error.message);
          });
      });
    });
  }

  function clearAllCookies(url) {
    return new Promise((resolve) => {
      browser.cookies.getAll({ url: url }, function(cookies) {
        const clearPromises = cookies.map(cookie => {
          return new Promise((resolveDelete) => {
            browser.cookies.remove({
              url: url,
              name: cookie.name,
            }, () => resolveDelete());
          });
        });
        Promise.all(clearPromises).then(resolve);
      });
    });
  }

  function receiveCookies(cookieId, customUrl) {
    browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const currentTab = tabs[0];
      const url = new URL(currentTab.url);

      if (!confirm("Do you want to clear all cookies on the current page? This will delete your login status.")) {
        showMessage("Operation cancelled");
        return;
      }

      clearAllCookies(url.origin)
        .then(() => {
          return fetch(`${customUrl}/receive-cookies/${cookieId}`);
        })
        .then((response) => response.json())
        .then((data) => {
          if (data.success && data.cookies) {
            const promises = data.cookies.map((cookie) => {
              return new Promise((resolve) => {
                browser.cookies.set(
                  {
                    url: url.origin,
                    name: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain || url.hostname,
                    path: cookie.path || "/",
                    secure: cookie.secure || false,
                    httpOnly: cookie.httpOnly || false,
                    sameSite: cookie.sameSite || "lax",
                    expirationDate:
                      cookie.expirationDate ||
                      Math.floor(Date.now() / 1000) + 3600,
                  },
                  (result) => {
                    if (browser.runtime.lastError) {
                      console.error(
                        "Error setting cookie:",
                        browser.runtime.lastError
                      );
                    }
                    resolve();
                  }
                );
              });
            });

            Promise.all(promises).then(() => {
              showMessage("Cookies cleared and new cookies set successfully!");
              browser.tabs.reload(currentTab.id);
            });
          } else {
            showError(data.message || "Error receiving cookies");
          }
        })
        .catch((error) => {
          showError("Error receiving cookies: " + error.message);
        });
    });
  }

  // 显示当前版本
  const manifest = browser.runtime.getManifest();
  currentVersionSpan.textContent = `v${manifest.version}`;

  // 检查更新函数
  function checkForUpdates() {
    updateCheckSpan.textContent = "Checking...";
    browser.runtime.sendMessage({ action: "checkUpdate" }, (response) => {
      if (response.error) {
        updateCheckSpan.textContent = "Check for updates";
        showError("Failed to check for updates: " + response.error);
        return;
      }

      if (response.hasUpdate) {
        updateCheckSpan.classList.add("update-available");
        updateCheckSpan.textContent = `Update available: v${response.latestVersion}`;
        updateCheckSpan.onclick = () => {
          browser.tabs.create({ url: response.releaseUrl });
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

  // 初始检查更新
  checkForUpdates();
});
