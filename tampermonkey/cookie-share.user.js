// ==UserScript==
// @name         Cookie Share
// @namespace    https://github.com/fangyuan99/cookie-share
// @version      0.0.1
// @description  Sends and receives cookies with your friends
// @author       fangyuan99,aBER
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_cookie
// @connect      *
// ==/UserScript==

(function () {
  "use strict";

  // ===================== Constants =====================
  const STORAGE_KEYS = {
    CUSTOM_URL: "cookie_share_custom_url",
    ADMIN_PASSWORD: "cookie_share_admin_password",
    SHOW_FLOATING_BUTTON: "cookie_share_show_floating_button",
    AUTO_HIDE_FULLSCREEN: "cookie_share_auto_hide_fullscreen",
  };

  // ===================== State Management =====================
  const state = {
    isFullscreen: false,
    floatingButton: null,
    sendModal: null,
    receiveModal: null,
    settingsModal: null,
  };
  // ===================== Fullscreen Handlers =====================
  const fullscreenManager = {
    handleFullscreenChange() {
      state.isFullscreen =
        document.fullscreenElement || document.webkitFullscreenElement;
      this.updateFloatingButtonVisibility();
    },

    updateFloatingButtonVisibility() {
      if (!state.floatingButton) return;

      const showFloatingButton = GM_getValue(
        STORAGE_KEYS.SHOW_FLOATING_BUTTON,
        true
      );
      const autoHideFullscreen = GM_getValue(
        STORAGE_KEYS.AUTO_HIDE_FULLSCREEN,
        true
      );

      const shouldHide = state.isFullscreen && autoHideFullscreen;
      state.floatingButton.style.display =
        !shouldHide && showFloatingButton ? "block" : "none";
    },
  };

  // ===================== Cookie Management =====================
  const cookieManager = {
    getAll() {
      return new Promise((resolve) => {
        GM_cookie.list({}, function (cookies) {
          resolve(
            cookies.map((cookie) => ({
              name: cookie.name,
              value: cookie.value,
              domain: cookie.domain,
              path: cookie.path || "/",
              secure: cookie.secure,
              sameSite: "Lax",
              hostOnly: cookie.hostOnly,
              httpOnly: cookie.httpOnly,
              session: cookie.session,
              expirationDate: cookie.expirationDate,
            }))
          );
        });
      });
    },

    set(cookie) {
      return new Promise((resolve) => {
        GM_cookie.set(
          {
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path || "/",
            secure: cookie.secure,
            httpOnly: cookie.httpOnly || false,
            expirationDate: cookie.expirationDate || undefined,
          },
          resolve
        );
      });
    },

    clearAll() {
      return new Promise((resolve) => {
        GM_cookie.list({}, function (cookies) {
          let deletedCount = 0;
          const totalCookies = cookies.length;

          if (totalCookies === 0) {
            resolve();
            return;
          }

          cookies.forEach((cookie) => {
            GM_cookie.delete(
              {
                name: cookie.name,
                domain: cookie.domain,
                path: cookie.path,
              },
              () => {
                deletedCount++;
                if (deletedCount === totalCookies) {
                  resolve();
                }
              }
            );
          });
        });
      });
    },
  };

  // ===================== Utility Functions =====================
  const utils = {
    validateUrl(url) {
      try {
        if (!/^https?:\/\//i.test(url)) {
          url = "https://" + url;
        }
        url = url.replace(/\/+$/, "");
        new URL(url);
        return url;
      } catch (e) {
        throw new Error("Invalid URL format");
      }
    },

    generateId(length = 10) {
      const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      return Array.from({ length }, () =>
        chars.charAt(Math.floor(Math.random() * chars.length))
      ).join("");
    },
  };

  // ===================== API Operations =====================
  const api = {
    async sendCookies(cookieId, customUrl) {
      try {
        const cookies = await cookieManager.getAll();
        if (!cookies.length) {
          return {
            success: false,
            message: "No cookies to send on the current page",
          };
        }

        const formattedUrl = utils.validateUrl(customUrl);
        const data = {
          id: cookieId,
          url: window.location.href,
          cookies: cookies,
        };

        return new Promise((resolve, reject) => {
          GM_xmlhttpRequest({
            method: "POST",
            url: `${formattedUrl}/send-cookies`,
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            data: JSON.stringify(data),
            responseType: "json",
            timeout: 10000,
            onload: (response) => {
              if (response.status >= 200 && response.status < 300) {
                resolve(response.response || { success: true });
              } else {
                reject(
                  new Error(
                    `Server returned error: ${response.status}\n${response.responseText}`
                  )
                );
              }
            },
            onerror: () => reject(new Error("Network request failed")),
            ontimeout: () => reject(new Error("Request timeout")),
          });
        });
      } catch (error) {
        console.error("Error sending cookies:", error);
        throw error;
      }
    },

    async receiveCookies(cookieId, customUrl) {
      try {
        const formattedUrl = utils.validateUrl(customUrl);
        const response = await new Promise((resolve, reject) => {
          GM_xmlhttpRequest({
            method: "GET",
            url: `${formattedUrl}/receive-cookies/${cookieId}`,
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            responseType: "json",
            timeout: 10000,
            onload: resolve,
            onerror: () => reject(new Error("Request failed")),
            ontimeout: () => reject(new Error("Request timeout")),
          });
        });

        if (
          !response?.response?.success ||
          !Array.isArray(response.response.cookies)
        ) {
          throw new Error("Invalid data format");
        }

        await cookieManager.clearAll();

        let importedCount = 0;
        for (const cookie of response.response.cookies) {
          if (cookie?.name && cookie?.value) {
            await cookieManager.set(cookie);
            importedCount++;
          }
        }

        if (importedCount === 0) {
          throw new Error("No cookies were successfully imported");
        }

        setTimeout(() => window.location.reload(), 500);
        return {
          success: true,
          message: `Successfully imported ${importedCount} cookies`,
        };
      } catch (error) {
        console.error("Error receiving cookies:", error);
        throw error;
      }
    },
  };

  // ===================== UI Components =====================
  const ui = {
    confirmDelete() {
      return new Promise((resolve) => {
        // 创建确认对话框容器
        const container = document.createElement("div");
        container.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(2px);
          z-index: 2147483647;
        `;

        // 创建对话框内容
        const dialog = document.createElement("div");
        dialog.style.cssText = `
          background: rgba(255, 255, 255, 0.95);
          padding: 24px;
          border-radius: 12px;
          text-align: center;
          min-width: 320px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
        `;

        dialog.innerHTML = `
          <h3 style="margin: 0 0 16px 0; color: #4A5567; font-size: 18px;">Confirm Delete</h3>
          <p style="margin: 0 0 24px 0; color: #666;">Are you sure you want to delete this cookie?</p>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button id="cancelBtn" style="
              padding: 8px 24px;
              border-radius: 6px;
              background: #91B3A7;
              color: white;
              border: none;
              cursor: pointer;
              min-width: 100px;
              transition: all 0.3s ease;
            ">Cancel</button>
            <button id="confirmBtn" style="
              padding: 8px 24px;
              border-radius: 6px;
              background: #FF6B6B;
              color: white;
              border: none;
              cursor: pointer;
              min-width: 100px;
              transition: all 0.3s ease;
            ">Delete</button>
          </div>
        `;

        container.appendChild(dialog);
        document.body.appendChild(container);

        // 添加按钮事件监听器
        const cancelBtn = dialog.querySelector("#cancelBtn");
        const confirmBtn = dialog.querySelector("#confirmBtn");

        // 添加按钮悬浮效果
        const buttons = dialog.querySelectorAll("button");
        buttons.forEach((btn) => {
          btn.addEventListener("mouseover", () => {
            btn.style.transform = "translateY(-1px)";
            if (btn.id === "cancelBtn") {
              btn.style.background = "#7A9B8F";
            } else {
              btn.style.background = "#FF5252";
            }
          });

          btn.addEventListener("mouseout", () => {
            btn.style.transform = "none";
            if (btn.id === "cancelBtn") {
              btn.style.background = "#91B3A7";
            } else {
              btn.style.background = "#FF6B6B";
            }
          });
        });

        // 绑定事件
        cancelBtn.onclick = () => {
          container.remove();
          resolve(false);
        };

        confirmBtn.onclick = () => {
          container.remove();
          resolve(true);
        };

        // 点击背景关闭
        container.onclick = (e) => {
          if (e.target === container) {
            container.remove();
            resolve(false);
          }
        };

        // 添加动画效果
        dialog.style.opacity = "0";
        dialog.style.transform = "scale(0.9)";
        dialog.style.transition = "all 0.2s ease";

        // 强制重绘
        dialog.offsetHeight;

        // 显示动画
        dialog.style.opacity = "1";
        dialog.style.transform = "scale(1)";
      });
    },

    injectStyles() {
      GM_addStyle(`
                    .cookie-share-overlay {
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        bottom: 0 !important;
                        background: rgba(0, 0, 0, 0.4) !important;
                        z-index: 2147483646 !important;
                        display: none !important;
                    }
    
                    .cookie-share-overlay.visible {
                        display: flex !important;
                        justify-content: center !important;
                        align-items: center !important;
                    }
    
                    .cookie-share-modal {
                        background: white !important;
                        border-radius: 12px !important;
                        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15) !important;
                        width: min(800px, 90vw) !important;
                        max-height: 90vh !important;
                        overflow: hidden !important;
                        position: relative !important;
                        display: none !important;
                        z-index: 2147483647 !important;
                        padding: 24px !important;
                    }
    
                    .cookie-share-modal.visible {
                        display: block !important;
                    }
    
                    .cookie-share-container {
                        font-family: -apple-system, system-ui, sans-serif !important;
                        padding: 32px !important;
                    }
    
                    .cookie-share-container .close-btn {
                        position: absolute !important;
                        right: 16px !important;
                        top: 16px !important;
                        width: 32px !important;
                        height: 32px !important;
                        background: none !important;
                        border: none !important;
                        font-size: 24px !important;
                        color: #666 !important;
                        cursor: pointer !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        padding: 0 !important;
                    }
    
                    .cookie-share-container h1 {
                        font-size: 32px !important;
                        font-weight: 600 !important;
                        text-align: center !important;
                        margin-bottom: 10px !important;
                        color: #333 !important;
                    }
    
                    .cookie-share-version {
                        text-align: center !important;
                        margin-bottom: 20px !important;
                        color: #666 !important;
                    }
    
                    .cookie-share-version a {
                        color: #0078d4 !important;
                        text-decoration: none !important;
                        margin: 0 10px !important;
                    }
    
                    .cookie-share-container input {
                        width: 100% !important;
                        height: 48px !important;
                        padding: 0 16px !important;
                        border: 1px solid #ddd !important;
                        border-radius: 8px !important;
                        font-size: 16px !important;
                        margin-bottom: 16px !important;
                    }
    
                    .cookie-share-container .id-input-container {
                        display: flex !important;
                        padding: 0 0 16px 0 !important;
                        gap: 16px !important;
                        align-items: center !important;
                    }
    
                    .cookie-share-container .id-input-container input {
                        margin-bottom: 0 !important;
                    }
    
                    .cookie-share-container .generate-btn {
                        width: 120px !important;
                        height: 48px !important;
                        flex-shrink: 0 !important;
                        background: #f3f3f3 !important;
                        color: #333 !important;
                        margin: 0 !important;
                        border-radius: 8px !important;
                    }
    
                    .cookie-share-container button {
                        width: 100% !important;
                        height: 48px !important;
                        border: none !important;
                        border-radius: 8px !important;
                        font-size: 16px !important;
                        font-weight: 500 !important;
                        cursor: pointer !important;
                        margin-bottom: 16px !important;
                    }
    
                    .cookie-share-container .action-btn {
                        background: #0078d4 !important;
                        color: white !important;
                    }
    
                    .cookie-share-container .clear-btn {
                        background: #dc3545 !important;
                        color: white !important;
                    }
    
                    .cookie-share-container .action-buttons {
                        display: flex !important;
                        gap: 16px !important;
                        margin-bottom: 16px !important;
                    }
    
                    .cookie-share-container .action-buttons button {
                        margin: 0 !important;
                    }
    
                    .cookie-share-floating-btn {
                        position: fixed !important;
                        bottom: 20px !important;
                        left: 20px !important;
                        width: 32px !important;
                        height: 32px !important;
                        background-color: transparent !important;
                        border: none !important;
                        border-radius: 50% !important;
                        cursor: pointer !important;
                        z-index: 2147483645 !important;
                        transition: transform 0.3s ease !important;
                    }
    
                    .cookie-share-floating-btn img {
                        width: 100% !important;
                        height: 100% !important;
                    }
    
                    .cookie-share-floating-btn:hover {
                        transform: scale(1.125) !important;
                    }
    
                    @media screen and (max-width: 480px) {
                        .cookie-share-container {
                            padding: 20px !important;
                        }
    
                        .cookie-share-container .action-buttons {
                            flex-direction: column !important;
                        }
                    }
                `);
    },

    createFloatingButton() {
      // Check if the floating button should be displayed
      const showFloatingButton = GM_getValue(
        STORAGE_KEYS.SHOW_FLOATING_BUTTON,
        true
      );
      if (!showFloatingButton) {
        return;
      }

      const cookieSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
          <path fill="#91B3A7" d="M21.598 13.789c-1.646-.583-2.76-2.145-2.76-3.891 0-.284-.1-.516-.316-.715-.184-.15-.466-.217-.699-.183-1.397.2-2.728-.2-3.743-1.015-1.015-.816-1.73-2.045-1.847-3.476-.017-.25-.167-.483-.383-.633-.217-.133-.483-.167-.732-.067-2.262.815-4.391-.616-5.239-2.562-.167-.366-.549-.566-.949-.482-3.193.715-6.07 2.72-8.031 5.248C-6.804 11.66-6.354 19.82.366 26.54c5.538 5.53 14.48 5.53 20.002 0 2.562-2.562 4.257-6.22 4.257-10.11-.033-.55-.05-.915-.566-1.098z"/>
          <circle fill="#4A5567" cx="10" cy="12" r="1.5"/>
          <circle fill="#4A5567" cx="16" cy="9" r="1.5"/>
          <circle fill="#4A5567" cx="14" cy="15" r="1.5"/>
        </svg>
      `;

      const floatingBtn = document.createElement("button");
      floatingBtn.innerHTML = cookieSvg;
      floatingBtn.className = "cookie-share-floating-btn";
      floatingBtn.onclick = () => this.showCookieList();

      document.body.appendChild(floatingBtn);
      state.floatingButton = floatingBtn;
      fullscreenManager.updateFloatingButtonVisibility();
    },

    createSettingsView(container) {
      const settingsContainer = document.createElement("div");
      settingsContainer.className = "settings-container";
      settingsContainer.style.cssText = `
                margin-top: 16px;
                padding: 16px;
                background: #f5f5f5;
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                gap: 12px;
            `;

      // Create a generic toggle function
      const createToggle = (labelText, storageKey, onChange) => {
        const toggleContainer = document.createElement("div");
        toggleContainer.style.cssText = `
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    width: 100%;
                `;

        const labelSpan = document.createElement("span");
        labelSpan.textContent = labelText;
        labelSpan.style.cssText = `
                    font-size: 14px;
                    color: #333;
                    user-select: none;
                `;

        const toggleWrapper = document.createElement("div");
        toggleWrapper.style.cssText = `
                    display: flex;
                    align-items: center;
                `;

        const toggleSwitch = document.createElement("label");
        toggleSwitch.className = "toggle-switch";
        toggleSwitch.style.cssText = `
                    position: relative;
                    display: inline-block;
                    width: 40px;
                    height: 20px;
                    margin-left: 12px;
                `;

        const toggleInput = document.createElement("input");
        toggleInput.type = "checkbox";
        toggleInput.checked = GM_getValue(storageKey, true);
        toggleInput.style.cssText = `
                    opacity: 0;
                    width: 0;
                    height: 0;
                    position: absolute;
                `;

        const toggleSlider = document.createElement("span");
        toggleSlider.className = "toggle-slider";
        toggleSlider.style.cssText = `
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #ccc;
                    transition: .4s;
                    border-radius: 20px;
                `;

        // Add slider styles
        const sliderBefore = document.createElement("span");
        sliderBefore.style.cssText = `
                    position: absolute;
                    content: "";
                    height: 16px;
                    width: 16px;
                    left: 2px;
                    bottom: 2px;
                    background-color: white;
                    transition: .4s;
                    border-radius: 50%;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                `;
        toggleSlider.appendChild(sliderBefore);

        // Set initial state
        if (toggleInput.checked) {
          toggleSlider.style.backgroundColor = "#0078d4";
          sliderBefore.style.transform = "translateX(20px)";
        }

        toggleInput.addEventListener("change", () => {
          const newState = toggleInput.checked;
          GM_setValue(storageKey, newState);

          // Update toggle styles
          toggleSlider.style.backgroundColor = newState ? "#0078d4" : "#ccc";
          sliderBefore.style.transform = newState
            ? "translateX(20px)"
            : "translateX(0)";

          if (onChange) onChange(newState);
        });

        toggleSwitch.appendChild(toggleInput);
        toggleSwitch.appendChild(toggleSlider);
        toggleWrapper.appendChild(toggleSwitch);
        toggleContainer.appendChild(labelSpan);
        toggleContainer.appendChild(toggleWrapper);

        return toggleContainer;
      };

      // Create floating button toggle
      const floatingBtnToggle = createToggle(
        "Show Floating Button",
        STORAGE_KEYS.SHOW_FLOATING_BUTTON,
        (newState) => {
          const existingBtn = document.querySelector(
            ".cookie-share-floating-btn"
          );
          if (existingBtn) {
            existingBtn.remove();
          }
          if (newState) {
            ui.createFloatingButton();
          }
        }
      );

      // Create fullscreen auto-hide toggle
      const fullscreenToggle = createToggle(
        "Auto Hide in Fullscreen(Not Available For Safari)",
        STORAGE_KEYS.AUTO_HIDE_FULLSCREEN,
        (newState) => {
          fullscreenManager.updateFloatingButtonVisibility();
        }
      );

      settingsContainer.appendChild(floatingBtnToggle);
      settingsContainer.appendChild(fullscreenToggle);
      container.appendChild(settingsContainer);
    },

    createMainView() {
      const overlay = document.createElement("div");
      overlay.className = "cookie-share-overlay";
      overlay.onclick = (e) => {
        if (e.target === overlay) ui.hideModal();
      };

      const modal = document.createElement("div");
      modal.className = "cookie-share-modal";
      modal.innerHTML = `
        <div class="cookie-share-container">
          <button class="close-btn" onclick="return false;">×</button>
          <div class="title-container">
            <h1>Cookie Share</h1>
            <a href="https://github.com/fangyuan99/cookie-share" target="_blank" class="github-link">
              <img src="https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/github.svg" alt="GitHub">
            </a>
          </div>

          <div class="id-input-container">
            <input type="text"
              class="cookie-id-input"
              placeholder="Cookie ID"
            >
            <button class="generate-btn" onclick="return false;">Generate ID</button>
          </div>

          <input type="text"
            class="server-url-input"
            placeholder="Server Address (e.g., https://example.com)"
            value="${GM_getValue(STORAGE_KEYS.CUSTOM_URL, "")}"
          >

          <div class="action-buttons">
            <button class="action-btn send-btn">Send Cookie</button>
            <button class="action-btn receive-btn">Receive Cookie</button>
          </div>

          <button class="clear-btn">Clear All Cookies of This Page</button>
        </div>
      `;

      GM_addStyle(`
        .server-url-input {
          width: 100%;
          height: 36px;
          padding: 0 12px;
          margin: 16px 0;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          box-sizing: border-box;
        }

        .header-actions {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          margin-bottom: 16px !important;
        }

        .github-link {
          display: flex !important;
          justify-content: center !important;
          margin-bottom: 20px !important;
        }

        .github-link a {
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          text-decoration: none !important;
          color: #666 !important;
          font-size: 14px !important;
          transition: all 0.3s ease !important;
        }

        .github-link a:hover {
          color: #333 !important;
          transform: translateY(-1px) !important;
        }

        .github-link img {
          width: 16px !important;
          height: 16px !important;
          opacity: 0.7 !important;
        }

        .github-link a:hover img {
          opacity: 1 !important;
        }

        .github-link span {
          font-weight: 400 !important;
        }

        .title-container {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          position: relative !important;
          margin-bottom: 20px !important;
        }

        .title-container h1 {
          margin: 0 !important;
        }

        .github-link {
          position: absolute !important;
          right: 0 !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
        }

        .github-link img {
          width: 20px !important;
          height: 20px !important;
          opacity: 0.7 !important;
          transition: all 0.3s ease !important;
        }

        .github-link:hover img {
          opacity: 1 !important;
        }
      `);

      // Add event listeners
      modal.querySelector(".close-btn").onclick = ui.hideModal;
      modal.querySelector(".generate-btn").onclick = () => {
        const idInput = modal.querySelector(".cookie-id-input");
        idInput.value = utils.generateId();
      };

      const serverUrlInput = modal.querySelector(".server-url-input");

      // 添加 input 事件监听器，在输入时自动保存
      serverUrlInput.addEventListener("input", () => {
        let url = serverUrlInput.value.trim();
        // 去掉末尾的斜杠
        url = url.replace(/\/+$/, "");
        GM_setValue(STORAGE_KEYS.CUSTOM_URL, url);
      });

      // 添加 blur 事件监听，在失去焦点时格式化显示
      serverUrlInput.addEventListener("blur", () => {
        let url = serverUrlInput.value.trim();
        // 去掉末尾的斜杠
        url = url.replace(/\/+$/, "");
        serverUrlInput.value = url;
        GM_setValue(STORAGE_KEYS.CUSTOM_URL, url);
      });

      modal.querySelector(".send-btn").onclick = async () => {
        try {
          const urlInput = modal.querySelector(".server-url-input");
          const idInput = modal.querySelector(".cookie-id-input");

          if (!urlInput.value.trim()) {
            notification.show("Please enter the server address", "error");
            return;
          }

          if (!idInput.value.trim()) {
            notification.show("Please enter or generate a Cookie ID", "error");
            return;
          }

          const result = await api.sendCookies(
            idInput.value.trim(),
            urlInput.value.trim()
          );
          notification.show(
            result.message || "Sent successfully",
            result.success ? "success" : "error"
          );
        } catch (error) {
          notification.show("Send failed: " + error.message, "error");
        }
      };

      modal.querySelector(".receive-btn").onclick = async () => {
        try {
          const urlInput = modal.querySelector(".server-url-input");
          const idInput = modal.querySelector(".cookie-id-input");

          if (!urlInput.value.trim()) {
            notification.show("Please enter the server address", "error");
            return;
          }

          if (!idInput.value.trim()) {
            notification.show("Please enter a Cookie ID", "error");
            return;
          }

          const result = await api.receiveCookies(
            idInput.value.trim(),
            urlInput.value.trim()
          );
          notification.show(
            result.message || "Received successfully",
            "success"
          );
        } catch (error) {
          notification.show("Receive failed: " + error.message, "error");
        }
      };

      modal.querySelector(".clear-btn").onclick = async () => {
        if (await this.confirmDelete()) {
          await cookieManager.clearAll();
          notification.show(
            "Cookies have been cleared, the page will refresh shortly",
            "success"
          );
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }
      };

      ui.createSettingsView(modal.querySelector(".cookie-share-container"));
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
    },

    showModal() {
      // Ensure any existing Cookie List elements are removed
      const existingOverlay = document.querySelector(".cookie-share-overlay");
      if (existingOverlay) {
        existingOverlay.remove();
      }

      // Create and display the Cookie Share modal
      this.createMainView();
      const overlay = document.querySelector(".cookie-share-overlay");
      const modal = document.querySelector(".cookie-share-modal");

      if (overlay && modal) {
        overlay.classList.add("visible");
        modal.classList.add("visible");
      }
    },

    hideModal() {
      const overlay = document.querySelector(".cookie-share-overlay");
      const modal = document.querySelector(".cookie-share-modal");

      if (overlay && modal) {
        const idInput = modal.querySelector(".cookie-id-input");
        if (idInput) {
          idInput.value = "";
        }

        overlay.classList.remove("visible");
        modal.classList.remove("visible");
        if (state.floatingButton) {
          fullscreenManager.updateFloatingButtonVisibility();
        }
      }
    },

    createCookieListModal() {
      const overlay = document.createElement("div");
      overlay.className = "cookie-share-overlay";
      overlay.onclick = (e) => {
        if (e.target === overlay) this.hideCookieList();
      };

      const modal = document.createElement("div");
      modal.className = "cookie-share-modal cookie-list-modal";
      modal.innerHTML = `
        <div class="cookie-share-container">
          <button class="close-btn" onclick="return false;">×</button>
          <h1>Cookies List</h1>
          <div id="cookieSharePasswordContainer" class="password-container hidden">
            <input type="password" 
              id="cookieSharePassword" 
              placeholder="Enter admin password" 
              class="cookie-share-input"
            />
          </div>
          <div id="cookieShareList" class="cookie-list-container"></div>
        </div>
      `;

      // Add additional styles for password input
      GM_addStyle(`
        .cookie-list-modal {
          max-width: 600px !important;
        }

        .cookie-list-container {
          margin-top: 20px !important;
          max-height: 400px !important;
          overflow-y: auto !important;
        }

        .cookie-share-item {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          padding: 12px !important;
          border-bottom: 1px solid #eee !important;
          background: #fff !important;
        }

        .cookie-share-item:last-child {
          border-bottom: none !important;
        }

        .cookie-share-buttons {
          display: flex !important;
          gap: 8px !important;
        }

        .cookie-share-receive,
        .cookie-share-delete {
          padding: 6px 12px !important;
          border-radius: 4px !important;
          border: none !important;
          cursor: pointer !important;
          font-size: 14px !important;
        }

        .cookie-share-receive {
          background: #0078d4 !important;
          color: white !important;
        }

        .cookie-share-delete {
          background: #dc3545 !important;
          color: white !important;
        }

        .cookie-share-error {
          color: #dc3545 !important;
          padding: 12px !important;
          text-align: center !important;
        }

        .cookie-share-empty {
          color: #666 !important;
          padding: 12px !important;
          text-align: center !important;
        }

        .cookie-share-loading {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 20px !important;
          gap: 10px !important;
        }

        .cookie-share-spinner {
          width: 20px !important;
          height: 20px !important;
          border: 2px solid #f3f3f3 !important;
          border-top: 2px solid #0078d4 !important;
          border-radius: 50% !important;
          animation: spin 1s linear infinite !important;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .password-container {
          margin: 20px 0 !important;
          text-align: center !important;
        }

        .password-container.hidden {
          display: none !important;
        }

        .cookie-share-input {
          width: 100% !important;
          max-width: 300px !important;
          height: 36px !important;
          padding: 0 12px !important;
          border: 1px solid #ddd !important;
          border-radius: 6px !important;
          font-size: 14px !important;
          margin: 0 auto !important;
        }
      `);

      modal.querySelector(".close-btn").onclick = () => this.hideCookieList();

      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      return { overlay, modal };
    },

    showCookieList() {
      // Ensure any existing Cookie Share elements are removed
      const existingOverlay = document.querySelector(".cookie-share-overlay");
      if (existingOverlay) {
        existingOverlay.remove();
      }

      // Create and display the Cookie List modal
      const { overlay, modal } = this.createCookieListModal();
      overlay.classList.add("visible");
      modal.classList.add("visible");

      const cookiesList = modal.querySelector("#cookieShareList");
      const passwordContainer = modal.querySelector(
        "#cookieSharePasswordContainer"
      );

      this.initializeCookieList(cookiesList, passwordContainer);
    },

    hideCookieList() {
      const overlay = document.querySelector(".cookie-share-overlay");
      const modal = document.querySelector(".cookie-share-modal");
      if (overlay && modal) {
        overlay.classList.remove("visible");
        modal.classList.remove("visible");
        setTimeout(() => {
          overlay.remove();
        }, 300);
      }
    },

    async initializeCookieList(cookiesList, passwordContainer) {
      try {
        const customUrl = GM_getValue(STORAGE_KEYS.CUSTOM_URL);
        if (!customUrl) {
          cookiesList.innerHTML = `<div class="cookie-share-error">Please set server URL first</div>`;
          return;
        }

        const savedPassword = GM_getValue(STORAGE_KEYS.ADMIN_PASSWORD);
        if (savedPassword) {
          await this.loadCookiesList(cookiesList, customUrl, savedPassword);
        } else {
          passwordContainer.classList.remove("hidden");
          const passwordInput = passwordContainer.querySelector(
            "#cookieSharePassword"
          );

          passwordInput.onkeydown = async (e) => {
            if (e.key === "Enter") {
              const password = passwordInput.value.trim();
              if (password) {
                try {
                  await this.loadCookiesList(cookiesList, customUrl, password);
                  GM_setValue(STORAGE_KEYS.ADMIN_PASSWORD, password);
                  passwordContainer.classList.add("hidden");
                } catch (error) {
                  passwordInput.value = "";
                  cookiesList.innerHTML = `<div class="cookie-share-error">${error.message}</div>`;
                }
              }
            }
          };
        }
      } catch (error) {
        console.error("Error loading cookies:", error);
        cookiesList.innerHTML = `<div class="cookie-share-error">Failed to load cookies: ${error.message}</div>`;
      }
    },

    async loadCookiesList(cookiesList, customUrl, password) {
      cookiesList.innerHTML = `
        <div class="cookie-share-loading">
          <div class="cookie-share-spinner"></div>
          <span>Loading cookies...</span>
        </div>
      `;

      const currentHost = window.location.hostname;

      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "GET",
          url: `${customUrl}/admin/list-cookies-by-host/${encodeURIComponent(
            currentHost
          )}`,
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Password": password,
          },
          onload: (response) => {
            try {
              const data = JSON.parse(response.responseText);

              if (response.status !== 200) {
                if (response.status === 401) {
                  // Password error, clear saved password
                  GM_setValue(STORAGE_KEYS.ADMIN_PASSWORD, "");
                  throw new Error("Invalid password");
                }
                throw new Error(data.message || "Failed to load cookies");
              }

              if (data.success && Array.isArray(data.cookies)) {
                if (data.cookies.length === 0) {
                  cookiesList.innerHTML = `<div class="cookie-share-empty">No cookies found for ${currentHost}</div>`;
                } else {
                  cookiesList.innerHTML = data.cookies
                    .map(
                      (cookie) => `
                    <div class="cookie-share-item">
                      <span class="cookie-id">ID: ${cookie.id}</span>
                      <div class="cookie-share-buttons">
                        <button class="cookie-share-receive" data-id="${cookie.id}">Receive</button>
                        <button class="cookie-share-delete" data-id="${cookie.id}">Delete</button>
                      </div>
                    </div>
                  `
                    )
                    .join("");
                  this.attachButtonListeners(cookiesList);
                }
              } else {
                throw new Error(data.message || "Failed to load cookies");
              }
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          onerror: (error) => {
            reject(new Error("Network request failed"));
          },
        });
      });
    },

    attachButtonListeners(container) {
      // Receive button handler
      container.querySelectorAll(".cookie-share-receive").forEach((button) => {
        button.onclick = async () => {
          const cookieId = button.dataset.id;
          const customUrl = GM_getValue(STORAGE_KEYS.CUSTOM_URL);

          try {
            const result = await api.receiveCookies(cookieId, customUrl);
            notification.show(
              result.message || "Received successfully",
              "success"
            );
            this.hideCookieList();
          } catch (error) {
            notification.show(
              "Failed to receive cookies: " + error.message,
              "error"
            );
          }
        };
      });

      // Delete button handler
      container.querySelectorAll(".cookie-share-delete").forEach((button) => {
        button.onclick = async () => {
          const cookieId = button.dataset.id;
          if (await this.confirmDelete()) {
            try {
              const customUrl = GM_getValue(STORAGE_KEYS.CUSTOM_URL);
              const password = GM_getValue(STORAGE_KEYS.ADMIN_PASSWORD);

              await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                  method: "DELETE",
                  url: `${customUrl}/admin/delete?key=${encodeURIComponent(
                    cookieId
                  )}`,
                  headers: {
                    "Content-Type": "application/json",
                    "X-Admin-Password": password,
                  },
                  onload: async (response) => {
                    try {
                      const data = JSON.parse(response.responseText);
                      if (data.success) {
                        await this.showCookieList(); // Refresh the list
                        notification.show(
                          "Cookie deleted successfully",
                          "success"
                        );
                        resolve();
                      } else {
                        reject(
                          new Error(data.message || "Failed to delete cookie")
                        );
                      }
                    } catch (error) {
                      reject(error);
                    }
                  },
                  onerror: () => reject(new Error("Network request failed")),
                });
              });
            } catch (error) {
              notification.show(
                "Failed to delete cookie: " + error.message,
                "error"
              );
            }
          }
        };
      });
    },
  };

  // ===================== Initialize =====================
  function init() {
    ui.injectStyles();
    ui.createFloatingButton();

    // Add fullscreen event listeners
    document.addEventListener("fullscreenchange", () =>
      fullscreenManager.handleFullscreenChange()
    );
    document.addEventListener("webkitfullscreenchange", () =>
      fullscreenManager.handleFullscreenChange()
    );

    // Register menu command, click to show Cookie Share
    GM_registerMenuCommand("Show Cookie Share", () => ui.showModal());
  }

  // Start the application
  init();
})();
// 首先添加一个通知系统的样式
GM_addStyle(`
  .cookie-share-notification {
    position: fixed !important;
    bottom: 24px !important;
    right: 24px !important;
    padding: 16px 24px !important;
    border-radius: 12px !important;
    backdrop-filter: blur(10px) !important;
    -webkit-backdrop-filter: blur(10px) !important;
    background: rgba(255, 255, 255, 0.8) !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1) !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    color: #4A5567 !important;
    font-family: -apple-system, system-ui, sans-serif !important;
    font-size: 14px !important;
    transform: translateY(150%) !important;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
    z-index: 2147483647 !important;
  }

  .cookie-share-notification.show {
    transform: translateY(0) !important;
  }

  .cookie-share-notification.success {
    border-left: 4px solid #91B3A7 !important;
  }

  .cookie-share-notification.error {
    border-left: 4px solid #E8A9A2 !important;
  }

  .cookie-share-modal {
    background: rgba(255, 255, 255, 0.8) !important;
    backdrop-filter: blur(10px) !important;
    -webkit-backdrop-filter: blur(10px) !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15) !important;
  }

  .cookie-share-container button {
    background: #91B3A7 !important;
    transition: all 0.3s ease !important;
    border: none !important;
    color: white !important;
  }

  .cookie-share-container button:hover {
    background: #7A9B8F !important;
    transform: translateY(-1px) !important;
  }

  .cookie-share-container .clear-btn {
    background: #E8A9A2 !important;
  }

  .cookie-share-container .clear-btn:hover {
    background: #D1918A !important;
  }

  .cookie-share-container input {
    background: rgba(255, 255, 255, 0.9) !important;
    border: 1px solid rgba(145, 179, 167, 0.3) !important;
    transition: all 0.3s ease !important;
  }

  .cookie-share-container input:focus {
    border-color: #91B3A7 !important;
    box-shadow: 0 0 0 2px rgba(145, 179, 167, 0.2) !important;
    outline: none !important;
  }

  .cookie-share-item {
    background: rgba(255, 255, 255, 0.5) !important;
    border-radius: 8px !important;
    margin-bottom: 8px !important;
    border: 1px solid rgba(145, 179, 167, 0.2) !important;
    transition: all 0.3s ease !important;
  }

  .cookie-share-item:hover {
    background: rgba(255, 255, 255, 0.8) !important;
    transform: translateY(-1px) !important;
  }

  .cookie-share-floating-btn {
    backdrop-filter: blur(4px) !important;
    -webkit-backdrop-filter: blur(4px) !important;
    background: rgba(255, 255, 255, 0.8) !important;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1) !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    padding: 8px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  .cookie-share-floating-btn svg {
    width: 24px !important;
    height: 24px !important;
    transform: rotate(0deg) !important;
  }

  /* 调整危险操作按���的颜��� */
  .cookie-share-container .clear-btn {
    background: #FF6B6B !important;
  }

  .cookie-share-container .clear-btn:hover {
    background: #FF5252 !important;
  }

  .cookie-share-container .cookie-share-delete {
    background: #FF6B6B !important;
  }

  .cookie-share-container .cookie-share-delete:hover {
    background: #FF5252 !important;
  }

  .cookie-share-notification.error {
    border-left: 4px solid #FF6B6B !important;
  }

  /* 确认删除对话框中的删除按钮 */
  .cookie-share-modal .confirm-delete {
    background: #FF6B6B !important;
  }

  .cookie-share-modal .confirm-delete:hover {
    background: #FF5252 !important;
  }
`);

// 添加通知系统
const notification = {
  show(message, type = "success") {
    const existingNotification = document.querySelector(
      ".cookie-share-notification"
    );
    if (existingNotification) {
      existingNotification.remove();
    }

    const notificationEl = document.createElement("div");
    notificationEl.className = `cookie-share-notification ${type}`;
    notificationEl.textContent = message;
    document.body.appendChild(notificationEl);

    // 强制重绘
    notificationEl.offsetHeight;
    notificationEl.classList.add("show");

    setTimeout(() => {
      notificationEl.classList.remove("show");
      setTimeout(() => notificationEl.remove(), 300);
    }, 3000);
  },
};

// 替换所有 alert 调用
// 在 api.sendCookies 的成功回调中
if (result.success) {
  notification.show(result.message || "Sent successfully");
} else {
  notification.show(result.message || "Failed to send cookies", "error");
}

// 在 api.receiveCookies 的成功回调中
notification.show(result.message || "Received successfully");

// 在错误处理中
notification.show(error.message, "error");

// 在清除 cookies 时
notification.show("Cookies have been cleared, the page will refresh shortly");
