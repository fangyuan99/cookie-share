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

  async function sendCookies(cookieId, customUrl) {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      const url = new URL(currentTab.url);

      const cookies = await browser.cookies.getAll({ url: url.origin });
      const cookieData = cookies.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
        expirationDate: cookie.expirationDate,
      }));

      const response = await fetch(`${customUrl}/send-cookies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: cookieId,
          url: currentTab.url,
          cookies: cookieData,
        }),
      });

      const data = await response.json();
      if (data.success) {
        showMessage("Cookies sent successfully!");
      } else {
        showError(data.message || "Error sending cookies");
      }
    } catch (error) {
      showError("Error sending cookies: " + error.message);
    }
  }

  async function clearAllCookies(url) {
    const cookies = await browser.cookies.getAll({ url });
    await Promise.all(
      cookies.map((cookie) =>
        browser.cookies.remove({
          url,
          name: cookie.name,
        })
      )
    );
  }

  async function receiveCookies(cookieId, customUrl) {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      const url = new URL(currentTab.url);

      if (
        !confirm(
          "Do you want to clear all cookies on the current page? This will delete your login status."
        )
      ) {
        showMessage("Operation cancelled");
        return;
      }

      await clearAllCookies(url.origin);
      const response = await fetch(`${customUrl}/receive-cookies/${cookieId}`);
      const data = await response.json();

      if (data.success && data.cookies) {
        await Promise.all(
          data.cookies.map((cookie) =>
            browser.cookies.set({
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
            })
          )
        );

        showMessage("Cookies cleared and new cookies set successfully!");
        await browser.tabs.reload(currentTab.id);
      } else {
        showError(data.message || "Error receiving cookies");
      }
    } catch (error) {
      showError("Error receiving cookies: " + error.message);
    }
  }

  // 显示当前版本
  const manifest = browser.runtime.getManifest();
  currentVersionSpan.textContent = `v${manifest.version}`;

  // 检查更新函数
  async function checkForUpdates() {
    updateCheckSpan.textContent = "Checking...";
    try {
      const response = await browser.runtime.sendMessage({ action: "checkUpdate" });
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
    } catch (error) {
      updateCheckSpan.textContent = "Check for updates";
      showError("Failed to check for updates: " + error.message);
    }
  }

  // 添加更新检查点击事件
  updateCheckSpan.addEventListener("click", checkForUpdates);
}); 