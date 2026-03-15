// ==UserScript==
// @name         Cookie Share
// @namespace    https://github.com/fangyuan99/cookie-share
// @version      0.3.0
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
    TRANSPORT_SECRET: "cookie_share_transport_secret",
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
  const isMacOS = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);

  function getShortcutLabel(actionKey) {
    const normalizedKey = actionKey.toUpperCase();
    return isMacOS
      ? `Command+Shift+${normalizedKey} / Option+Shift+${normalizedKey}`
      : `Alt+Shift+${normalizedKey}`;
  }

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
      placeholderTransportSecret: "Enter transport secret",

      // Settings
      settingsShowFloatingButton: `Show Floating Button (${getShortcutLabel("L")})`,
      settingsAutoHideFullscreen:
        "Auto Hide in Fullscreen (Not Available For Safari)",
      settingsSaveLocally:
        "Prefer Local Save ('Send' will only save locally if checked)",
      settingsConfigTransferTitle: "Import / Export Config",
      settingsConfigTransferHint:
        "Only userscript settings are included. Local cookie records are excluded.",
      settingsExportConfigButton: "Export Config",
      settingsImportConfigButton: "Import Config",

      // Menu Commands
      menuShowShare: `Show Cookie Share (${getShortcutLabel("C")})`,
      menuShowList: `Show Cookie List (${getShortcutLabel("L")})`,
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
      notificationNeedTransportSecret:
        "Cloud operations require a transport secret",
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
      notificationEncryptFailed: "Failed to encrypt payload",
      notificationDecryptFailed: "Failed to decrypt server response",
      notificationInvalidTransportSecret:
        "Invalid transport secret or corrupted payload",
      notificationConfigExported: "Config exported to the text box",
      notificationConfigCopied: "Config exported and copied to clipboard",
      notificationConfigCopyFailed: "Config exported, but clipboard copy failed",
      notificationConfigImported: "Config imported successfully",
      notificationConfigEmpty: "Please enter a Base64 config",
      notificationConfigInvalid: "Invalid config payload",
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
      placeholderTransportSecret: "输入传输密钥",

      // Settings
      settingsShowFloatingButton: `显示悬浮按钮 (${getShortcutLabel("L")})`,
      settingsAutoHideFullscreen: "全屏时自动隐藏 (Safari 不可用)",
      settingsSaveLocally: "优先本地保存 (勾选后'发送'将仅保存本地)", // Fixed quotes
      settingsConfigTransferTitle: "导入 / 导出配置",
      settingsConfigTransferHint:
        "仅包含脚本自身配置，不包含本地 Cookie 记录。",
      settingsExportConfigButton: "导出配置",
      settingsImportConfigButton: "导入配置",

      // Menu Commands
      menuShowShare: `显示 Cookie 分享面板 (${getShortcutLabel("C")})`,
      menuShowList: `显示 Cookie 列表 (${getShortcutLabel("L")})`,
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
      notificationNeedTransportSecret: "云端操作需要传输密钥",
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
      notificationEncryptFailed: "加密请求失败",
      notificationDecryptFailed: "解密服务器响应失败",
      notificationInvalidTransportSecret: "传输密钥错误或数据已损坏",
      notificationConfigExported: "配置已导出到输入框",
      notificationConfigCopied: "配置已导出并复制到剪贴板",
      notificationConfigCopyFailed: "配置已导出，但复制到剪贴板失败",
      notificationConfigImported: "配置导入成功",
      notificationConfigEmpty: "请输入 Base64 配置",
      notificationConfigInvalid: "配置内容无效",
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

  const CONFIG_NORMALIZERS = {
    [STORAGE_KEYS.CUSTOM_URL]: (value) =>
      typeof value === "string" ? value.replace(/\/+$/, "") : "",
    [STORAGE_KEYS.ADMIN_PASSWORD]: (value) =>
      typeof value === "string" ? value : "",
    [STORAGE_KEYS.TRANSPORT_SECRET]: (value) =>
      typeof value === "string" ? value : "",
    [STORAGE_KEYS.SHOW_FLOATING_BUTTON]: (value) =>
      typeof value === "boolean" ? value : true,
    [STORAGE_KEYS.AUTO_HIDE_FULLSCREEN]: (value) =>
      typeof value === "boolean" ? value : true,
    [STORAGE_KEYS.SAVE_LOCALLY]: (value) =>
      typeof value === "boolean" ? value : false,
    [STORAGE_KEYS.LANGUAGE_PREFERENCE]: (value) =>
      value === LANGUAGES.EN || value === LANGUAGES.ZH ? value : null,
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
              sameSite: utils.normalizeSameSiteFromBrowser(cookie.sameSite),
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
            sameSite: utils.normalizeSameSiteForSet(cookie.sameSite),
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
      const bytes = new Uint8Array(length);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (byte) =>
        chars.charAt(byte % chars.length)
      ).join("");
    },

    localizeServerMessage(message) {
      const mapping = {
        "Cookies saved successfully": t("notificationSentSuccess"),
        "Cookies saved successfully.": t("notificationSentSuccess"),
        "Cookies not found": t("notificationReceiveFailed", {
          source: t("sourceCloud"),
          message: t("apiErrorInvalidData"),
        }),
        "Cookies and URL updated successfully": "更新成功",
        "Data deleted successfully": t("notificationCloudDeleted"),
        "Import completed": "导入成功",
        Unauthorized: t("notificationAdminPermission"),
        "Invalid encrypted payload": t("notificationDecryptFailed"),
        "Transport secret mismatch or corrupted payload":
          t("notificationInvalidTransportSecret"),
      };
      return mapping[message] || message;
    },

    normalizeSameSiteFromBrowser(value) {
      if (typeof value !== "string") {
        return "lax";
      }

      const normalized = value.toLowerCase();
      if (
        normalized === "no_restriction" ||
        normalized === "none" ||
        normalized === "unspecified"
      ) {
        return "none";
      }
      if (normalized === "strict") {
        return "strict";
      }
      return "lax";
    },

    normalizeSameSiteForSet(value) {
      if (typeof value !== "string") {
        return undefined;
      }

      const normalized = value.toLowerCase();
      if (normalized === "none") {
        return "no_restriction";
      }
      if (normalized === "strict") {
        return "strict";
      }
      if (normalized === "lax") {
        return "lax";
      }
      return undefined;
    },

    encodeBase64(value) {
      const bytes = new TextEncoder().encode(value);
      let binary = "";
      for (const byte of bytes) {
        binary += String.fromCharCode(byte);
      }
      return btoa(binary);
    },

    decodeBase64(value) {
      const binary = atob(value.replace(/\s+/g, ""));
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return new TextDecoder().decode(bytes);
    },

    async copyToClipboard(value, inputElement = null) {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
      }

      const fallbackInput =
        inputElement ||
        Object.assign(document.createElement("textarea"), {
          value,
        });
      const shouldCleanup = !inputElement;

      if (shouldCleanup) {
        fallbackInput.style.position = "fixed";
        fallbackInput.style.opacity = "0";
        document.body.appendChild(fallbackInput);
      } else {
        fallbackInput.value = value;
      }

      fallbackInput.focus();
      fallbackInput.select();

      const copied = document.execCommand("copy");

      if (shouldCleanup) {
        fallbackInput.remove();
      }

      if (!copied) {
        throw new Error(t("notificationConfigCopyFailed"));
      }
    },
  };

  const configManager = {
    version: 1,
    exportKeys: Object.keys(CONFIG_NORMALIZERS),

    normalizeValue(storageKey, value) {
      const normalizer = CONFIG_NORMALIZERS[storageKey];
      return normalizer ? normalizer(value) : value;
    },

    collectConfig() {
      const values = {};
      this.exportKeys.forEach((storageKey) => {
        values[storageKey] = this.normalizeValue(
          storageKey,
          GM_getValue(storageKey, undefined)
        );
      });

      return {
        version: this.version,
        values,
      };
    },

    exportToBase64() {
      return utils.encodeBase64(JSON.stringify(this.collectConfig()));
    },

    async importFromBase64(encodedConfig) {
      const normalizedConfig = encodedConfig.trim();
      if (!normalizedConfig) {
        throw new Error(t("notificationConfigEmpty"));
      }

      let parsedConfig;
      try {
        parsedConfig = JSON.parse(utils.decodeBase64(normalizedConfig));
      } catch (error) {
        throw new Error(t("notificationConfigInvalid"));
      }

      if (!parsedConfig || typeof parsedConfig !== "object") {
        throw new Error(t("notificationConfigInvalid"));
      }

      const values =
        parsedConfig.values && typeof parsedConfig.values === "object"
          ? parsedConfig.values
          : parsedConfig;

      let appliedCount = 0;
      for (const storageKey of this.exportKeys) {
        if (!Object.prototype.hasOwnProperty.call(values, storageKey)) {
          continue;
        }

        await GM_setValue(
          storageKey,
          this.normalizeValue(storageKey, values[storageKey])
        );
        appliedCount += 1;
      }

      if (appliedCount === 0) {
        throw new Error(t("notificationConfigInvalid"));
      }
    },
  };

  const transportCrypto = {
    version: 1,
    iterations: 310000,
    encoder: new TextEncoder(),
    decoder: new TextDecoder(),

    base64UrlEncode(bytes) {
      let binary = "";
      for (const value of bytes) {
        binary += String.fromCharCode(value);
      }
      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    },

    base64UrlDecode(value) {
      const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes;
    },

    isEnvelope(value) {
      return Boolean(
        value &&
          typeof value === "object" &&
          value.version === this.version &&
          typeof value.salt === "string" &&
          typeof value.iv === "string" &&
          typeof value.payload === "string"
      );
    },

    async deriveKey(secret, salt) {
      const material = await crypto.subtle.importKey(
        "raw",
        this.encoder.encode(secret),
        "PBKDF2",
        false,
        ["deriveKey"]
      );

      return await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          hash: "SHA-256",
          salt,
          iterations: this.iterations,
        },
        material,
        {
          name: "AES-GCM",
          length: 256,
        },
        false,
        ["encrypt", "decrypt"]
      );
    },

    async encrypt(secret, payload) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await this.deriveKey(secret, salt);
      const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          key,
          this.encoder.encode(JSON.stringify(payload))
        )
      );

      return {
        version: this.version,
        salt: this.base64UrlEncode(salt),
        iv: this.base64UrlEncode(iv),
        payload: this.base64UrlEncode(ciphertext),
      };
    },

    async decrypt(secret, envelope) {
      if (!this.isEnvelope(envelope)) {
        throw new Error(t("notificationDecryptFailed"));
      }

      try {
        const key = await this.deriveKey(
          secret,
          this.base64UrlDecode(envelope.salt)
        );
        const plaintext = await crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: this.base64UrlDecode(envelope.iv),
          },
          key,
          this.base64UrlDecode(envelope.payload)
        );
        return JSON.parse(this.decoder.decode(plaintext));
      } catch {
        throw new Error(t("notificationInvalidTransportSecret"));
      }
    },
  };

  // ===================== API Operations =====================
  const api = {
    async requestEncryptedJson({ method, url, body, transportSecret, headers }) {
      if (!transportSecret) {
        throw new Error(t("notificationNeedTransportSecret"));
      }

      const requestHeaders = {
        Accept: "application/json",
        ...(headers || {}),
      };

      if (body !== undefined) {
        requestHeaders["Content-Type"] = "application/json";
      }

      const requestData =
        body === undefined
          ? undefined
          : JSON.stringify(await transportCrypto.encrypt(transportSecret, body));

      const response = await new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method,
          url,
          headers: requestHeaders,
          data: requestData,
          responseType: "text",
          timeout: 10000,
          onload: resolve,
          onerror: () => reject(new Error(t("apiErrorNetwork"))),
          ontimeout: () => reject(new Error(t("apiErrorTimeout"))),
        });
      });

      let payload = {};
      try {
        payload = response.responseText ? JSON.parse(response.responseText) : {};
      } catch {
        throw new Error(t("notificationDecryptFailed"));
      }

      if (response.status < 200 || response.status >= 300) {
        if (transportCrypto.isEnvelope(payload)) {
          const decryptedError = await transportCrypto.decrypt(
            transportSecret,
            payload
          );
          throw new Error(
            utils.localizeServerMessage(
              decryptedError.message || decryptedError.error || ""
            ) ||
              t("apiErrorServerReturn", {
                status: response.status || "?",
                text: response.responseText || "",
              })
          );
        }

        throw new Error(
          utils.localizeServerMessage(payload.message || payload.error || "") ||
            t("apiErrorServerReturn", {
              status: response.status || "?",
              text: response.responseText || "",
            })
        );
      }

      return await transportCrypto.decrypt(transportSecret, payload);
    },

    async sendCookies(cookieId, customUrl, transportSecret) {
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

        return await this.requestEncryptedJson({
          method: "POST",
          url: `${formattedUrl}/send-cookies`,
          body: data,
          transportSecret,
        });
      } catch (error) {
        console.error("Error sending cookies:", error);
        throw error;
      }
    },

    async receiveCookies(cookieId, customUrl, transportSecret) {
      try {
        const formattedUrl = utils.validateUrl(customUrl);
        const response = await this.requestEncryptedJson({
          method: "GET",
          url: `${formattedUrl}/receive-cookies/${cookieId}`,
          transportSecret,
        });

        if (!response?.success || !Array.isArray(response.cookies)) {
          throw new Error(t("apiErrorInvalidData"));
        }

        await cookieManager.clearAll();

        let importedCount = 0;
        for (const cookie of response.cookies) {
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

        .github-link img,
        .github-link svg {
          width: 20px !important;
          height: 20px !important;
          opacity: 0.7 !important;
          transition: all 0.3s ease !important;
        }

        .github-link:hover img,
        .github-link:hover svg {
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

    refreshFloatingButton() {
      const existingBtn = document.querySelector(".cookie-share-floating-btn");
      if (existingBtn) {
        existingBtn.remove();
      }
      state.floatingButton = null;

      if (GM_getValue(STORAGE_KEYS.SHOW_FLOATING_BUTTON, true)) {
        this.createFloatingButton();
      } else {
        fullscreenManager.updateFloatingButtonVisibility();
      }
    },

    createConfigTransferView(context = {}) {
      const { idInput, options = {} } = context;
      const transferContainer = document.createElement("details");
      transferContainer.className = "cookie-share-config-transfer";
      transferContainer.open = Boolean(options.openConfigTransfer);
      transferContainer.style.cssText = `
                margin-bottom: 16px;
                padding: 12px 16px;
                background: #f5f5f5;
                border-radius: 8px;
            `;

      const summary = document.createElement("summary");
      summary.textContent = t("settingsConfigTransferTitle");
      summary.style.cssText = `
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                color: #333;
                user-select: none;
            `;

      const hint = document.createElement("div");
      hint.textContent = t("settingsConfigTransferHint");
      hint.style.cssText = `
                margin: 12px 0 8px;
                font-size: 12px;
                line-height: 1.5;
                color: #666;
            `;

      const transferInput = document.createElement("textarea");
      transferInput.className = "cookie-share-config-textarea";
      transferInput.value = options.configTransferValue || "";
      transferInput.spellcheck = false;
      transferInput.style.cssText = `
                width: 100%;
                min-height: 96px;
                padding: 12px;
                border: 1px solid #ddd;
                border-radius: 8px;
                resize: vertical;
                box-sizing: border-box;
                font-size: 13px;
                line-height: 1.5;
                font-family: Consolas, Monaco, monospace;
                background: rgba(255, 255, 255, 0.95);
                color: #333;
            `;

      const buttonRow = document.createElement("div");
      buttonRow.style.cssText = `
                display: flex;
                gap: 12px;
                margin-top: 12px;
            `;

      const exportBtn = document.createElement("button");
      exportBtn.className = "generate-btn";
      exportBtn.textContent = t("settingsExportConfigButton");
      exportBtn.style.width = "auto";
      exportBtn.style.padding = "0 16px";
      exportBtn.onclick = async () => {
        const exportedConfig = configManager.exportToBase64();
        transferInput.value = exportedConfig;
        transferContainer.open = true;

        try {
          await utils.copyToClipboard(exportedConfig, transferInput);
          notification.show(t("notificationConfigCopied"), "success");
        } catch (error) {
          notification.show(error.message, "error");
        }
      };

      const importBtn = document.createElement("button");
      importBtn.className = "generate-btn";
      importBtn.textContent = t("settingsImportConfigButton");
      importBtn.style.width = "auto";
      importBtn.style.padding = "0 16px";
      importBtn.onclick = async () => {
        try {
          await configManager.importFromBase64(transferInput.value);
          detectLanguage();
          this.refreshFloatingButton();
          this.showModal({
            cookieId: idInput?.value || "",
            openConfigTransfer: true,
            configTransferValue: transferInput.value.trim(),
          });
          notification.show(t("notificationConfigImported"), "success");
        } catch (error) {
          notification.show(error.message, "error");
        }
      };

      buttonRow.appendChild(exportBtn);
      buttonRow.appendChild(importBtn);

      transferContainer.appendChild(summary);
      transferContainer.appendChild(hint);
      transferContainer.appendChild(transferInput);
      transferContainer.appendChild(buttonRow);

      return transferContainer;
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
        () => {
          ui.refreshFloatingButton();
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

    createMainView(options = {}) {
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

      const githubIcon = document.createElement("span");
      githubIcon.setAttribute("aria-label", "GitHub");
      githubIcon.innerHTML = `
        <svg viewBox="0 0 1049 1024" xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true">
          <path d="M524.979332 0C234.676191 0 0 234.676191 0 524.979332c0 232.068678 150.366597 428.501342 358.967656 498.035028 26.075132 5.215026 35.636014-11.299224 35.636014-25.205961 0-12.168395-0.869171-53.888607-0.869171-97.347161-146.020741 31.290159-176.441729-62.580318-176.441729-62.580318-23.467619-60.841976-58.234462-76.487055-58.234463-76.487055-47.804409-32.15933 3.476684-32.15933 3.476685-32.15933 53.019436 3.476684 80.83291 53.888607 80.83291 53.888607 46.935238 79.963739 122.553122 57.365291 152.97411 43.458554 4.345855-33.897672 18.252593-57.365291 33.028501-70.402857-116.468925-12.168395-239.022047-57.365291-239.022047-259.012982 0-57.365291 20.860106-104.300529 53.888607-140.805715-5.215026-13.037566-23.467619-66.926173 5.215027-139.067372 0 0 44.327725-13.906737 144.282399 53.888607 41.720212-11.299224 86.917108-17.383422 131.244833-17.383422s89.524621 6.084198 131.244833 17.383422C756.178839 203.386032 800.506564 217.29277 800.506564 217.29277c28.682646 72.1412 10.430053 126.029806 5.215026 139.067372 33.897672 36.505185 53.888607 83.440424 53.888607 140.805715 0 201.64769-122.553122 245.975415-239.891218 259.012982 19.121764 16.514251 35.636014 47.804409 35.636015 97.347161 0 70.402857-0.869171 126.898978-0.869172 144.282399 0 13.906737 9.560882 30.420988 35.636015 25.205961 208.601059-69.533686 358.967656-265.96635 358.967655-498.035028C1049.958663 234.676191 814.413301 0 524.979332 0z" fill="#191717"></path>
          <path d="M199.040177 753.571326c-0.869171 2.607513-5.215026 3.476684-8.691711 1.738342s-6.084198-5.215026-4.345855-7.82254c0.869171-2.607513 5.215026-3.476684 8.691711-1.738342s5.215026 5.215026 4.345855 7.82254z m-6.953369-4.345856M219.900283 777.038945c-2.607513 2.607513-7.82254 0.869171-10.430053-2.607514-3.476684-3.476684-4.345855-8.691711-1.738342-11.299224 2.607513-2.607513 6.953369-0.869171 10.430053 2.607514 3.476684 4.345855 4.345855 9.560882 1.738342 11.299224z m-5.215026-5.215027M240.760389 807.459932c-3.476684 2.607513-8.691711 0-11.299224-4.345855-3.476684-4.345855-3.476684-10.430053 0-12.168395 3.476684-2.607513 8.691711 0 11.299224 4.345855 3.476684 4.345855 3.476684 9.560882 0 12.168395z m0 0M269.443034 837.011749c-2.607513 3.476684-8.691711 2.607513-13.906737-1.738342-4.345855-4.345855-6.084198-10.430053-2.607513-13.037566 2.607513-3.476684 8.691711-2.607513 13.906737 1.738342 4.345855 3.476684 5.215026 9.560882 2.607513 13.037566z m0 0M308.555733 853.526c-0.869171 4.345855-6.953369 6.084198-13.037566 4.345855-6.084198-1.738342-9.560882-6.953369-8.691711-10.430053 0.869171-4.345855 6.953369-6.084198 13.037566-4.345855 6.084198 1.738342 9.560882 6.084198 8.691711 10.430053z m0 0M351.145116 857.002684c0 4.345855-5.215026 7.82254-11.299224 7.82254-6.084198 0-11.299224-3.476684-11.299224-7.82254s5.215026-7.82254 11.299224-7.82254c6.084198 0 11.299224 3.476684 11.299224 7.82254z m0 0M391.126986 850.049315c0.869171 4.345855-3.476684 8.691711-9.560882 9.560882-6.084198 0.869171-11.299224-1.738342-12.168395-6.084197-0.869171-4.345855 3.476684-8.691711 9.560881-9.560882 6.084198-0.869171 11.299224 1.738342 12.168396 6.084197z m0 0" fill="#191717"></path>
        </svg>
      `;

      // ID 输入容器
      const idContainer = document.createElement("div");
      idContainer.className = "id-input-container";

      const idInput = document.createElement("input");
      idInput.type = "text";
      idInput.className = "cookie-id-input";
      idInput.placeholder = t("placeholderCookieId");
      idInput.value = options.cookieId || "";

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

      const transportContainer = document.createElement("div");
      transportContainer.className = "id-input-container";

      const transportInput = document.createElement("input");
      transportInput.type = "password";
      transportInput.id = "cookieShareTransportSecret";
      transportInput.className = "cookie-id-input";
      transportInput.placeholder = t("placeholderTransportSecret");
      transportInput.value = GM_getValue(STORAGE_KEYS.TRANSPORT_SECRET, "");
      transportInput.addEventListener("input", function () {
        GM_setValue(STORAGE_KEYS.TRANSPORT_SECRET, this.value);
      });

      const toggleTransportBtn = document.createElement("button");
      toggleTransportBtn.className = "generate-btn";
      toggleTransportBtn.style.width = "120px";
      toggleTransportBtn.innerHTML = eyeOpenSvg;
      toggleTransportBtn.onclick = () => {
        if (transportInput.type === "password") {
          transportInput.type = "text";
          toggleTransportBtn.innerHTML = eyeClosedSvg;
        } else {
          transportInput.type = "password";
          toggleTransportBtn.innerHTML = eyeOpenSvg;
        }
      };

      transportContainer.appendChild(transportInput);
      transportContainer.appendChild(toggleTransportBtn);

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
      githubLink.appendChild(githubIcon);
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
      container.appendChild(transportContainer);
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
          const transportSecret = transportInput.value.trim();

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
            if (!transportSecret) {
              notification.show(t("notificationNeedTransportSecret"), "error");
              return;
            }
            const result = await api.sendCookies(
              cookieId,
              serverUrl,
              transportSecret
            );
            notification.show(
              result.success ? t("notificationSentSuccess") : utils.localizeServerMessage(result.message || ""),
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

          if (!transportInput.value.trim()) {
            notification.show(t("notificationNeedTransportSecret"), "error");
            return;
          }

          const result = await api.receiveCookies(
            idInput.value.trim(),
            serverInput.value.trim(),
            transportInput.value.trim()
          );
          notification.show(t("notificationReceivedSuccess"), "success");
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
      const configTransferView = this.createConfigTransferView({
        idInput,
        options,
      });
      container.appendChild(configTransferView);
    },

    showModal(options = {}) {
      // Ensure any existing Cookie Share elements are removed
      const existingOverlay = document.querySelector(".cookie-share-overlay");
      if (existingOverlay) {
        existingOverlay.remove();
      }

      // Create and display the Cookie Share modal
      this.createMainView(options);
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

        const transportSecret = GM_getValue(STORAGE_KEYS.TRANSPORT_SECRET);

        await this.loadCombinedCookieList(
          cookiesList,
          customUrl,
          transportSecret
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
      transportSecret,
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
        try {
          if (!transportSecret) {
            cloudError = new Error(t("notificationNeedTransportSecret"));
          } else {
            const data = await api.requestEncryptedJson({
              method: "GET",
              url: `${customUrl}/list-cookies-by-host/${encodeURIComponent(
                currentHost
              )}`,
              transportSecret,
            });

            if (data.success && Array.isArray(data.cookies)) {
              data.cookies.forEach((cookie) => {
                // Avoid adding duplicates if ID already exists from local storage
                if (
                  !combinedCookies.some(
                    (c) => c.id === cookie.id && c.source === "cloud"
                  )
                ) {
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
        }
      }

      // 3. Render List
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
          const transportSecret = GM_getValue(STORAGE_KEYS.TRANSPORT_SECRET);
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
              if (!transportSecret) {
                notification.show(
                  t("notificationNeedTransportSecret"),
                  "error"
                );
                return;
              }
              const result = await api.receiveCookies(
                cookieId,
                customUrl,
                transportSecret
              );
              notification.show(t("notificationReceivedSuccess"), "success");
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
                const transportSecret = GM_getValue(
                  STORAGE_KEYS.TRANSPORT_SECRET
                );

                if (!customUrl) {
                  notification.show(t("notificationNeedServerAddress"), "error");
                  return;
                }

                if (!transportSecret) {
                  notification.show(
                    t("notificationNeedTransportSecret"),
                    "error"
                  );
                  return;
                }

                try {
                  await api.requestEncryptedJson({
                    method: "DELETE",
                    url: `${customUrl}/delete?key=${encodeURIComponent(
                      cookieId
                    )}`,
                    transportSecret,
                  });
                } catch (error) {
                  throw error;
                }

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
    const matchesShortcut = (event, actionKey) => {
      const key = event.key.toLowerCase();
      const expectedKey = actionKey.toLowerCase();
      if (key !== expectedKey || !event.shiftKey) {
        return false;
      }

      const hasMacShortcut =
        isMacOS && !event.ctrlKey && (event.metaKey || event.altKey);
      const hasDefaultShortcut =
        !isMacOS && !event.ctrlKey && !event.metaKey && event.altKey;

      return hasMacShortcut || hasDefaultShortcut;
    };

    const handleKeyboardShortcuts = (e) => {
      // Alt + Shift + L on Windows/Linux, Command/Option + Shift + L on macOS
      if (matchesShortcut(e, "l")) {
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
      // Alt + Shift + C on Windows/Linux, Command/Option + Shift + C on macOS
      if (matchesShortcut(e, "c")) {
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
