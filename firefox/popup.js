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
    messageDiv.classList.remove('hidden');
    errorMessageDiv.classList.add('hidden');
    setTimeout(() => {
      messageDiv.classList.add('opacity-0');
      setTimeout(() => {
        messageDiv.classList.add('hidden');
        messageDiv.classList.remove('opacity-0');
      }, 300);
    }, 3000);
  }

  function showError(message) {
    errorMessageDiv.textContent = message;
    errorMessageDiv.classList.remove('hidden');
    messageDiv.classList.add('hidden');
    setTimeout(() => {
      errorMessageDiv.classList.add('opacity-0');
      setTimeout(() => {
        errorMessageDiv.classList.add('hidden');
        errorMessageDiv.classList.remove('opacity-0');
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

  function sendCookies(cookieId, customUrl) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const currentTab = tabs[0];
      const url = new URL(currentTab.url);

      chrome.cookies.getAll({ url: url.origin }, function (cookies) {
        const cookieData = cookies.map(function (cookie) {
          return {
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            httpOnly: cookie.httpOnly,
            secure: cookie.secure,
            sameSite: cookie.sameSite,
            expirationDate: cookie.expirationDate,
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
      chrome.cookies.getAll({ url: url }, function (cookies) {
        const clearPromises = cookies.map((cookie) => {
          return new Promise((resolveDelete) => {
            chrome.cookies.remove(
              {
                url: url,
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

  function receiveCookies(cookieId, customUrl) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const currentTab = tabs[0];
      const url = new URL(currentTab.url);

      showCustomConfirm(
        "Do you want to clear all cookies on the current page? This will delete your login status.",
        (result) => {
          if (!result) {
            showMessage("Operation cancelled");
            return;
          }
          
          clearAllCookies(url.origin)
            .then(() => {
              fetch(`${customUrl}/receive-cookies/${cookieId}`)
                .then((response) => response.json())
                .then((data) => {
                  if (data.success && data.cookies) {
                    const promises = data.cookies.map((cookie) => {
                      return new Promise((resolve) => {
                        // 处理 sameSite 值，确保符合 Firefox 的要求
                        let sameSite;
                        if (!cookie.sameSite || cookie.sameSite.toLowerCase() === "unspecified") {
                          sameSite = "lax"; // Firefox 默认值
                        } else {
                          // Firefox 只接受这三个值
                          sameSite = cookie.sameSite.toLowerCase();
                          if (!["strict", "lax", "no_restriction"].includes(sameSite)) {
                            sameSite = "lax";
                          }
                        }

                        const cookieDetails = {
                          url: url.origin,
                          name: cookie.name,
                          value: cookie.value,
                          domain: cookie.domain || url.hostname,
                          path: cookie.path || "/",
                          secure: cookie.secure || false,
                          httpOnly: cookie.httpOnly || false,
                          sameSite: sameSite,
                          expirationDate: cookie.expirationDate || Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
                        };

                        chrome.cookies.set(cookieDetails, (result) => {
                          if (chrome.runtime.lastError) {
                            console.error("Error setting cookie:", chrome.runtime.lastError);
                          }
                          resolve();
                        });
                      });
                    });

                    Promise.all(promises).then(() => {
                      showMessage("Cookies cleared and new cookies set successfully!");
                      chrome.tabs.reload(currentTab.id);
                    });
                  } else {
                    showError("Failed to get cookies: " + (data.message || "Unknown error"));
                  }
                })
                .catch((error) => {
                  console.error("Error:", error);
                  showError("Request failed: " + error.message);
                });
            });
        }
      );
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

  // 自定义确认弹窗函数
  function showCustomConfirm(message, callback) {
    const modal = document.getElementById('confirmModal');
    const confirmMessage = document.getElementById('confirmMessage');
    const yesBtn = document.getElementById('confirmYes');
    const noBtn = document.getElementById('confirmNo');

    confirmMessage.textContent = message;
    modal.classList.add('show');

    yesBtn.onclick = () => {
      modal.classList.remove('show');
      callback(true);
    };

    noBtn.onclick = () => {
      modal.classList.remove('show');
      callback(false);
    };
  }

  // Admin按钮点击事件
  document.getElementById('adminLink').addEventListener('click', () => {
    const customUrl = customUrlInput.value.trim();
    if (!customUrl) {
      showError("Please enter a custom URL");
      return;
    }
    chrome.tabs.create({ url: `${customUrl}/admin` });
  });

  // List Cookies按钮点击事件
  document.getElementById('listCookiesBtn').addEventListener('click', () => {
    const modal = document.getElementById('listCookiesModal');
    modal.classList.add('show');
  });

  // 关闭按钮事件
  document.querySelector('.close').addEventListener('click', () => {
    document.getElementById('listCookiesModal').classList.remove('show');
  });

  // 保存admin密码
  document.getElementById('adminPassword').addEventListener('input', (e) => {
    chrome.storage.local.set({ adminPassword: e.target.value });
  });

  // 加载保存的admin密码
  chrome.storage.local.get(['adminPassword'], (result) => {
    if (result.adminPassword) {
      document.getElementById('adminPassword').value = result.adminPassword;
    }
  });

  // 获取Cookies列表
  document.getElementById('fetchCookiesBtn').addEventListener('click', async () => {
    const customUrl = customUrlInput.value.trim();
    if (!customUrl) {
      showError("Please enter a custom URL");
      return;
    }

    const password = document.getElementById('adminPassword').value;
    const fetchButton = document.getElementById('fetchCookiesBtn');
    const cookiesList = document.getElementById('cookiesList');
    const searchInput = document.getElementById('searchInput');
    
    try {
      // 设置按钮加载状态
      fetchButton.textContent = 'Loading...';
      fetchButton.style.opacity = '0.7';
      fetchButton.disabled = true;
      
      cookiesList.innerHTML = '';
      searchInput.value = '';
      
      const response = await fetch(`${customUrl}/admin/list-cookies`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        cookiesData = data.cookies;
        renderCookiesList(cookiesData);
        showMessage("Cookies loaded successfully");
      } else {
        showError('Failed to get cookies: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error:', error);
      showError('Request failed: ' + error.message);
    } finally {
      // 恢复按钮状态
      fetchButton.textContent = 'Get Cookies';
      fetchButton.style.opacity = '1';
      fetchButton.disabled = false;
    }
  });

  // 搜索功能
  document.getElementById('searchInput').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredCookies = cookiesData.filter(cookie => 
      cookie.id.toLowerCase().includes(searchTerm) || 
      cookie.url.toLowerCase().includes(searchTerm)
    );
    
    renderCookiesList(filteredCookies);
  });

  // 渲染cookies列表
  function renderCookiesList(cookies) {
    const cookiesList = document.getElementById('cookiesList');
    cookiesList.innerHTML = cookies.map(cookie => `
      <div class="bg-surface-hover rounded-lg hover:shadow-win11 transition-shadow">
        <p class="text-sm"><span class="font-medium text-secondary">ID:</span> ${cookie.id}</p>
        <p class="text-sm"><span class="font-medium text-secondary">URL:</span> ${cookie.url}</p>
      </div>
    `).join('');
  }

  // 修改确认弹窗中的按钮文本
  document.getElementById('confirmModal').innerHTML = `
    <div class="modal-content">
      <p id="confirmMessage"></p>
      <button id="confirmYes">Confirm</button>
      <button id="confirmNo">Cancel</button>
    </div>
  `;
});
