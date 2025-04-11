// ==UserScript==
// @name         Cookie Share
// @namespace    https://github.com/fangyuan99/cookie-share
// @version      0.1.0
// @description  Sends and receives cookies with your friends
// @author       fangyuan99,aBER
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_cookie
// @updateURL    https://github.com/fangyuan99/cookie-share/raw/refs/heads/main/tampermonkey/cookie-share.user.js
// @connect      *
// ==/UserScript==

(function () {
  "use strict";
  if (window.self !== window.top) return;

  // ===================== Constants =====================
  const STORAGE_KEYS = {
    CUSTOM_URL: "cookie_share_custom_url",
    ADMIN_PASSWORD: "cookie_share_admin_password",
    SHOW_FLOATING_BUTTON: "cookie_share_show_floating_button",
    AUTO_HIDE_FULLSCREEN: "cookie_share_auto_hide_fullscreen",
    SAVE_LOCALLY: "cookie_share_save_locally",
    LANGUAGE_PREFERENCE: "cookie_share_language_preference", // Added
  };

  // ===================== i18n =====================
  const LANGUAGES = {
    EN: "en",
    ZH: "zh",
  };

  let currentLanguage = LANGUAGES.EN; // Default language

  // Detect browser language, prioritizing saved preference
  function detectLanguage() {
    const savedLang = GM_getValue(STORAGE_KEYS.LANGUAGE_PREFERENCE, null);
    if (savedLang === LANGUAGES.EN || savedLang === LANGUAGES.ZH) {
      currentLanguage = savedLang;
      console.log(
        `Cookie Share: Language set from preference: ${currentLanguage}`
      );
      return;
    }

    // Fallback to browser language detection
    const browserLang = navigator.language || navigator.userLanguage;
    if (browserLang && browserLang.toLowerCase().startsWith(LANGUAGES.ZH)) {
      currentLanguage = LANGUAGES.ZH;
    } else {
      currentLanguage = LANGUAGES.EN;
    }
    // Optional: Check GM_getValue for saved preference if implementing manual switch
    console.log(`Cookie Share: Language set to ${currentLanguage}`);
  }

  const translations = {
    en: {
      // General UI
      cookieShareTitle: "Cookie Share",
      cookiesListTitle: "Cookies List",
      confirmDeleteTitle: "Confirm Delete",
      closeButton: "×",
      cancelButton: "Cancel",
      deleteButton: "Delete",
      receiveButton: "Receive",
      showListButton: "Show List",
      showPanelButton: "Show Panel",
      generateIdButton: "Generate ID",
      sendCookieButton: "Send Cookie",
      receiveCookieButton: "Receive Cookie",
      clearAllCookiesButton: "Clear All Cookies of This Page",
      sourceLocal: "Local",
      sourceCloud: "Cloud",
      loadingCookies: "Loading cookies...",
      failed: "failed", // Added

      // Placeholders
      placeholderCookieId: "Cookie ID",
      placeholderServerAddress: "Server Address (e.g., https://example.com)",
      placeholderAdminPassword: "Enter admin password",

      // Settings
      settingsShowFloatingButton: "Show Floating Button (Alt+Shift+L)",
      settingsAutoHideFullscreen:
        "Auto Hide in Fullscreen (Not Available For Safari)",
      settingsSaveLocally:
        "Prefer Local Save ('Send' will only save locally if checked)",

      // Menu Commands
      menuShowShare: "Show Cookie Share (Alt+Shift+C)",
      menuShowList: "Show Cookie List (Alt+Shift+L)",
      menuSwitchLanguage: "Switch Language (Refresh Required)", // Added

      // Notifications & Messages
      notificationEnterCookieId: "Please enter or generate a Cookie ID",
      notificationNoCookiesToSave: "No cookies to save on the current page",
      notificationSavedLocally: "Cookie saved locally successfully",
      notificationEnterServer: "Please enter the server address",
      notificationSentSuccess: "Sent successfully",
      notificationReceivedSuccess: "Received successfully",
      notificationClearedSuccess:
        "Cookies have been cleared, the page will refresh shortly",
      notificationImportSuccess:
        "Successfully imported {{count}} cookies from local, refreshing soon",
      notificationLocalDataNotFound: "Local cookie data not found",
      notificationLocalDataInvalid: "Local cookie data format invalid",
      notificationLocalImportFailed: "Failed to import any local cookies",
      notificationNeedServerAddress: "Please set the server address first",
      notificationReceiveFailed:
        "Receive {{source}} cookie failed: {{message}}",
      notificationLocalDeleted: "Local cookie deleted",
      notificationNeedAdminCreds:
        "Deleting cloud cookies requires server address and admin password",
      notificationCloudDeleted: "Cloud cookie deleted",
      notificationDeleteFailed: "Delete {{source}} cookie failed: {{message}}",
      notificationListInitFailed:
        "Failed to initialize cookie list: {{message}}",
      notificationLoadCloudFailed:
        "Failed to load cloud cookies: {{message}} (Local cookies will still be shown)",
      notificationLoadLocalFailed: "Failed to load local cookies: {{message}}",
      notificationInvalidPassword: "Invalid admin password",
      notificationAdminPermission:
        "Invalid admin password or insufficient permissions",
      notificationServerDeleteFailed: "Server returned delete failure",
      notificationNetworkError: "Network request failed",
      notificationRequestTimeout: "Request timed out",
      notificationResponseError: "Error processing response: {{message}}",
      confirmDeleteMessage: "Are you sure you want to delete this cookie?",
      listEmpty: "No local or cloud cookies found related to {{host}}",
      listEmptyLocalOnly: "No local cookies found related to {{host}}",

      // API Errors (Direct mapping, may stay English if API doesn't support i18n)
      apiErrorNoCookiesToSend: "No cookies to send on the current page",
      apiErrorServerReturn: "Server returned error: {{status}}\n{{text}}", // Escaped newline
      apiErrorNetwork: "Network request failed",
      apiErrorTimeout: "Request timeout",
      apiErrorInvalidData: "Invalid data format",
      apiErrorNoImport: "No cookies were successfully imported",
    },
    zh: {
      // General UI
      cookieShareTitle: "Cookie Share",
      cookiesListTitle: "Cookie List",
      confirmDeleteTitle: "确认删除",
      closeButton: "×",
      cancelButton: "取消",
      deleteButton: "删除",
      receiveButton: "接收",
      showListButton: "显示列表",
      showPanelButton: "显示面板",
      generateIdButton: "生成 ID",
      sendCookieButton: "发送 Cookie",
      receiveCookieButton: "接收 Cookie",
      clearAllCookiesButton: "清除本页所有 Cookie",
      sourceLocal: "本地",
      sourceCloud: "云端",
      loadingCookies: "正在加载 Cookie...",
      failed: "失败", // Added

      // Placeholders
      placeholderCookieId: "Cookie ID",
      placeholderServerAddress: "服务器地址 (例如 https://example.com)",
      placeholderAdminPassword: "输入管理密码",

      // Settings
      settingsShowFloatingButton: "显示悬浮按钮 (Alt+Shift+L)",
      settingsAutoHideFullscreen: "全屏时自动隐藏 (Safari 不可用)",
      settingsSaveLocally: "优先本地保存 (勾选后'发送'将仅保存本地)", // Fixed quotes

      // Menu Commands
      menuShowShare: "显示 Cookie 分享面板 (Alt+Shift+C)",
      menuShowList: "显示 Cookie 列表 (Alt+Shift+L)",
      menuSwitchLanguage: "切换语言 (需刷新页面)", // Added

      // Notifications & Messages
      notificationEnterCookieId: "请输入或生成一个 Cookie ID",
      notificationNoCookiesToSave: "当前页面没有可保存的 Cookie",
      notificationSavedLocally: "Cookie 已成功保存到本地",
      notificationEnterServer: "请输入服务器地址",
      notificationSentSuccess: "发送成功",
      notificationReceivedSuccess: "接收成功",
      notificationClearedSuccess: "Cookie 已清除，页面即将刷新",
      notificationImportSuccess: "成功从本地导入 {{count}} 个 Cookie，即将刷新",
      notificationLocalDataNotFound: "本地 Cookie 数据未找到",
      notificationLocalDataInvalid: "本地 Cookie 数据格式无效",
      notificationLocalImportFailed: "未成功导入任何本地 Cookie",
      notificationNeedServerAddress: "请先设置服务器地址",
      notificationReceiveFailed: "接收 {{source}} Cookie 失败: {{message}}",
      notificationLocalDeleted: "本地 Cookie 已删除",
      notificationNeedAdminCreds: "删除云端 Cookie 需要服务器地址和管理密码",
      notificationCloudDeleted: "云端 Cookie 已删除",
      notificationDeleteFailed: "删除 {{source}} Cookie 失败: {{message}}",
      notificationListInitFailed: "初始化 Cookie 列表失败: {{message}}",
      notificationLoadCloudFailed:
        "加载云端 Cookie 失败: {{message}} (本地 Cookie 仍会显示)",
      notificationLoadLocalFailed: "加载本地 Cookie 失败: {{message}}",
      notificationInvalidPassword: "无效的管理密码",
      notificationAdminPermission: "管理密码无效或权限不足",
      notificationServerDeleteFailed: "服务器返回删除失败",
      notificationNetworkError: "网络请求失败",
      notificationRequestTimeout: "请求超时",
      notificationResponseError: "处理响应时出错: {{message}}",
      confirmDeleteMessage: "您确定要删除此 Cookie 吗？",
      listEmpty: "未找到与 {{host}} 相关的本地或云端 Cookie",
      listEmptyLocalOnly: "未找到与 {{host}} 相关的本地 Cookie",

      // API Errors (Maintain English or provide generic Chinese messages)
      apiErrorNoCookiesToSend: "当前页面无 Cookie 可发送",
      apiErrorServerReturn: "服务器返回错误: {{status}}\n{{text}}", // Escaped newline
      apiErrorNetwork: "网络请求失败",
      apiErrorTimeout: "请求超时",
      apiErrorInvalidData: "无效的数据格式",
      apiErrorNoImport: "未能成功导入任何 Cookie",
    },
  };

  // Translation helper function
  function t(key, replacements = {}) {
    let translation =
      translations[currentLanguage]?.[key] || translations[LANGUAGES.EN]?.[key];

    if (translation === undefined) {
      console.warn(`Missing translation for key: ${key}`);
      return key; // Return the key itself if translation is missing entirely
    }

    // Perform replacements
    for (const placeholder in replacements) {
      const regex = new RegExp(`{{\s*${placeholder}\s*}}`, "g");
      translation = translation.replace(regex, replacements[placeholder]);
    }

    return translation;
  }

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
            message: t("notificationNoCookiesToSave"),
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
                    t("apiErrorServerReturn", {
                      status: response.status || "?",
                      text: response.responseText || response.message,
                    })
                  )
                );
              }
            },
            onerror: () => reject(new Error(t("apiErrorNetwork"))),
            ontimeout: () => reject(new Error(t("apiErrorTimeout"))),
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
            onerror: () => reject(new Error(t("apiErrorNetwork"))),
            ontimeout: () => reject(new Error(t("apiErrorTimeout"))),
          });
        });

        if (
          !response?.response?.success ||
          !Array.isArray(response.response.cookies)
        ) {
          throw new Error(t("apiErrorInvalidData"));
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
          throw new Error(t("apiErrorNoImport"));
        }

        setTimeout(() => window.location.reload(), 500);
        return {
          success: true,
          message: t("notificationReceivedSuccess"),
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
          <h3 style="margin: 0 0 16px 0; color: #4A5567; font-size: 18px;">${t(
            "confirmDeleteTitle"
          )}</h3> <!-- Updated -->
          <p style="margin: 0 0 24px 0; color: #666;">${t(
            "confirmDeleteMessage"
          )}</p> <!-- Updated -->
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
            ">${t("cancelButton")}</button> <!-- Updated -->
            <button id="confirmBtn" style="
              padding: 8px 24px;
              border-radius: 6px;
              background: #FF6B6B; /* Keep delete color */
              color: white;
              border: none;
              cursor: pointer;
              min-width: 100px;
              transition: all 0.3s ease;
            ">${t("deleteButton")}</button> <!-- Updated -->
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

      GM_addStyle(`
        .server-url-input {
          width: 100% !important;
          height: 36px !important;
          padding: 0 12px !important;
          margin: 16px 0 !important;
          border: 1px solid #ddd !important;
          border-radius: 6px !important;
          font-size: 14px !important;
          box-sizing: border-box !important;
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

        .id-input-container {
          display: flex !important;
          gap: 16px !important;
          margin-bottom: 16px !important;
        }

        .generate-btn {
          width: 120px !important;
          height: 48px !important;
          flex-shrink: 0 !important;
          background: #f3f3f3 !important;
          color: #333 !important;
          margin: 0 !important;
          border-radius: 8px !important;
        }

        .action-buttons {
          display: flex !important;
          gap: 16px !important;
          margin-bottom: 16px !important;
        }

        .action-btn {
          flex: 1 !important;
          height: 48px !important;
          background: #0078d4 !important;
          color: white !important;
          border: none !important;
          border-radius: 8px !important;
          font-size: 16px !important;
          cursor: pointer !important;
          transition: all 0.3s ease !important;
        }

        .action-btn:hover {
          background: #006cbd !important;
          transform: translateY(-1px) !important;
        }

        .clear-btn {
          width: 100% !important;
          height: 48px !important;
          background: #FF6B6B !important;
          color: white !important;
          border: none !important;
          border-radius: 8px !important;
          font-size: 16px !important;
          cursor: pointer !important;
          transition: all 0.3s ease !important;
        }

        .clear-btn:hover {
          background: #FF5252 !important;
          transform: translateY(-1px) !important;
        }

        .close-btn {
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
          transition: all 0.3s ease !important;
        }

        .close-btn:hover {
          color: #333 !important;
          transform: scale(1.1) !important;
        }

        .cookie-id-input {
          flex: 1 !important;
          height: 48px !important;
          padding: 0 16px !important;
          border: 1px solid #ddd !important;
          border-radius: 8px !important;
          font-size: 16px !important;
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
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12">
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
      const createToggle = (
        labelTextKey,
        storageKey,
        onChange,
        defaultValue = true
      ) => {
        const toggleContainer = document.createElement("div");
        toggleContainer.style.cssText = `
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    width: 100%;
                `;

        const labelSpan = document.createElement("span");
        labelSpan.textContent = t(labelTextKey);
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
        toggleInput.checked = GM_getValue(storageKey, defaultValue);
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
        "settingsShowFloatingButton",
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
        "settingsAutoHideFullscreen",
        STORAGE_KEYS.AUTO_HIDE_FULLSCREEN,
        (newState) => {
          fullscreenManager.updateFloatingButtonVisibility();
        }
      );

      // Create save locally toggle
      const saveLocallyToggle = createToggle(
        "settingsSaveLocally",
        STORAGE_KEYS.SAVE_LOCALLY,
        null,
        false
      );

      settingsContainer.appendChild(floatingBtnToggle);
      settingsContainer.appendChild(fullscreenToggle);
      settingsContainer.appendChild(saveLocallyToggle);
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

      // 创建容器
      const container = document.createElement("div");
      container.className = "cookie-share-container";

      // 创建关闭按钮
      const closeBtn = document.createElement("button");
      closeBtn.className = "close-btn";
      closeBtn.textContent = t("closeButton");
      closeBtn.onclick = () => ui.hideModal();

      // 创建标题容器
      const titleContainer = document.createElement("div");
      titleContainer.className = "title-container";

      const title = document.createElement("h1");
      title.textContent = t("cookieShareTitle");

      const githubLink = document.createElement("a");
      githubLink.href = "https://github.com/fangyuan99/cookie-share";
      githubLink.target = "_blank";
      githubLink.className = "github-link";

      const githubImg = document.createElement("img");
      githubImg.src =
        "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/github.svg";
      githubImg.alt = "GitHub";

      // ID 输入容器
      const idContainer = document.createElement("div");
      idContainer.className = "id-input-container";

      const idInput = document.createElement("input");
      idInput.type = "text";
      idInput.className = "cookie-id-input";
      idInput.placeholder = t("placeholderCookieId");

      const generateBtn = document.createElement("button");
      generateBtn.className = "generate-btn";
      generateBtn.textContent = t("generateIdButton");
      generateBtn.onclick = () => {
        idInput.value = utils.generateId();
      };

      // 服务器地址输入
      const serverInput = document.createElement("input");
      serverInput.type = "text";
      serverInput.className = "cookie-id-input";
      serverInput.placeholder = t("placeholderServerAddress");
      serverInput.value = GM_getValue(STORAGE_KEYS.CUSTOM_URL, "");

      // 创建服务器地址输入容器
      const serverContainer = document.createElement("div");
      serverContainer.className = "id-input-container";

      // 创建显示 cookie list 的按钮
      const showListBtn = document.createElement("button");
      showListBtn.className = "generate-btn";
      showListBtn.textContent = t("showListButton");
      showListBtn.style.width = "120px";
      showListBtn.onclick = () => ui.showCookieList();

      // 组装服务器地址输入容器
      serverContainer.appendChild(serverInput);
      serverContainer.appendChild(showListBtn);

      // 创建密码输入容器
      const passwordContainer = document.createElement("div");
      passwordContainer.className = "id-input-container";

      const passwordInput = document.createElement("input");
      passwordInput.type = "password";
      passwordInput.id = "cookieSharePassword";
      passwordInput.className = "cookie-id-input";
      passwordInput.placeholder = t("placeholderAdminPassword");
      passwordInput.value = GM_getValue(STORAGE_KEYS.ADMIN_PASSWORD, "");

      // Add event listener to save password when it changes
      passwordInput.addEventListener("input", function () {
        GM_setValue(STORAGE_KEYS.ADMIN_PASSWORD, this.value);
      });

      // Create toggle button for password visibility
      const togglePasswordBtn = document.createElement("button");
      togglePasswordBtn.className = "generate-btn";
      togglePasswordBtn.style.width = "120px";

      // Use eye icons instead of text for better i18n
      const eyeOpenSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" style="fill: currentColor;">
          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
        </svg>
      `;

      const eyeClosedSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" style="fill: currentColor;">
          <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
        </svg>
      `;

      togglePasswordBtn.innerHTML = eyeOpenSvg;
      togglePasswordBtn.onclick = () => {
        if (passwordInput.type === "password") {
          passwordInput.type = "text";
          togglePasswordBtn.innerHTML = eyeClosedSvg;
        } else {
          passwordInput.type = "password";
          togglePasswordBtn.innerHTML = eyeOpenSvg;
        }
      };

      // Assemble password container
      passwordContainer.appendChild(passwordInput);
      passwordContainer.appendChild(togglePasswordBtn);

      // 操作按钮容器
      const actionButtons = document.createElement("div");
      actionButtons.className = "action-buttons";

      const sendBtn = document.createElement("button");
      sendBtn.className = "action-btn send-btn";
      sendBtn.textContent = t("sendCookieButton");

      const receiveBtn = document.createElement("button");
      receiveBtn.className = "action-btn receive-btn";
      receiveBtn.textContent = t("receiveCookieButton");

      const clearBtn = document.createElement("button");
      clearBtn.className = "clear-btn";
      clearBtn.textContent = t("clearAllCookiesButton");

      // 组装 DOM
      githubLink.appendChild(githubImg);
      titleContainer.appendChild(title);
      titleContainer.appendChild(githubLink);

      idContainer.appendChild(idInput);
      idContainer.appendChild(generateBtn);

      actionButtons.appendChild(sendBtn);
      actionButtons.appendChild(receiveBtn);

      container.appendChild(closeBtn);
      container.appendChild(titleContainer);
      container.appendChild(idContainer);
      container.appendChild(serverContainer);
      container.appendChild(passwordContainer);
      container.appendChild(actionButtons);
      container.appendChild(clearBtn);

      modal.appendChild(container);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // 添加事件监听器
      sendBtn.onclick = async () => {
        try {
          const saveLocally = GM_getValue(STORAGE_KEYS.SAVE_LOCALLY, false);
          const cookieId = idInput.value.trim();
          const serverUrl = serverInput.value.trim();

          if (!cookieId) {
            notification.show(t("notificationEnterCookieId"), "error");
            return;
          }

          if (saveLocally) {
            // Save locally
            const cookies = await cookieManager.getAll();
            if (!cookies.length) {
              notification.show(t("notificationNoCookiesToSave"), "error");
              return;
            }
            const data = {
              id: cookieId,
              url: window.location.href, // Store current URL for context
              cookies: cookies,
            };
            const localKey = `cookie_share_local_${data.id}`;
            await GM_setValue(localKey, JSON.stringify(data));
            notification.show(t("notificationSavedLocally"), "success");
          } else {
            // Send to server (existing logic)
            if (!serverUrl) {
              notification.show(t("notificationEnterServer"), "error");
              return;
            }
            const result = await api.sendCookies(cookieId, serverUrl);
            notification.show(
              result.message || t("notificationSentSuccess"),
              result.success ? "success" : "error"
            );
          }
        } catch (error) {
          let errorMessage = error.message;
          if (error.message.includes("No cookies to send")) {
            errorMessage = t("apiErrorNoCookiesToSend");
          } else if (error.message.startsWith("Server returned error:")) {
            errorMessage = t("apiErrorServerReturn", {
              status: error.status || "?",
              text: error.responseText || error.message,
            });
          } else if (error.message === "Network request failed") {
            errorMessage = t("apiErrorNetwork");
          } else if (error.message === "Request timeout") {
            errorMessage = t("apiErrorTimeout");
          }
          const actionKey = GM_getValue(STORAGE_KEYS.SAVE_LOCALLY, false)
            ? "settingsSaveLocally"
            : "sendCookieButton";
          notification.show(
            `${t(actionKey)} ${t("failed")}: ${errorMessage}`,
            "error"
          );
        }
      };

      receiveBtn.onclick = async () => {
        try {
          if (!serverInput.value.trim()) {
            notification.show(t("notificationEnterServer"), "error");
            return;
          }

          if (!idInput.value.trim()) {
            notification.show(t("notificationEnterCookieId"), "error");
            return;
          }

          const result = await api.receiveCookies(
            idInput.value.trim(),
            serverInput.value.trim()
          );
          notification.show(
            result.message || t("notificationReceivedSuccess"),
            "success"
          );
        } catch (error) {
          let errorMessage = error.message;
          if (error.message === "Request failed") {
            errorMessage = t("apiErrorNetwork");
          } else if (error.message === "Request timeout") {
            errorMessage = t("apiErrorTimeout");
          } else if (error.message === "Invalid data format") {
            errorMessage = t("apiErrorInvalidData");
          } else if (
            error.message === "No cookies were successfully imported"
          ) {
            errorMessage = t("apiErrorNoImport");
          }
          notification.show(
            t("notificationReceiveFailed", {
              source: t("sourceCloud"),
              message: errorMessage,
            }),
            "error"
          );
        }
      };

      clearBtn.onclick = async () => {
        if (await this.confirmDelete()) {
          await cookieManager.clearAll();
          notification.show(t("notificationClearedSuccess"), "success");
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }
      };

      // 添加服务器地址输入事件
      serverInput.addEventListener("input", () => {
        let url = serverInput.value.trim();
        url = url.replace(/\/+$/, "");
        GM_setValue(STORAGE_KEYS.CUSTOM_URL, url);
      });

      serverInput.addEventListener("blur", () => {
        let url = serverInput.value.trim();
        url = url.replace(/\/+$/, "");
        serverInput.value = url;
        GM_setValue(STORAGE_KEYS.CUSTOM_URL, url);
      });

      ui.createSettingsView(container);
    },

    showModal() {
      // Ensure any existing Cookie Share elements are removed
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
      if (overlay) {
        overlay.classList.remove("visible");
        setTimeout(() => {
          overlay.remove();
        }, 300);
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
          <button class="close-btn" onclick="return false;">${t(
            "closeButton"
          )}</button>
          <h1>${t("cookiesListTitle")}</h1>
          <div id="cookieShareList" class="cookie-list-container"></div>
          <div style="display: flex; justify-content: center;">
            <button id="cookieShareGoToMainBtn" class="generate-btn" style="width: 120px;">${t(
              "showPanelButton"
            )}</button>
          </div>
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
          margin-bottom: 16px !important;
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

      // Add click handler for the new "Go to Cookie Share" button
      const mainBtn = modal.querySelector("#cookieShareGoToMainBtn");
      mainBtn.onclick = () => {
        this.hideCookieList();
        this.showModal();
      };

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
      this.initializeCookieList(cookiesList);
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

    async initializeCookieList(cookiesList) {
      try {
        const customUrl = GM_getValue(STORAGE_KEYS.CUSTOM_URL);
        // We need customUrl only if we need to fetch cloud cookies or delete them
        // We always need to check for local cookies

        cookiesList.innerHTML = ""; // Clear previous content

        const savedPassword = GM_getValue(STORAGE_KEYS.ADMIN_PASSWORD);

        // Try loading with the existing password, or without password for local-only
        await this.loadCombinedCookieList(
          cookiesList,
          customUrl,
          savedPassword
        );
      } catch (error) {
        console.error("Error initializing cookies list:", error);
        cookiesList.innerHTML = `<div class="cookie-share-error">${t(
          "notificationListInitFailed",
          { message: error.message }
        )}</div>`;
      }
    },

    async loadCombinedCookieList(
      cookiesList,
      customUrl,
      password,
      loadOnlyLocal = false
    ) {
      cookiesList.innerHTML = `
          <div class="cookie-share-loading">
            <div class="cookie-share-spinner"></div>
            <span>${t("loadingCookies")}</span>
          </div>
        `;

      let combinedCookies = [];
      const currentHost = window.location.hostname;
      let cloudError = null;

      // 1. Fetch Local Cookies
      try {
        const allKeys = await GM_listValues();
        const localKeys = allKeys.filter((key) =>
          key.startsWith("cookie_share_local_")
        );
        console.log("Local keys found:", localKeys); // Debug log

        for (const key of localKeys) {
          try {
            const rawData = await GM_getValue(key);
            if (rawData) {
              const cookieData = JSON.parse(rawData);
              // Check if the cookie's URL matches the current host
              let cookieHost = "";
              try {
                cookieHost = new URL(cookieData.url).hostname;
              } catch (e) {
                console.warn(
                  `Invalid URL stored for local cookie ID ${cookieData.id}: ${cookieData.url}`
                );
                // Decide how to handle: skip, or assume match? Let's skip for now.
                continue;
              }

              if (cookieHost === currentHost) {
                console.log(`Adding local cookie: ${cookieData.id}`); // Debug log
                combinedCookies.push({
                  id: cookieData.id,
                  source: "local",
                  // Keep full data for local receive
                  url: cookieData.url,
                  cookies: cookieData.cookies,
                });
              }
            }
          } catch (parseError) {
            console.error(
              `Failed to parse local cookie data for key ${key}:`,
              parseError
            );
          }
        }
        console.log("Local cookies processed:", combinedCookies); // Debug log
      } catch (error) {
        console.error("Error fetching local cookies:", error);
        // Optionally display an error message for local fetch failure
        cookiesList.innerHTML = `<div class="cookie-share-error">${t(
          "notificationLoadLocalFailed",
          { message: error.message }
        )}</div>`;
      }

      // 2. Fetch Cloud Cookies (if applicable)
      if (!loadOnlyLocal && customUrl) {
        console.log("Fetching cloud cookies from:", customUrl); // Debug log
        try {
          // Requires password for cloud operations
          if (!password) {
            // This case is handled by initializeCookieList showing the password prompt
            // We just skip fetching cloud cookies here if no password provided yet.
            console.log("No password provided, skipping cloud fetch for now.");
          } else {
            const response = await new Promise((resolve, reject) => {
              GM_xmlhttpRequest({
                method: "GET",
                url: `${customUrl}/admin/list-cookies-by-host/${encodeURIComponent(
                  currentHost
                )}`,
                headers: {
                  "Content-Type": "application/json",
                  "X-Admin-Password": password,
                },
                responseType: "text", // Get raw text to handle JSON parsing manually
                timeout: 10000,
                onload: (res) => {
                  if (res.status >= 200 && res.status < 300) {
                    resolve(res);
                  } else {
                    reject({
                      status: res.status,
                      responseText: res.responseText,
                    });
                  }
                },
                onerror: (error) =>
                  reject({ status: 0, responseText: t("apiErrorNetwork") }),
                ontimeout: () =>
                  reject({ status: 0, responseText: t("apiErrorTimeout") }),
              });
            });

            const data = JSON.parse(response.responseText);
            console.log("Cloud response data:", data); // Debug log

            if (data.success && Array.isArray(data.cookies)) {
              data.cookies.forEach((cookie) => {
                // Avoid adding duplicates if ID already exists from local storage
                if (
                  !combinedCookies.some(
                    (c) => c.id === cookie.id && c.source === "cloud"
                  )
                ) {
                  console.log(`Adding cloud cookie: ${cookie.id}`); // Debug log
                  combinedCookies.push({
                    id: cookie.id,
                    source: "cloud",
                    // Store URL if provided by API, needed for context/potential future use
                    url: cookie.url || null,
                  });
                }
              });
            } else {
              throw new Error(
                data.message || "Failed to parse cloud cookie data"
              );
            }
          }
        } catch (error) {
          console.error("Error fetching cloud cookies:", error);
          cloudError = error; // Store error to display later
          // Handle password error specifically
          if (error.status === 401) {
            GM_setValue(STORAGE_KEYS.ADMIN_PASSWORD, ""); // Clear incorrect password
            cloudError = new Error(t("notificationInvalidPassword"));
            // Re-initialize to show password prompt again
            // Be careful not to cause infinite loop. Maybe just show error.
            // Let's just show the error message in the list for now.
          }
        }
      } else if (!customUrl && !loadOnlyLocal) {
        console.log("Custom URL not set, skipping cloud fetch.");
      }

      // 3. Render List
      console.log("Final combined cookies:", combinedCookies); // Debug log

      // Clear loading indicator
      const loadingIndicator = cookiesList.querySelector(
        ".cookie-share-loading"
      );
      if (loadingIndicator) loadingIndicator.remove();

      // Prepend cloud error if exists
      if (cloudError) {
        const errorDiv = document.createElement("div");
        errorDiv.className = "cookie-share-error";
        errorDiv.textContent = t("notificationLoadCloudFailed", {
          message: cloudError.message,
        });
        cookiesList.prepend(errorDiv);
      }

      if (combinedCookies.length === 0) {
        // If there was no cloud error, show empty message. If there was, the error is already shown.
        const hasErrors = cloudError || localError;
        const hasItems = cookiesList.querySelector(".cookie-share-item"); // Check if items were added despite errors
        if (!hasItems) {
          const emptyDiv = document.createElement("div");
          emptyDiv.className = "cookie-share-empty";
          if (loadOnlyLocal || (!customUrl && !cloudError)) {
            emptyDiv.textContent = t("listEmptyLocalOnly", {
              host: currentHost,
            });
          } else {
            emptyDiv.textContent = t("listEmpty", { host: currentHost });
          }
          cookiesList.appendChild(emptyDiv);
        }
      } else {
        // Ensure list container is empty before appending items (if errors were prepended)
        const existingItems = cookiesList.querySelectorAll(
          ".cookie-share-item, .cookie-share-empty"
        );
        existingItems.forEach((item) => item.remove());

        combinedCookies.forEach((cookie) => {
          const item = document.createElement("div");
          item.className = "cookie-share-item";
          const sourceText = t(
            cookie.source === "local" ? "sourceLocal" : "sourceCloud"
          );
          item.innerHTML = `
                   <span class="cookie-id">ID: ${
                     cookie.id
                   } (${sourceText})</span>
                   <div class="cookie-share-buttons">
                     <button class="cookie-share-receive" data-id="${
                       cookie.id
                     }" data-source="${cookie.source}">${t(
            "receiveButton"
          )}</button>
                     <button class="cookie-share-delete" data-id="${
                       cookie.id
                     }" data-source="${cookie.source}">${t(
            "deleteButton"
          )}</button>
                   </div>
                 `;
          cookiesList.appendChild(item);
        });

        this.attachButtonListeners(cookiesList); // Attach listeners after rendering
      }
    },

    attachButtonListeners(container) {
      // Receive button handler
      container.querySelectorAll(".cookie-share-receive").forEach((button) => {
        button.onclick = async () => {
          const cookieId = button.dataset.id;
          const source = button.dataset.source;
          const customUrl = GM_getValue(STORAGE_KEYS.CUSTOM_URL); // Needed for cloud receive
          const sourceText = t(
            source === "local" ? "sourceLocal" : "sourceCloud"
          );

          try {
            if (source === "local") {
              const localKey = `cookie_share_local_${cookieId}`;
              const rawData = await GM_getValue(localKey);
              if (!rawData) throw new Error(t("notificationLocalDataNotFound"));

              const cookieData = JSON.parse(rawData);
              if (!Array.isArray(cookieData.cookies))
                throw new Error(t("notificationLocalDataInvalid"));

              await cookieManager.clearAll(); // Clear existing cookies first

              let importedCount = 0;
              for (const cookie of cookieData.cookies) {
                if (cookie?.name && cookie?.value) {
                  await cookieManager.set(cookie);
                  importedCount++;
                }
              }
              if (importedCount === 0)
                throw new Error(t("notificationLocalImportFailed"));

              notification.show(
                t("notificationImportSuccess", { count: importedCount }),
                "success"
              );
              setTimeout(() => window.location.reload(), 500);
              this.hideCookieList();
            } else {
              // source === 'cloud'
              if (!customUrl) {
                notification.show(t("notificationNeedServerAddress"), "error");
                return;
              }
              const result = await api.receiveCookies(cookieId, customUrl);
              notification.show(
                result.message || t("notificationReceivedSuccess"),
                "success"
              );
              this.hideCookieList(); // Hide modal immediately
            }
          } catch (error) {
            notification.show(
              t("notificationReceiveFailed", {
                source: sourceText,
                message: error.message,
              }),
              "error"
            );
          }
        };
      });

      // Delete button handler
      container.querySelectorAll(".cookie-share-delete").forEach((button) => {
        button.onclick = async () => {
          const cookieId = button.dataset.id;
          const source = button.dataset.source;
          const sourceText = t(
            source === "local" ? "sourceLocal" : "sourceCloud"
          );

          if (await this.confirmDelete()) {
            // Use existing confirmDelete UI
            try {
              if (source === "local") {
                const localKey = `cookie_share_local_${cookieId}`;
                await GM_deleteValue(localKey);
                notification.show(t("notificationLocalDeleted"), "success");
                // Refresh the list by re-calling showCookieList which triggers initialization
                this.showCookieList(); // Re-initialize and show the list
              } else {
                // source === 'cloud'
                const customUrl = GM_getValue(STORAGE_KEYS.CUSTOM_URL);
                const password = GM_getValue(STORAGE_KEYS.ADMIN_PASSWORD);

                if (!customUrl || !password) {
                  notification.show(t("notificationNeedAdminCreds"), "error");
                  return;
                }

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
                    responseType: "text", // Get raw text
                    onload: (response) => {
                      try {
                        // Check for non-JSON success or failure messages if API behaves differently
                        if (
                          response.status === 200 ||
                          response.status === 204
                        ) {
                          // Assume success on 200/204, even without JSON body
                          // Attempt to parse JSON if available
                          let data = { success: true };
                          try {
                            if (response.responseText)
                              data = JSON.parse(response.responseText);
                          } catch (e) {
                            /* Ignore parsing error if body is not JSON */
                          }

                          if (data.success) {
                            resolve();
                          } else {
                            reject(
                              new Error(
                                data.message ||
                                  t("notificationServerDeleteFailed")
                              )
                            );
                          }
                        } else if (response.status === 401) {
                          GM_setValue(STORAGE_KEYS.ADMIN_PASSWORD, ""); // Clear bad password
                          reject(new Error(t("notificationAdminPermission")));
                        } else {
                          let errorMsg = "Failed to delete cookie";
                          try {
                            const errData = JSON.parse(response.responseText);
                            errorMsg =
                              errData.message ||
                              `服务器错误: ${response.status}`;
                          } catch (e) {
                            errorMsg = `服务器错误: ${response.status}`;
                          }
                          reject(new Error(errorMsg));
                        }
                      } catch (error) {
                        // Catch JSON parsing errors on success/failure cases
                        reject(
                          new Error(
                            t("notificationResponseError", {
                              message: error.message,
                            })
                          )
                        );
                      }
                    },
                    onerror: () =>
                      reject(new Error(t("notificationNetworkError"))),
                    ontimeout: () =>
                      reject(new Error(t("notificationRequestTimeout"))),
                  });
                });

                notification.show(t("notificationCloudDeleted"), "success");
                // Refresh the list
                this.showCookieList();
              }
            } catch (error) {
              const action =
                source === "local" ? t("sourceLocal") : t("sourceCloud");
              notification.show(
                t("notificationDeleteFailed", {
                  source: action,
                  message: error.message,
                }),
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
    detectLanguage(); // Call language detection first
    ui.injectStyles();
    ui.createFloatingButton();

    // Add fullscreen event listeners
    document.addEventListener("fullscreenchange", () =>
      fullscreenManager.handleFullscreenChange()
    );
    document.addEventListener("webkitfullscreenchange", () =>
      fullscreenManager.handleFullscreenChange()
    );

    // Add keyboard shortcuts
    const handleKeyboardShortcuts = (e) => {
      // Alt + Shift + L for cookie list
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        e.stopPropagation();
        const overlay = document.querySelector(".cookie-share-overlay");
        const modal = document.querySelector(".cookie-list-modal");
        if (overlay && modal) {
          ui.hideCookieList();
        } else {
          ui.showCookieList();
        }
        return false;
      }
      // Alt + Shift + C for cookie share panel
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        e.stopPropagation();
        const overlay = document.querySelector(".cookie-share-overlay");
        const modal = document.querySelector(
          ".cookie-share-modal:not(.cookie-list-modal)"
        );
        if (overlay && modal) {
          ui.hideModal();
        } else {
          ui.showModal();
        }
        return false;
      }
    };

    // Remove existing event listener if any
    document.removeEventListener("keydown", handleKeyboardShortcuts);
    // Add new event listener
    document.addEventListener("keydown", handleKeyboardShortcuts, {
      capture: true,
    });

    // Register menu command, click to show Cookie Share
    GM_registerMenuCommand(t("menuShowShare"), () => ui.showModal());
    GM_registerMenuCommand(t("menuShowList"), () => ui.showCookieList());
    GM_registerMenuCommand(t("menuSwitchLanguage"), switchLanguage); // Added
  }

  // Start the application
  init();

  // Function to handle manual language switching
  function switchLanguage() {
    const newLanguage =
      currentLanguage === LANGUAGES.EN ? LANGUAGES.ZH : LANGUAGES.EN;
    GM_setValue(STORAGE_KEYS.LANGUAGE_PREFERENCE, newLanguage);
    currentLanguage = newLanguage; // Update current session variable
    // Show notification - use the new language for the notification itself
    notification.show(t("menuSwitchLanguage"), "success");
    // Note: A page refresh is required for the UI elements to fully update.
  }
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
    background: rgba(255, 255, 255, 0.95) !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1) !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    color: #000000 !important;
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
    background: rgba(255, 255, 255, 0.95) !important;
    backdrop-filter: blur(10px) !important;
    -webkit-backdrop-filter: blur(10px) !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15) !important;
  }

  .cookie-share-container h1 {
    color: #000000 !important;
  }

  .cookie-share-container button {
    background: #91B3A7 !important;
    transition: all 0.3s ease !important;
    border: none !important;
    color: #FFFFFF !important;
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
    background: rgba(255, 255, 255, 0.95) !important;
    border: 1px solid rgba(145, 179, 167, 0.3) !important;
    transition: all 0.3s ease !important;
    color: #000000 !important;
  }

  .cookie-share-container input::placeholder {
    color: #666666 !important;
  }

  .cookie-share-container input:focus {
    border-color: #91B3A7 !important;
    box-shadow: 0 0 0 2px rgba(145, 179, 167, 0.2) !important;
    outline: none !important;
  }

  .cookie-share-item {
    background: rgba(255, 255, 255, 0.95) !important;
    border-radius: 8px !important;
    margin-bottom: 8px !important;
    border: 1px solid rgba(145, 179, 167, 0.2) !important;
    transition: all 0.3s ease !important;
    color: #000000 !important;
  }

  .cookie-share-item:hover {
    background: rgba(255, 255, 255, 0.98) !important;
    transform: translateY(-1px) !important;
  }

  .cookie-share-empty, 
  .cookie-share-error,
  .cookie-share-loading span {
    color: #000000 !important;
  }

  .cookie-share-floating-btn {
    backdrop-filter: blur(4px) !important;
    -webkit-backdrop-filter: blur(4px) !important;
    background: rgba(255, 255, 255, 0.95) !important;
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

  /* 调整危险操作按钮的颜色 */
  .cookie-share-container .clear-btn {
    background: #FF6B6B !important;
    color: #FFFFFF !important;
  }

  .cookie-share-container .clear-btn:hover {
    background: #FF5252 !important;
  }

  .cookie-share-container .cookie-share-delete {
    background: #FF6B6B !important;
    color: #FFFFFF !important;
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
    color: #FFFFFF !important;
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
