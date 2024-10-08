document.addEventListener("DOMContentLoaded", function () {
  const sendButton = document.getElementById("sendButton");
  const receiveButton = document.getElementById("receiveButton");
  const generateIdButton = document.getElementById("generateIdButton");
  const saveUrlButton = document.getElementById("saveUrlButton");
  const messageDiv = document.getElementById("message");
  const errorMessageDiv = document.getElementById("errorMessage");
  const cookieIdInput = document.getElementById("cookieId");
  const customUrlInput = document.getElementById("customUrl");

  sendButton.addEventListener("click", handleSendCookies);
  receiveButton.addEventListener("click", handleReceiveCookies);
  generateIdButton.addEventListener("click", handleGenerateId);
  saveUrlButton.addEventListener("click", handleSaveUrl);

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

  function handleSaveUrl() {
    const customUrl = customUrlInput.value.trim();
    if (!customUrl) {
      showError("Please enter a URL");
      return;
    }
    chrome.storage.sync.set({ customUrl: customUrl }, () => {
      showMessage("Custom URL saved!");
    });
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

  function receiveCookies(cookieId, customUrl) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const currentTab = tabs[0];
      const url = new URL(currentTab.url);

      fetch(`${customUrl}/receive-cookies/${cookieId}`)
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
                      Math.floor(Date.now() / 1000) + 3600,
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
              showMessage("Cookies received and set successfully!");
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
});
