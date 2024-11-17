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

      clearAllCookies(url.origin)
        .then(() => {
          return fetch(`${customUrl}/receive-cookies/${cookieId}`);
        })
        .then((response) => response.json())
        .then((data) => {
          if (data.success && data.cookies) {
            const promises = data.cookies.map((cookie) => {
              return new Promise((resolve) => {
                chrome.cookies.set(
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
                      Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
                  },
                  (result) => {
                    if (chrome.runtime.lastError) {
                      console.error(
                        "Error setting cookie:",
                        chrome.runtime.lastError
                      );
                    }
                    resolve();
                  }
                );
              });
            });

            Promise.all(promises).then(() => {
              showMessage("Cookies cleared and new cookies set successfully!");
              chrome.tabs.reload(currentTab.id);
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
    const modal = document.getElementById("confirmModal");
    const confirmMessage = document.getElementById("confirmMessage");
    const yesBtn = document.getElementById("confirmYes");
    const noBtn = document.getElementById("confirmNo");

    confirmMessage.textContent = message;
    modal.classList.add("show");

    yesBtn.onclick = () => {
      modal.classList.remove("show");
      callback(true);
    };

    noBtn.onclick = () => {
      modal.classList.remove("show");
      callback(false);
    };
  }

  // Admin按钮点击事件
  document.getElementById("adminLink").addEventListener("click", () => {
    const customUrl = customUrlInput.value.trim();
    if (!customUrl) {
      showError("Please enter a custom URL");
      return;
    }
    chrome.tabs.create({ url: `${customUrl}/admin` });
  });

  // List Cookies按钮点击事件
  const listCookiesBtn = document.getElementById('listCookiesBtn');
  if (listCookiesBtn) {
    listCookiesBtn.addEventListener('click', async () => {
      const modal = document.getElementById('listCookiesModal');
      showLoadingState();
      
      try {
        // 显示modal
        modal.classList.remove('hidden');
        modal.classList.add('show');

        // 检查是否有保存的密码
        const result = await new Promise((resolve) => {
          chrome.storage.local.get('adminPassword', resolve);
        });
        
        if (!result.adminPassword) {
          showPasswordInput();
        } else {
          await fetchCurrentSiteCookies(result.adminPassword);
        }
      } catch (error) {
        console.error('Error in list cookies click handler:', error);
        showError('Failed to handle list cookies: ' + error.message);
      }
    });
  }

  // 添加关闭按钮事件监听器
  document.querySelector('#listCookiesModal .close').addEventListener('click', () => {
    const modal = document.getElementById('listCookiesModal');
    modal.classList.remove('show');
    modal.classList.add('hidden');
  });

  // 显示/隐藏状态控制函数
  function showLoadingState() {
    document.getElementById("loadingState").classList.remove("hidden");
    document.getElementById("emptyState").classList.add("hidden");
    document.getElementById("cookiesList").innerHTML = "";
  }

  function showPasswordInput() {
    document
      .getElementById("adminPasswordContainer")
      .classList.remove("hidden");
    document.getElementById("loadingState").classList.add("hidden");
  }

  function showEmptyState(host) {
    document.getElementById("currentHostDisplay").textContent = host;
    document.getElementById("emptyState").classList.remove("hidden");
    document.getElementById("loadingState").classList.add("hidden");
  }

  // 渲染 cookies 列表
  function renderCookies(cookies) {
    const cookiesList = document.getElementById("cookiesList");
    const templateItem = cookiesList.querySelector(
      ".cookie-item[data-template]"
    );

    if (!templateItem) {
      console.error("Template element not found");
      return;
    }

    document.getElementById("loadingState").classList.add("hidden");

    // 清空列表，但保留模板
    const template = templateItem.cloneNode(true);
    cookiesList.innerHTML = "";
    cookiesList.appendChild(template); // 重新添加模板

    cookies.forEach((cookie) => {
      const cookieItem = template.cloneNode(true);
      cookieItem.classList.remove("hidden");
      cookieItem.removeAttribute("data-template");

      const idElement = cookieItem.querySelector(".cookie-id");
      const receiveButton = cookieItem.querySelector(".receive-cookie");
      const deleteButton = cookieItem.querySelector(".delete-cookie");

      if (idElement) idElement.textContent = `ID: ${cookie.id}`;
      if (receiveButton) receiveButton.dataset.id = cookie.id;
      if (deleteButton) deleteButton.dataset.id = cookie.id;

      cookiesList.appendChild(cookieItem);
    });

    attachCookieButtonListeners();
  }

  // 获取当前站点 cookies 的函数
  async function fetchCurrentSiteCookies(password) {
    const customUrl = document.getElementById('customUrl').value.trim();
    if (!customUrl) {
      showError("Please enter a custom URL");
      return;
    }

    try {
      const [currentTab] = await new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, resolve);
      });

      if (!currentTab) {
        throw new Error('No active tab found');
      }

      const currentHost = new URL(currentTab.url).hostname;
      console.log('Fetching cookies for host:', currentHost); // 调试日志

      const response = await fetch(
        `${customUrl}/admin/list-cookies-by-host/${encodeURIComponent(currentHost)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Password': password
          }
        }
      );

      const data = await response.json();
      console.log('Response data:', data); // 调试日志

      // 移除加载状态
      document.getElementById('loadingState').classList.add('hidden');

      if (data.success) {
        if (data.cookies.length === 0) {
          showEmptyState(currentHost);
        } else {
          const cookiesList = document.getElementById('cookiesList');
          cookiesList.innerHTML = ''; // 清空现有内容

          data.cookies.forEach(cookie => {
            // 创建新的 cookie 项元素
            const cookieItem = document.createElement('div');
            cookieItem.className = 'flex items-center p-3 bg-surface-hover rounded-lg hover:shadow-win11 transition-shadow';
            cookieItem.innerHTML = `
              <div class="flex items-center space-x-4">
                <span class="text-sm flex-grow">ID: ${cookie.id}</span>
                <button class="win11-button-small receive-cookie bg-primary text-white" data-id="${cookie.id}">Receive</button>
                <button class="win11-button-small delete-cookie bg-red-500 text-white" data-id="${cookie.id}">Delete</button>
              </div>
            `;
            cookiesList.appendChild(cookieItem);
          });

          attachCookieButtonListeners();
        }
      } else {
        if (response.status === 401) {
          showPasswordInput();
          showError('Invalid password. Please enter the correct password.');
        } else {
          showError('Failed to get cookies: ' + (data.message || 'Unknown error'));
        }
      }
    } catch (error) {
      // 确保在出错时也移除加载状态
      document.getElementById('loadingState').classList.add('hidden');
      console.error('Error:', error);
      showError('Request failed: ' + error.message);
    }
  }

  // 获取Cookies列表
  document
    .getElementById("fetchCookiesBtn")
    .addEventListener("click", async () => {
      const customUrl = customUrlInput.value.trim();
      if (!customUrl) {
        showError("Please enter a custom URL");
        return;
      }

      const password = document.getElementById("adminPassword").value;
      const fetchButton = document.getElementById("fetchCookiesBtn");
      const cookiesList = document.getElementById("cookiesList");
      const searchInput = document.getElementById("searchInput");

      try {
        // 设置按钮加载状态
        fetchButton.textContent = "Loading...";
        fetchButton.disabled = true;

        cookiesList.innerHTML = "";
        searchInput.value = "";

        const response = await fetch(`${customUrl}/admin/list-cookies`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Password": password,
          },
        });

        const data = await response.json();

        if (data.success) {
          cookiesData = data.cookies;
          renderCookiesList(cookiesData);
          showMessage("Cookies loaded successfully");
        } else {
          showError(
            "Failed to get cookies: " + (data.message || "Unknown error")
          );
        }
      } catch (error) {
        console.error("Error:", error);
        showError("Request failed: " + error.message);
      } finally {
        // 恢复按钮状态
        fetchButton.textContent = "Get Cookies";
        fetchButton.disabled = false;
      }
    });

  // 搜索功能
  document.getElementById("searchInput").addEventListener("input", (e) => {
    const searchTerm = e.target.value.toLowerCase();
    let filteredCookies;

    if (searchTerm) {
      // 如果有搜索词，则搜索所有 cookies
      filteredCookies = cookiesData.filter(
        (cookie) =>
          cookie.id.toLowerCase().includes(searchTerm) ||
          cookie.url.toLowerCase().includes(searchTerm)
      );
    } else {
      // 如果没有搜索词，显示所有 cookies（保持分组显示）
      filteredCookies = cookiesData;
    }

    renderCookiesList(filteredCookies);
  });

  // 存储cookies数据的全局变量
  let cookiesData = [];

  // 获取URL的主机名
  function getHostFromUrl(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return url;
    }
  }

  // 添加按钮事件监听器
  function attachCookieButtonListeners() {
    // Receive按钮事件
    document.querySelectorAll(".receive-cookie").forEach((button) => {
      button.addEventListener("click", (e) => {
        const cookieId = e.target.dataset.id;
        const customUrl = document.getElementById("customUrl").value.trim();
        if (customUrl) {
          document.getElementById("cookieId").value = cookieId;
          document.getElementById("listCookiesModal").classList.remove("show");
          document.getElementById("listCookiesModal").classList.add("hidden");
          receiveCookies(cookieId, customUrl);
        }
      });
    });

    // Delete按钮事件
    document.querySelectorAll(".delete-cookie").forEach((button) => {
      button.addEventListener("click", async (e) => {
        const cookieId = e.target.dataset.id;
        const customUrl = document.getElementById("customUrl").value.trim();
        const password = document.getElementById("adminPassword").value;

        if (confirm("Are you sure you want to delete this cookie?")) {
          try {
            const response = await fetch(
              `${customUrl}/admin/delete?key=${encodeURIComponent(cookieId)}`,
              {
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                  "X-Admin-Password": password,
                },
              }
            );

            const data = await response.json();
            if (data.success) {
              showMessage("Cookie deleted successfully");
              // 重新获取当前域名的 cookies
              await fetchCurrentSiteCookies(password);
            } else {
              showError(data.message || "Failed to delete cookie");
            }
          } catch (error) {
            showError("Error deleting cookie: " + error.message);
          }
        }
      });
    });
  }

  // 修改确认弹窗中的按钮文本
  document.getElementById("confirmModal").innerHTML = `
    <div class="modal-content">
      <p id="confirmMessage"></p>
      <button id="confirmYes">Confirm</button>
      <button id="confirmNo">Cancel</button>
    </div>
  `;
});
