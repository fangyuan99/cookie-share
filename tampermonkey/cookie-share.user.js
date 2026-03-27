// ==UserScript==
// @name         Cookie Share
// @namespace    https://github.com/fangyuan99/cookie-share
// @version      0.5.2
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
    LANGUAGE_PREFERENCE: "cookie_share_language_preference",
    THEME: "cookie_share_theme",
  };

  const THEMES = { DARK: "dark", CLAUDE: "claude" };

  // ===================== i18n =====================
  const LANGUAGES = {
    EN: "en",
    ZH: "zh",
  };

  let currentLanguage = LANGUAGES.EN;
  const isMacOS = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);

  function getShortcutLabel(actionKey) {
    const normalizedKey = actionKey.toUpperCase();
    return isMacOS
      ? `Command+Shift+${normalizedKey} / Option+Shift+${normalizedKey}`
      : `Alt+Shift+${normalizedKey}`;
  }

  function detectLanguage() {
    const savedLang = GM_getValue(STORAGE_KEYS.LANGUAGE_PREFERENCE, null);
    if (savedLang === LANGUAGES.EN || savedLang === LANGUAGES.ZH) {
      currentLanguage = savedLang;
      return;
    }
    const browserLang = navigator.language || navigator.userLanguage;
    if (browserLang && browserLang.toLowerCase().startsWith(LANGUAGES.ZH)) {
      currentLanguage = LANGUAGES.ZH;
    } else {
      currentLanguage = LANGUAGES.EN;
    }
  }

  const translations = {
    en: {
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
      clearAllCookiesButton: "Clear page's Cookies",
      addAccountButton: "Add Account",
      addAccountConfirmTitle: "Add Account",
      addAccountConfirmMessage: "This will send the current cookies, clear all cookies on this page, and reload the page so you can log in with a new account. Continue?",
      confirmButton: "Confirm",
      sourceLocal: "Local",
      sourceCloud: "Cloud",
      loadingCookies: "Loading cookies...",
      failed: "failed",
      placeholderCookieId: "Cookie ID",
      placeholderServerAddress: "Server Address (e.g., https://example.com)",
      placeholderAdminPassword: "Enter admin password",
      placeholderTransportSecret: "Enter transport secret",
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
      settingsTheme: "Theme",
      themeDark: "Dark",
      themeClaude: "Claude",
      menuShowShare: `Show Cookie Share (${getShortcutLabel("C")})`,
      menuShowList: `Show Cookie List (${getShortcutLabel("L")})`,
      menuSwitchLanguage: "Switch Language (Refresh Required)",
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
      notificationConfigCopyFailed:
        "Config exported, but clipboard copy failed",
      notificationConfigImported: "Config imported successfully",
      notificationConfigEmpty: "Please enter a Base64 config",
      notificationConfigInvalid: "Invalid config payload",
      confirmDeleteMessage: "Are you sure you want to delete this cookie?",
      listEmpty: "No local or cloud cookies found related to {{host}}",
      listEmptyLocalOnly: "No local cookies found related to {{host}}",
      apiErrorNoCookiesToSend: "No cookies to send on the current page",
      apiErrorServerReturn: "Server returned error: {{status}}\n{{text}}",
      apiErrorNetwork: "Network request failed",
      apiErrorTimeout: "Request timeout",
      apiErrorInvalidData: "Invalid data format",
      apiErrorNoImport: "No cookies were successfully imported",
    },
    zh: {
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
      clearAllCookiesButton: "清除本页 Cookie",
      addAccountButton: "新增账号",
      addAccountConfirmTitle: "新增账号",
      addAccountConfirmMessage: "此操作会发送当前 Cookie，清空本页所有 Cookie 并刷新页面，以便您登录新账号。是否继续？",
      confirmButton: "确认",
      sourceLocal: "本地",
      sourceCloud: "云端",
      loadingCookies: "正在加载 Cookie...",
      failed: "失败",
      placeholderCookieId: "Cookie ID",
      placeholderServerAddress: "服务器地址 (例如 https://example.com)",
      placeholderAdminPassword: "输入管理密码",
      placeholderTransportSecret: "输入传输密钥",
      settingsShowFloatingButton: `显示悬浮按钮 (${getShortcutLabel("L")})`,
      settingsAutoHideFullscreen: "全屏时自动隐藏 (Safari 不可用)",
      settingsSaveLocally: "优先本地保存 (勾选后'发送'将仅保存本地)",
      settingsConfigTransferTitle: "导入 / 导出配置",
      settingsConfigTransferHint:
        "仅包含脚本自身配置，不包含本地 Cookie 记录。",
      settingsExportConfigButton: "导出配置",
      settingsImportConfigButton: "导入配置",
      settingsTheme: "主题",
      themeDark: "Dark",
      themeClaude: "Claude",
      menuShowShare: `显示 Cookie 分享面板 (${getShortcutLabel("C")})`,
      menuShowList: `显示 Cookie 列表 (${getShortcutLabel("L")})`,
      menuSwitchLanguage: "切换语言 (需刷新页面)",
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
      apiErrorNoCookiesToSend: "当前页面无 Cookie 可发送",
      apiErrorServerReturn: "服务器返回错误: {{status}}\n{{text}}",
      apiErrorNetwork: "网络请求失败",
      apiErrorTimeout: "请求超时",
      apiErrorInvalidData: "无效的数据格式",
      apiErrorNoImport: "未能成功导入任何 Cookie",
    },
  };

  function t(key, replacements = {}) {
    let translation =
      translations[currentLanguage]?.[key] || translations[LANGUAGES.EN]?.[key];
    if (translation === undefined) {
      console.warn(`Missing translation for key: ${key}`);
      return key;
    }
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
    [STORAGE_KEYS.THEME]: (value) =>
      value === THEMES.DARK || value === THEMES.CLAUDE ? value : THEMES.CLAUDE,
  };

  // ===================== Shadow DOM =====================
  let shadowHost = null;
  let shadowRoot = null;
  let shadowWrapper = null;
  let shadowReady = false;
  let stylesInjected = false;

  function ensureShadowDOM() {
    if (shadowReady && shadowHost.isConnected) return true;
    if (!document.body) return false;
    try {
      if (!shadowHost) {
        shadowHost = document.createElement("div");
        shadowHost.id = "cookie-share-root";
        shadowHost.style.cssText = "all: initial !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 0 !important; height: 0 !important; overflow: visible !important; z-index: 2147483645 !important; pointer-events: none !important;";
        shadowRoot = shadowHost.attachShadow({ mode: "open" });
        shadowWrapper = document.createElement("div");
        shadowWrapper.id = "cs-wrapper";
        shadowRoot.appendChild(shadowWrapper);
      }
      if (!shadowHost.isConnected) {
        document.body.appendChild(shadowHost);
      }
      if (!stylesInjected) {
        ui.injectStyles();
        stylesInjected = true;
      }
      shadowReady = true;
      return true;
    } catch (e) {
      console.error("[Cookie Share] Shadow DOM init failed:", e);
      return false;
    }
  }

  function getShadowRoot() {
    ensureShadowDOM();
    return shadowRoot;
  }

  function getShadowWrapper() {
    ensureShadowDOM();
    return shadowWrapper;
  }

  // ===================== Theme Manager =====================
  const themeManager = {
    current: THEMES.CLAUDE,

    init() {
      this.current = GM_getValue(STORAGE_KEYS.THEME, THEMES.CLAUDE);
      if (this.current !== THEMES.DARK && this.current !== THEMES.CLAUDE) {
        this.current = THEMES.CLAUDE;
      }
      this.apply();
    },

    apply() {
      if (shadowWrapper) {
        shadowWrapper.setAttribute("data-cs-theme", this.current);
      }
    },

    setTheme(theme) {
      if (theme !== THEMES.DARK && theme !== THEMES.CLAUDE) return;
      this.current = theme;
      GM_setValue(STORAGE_KEYS.THEME, theme);
      this.apply();
    },

    toggle() {
      this.setTheme(this.current === THEMES.DARK ? THEMES.CLAUDE : THEMES.DARK);
    },
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
        true,
      );
      const autoHideFullscreen = GM_getValue(
        STORAGE_KEYS.AUTO_HIDE_FULLSCREEN,
        true,
      );
      const shouldHide = state.isFullscreen && autoHideFullscreen;
      state.floatingButton.style.display =
        !shouldHide && showFloatingButton ? "flex" : "none";
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
            })),
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
          resolve,
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
              { name: cookie.name, domain: cookie.domain, path: cookie.path },
              () => {
                deletedCount++;
                if (deletedCount === totalCookies) {
                  resolve();
                }
              },
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
        chars.charAt(byte % chars.length),
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
        "Transport secret mismatch or corrupted payload": t(
          "notificationInvalidTransportSecret",
        ),
      };
      return mapping[message] || message;
    },

    normalizeSameSiteFromBrowser(value) {
      if (typeof value !== "string") return "lax";
      const normalized = value.toLowerCase();
      if (
        normalized === "no_restriction" ||
        normalized === "none" ||
        normalized === "unspecified"
      ) {
        return "none";
      }
      if (normalized === "strict") return "strict";
      return "lax";
    },

    normalizeSameSiteForSet(value) {
      if (typeof value !== "string") return undefined;
      const normalized = value.toLowerCase();
      if (normalized === "none") return "no_restriction";
      if (normalized === "strict") return "strict";
      if (normalized === "lax") return "lax";
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
        Object.assign(document.createElement("textarea"), { value });
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

  // ===================== Config Manager =====================
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
          GM_getValue(storageKey, undefined),
        );
      });
      return { version: this.version, values };
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
          this.normalizeValue(storageKey, values[storageKey]),
        );
        appliedCount += 1;
      }
      if (appliedCount === 0) {
        throw new Error(t("notificationConfigInvalid"));
      }
    },
  };

  // ===================== Transport Crypto =====================
  const transportCrypto = {
    version: 1,
    iterations: 100000,
    encoder: new TextEncoder(),
    decoder: new TextDecoder(),

    base64UrlEncode(bytes) {
      let binary = "";
      for (const value of bytes) {
        binary += String.fromCharCode(value);
      }
      return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
    },

    base64UrlDecode(value) {
      const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
      const padded =
        normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
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
        typeof value.payload === "string",
      );
    },

    async deriveKey(secret, salt) {
      const material = await crypto.subtle.importKey(
        "raw",
        this.encoder.encode(secret),
        "PBKDF2",
        false,
        ["deriveKey"],
      );
      return await crypto.subtle.deriveKey(
        { name: "PBKDF2", hash: "SHA-256", salt, iterations: this.iterations },
        material,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
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
          this.encoder.encode(JSON.stringify(payload)),
        ),
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
          this.base64UrlDecode(envelope.salt),
        );
        const plaintext = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: this.base64UrlDecode(envelope.iv) },
          key,
          this.base64UrlDecode(envelope.payload),
        );
        return JSON.parse(this.decoder.decode(plaintext));
      } catch {
        throw new Error(t("notificationInvalidTransportSecret"));
      }
    },
  };

  // ===================== API Operations =====================
  const api = {
    async requestEncryptedJson({
      method,
      url,
      body,
      transportSecret,
      headers,
    }) {
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
          : JSON.stringify(
              await transportCrypto.encrypt(transportSecret, body),
            );
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
        payload = response.responseText
          ? JSON.parse(response.responseText)
          : {};
      } catch {
        throw new Error(t("notificationDecryptFailed"));
      }
      if (response.status < 200 || response.status >= 300) {
        if (transportCrypto.isEnvelope(payload)) {
          const decryptedError = await transportCrypto.decrypt(
            transportSecret,
            payload,
          );
          throw new Error(
            utils.localizeServerMessage(
              decryptedError.message || decryptedError.error || "",
            ) ||
              t("apiErrorServerReturn", {
                status: response.status || "?",
                text: response.responseText || "",
              }),
          );
        }
        throw new Error(
          utils.localizeServerMessage(payload.message || payload.error || "") ||
            t("apiErrorServerReturn", {
              status: response.status || "?",
              text: response.responseText || "",
            }),
        );
      }
      return await transportCrypto.decrypt(transportSecret, payload);
    },

    async sendCookies(cookieId, customUrl, transportSecret) {
      try {
        const cookies = await cookieManager.getAll();
        if (!cookies.length) {
          return { success: false, message: t("notificationNoCookiesToSave") };
        }
        const formattedUrl = utils.validateUrl(customUrl);
        const data = { id: cookieId, url: window.location.href, cookies };
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
        return { success: true, message: t("notificationReceivedSuccess") };
      } catch (error) {
        console.error("Error receiving cookies:", error);
        throw error;
      }
    },
  };

  // ===================== Notification =====================
  const notification = {
    show(message, type = "success") {
      const root = getShadowWrapper();
      if (!root) return;
      const existingNotification = root.querySelector(
        ".cookie-share-notification",
      );
      if (existingNotification) {
        existingNotification.remove();
      }
      const notificationEl = document.createElement("div");
      notificationEl.className = `cookie-share-notification ${type}`;
      notificationEl.textContent = message;
      root.appendChild(notificationEl);
      notificationEl.offsetHeight;
      notificationEl.classList.add("show");
      setTimeout(() => {
        notificationEl.classList.remove("show");
        setTimeout(() => notificationEl.remove(), 300);
      }, 3000);
    },
  };

  // ===================== UI Components =====================
  const ui = {
    confirmDelete() {
      return new Promise((resolve) => {
        const root = getShadowWrapper();
        if (!root) { resolve(false); return; }
        const container = document.createElement("div");
        container.style.cssText = `
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--cs-overlay); backdrop-filter: blur(4px);
          z-index: 2147483647; pointer-events: auto;
        `;

        const dialog = document.createElement("div");
        dialog.style.cssText = `
          background: var(--cs-surface); padding: 24px;
          border-radius: var(--cs-radius-lg); text-align: center;
          min-width: 320px; border: var(--cs-card-border);
          box-shadow: var(--cs-shadow);
          font-family: -apple-system, system-ui, 'Segoe UI', sans-serif;
          color: var(--cs-text);
        `;

        dialog.innerHTML = `
          <h3 style="margin: 0 0 16px 0; color: var(--cs-heading); font-size: 18px; font-weight: 600;">${t("confirmDeleteTitle")}</h3>
          <p style="margin: 0 0 24px 0; color: var(--cs-text-secondary);">${t("confirmDeleteMessage")}</p>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button id="cancelBtn" class="cs-btn cs-btn-secondary" style="min-width: 100px; margin: 0 !important;">${t("cancelButton")}</button>
            <button id="confirmBtn" class="cs-btn cs-btn-danger" style="min-width: 100px; margin: 0 !important;">${t("deleteButton")}</button>
          </div>
        `;

        container.appendChild(dialog);
        root.appendChild(container);

        dialog.querySelector("#cancelBtn").onclick = () => {
          container.remove();
          resolve(false);
        };
        dialog.querySelector("#confirmBtn").onclick = () => {
          container.remove();
          resolve(true);
        };
        container.onclick = (e) => {
          if (e.target === container) {
            container.remove();
            resolve(false);
          }
        };
      });
    },

    confirmAddAccount() {
      return new Promise((resolve) => {
        const root = getShadowWrapper();
        if (!root) { resolve(false); return; }
        const container = document.createElement("div");
        container.style.cssText = `
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--cs-overlay); backdrop-filter: blur(4px);
          z-index: 2147483647; pointer-events: auto;
        `;

        const dialog = document.createElement("div");
        dialog.style.cssText = `
          background: var(--cs-surface); padding: 24px;
          border-radius: var(--cs-radius-lg); text-align: center;
          min-width: 320px; border: var(--cs-card-border);
          box-shadow: var(--cs-shadow);
          font-family: -apple-system, system-ui, 'Segoe UI', sans-serif;
          color: var(--cs-text);
        `;

        dialog.innerHTML = `
          <h3 style="margin: 0 0 16px 0; color: var(--cs-heading); font-size: 18px; font-weight: 600;">${t("addAccountConfirmTitle")}</h3>
          <p style="margin: 0 0 24px 0; color: var(--cs-text-secondary);">${t("addAccountConfirmMessage")}</p>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button id="cancelBtn" class="cs-btn cs-btn-secondary" style="min-width: 100px; margin: 0 !important;">${t("cancelButton")}</button>
            <button id="confirmBtn" class="cs-btn cs-btn-danger" style="min-width: 100px; margin: 0 !important;">${t("confirmButton")}</button>
          </div>
        `;

        container.appendChild(dialog);
        root.appendChild(container);

        dialog.querySelector("#cancelBtn").onclick = () => {
          container.remove();
          resolve(false);
        };
        dialog.querySelector("#confirmBtn").onclick = () => {
          container.remove();
          resolve(true);
        };
        container.onclick = (e) => {
          if (e.target === container) {
            container.remove();
            resolve(false);
          }
        };

        dialog.style.opacity = "0";
        dialog.style.transform = "scale(0.95)";
        dialog.style.transition = "all 0.2s ease";
        dialog.offsetHeight;
        dialog.style.opacity = "1";
        dialog.style.transform = "scale(1)";
      });
    },

    injectStyles() {
      const styleEl = document.createElement("style");
      styleEl.textContent = `
        /* ===== Base Reset ===== */
        *, *::before, *::after {
          box-sizing: border-box;
        }
        #cs-wrapper {
          font-family: -apple-system, system-ui, 'Segoe UI', sans-serif;
          line-height: 1.5;
          color: var(--cs-text);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* ===== Dark Theme (Apple/Linear inspired) ===== */
        #cs-wrapper[data-cs-theme="dark"] {
          --cs-overlay: rgba(0, 0, 0, 0.55);
          --cs-surface: #1C1C1E;
          --cs-surface-secondary: #2C2C2E;
          --cs-surface-hover: #3A3A3C;
          --cs-card-border: 1px solid rgba(255, 255, 255, 0.08);
          --cs-shadow: 0 8px 40px rgba(0, 0, 0, 0.45);
          --cs-heading: #F5F5F7;
          --cs-text: #E5E5EA;
          --cs-text-secondary: #98989D;
          --cs-text-muted: #636366;
          --cs-input-bg: #2C2C2E;
          --cs-input-border: #3A3A3C;
          --cs-input-focus-border: #7C6AEF;
          --cs-input-focus-shadow: 0 0 0 2px rgba(124, 106, 239, 0.25);
          --cs-accent: #7C6AEF;
          --cs-accent-hover: #6857D9;
          --cs-danger: #FF453A;
          --cs-danger-hover: #E5342A;
          --cs-success-border: #30D158;
          --cs-error-border: #FF453A;
          --cs-btn-primary-bg: #7C6AEF;
          --cs-btn-primary-text: #FFF;
          --cs-btn-primary-hover: #6857D9;
          --cs-btn-secondary-bg: #2C2C2E;
          --cs-btn-secondary-text: #E5E5EA;
          --cs-btn-secondary-hover: #3A3A3C;
          --cs-btn-danger-bg: #FF453A;
          --cs-btn-danger-text: #FFF;
          --cs-btn-danger-hover: #E5342A;
          --cs-toggle-bg: #3A3A3C;
          --cs-toggle-active: #7C6AEF;
          --cs-radius: 10px;
          --cs-radius-lg: 14px;
          --cs-divider: rgba(255, 255, 255, 0.08);
          --cs-spinner-track: #3A3A3C;
          --cs-spinner-head: #7C6AEF;
          --cs-notif-bg: rgba(28, 28, 30, 0.97);
          --cs-notif-border: 1px solid rgba(255, 255, 255, 0.1);
          --cs-float-bg: rgba(28, 28, 30, 0.92);
          --cs-float-border: 1px solid rgba(255, 255, 255, 0.1);
          --cs-float-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
          --cs-theme-btn-active: #7C6AEF;
          --cs-theme-btn-active-text: #FFF;
          --cs-theme-btn-inactive: #2C2C2E;
          --cs-theme-btn-inactive-text: #98989D;
        }

        /* ===== Claude Theme ===== */
        #cs-wrapper[data-cs-theme="claude"] {
          --cs-overlay: rgba(0, 0, 0, 0.25);
          --cs-surface: #FFFFFF;
          --cs-surface-secondary: #F5F3EE;
          --cs-surface-hover: #FAF8F5;
          --cs-card-border: 1px solid #E5E0DA;
          --cs-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
          --cs-heading: #1A1915;
          --cs-text: #2D2B28;
          --cs-text-secondary: #6B6966;
          --cs-text-muted: #9A9790;
          --cs-input-bg: #FFFFFF;
          --cs-input-border: #D8D3CC;
          --cs-input-focus-border: #C96442;
          --cs-input-focus-shadow: 0 0 0 2px rgba(201, 100, 66, 0.15);
          --cs-accent: #C96442;
          --cs-accent-hover: #B5593A;
          --cs-danger: #D84A3A;
          --cs-danger-hover: #C03E2F;
          --cs-success-border: #2D8C5A;
          --cs-error-border: #D84A3A;
          --cs-btn-primary-bg: #C96442;
          --cs-btn-primary-text: #FFF;
          --cs-btn-primary-hover: #B5593A;
          --cs-btn-secondary-bg: #EDE9E3;
          --cs-btn-secondary-text: #2D2B28;
          --cs-btn-secondary-hover: #E0DCD5;
          --cs-btn-danger-bg: #D84A3A;
          --cs-btn-danger-text: #FFF;
          --cs-btn-danger-hover: #C03E2F;
          --cs-toggle-bg: #D8D3CC;
          --cs-toggle-active: #C96442;
          --cs-radius: 12px;
          --cs-radius-lg: 16px;
          --cs-divider: #E5E0DA;
          --cs-spinner-track: #E5E0DA;
          --cs-spinner-head: #C96442;
          --cs-notif-bg: rgba(255, 255, 255, 0.97);
          --cs-notif-border: 1px solid #E5E0DA;
          --cs-float-bg: rgba(255, 255, 255, 0.95);
          --cs-float-border: 1px solid #E5E0DA;
          --cs-float-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
          --cs-theme-btn-active: #C96442;
          --cs-theme-btn-active-text: #FFF;
          --cs-theme-btn-inactive: #EDE9E3;
          --cs-theme-btn-inactive-text: #6B6966;
        }

        /* ===== Overlay ===== */
        .cookie-share-overlay {
          position: fixed !important;
          top: 0 !important; left: 0 !important;
          right: 0 !important; bottom: 0 !important;
          background: var(--cs-overlay) !important;
          backdrop-filter: blur(4px) !important;
          -webkit-backdrop-filter: blur(4px) !important;
          z-index: 2147483646 !important;
          display: none !important;
          pointer-events: auto !important;
        }
        .cookie-share-overlay.visible {
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
        }

        /* ===== Modal ===== */
        .cookie-share-modal {
          background: var(--cs-surface) !important;
          border-radius: var(--cs-radius-lg) !important;
          border: var(--cs-card-border) !important;
          box-shadow: var(--cs-shadow) !important;
          width: min(480px, 90vw) !important;
          max-height: 90vh !important;
          overflow-y: auto !important;
          position: relative !important;
          display: none !important;
          z-index: 2147483647 !important;
          padding: 0 !important;
        }
        .cookie-share-modal.visible {
          display: block !important;
        }
        .cookie-list-modal {
          width: min(560px, 90vw) !important;
        }

        /* ===== Container ===== */
        .cookie-share-container {
          font-family: -apple-system, system-ui, 'Segoe UI', sans-serif !important;
          padding: 28px !important;
          color: var(--cs-text) !important;
        }

        /* ===== Close Button ===== */
        .cookie-share-container .close-btn {
          position: absolute !important;
          right: 16px !important; top: 16px !important;
          width: 28px !important; height: 28px !important;
          background: none !important; border: none !important;
          font-size: 20px !important;
          color: var(--cs-text-muted) !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important; justify-content: center !important;
          padding: 0 !important;
          border-radius: 6px !important;
          transition: all 0.15s ease !important;
          line-height: 1 !important;
        }
        .cookie-share-container .close-btn:hover {
          color: var(--cs-text) !important;
          background: var(--cs-surface-secondary) !important;
        }

        /* ===== Settings Button ===== */
        .cookie-share-container .settings-btn {
          position: absolute !important;
          right: 48px !important; top: 16px !important;
          width: 28px !important; height: 28px !important;
          background: none !important; border: none !important;
          color: var(--cs-text-muted) !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important; justify-content: center !important;
          padding: 0 !important;
          border-radius: 6px !important;
          transition: all 0.15s ease !important;
          line-height: 1 !important;
          margin: 0 !important;
        }
        .cookie-share-container .settings-btn:hover,
        .cookie-share-container .settings-btn.active {
          color: var(--cs-text) !important;
          background: var(--cs-surface-secondary) !important;
        }

        /* ===== Settings Panel (hidden by default) ===== */
        .cookie-share-settings-panel {
          display: none !important;
        }
        .cookie-share-settings-panel.visible {
          display: block !important;
        }

        /* ===== Title ===== */
        .cookie-share-container .title-container {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 10px !important;
          margin-bottom: 24px !important;
        }
        .cookie-share-container h1 {
          font-size: 22px !important;
          font-weight: 700 !important;
          margin: 0 !important;
          color: var(--cs-heading) !important;
          letter-spacing: -0.02em !important;
        }
        .github-link {
          display: flex !important;
          align-items: center !important;
          text-decoration: none !important;
          opacity: 0.5 !important;
          transition: opacity 0.15s ease !important;
        }
        .github-link:hover {
          opacity: 1 !important;
        }
        .github-link svg path {
          fill: var(--cs-text) !important;
        }

        /* ===== Inputs ===== */
        .cookie-share-container input[type="text"],
        .cookie-share-container input[type="password"],
        .cookie-share-container .cookie-id-input {
          width: 100% !important;
          height: 40px !important;
          padding: 0 12px !important;
          border: 1px solid var(--cs-input-border) !important;
          border-radius: var(--cs-radius) !important;
          font-size: 14px !important;
          background: var(--cs-input-bg) !important;
          color: var(--cs-text) !important;
          outline: none !important;
          transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
          box-sizing: border-box !important;
          font-family: inherit !important;
          margin: 0 !important;
        }
        .cookie-share-container input:focus {
          border-color: var(--cs-input-focus-border) !important;
          box-shadow: var(--cs-input-focus-shadow) !important;
        }
        .cookie-share-container input::placeholder {
          color: var(--cs-text-muted) !important;
        }

        /* ===== ID Input Row ===== */
        .cookie-share-container .id-input-container {
          display: flex !important;
          gap: 8px !important;
          align-items: center !important;
          margin-bottom: 10px !important;
        }
        .cookie-share-container .id-input-container input {
          flex: 1 !important;
        }

        /* ===== Buttons ===== */
        .cookie-share-container button {
          font-family: inherit !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          cursor: pointer !important;
          border: none !important;
          border-radius: var(--cs-radius) !important;
          transition: all 0.15s ease !important;
          line-height: 1 !important;
        }

        .cs-btn {
          height: 40px !important;
          padding: 0 16px !important;
          border-radius: var(--cs-radius) !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          cursor: pointer !important;
          border: none !important;
          transition: all 0.15s ease !important;
        }
        .cs-btn-primary {
          background: var(--cs-btn-primary-bg) !important;
          color: var(--cs-btn-primary-text) !important;
        }
        .cs-btn-primary:hover {
          background: var(--cs-btn-primary-hover) !important;
        }
        .cs-btn-secondary {
          background: var(--cs-btn-secondary-bg) !important;
          color: var(--cs-btn-secondary-text) !important;
        }
        .cs-btn-secondary:hover {
          background: var(--cs-btn-secondary-hover) !important;
        }
        .cs-btn-danger {
          background: var(--cs-btn-danger-bg) !important;
          color: var(--cs-btn-danger-text) !important;
        }
        .cs-btn-danger:hover {
          background: var(--cs-btn-danger-hover) !important;
        }
        .cs-btn-accent {
          background: var(--cs-accent) !important;
          color: #FFF !important;
        }
        .cs-btn-accent:hover {
          background: var(--cs-accent-hover) !important;
        }

        .cookie-share-container .generate-btn {
          width: auto !important;
          min-width: 90px !important;
          height: 40px !important;
          flex-shrink: 0 !important;
          background: var(--cs-btn-secondary-bg) !important;
          color: var(--cs-btn-secondary-text) !important;
          margin: 0 !important;
          padding: 0 14px !important;
          white-space: nowrap !important;
        }
        .cookie-share-container .generate-btn:hover {
          background: var(--cs-btn-secondary-hover) !important;
        }

        .cookie-share-container .action-buttons {
          display: flex !important;
          gap: 8px !important;
          margin-bottom: 10px !important;
        }
        .cookie-share-container .action-buttons button {
          margin: 0 !important;
        }
        .cookie-share-container .action-btn {
          flex: 1 !important;
          height: 40px !important;
          background: var(--cs-accent) !important;
          color: #FFF !important;
        }
        .cookie-share-container .action-btn:hover {
          background: var(--cs-accent-hover) !important;
        }

        .cookie-share-container .bottom-buttons {
          display: flex !important;
          gap: 8px !important;
          margin-bottom: 0 !important;
        }
        .cookie-share-container .bottom-buttons button {
          margin: 0 !important;
        }
        .cookie-share-container .add-account-btn {
          flex: 1 !important;
          height: 40px !important;
          background: var(--cs-btn-primary-bg) !important;
          color: var(--cs-btn-primary-text) !important;
        }
        .cookie-share-container .add-account-btn:hover {
          background: var(--cs-btn-primary-hover) !important;
        }
        .cookie-share-container .clear-btn {
          flex: 1 !important;
          height: 40px !important;
          background: var(--cs-btn-danger-bg) !important;
          color: var(--cs-btn-danger-text) !important;
        }
        .cookie-share-container .clear-btn:hover {
          background: var(--cs-btn-danger-hover) !important;
        }

        /* ===== Settings ===== */
        .cookie-share-settings {
          margin-top: 14px !important;
          padding: 14px !important;
          background: var(--cs-surface-secondary) !important;
          border-radius: var(--cs-radius) !important;
          border: var(--cs-card-border) !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 12px !important;
        }
        .cs-setting-row {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          width: 100% !important;
        }
        .cs-setting-label {
          font-size: 13px !important;
          color: var(--cs-text) !important;
          user-select: none !important;
        }
        .cs-toggle {
          position: relative !important;
          display: inline-block !important;
          width: 36px !important;
          height: 20px !important;
          flex-shrink: 0 !important;
          margin-left: 12px !important;
        }
        .cs-toggle input {
          opacity: 0 !important;
          width: 0 !important; height: 0 !important;
          position: absolute !important;
        }
        .cs-toggle-slider {
          position: absolute !important;
          cursor: pointer !important;
          top: 0 !important; left: 0 !important;
          right: 0 !important; bottom: 0 !important;
          background-color: var(--cs-toggle-bg) !important;
          transition: background-color 0.2s ease !important;
          border-radius: 20px !important;
        }
        .cs-toggle-knob {
          position: absolute !important;
          height: 16px !important; width: 16px !important;
          left: 2px !important; bottom: 2px !important;
          background-color: white !important;
          transition: transform 0.2s ease !important;
          border-radius: 50% !important;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2) !important;
        }
        .cs-toggle input:checked + .cs-toggle-slider {
          background-color: var(--cs-toggle-active) !important;
        }
        .cs-toggle input:checked + .cs-toggle-slider .cs-toggle-knob {
          transform: translateX(16px) !important;
        }

        /* ===== Theme Selector ===== */
        .cs-theme-selector {
          display: flex !important;
          gap: 6px !important;
        }
        .cs-theme-btn {
          padding: 4px 12px !important;
          border-radius: 6px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          border: none !important;
          transition: all 0.15s ease !important;
          background: var(--cs-theme-btn-inactive) !important;
          color: var(--cs-theme-btn-inactive-text) !important;
          height: auto !important;
          width: auto !important;
          min-width: auto !important;
          margin: 0 !important;
          line-height: 1.5 !important;
        }
        .cs-theme-btn.active {
          background: var(--cs-theme-btn-active) !important;
          color: var(--cs-theme-btn-active-text) !important;
        }
        .cs-theme-btn:hover:not(.active) {
          background: var(--cs-btn-secondary-hover) !important;
        }

        /* ===== Config Transfer ===== */
        .cookie-share-config-transfer {
          margin-top: 14px !important;
          padding: 14px !important;
          background: var(--cs-surface-secondary) !important;
          border-radius: var(--cs-radius) !important;
          border: var(--cs-card-border) !important;
        }
        .cookie-share-config-transfer summary {
          cursor: pointer !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          color: var(--cs-text) !important;
          user-select: none !important;
        }
        .cookie-share-config-textarea {
          width: 100% !important;
          min-height: 80px !important;
          padding: 10px !important;
          border: 1px solid var(--cs-input-border) !important;
          border-radius: var(--cs-radius) !important;
          resize: vertical !important;
          box-sizing: border-box !important;
          font-size: 12px !important;
          line-height: 1.5 !important;
          font-family: 'SF Mono', Consolas, Monaco, monospace !important;
          background: var(--cs-input-bg) !important;
          color: var(--cs-text) !important;
        }

        /* ===== Cookie List ===== */
        .cookie-list-container {
          margin-top: 16px !important;
          max-height: 400px !important;
          overflow-y: auto !important;
          margin-bottom: 14px !important;
        }
        .cookie-share-item {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          padding: 10px 12px !important;
          background: var(--cs-surface-secondary) !important;
          border: 1px solid var(--cs-divider) !important;
          border-radius: var(--cs-radius) !important;
          margin-bottom: 6px !important;
          transition: background 0.15s ease !important;
          color: var(--cs-text) !important;
        }
        .cookie-share-item:hover {
          background: var(--cs-surface-hover) !important;
        }
        .cookie-share-buttons {
          display: flex !important;
          gap: 6px !important;
        }
        .cookie-share-receive,
        .cookie-share-delete {
          padding: 5px 10px !important;
          border-radius: 6px !important;
          border: none !important;
          cursor: pointer !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          transition: all 0.15s ease !important;
          height: auto !important;
          width: auto !important;
          min-width: auto !important;
          margin: 0 !important;
        }
        .cookie-share-receive {
          background: var(--cs-accent) !important;
          color: #FFF !important;
        }
        .cookie-share-receive:hover {
          background: var(--cs-accent-hover) !important;
        }
        .cookie-share-delete {
          background: var(--cs-btn-danger-bg) !important;
          color: var(--cs-btn-danger-text) !important;
        }
        .cookie-share-delete:hover {
          background: var(--cs-btn-danger-hover) !important;
        }
        .cookie-share-error {
          color: var(--cs-danger) !important;
          padding: 12px !important;
          text-align: center !important;
          font-size: 13px !important;
        }
        .cookie-share-empty {
          color: var(--cs-text-muted) !important;
          padding: 12px !important;
          text-align: center !important;
          font-size: 13px !important;
        }
        .cookie-share-loading {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 20px !important;
          gap: 10px !important;
          color: var(--cs-text-secondary) !important;
        }
        .cookie-share-spinner {
          width: 18px !important; height: 18px !important;
          border: 2px solid var(--cs-spinner-track) !important;
          border-top: 2px solid var(--cs-spinner-head) !important;
          border-radius: 50% !important;
          animation: cs-spin 0.8s linear infinite !important;
        }

        /* ===== Floating Button ===== */
        .cookie-share-floating-btn {
          position: fixed !important;
          bottom: 20px !important; left: 20px !important;
          width: 36px !important; height: 36px !important;
          background: var(--cs-float-bg) !important;
          border: var(--cs-float-border) !important;
          border-radius: 10px !important;
          cursor: pointer !important;
          z-index: 2147483645 !important;
          transition: transform 0.15s ease, box-shadow 0.15s ease !important;
          box-shadow: var(--cs-float-shadow) !important;
          padding: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          backdrop-filter: blur(8px) !important;
          -webkit-backdrop-filter: blur(8px) !important;
          pointer-events: auto !important;
        }
        .cookie-share-floating-btn:hover {
          transform: scale(1.1) !important;
        }
        .cookie-share-floating-btn svg {
          width: 20px !important; height: 20px !important;
        }
        .cookie-share-floating-btn svg path {
          fill: var(--cs-accent) !important;
        }
        .cookie-share-floating-btn svg circle {
          fill: var(--cs-text-secondary) !important;
        }

        /* ===== Notification ===== */
        .cookie-share-notification {
          position: fixed !important;
          bottom: 24px !important; right: 24px !important;
          padding: 14px 20px !important;
          border-radius: var(--cs-radius) !important;
          background: var(--cs-notif-bg) !important;
          border: var(--cs-notif-border) !important;
          box-shadow: var(--cs-shadow) !important;
          color: var(--cs-text) !important;
          font-family: -apple-system, system-ui, sans-serif !important;
          font-size: 13px !important;
          transform: translateY(150%) !important;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          z-index: 2147483647 !important;
          backdrop-filter: blur(8px) !important;
          -webkit-backdrop-filter: blur(8px) !important;
          max-width: 360px !important;
          pointer-events: auto !important;
        }
        .cookie-share-notification.show {
          transform: translateY(0) !important;
        }
        .cookie-share-notification.success {
          border-left: 3px solid var(--cs-success-border) !important;
        }
        .cookie-share-notification.error {
          border-left: 3px solid var(--cs-error-border) !important;
        }

        /* ===== Animations ===== */
        @keyframes cs-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* ===== Responsive ===== */
        @media screen and (max-width: 480px) {
          .cookie-share-container {
            padding: 20px !important;
          }
          .cookie-share-container .action-buttons {
            flex-direction: column !important;
          }
        }
      `;
      shadowRoot.appendChild(styleEl);
    },

    createFloatingButton() {
      const showFloatingButton = GM_getValue(
        STORAGE_KEYS.SHOW_FLOATING_BUTTON,
        true,
      );
      if (!showFloatingButton) return;

      const cookieSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path d="M21.598 13.789c-1.646-.583-2.76-2.145-2.76-3.891 0-.284-.1-.516-.316-.715-.184-.15-.466-.217-.699-.183-1.397.2-2.728-.2-3.743-1.015-1.015-.816-1.73-2.045-1.847-3.476-.017-.25-.167-.483-.383-.633-.217-.133-.483-.167-.732-.067-2.262.815-4.391-.616-5.239-2.562-.167-.366-.549-.566-.949-.482-3.193.715-6.07 2.72-8.031 5.248C-6.804 11.66-6.354 19.82.366 26.54c5.538 5.53 14.48 5.53 20.002 0 2.562-2.562 4.257-6.22 4.257-10.11-.033-.55-.05-.915-.566-1.098z"/>
          <circle cx="10" cy="12" r="1.5"/>
          <circle cx="16" cy="9" r="1.5"/>
          <circle cx="14" cy="15" r="1.5"/>
        </svg>
      `;

      const floatingBtn = document.createElement("button");
      floatingBtn.innerHTML = cookieSvg;
      floatingBtn.className = "cookie-share-floating-btn";
      floatingBtn.onclick = () => this.showCookieList();
      getShadowWrapper().appendChild(floatingBtn);
      state.floatingButton = floatingBtn;
      fullscreenManager.updateFloatingButtonVisibility();
    },

    refreshFloatingButton() {
      const existingBtn = getShadowWrapper()?.querySelector(".cookie-share-floating-btn");
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

      const summary = document.createElement("summary");
      summary.textContent = t("settingsConfigTransferTitle");

      const hint = document.createElement("div");
      hint.textContent = t("settingsConfigTransferHint");
      hint.style.cssText = `
        margin: 10px 0 8px; font-size: 12px;
        line-height: 1.5; color: var(--cs-text-muted);
      `;

      const transferInput = document.createElement("textarea");
      transferInput.className = "cookie-share-config-textarea";
      transferInput.value = options.configTransferValue || "";
      transferInput.spellcheck = false;

      const buttonRow = document.createElement("div");
      buttonRow.style.cssText = "display: flex; gap: 8px; margin-top: 10px;";

      const exportBtn = document.createElement("button");
      exportBtn.className = "generate-btn";
      exportBtn.textContent = t("settingsExportConfigButton");
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
      importBtn.onclick = async () => {
        try {
          await configManager.importFromBase64(transferInput.value);
          detectLanguage();
          themeManager.init();
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
      settingsContainer.className = "cookie-share-settings";

      const createToggle = (
        labelTextKey,
        storageKey,
        onChange,
        defaultValue = true,
      ) => {
        const row = document.createElement("div");
        row.className = "cs-setting-row";

        const label = document.createElement("span");
        label.className = "cs-setting-label";
        label.textContent = t(labelTextKey);

        const toggle = document.createElement("label");
        toggle.className = "cs-toggle";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = GM_getValue(storageKey, defaultValue);

        const slider = document.createElement("span");
        slider.className = "cs-toggle-slider";
        const knob = document.createElement("span");
        knob.className = "cs-toggle-knob";
        slider.appendChild(knob);

        input.addEventListener("change", () => {
          GM_setValue(storageKey, input.checked);
          if (onChange) onChange(input.checked);
        });

        toggle.appendChild(input);
        toggle.appendChild(slider);
        row.appendChild(label);
        row.appendChild(toggle);
        return row;
      };

      // Theme selector
      const themeRow = document.createElement("div");
      themeRow.className = "cs-setting-row";
      const themeLabel = document.createElement("span");
      themeLabel.className = "cs-setting-label";
      themeLabel.textContent = t("settingsTheme");
      const themeSelector = document.createElement("div");
      themeSelector.className = "cs-theme-selector";

      const createThemeBtn = (theme, label) => {
        const btn = document.createElement("button");
        btn.className = `cs-theme-btn${themeManager.current === theme ? " active" : ""}`;
        btn.textContent = label;
        btn.onclick = () => {
          themeManager.setTheme(theme);
          themeSelector.querySelectorAll(".cs-theme-btn").forEach((b) => {
            b.classList.toggle("active", b.dataset.theme === theme);
          });
        };
        btn.dataset.theme = theme;
        return btn;
      };

      themeSelector.appendChild(
        createThemeBtn(THEMES.CLAUDE, `✦ ${t("themeClaude")}`),
      );
      themeSelector.appendChild(
        createThemeBtn(THEMES.DARK, `● ${t("themeDark")}`),
      );
      themeRow.appendChild(themeLabel);
      themeRow.appendChild(themeSelector);

      settingsContainer.appendChild(themeRow);
      settingsContainer.appendChild(
        createToggle(
          "settingsShowFloatingButton",
          STORAGE_KEYS.SHOW_FLOATING_BUTTON,
          () => {
            ui.refreshFloatingButton();
          },
        ),
      );
      settingsContainer.appendChild(
        createToggle(
          "settingsAutoHideFullscreen",
          STORAGE_KEYS.AUTO_HIDE_FULLSCREEN,
          () => {
            fullscreenManager.updateFloatingButtonVisibility();
          },
        ),
      );
      settingsContainer.appendChild(
        createToggle(
          "settingsSaveLocally",
          STORAGE_KEYS.SAVE_LOCALLY,
          null,
          false,
        ),
      );

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

      const container = document.createElement("div");
      container.className = "cookie-share-container";

      // Close button
      const closeBtn = document.createElement("button");
      closeBtn.className = "close-btn";
      closeBtn.textContent = t("closeButton");
      closeBtn.onclick = () => ui.hideModal();

      // Settings gear button
      const settingsBtn = document.createElement("button");
      settingsBtn.className = "settings-btn";
      settingsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
      settingsBtn.onclick = () => {
        const panel = container.querySelector(".cookie-share-settings-panel");
        if (panel) {
          panel.classList.toggle("visible");
          settingsBtn.classList.toggle("active");
        }
      };

      // Title container with GitHub icon inline
      const titleContainer = document.createElement("div");
      titleContainer.className = "title-container";

      const title = document.createElement("h1");
      title.textContent = t("cookieShareTitle");

      const githubLink = document.createElement("a");
      githubLink.href = "https://github.com/fangyuan99/cookie-share";
      githubLink.target = "_blank";
      githubLink.className = "github-link";
      githubLink.innerHTML = `
        <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" width="18" height="18" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
        </svg>
      `;

      titleContainer.appendChild(title);
      titleContainer.appendChild(githubLink);

      // ID input
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

      // Server URL input
      const serverContainer = document.createElement("div");
      serverContainer.className = "id-input-container";

      const serverInput = document.createElement("input");
      serverInput.type = "text";
      serverInput.className = "cookie-id-input";
      serverInput.placeholder = t("placeholderServerAddress");
      serverInput.value = GM_getValue(STORAGE_KEYS.CUSTOM_URL, "");

      const showListBtn = document.createElement("button");
      showListBtn.className = "generate-btn";
      showListBtn.textContent = t("showListButton");
      showListBtn.onclick = () => ui.showCookieList();

      serverContainer.appendChild(serverInput);
      serverContainer.appendChild(showListBtn);

      // Transport secret input
      const eyeOpenSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" style="fill: currentColor;"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;
      const eyeClosedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" style="fill: currentColor;"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>`;

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

      // Action buttons
      const actionButtons = document.createElement("div");
      actionButtons.className = "action-buttons";

      const sendBtn = document.createElement("button");
      sendBtn.className = "action-btn send-btn";
      sendBtn.textContent = t("sendCookieButton");

      const receiveBtn = document.createElement("button");
      receiveBtn.className = "action-btn receive-btn";
      receiveBtn.textContent = t("receiveCookieButton");

      const bottomButtons = document.createElement("div");
      bottomButtons.className = "bottom-buttons";

      const addAccountBtn = document.createElement("button");
      addAccountBtn.className = "add-account-btn";
      addAccountBtn.textContent = t("addAccountButton");

      const clearBtn = document.createElement("button");
      clearBtn.className = "clear-btn";
      clearBtn.textContent = t("clearAllCookiesButton");

      bottomButtons.appendChild(addAccountBtn);
      bottomButtons.appendChild(clearBtn);

      // Assemble DOM
      idContainer.appendChild(idInput);
      idContainer.appendChild(generateBtn);
      actionButtons.appendChild(sendBtn);
      actionButtons.appendChild(receiveBtn);

      container.appendChild(closeBtn);
      container.appendChild(settingsBtn);
      container.appendChild(titleContainer);
      container.appendChild(idContainer);
      container.appendChild(serverContainer);
      container.appendChild(transportContainer);
      container.appendChild(actionButtons);
      container.appendChild(bottomButtons);

      // Settings panel (hidden by default, toggled by gear button)
      const settingsPanel = document.createElement("div");
      settingsPanel.className = "cookie-share-settings-panel";

      modal.appendChild(container);
      overlay.appendChild(modal);
      getShadowWrapper().appendChild(overlay);

      // Event listeners
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
            const cookies = await cookieManager.getAll();
            if (!cookies.length) {
              notification.show(t("notificationNoCookiesToSave"), "error");
              return;
            }
            const data = { id: cookieId, url: window.location.href, cookies };
            const localKey = `cookie_share_local_${data.id}`;
            await GM_setValue(localKey, JSON.stringify(data));
            notification.show(t("notificationSavedLocally"), "success");
          } else {
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
              transportSecret,
            );
            notification.show(
              result.success
                ? t("notificationSentSuccess")
                : utils.localizeServerMessage(result.message || ""),
              result.success ? "success" : "error",
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
            "error",
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
          await api.receiveCookies(
            idInput.value.trim(),
            serverInput.value.trim(),
            transportInput.value.trim(),
          );
          notification.show(t("notificationReceivedSuccess"), "success");
        } catch (error) {
          let errorMessage = error.message;
          if (error.message === "Request failed")
            errorMessage = t("apiErrorNetwork");
          else if (error.message === "Request timeout")
            errorMessage = t("apiErrorTimeout");
          else if (error.message === "Invalid data format")
            errorMessage = t("apiErrorInvalidData");
          else if (error.message === "No cookies were successfully imported")
            errorMessage = t("apiErrorNoImport");
          notification.show(
            t("notificationReceiveFailed", {
              source: t("sourceCloud"),
              message: errorMessage,
            }),
            "error",
          );
        }
      };

      addAccountBtn.onclick = async () => {
        if (!(await this.confirmAddAccount())) {
          return;
        }
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
            const cookies = await cookieManager.getAll();
            if (!cookies.length) {
              notification.show(t("notificationNoCookiesToSave"), "error");
              return;
            }
            const data = { id: cookieId, url: window.location.href, cookies };
            const localKey = `cookie_share_local_${data.id}`;
            await GM_setValue(localKey, JSON.stringify(data));
          } else {
            if (!serverUrl) {
              notification.show(t("notificationEnterServer"), "error");
              return;
            }
            if (!transportSecret) {
              notification.show(t("notificationNeedTransportSecret"), "error");
              return;
            }
            const result = await api.sendCookies(cookieId, serverUrl, transportSecret);
            if (!result.success) {
              notification.show(
                utils.localizeServerMessage(result.message || ""),
                "error",
              );
              return;
            }
          }
          await cookieManager.clearAll();
          notification.show(t("notificationClearedSuccess"), "success");
          setTimeout(() => window.location.reload(), 500);
        } catch (error) {
          let errorMessage = error.message;
          if (error.message.includes("No cookies to send")) {
            errorMessage = t("apiErrorNoCookiesToSend");
          } else if (error.message === "Network request failed") {
            errorMessage = t("apiErrorNetwork");
          } else if (error.message === "Request timeout") {
            errorMessage = t("apiErrorTimeout");
          }
          notification.show(errorMessage, "error");
        }
      };

      clearBtn.onclick = async () => {
        if (await this.confirmDelete()) {
          await cookieManager.clearAll();
          notification.show(t("notificationClearedSuccess"), "success");
          setTimeout(() => window.location.reload(), 500);
        }
      };

      serverInput.addEventListener("input", () => {
        let url = serverInput.value.trim().replace(/\/+$/, "");
        GM_setValue(STORAGE_KEYS.CUSTOM_URL, url);
      });
      serverInput.addEventListener("blur", () => {
        let url = serverInput.value.trim().replace(/\/+$/, "");
        serverInput.value = url;
        GM_setValue(STORAGE_KEYS.CUSTOM_URL, url);
      });

      ui.createSettingsView(settingsPanel);
      const configTransferView = this.createConfigTransferView({
        idInput,
        options,
      });
      settingsPanel.appendChild(configTransferView);
      container.appendChild(settingsPanel);
    },

    showModal(options = {}) {
      const root = getShadowWrapper();
      if (!root) return;
      const existingOverlay = root.querySelector(".cookie-share-overlay");
      if (existingOverlay) existingOverlay.remove();
      this.createMainView(options);
      const overlay = root.querySelector(".cookie-share-overlay");
      const modal = root.querySelector(".cookie-share-modal");
      if (overlay && modal) {
        overlay.classList.add("visible");
        modal.classList.add("visible");
      }
    },

    hideModal() {
      const overlay = getShadowWrapper()?.querySelector(".cookie-share-overlay");
      if (overlay) {
        overlay.classList.remove("visible");
        setTimeout(() => overlay.remove(), 300);
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
          <button class="close-btn" onclick="return false;">${t("closeButton")}</button>
          <div class="title-container">
            <h1>${t("cookiesListTitle")}</h1>
          </div>
          <div id="cookieShareList" class="cookie-list-container"></div>
          <div style="display: flex; justify-content: center;">
            <button id="cookieShareGoToMainBtn" class="generate-btn">${t("showPanelButton")}</button>
          </div>
        </div>
      `;

      modal.querySelector(".close-btn").onclick = () => this.hideCookieList();
      modal.querySelector("#cookieShareGoToMainBtn").onclick = () => {
        this.hideCookieList();
        this.showModal();
      };

      overlay.appendChild(modal);
      const root = getShadowWrapper();
      if (!root) return { overlay, modal };
      root.appendChild(overlay);
      return { overlay, modal };
    },

    showCookieList() {
      const root = getShadowWrapper();
      if (!root) return;
      const existingOverlay = root.querySelector(".cookie-share-overlay");
      if (existingOverlay) existingOverlay.remove();
      const { overlay, modal } = this.createCookieListModal();
      overlay.classList.add("visible");
      modal.classList.add("visible");
      const cookiesList = modal.querySelector("#cookieShareList");
      this.initializeCookieList(cookiesList);
    },

    hideCookieList() {
      const root = getShadowWrapper();
      const overlay = root?.querySelector(".cookie-share-overlay");
      const modal = root?.querySelector(".cookie-share-modal");
      if (overlay && modal) {
        overlay.classList.remove("visible");
        modal.classList.remove("visible");
        setTimeout(() => overlay.remove(), 300);
      }
    },

    async initializeCookieList(cookiesList) {
      try {
        const customUrl = GM_getValue(STORAGE_KEYS.CUSTOM_URL);
        cookiesList.innerHTML = "";
        const transportSecret = GM_getValue(STORAGE_KEYS.TRANSPORT_SECRET);
        await this.loadCombinedCookieList(
          cookiesList,
          customUrl,
          transportSecret,
        );
      } catch (error) {
        console.error("Error initializing cookies list:", error);
        cookiesList.innerHTML = `<div class="cookie-share-error">${t("notificationListInitFailed", { message: error.message })}</div>`;
      }
    },

    async loadCombinedCookieList(
      cookiesList,
      customUrl,
      transportSecret,
      loadOnlyLocal = false,
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

      try {
        const allKeys = await GM_listValues();
        const localKeys = allKeys.filter((key) =>
          key.startsWith("cookie_share_local_"),
        );
        for (const key of localKeys) {
          try {
            const rawData = await GM_getValue(key);
            if (rawData) {
              const cookieData = JSON.parse(rawData);
              let cookieHost = "";
              try {
                cookieHost = new URL(cookieData.url).hostname;
              } catch (e) {
                continue;
              }
              if (cookieHost === currentHost) {
                combinedCookies.push({
                  id: cookieData.id,
                  source: "local",
                  url: cookieData.url,
                  cookies: cookieData.cookies,
                });
              }
            }
          } catch (parseError) {
            console.error(
              `Failed to parse local cookie data for key ${key}:`,
              parseError,
            );
          }
        }
      } catch (error) {
        console.error("Error fetching local cookies:", error);
        cookiesList.innerHTML = `<div class="cookie-share-error">${t("notificationLoadLocalFailed", { message: error.message })}</div>`;
      }

      if (!loadOnlyLocal && customUrl) {
        try {
          if (!transportSecret) {
            cloudError = new Error(t("notificationNeedTransportSecret"));
          } else {
            const data = await api.requestEncryptedJson({
              method: "GET",
              url: `${customUrl}/list-cookies-by-host/${encodeURIComponent(currentHost)}`,
              transportSecret,
            });
            if (data.success && Array.isArray(data.cookies)) {
              data.cookies.forEach((cookie) => {
                if (
                  !combinedCookies.some(
                    (c) => c.id === cookie.id && c.source === "cloud",
                  )
                ) {
                  combinedCookies.push({
                    id: cookie.id,
                    source: "cloud",
                    url: cookie.url || null,
                  });
                }
              });
            } else {
              throw new Error(
                data.message || "Failed to parse cloud cookie data",
              );
            }
          }
        } catch (error) {
          console.error("Error fetching cloud cookies:", error);
          cloudError = error;
        }
      }

      const loadingIndicator = cookiesList.querySelector(
        ".cookie-share-loading",
      );
      if (loadingIndicator) loadingIndicator.remove();

      if (cloudError) {
        const errorDiv = document.createElement("div");
        errorDiv.className = "cookie-share-error";
        errorDiv.textContent = t("notificationLoadCloudFailed", {
          message: cloudError.message,
        });
        cookiesList.prepend(errorDiv);
      }

      if (combinedCookies.length === 0) {
        const hasItems = cookiesList.querySelector(".cookie-share-item");
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
        const existingItems = cookiesList.querySelectorAll(
          ".cookie-share-item, .cookie-share-empty",
        );
        existingItems.forEach((item) => item.remove());

        combinedCookies.forEach((cookie) => {
          const item = document.createElement("div");
          item.className = "cookie-share-item";
          const sourceText = t(
            cookie.source === "local" ? "sourceLocal" : "sourceCloud",
          );
          item.innerHTML = `
            <span style="font-size: 13px; font-weight: 500;">ID: ${cookie.id} <span style="color: var(--cs-text-muted); font-weight: 400;">(${sourceText})</span></span>
            <div class="cookie-share-buttons">
              <button class="cookie-share-receive" data-id="${cookie.id}" data-source="${cookie.source}">${t("receiveButton")}</button>
              <button class="cookie-share-delete" data-id="${cookie.id}" data-source="${cookie.source}">${t("deleteButton")}</button>
            </div>
          `;
          cookiesList.appendChild(item);
        });

        this.attachButtonListeners(cookiesList);
      }
    },

    attachButtonListeners(container) {
      container.querySelectorAll(".cookie-share-receive").forEach((button) => {
        button.onclick = async () => {
          const cookieId = button.dataset.id;
          const source = button.dataset.source;
          const customUrl = GM_getValue(STORAGE_KEYS.CUSTOM_URL);
          const transportSecret = GM_getValue(STORAGE_KEYS.TRANSPORT_SECRET);
          const sourceText = t(
            source === "local" ? "sourceLocal" : "sourceCloud",
          );

          try {
            if (source === "local") {
              const localKey = `cookie_share_local_${cookieId}`;
              const rawData = await GM_getValue(localKey);
              if (!rawData) throw new Error(t("notificationLocalDataNotFound"));
              const cookieData = JSON.parse(rawData);
              if (!Array.isArray(cookieData.cookies))
                throw new Error(t("notificationLocalDataInvalid"));
              await cookieManager.clearAll();
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
                "success",
              );
              setTimeout(() => window.location.reload(), 500);
              this.hideCookieList();
            } else {
              if (!customUrl) {
                notification.show(t("notificationNeedServerAddress"), "error");
                return;
              }
              if (!transportSecret) {
                notification.show(
                  t("notificationNeedTransportSecret"),
                  "error",
                );
                return;
              }
              await api.receiveCookies(cookieId, customUrl, transportSecret);
              notification.show(t("notificationReceivedSuccess"), "success");
              this.hideCookieList();
            }
          } catch (error) {
            notification.show(
              t("notificationReceiveFailed", {
                source: sourceText,
                message: error.message,
              }),
              "error",
            );
          }
        };
      });

      container.querySelectorAll(".cookie-share-delete").forEach((button) => {
        button.onclick = async () => {
          const cookieId = button.dataset.id;
          const source = button.dataset.source;
          const sourceText = t(
            source === "local" ? "sourceLocal" : "sourceCloud",
          );

          if (await this.confirmDelete()) {
            try {
              if (source === "local") {
                const localKey = `cookie_share_local_${cookieId}`;
                await GM_deleteValue(localKey);
                notification.show(t("notificationLocalDeleted"), "success");
                this.showCookieList();
              } else {
                const customUrl = GM_getValue(STORAGE_KEYS.CUSTOM_URL);
                const transportSecret = GM_getValue(
                  STORAGE_KEYS.TRANSPORT_SECRET,
                );
                if (!customUrl) {
                  notification.show(
                    t("notificationNeedServerAddress"),
                    "error",
                  );
                  return;
                }
                if (!transportSecret) {
                  notification.show(
                    t("notificationNeedTransportSecret"),
                    "error",
                  );
                  return;
                }
                try {
                  await api.requestEncryptedJson({
                    method: "DELETE",
                    url: `${customUrl}/delete?key=${encodeURIComponent(cookieId)}`,
                    transportSecret,
                  });
                } catch (error) {
                  throw error;
                }
                notification.show(t("notificationCloudDeleted"), "success");
                this.showCookieList();
              }
            } catch (error) {
              notification.show(
                t("notificationDeleteFailed", {
                  source: sourceText,
                  message: error.message,
                }),
                "error",
              );
            }
          }
        };
      });
    },
  };

  // ===================== Initialize =====================
  function initUI() {
    if (!ensureShadowDOM()) return false;
    themeManager.init();
    ui.createFloatingButton();
    return true;
  }

  function init() {
    detectLanguage();

    if (!initUI()) {
      const waitForBody = () => {
        if (document.body) {
          initUI();
        } else {
          requestAnimationFrame(waitForBody);
        }
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => initUI(), { once: true });
      } else {
        requestAnimationFrame(waitForBody);
      }
    }

    document.addEventListener("fullscreenchange", () =>
      fullscreenManager.handleFullscreenChange(),
    );
    document.addEventListener("webkitfullscreenchange", () =>
      fullscreenManager.handleFullscreenChange(),
    );

    const matchesShortcut = (event, actionKey) => {
      const key = event.key.toLowerCase();
      const expectedKey = actionKey.toLowerCase();
      if (key !== expectedKey || !event.shiftKey) return false;
      const hasMacShortcut =
        isMacOS && !event.ctrlKey && (event.metaKey || event.altKey);
      const hasDefaultShortcut =
        !isMacOS && !event.ctrlKey && !event.metaKey && event.altKey;
      return hasMacShortcut || hasDefaultShortcut;
    };

    const handleKeyboardShortcuts = (e) => {
      const root = getShadowWrapper();
      if (!root) return;
      if (matchesShortcut(e, "l")) {
        e.preventDefault();
        e.stopPropagation();
        const overlay = root.querySelector(".cookie-share-overlay");
        const modal = root.querySelector(".cookie-list-modal");
        if (overlay && modal) {
          ui.hideCookieList();
        } else {
          ui.showCookieList();
        }
        return false;
      }
      if (matchesShortcut(e, "c")) {
        e.preventDefault();
        e.stopPropagation();
        const overlay = root.querySelector(".cookie-share-overlay");
        const modal = root.querySelector(
          ".cookie-share-modal:not(.cookie-list-modal)",
        );
        if (overlay && modal) {
          ui.hideModal();
        } else {
          ui.showModal();
        }
        return false;
      }
    };

    document.removeEventListener("keydown", handleKeyboardShortcuts);
    document.addEventListener("keydown", handleKeyboardShortcuts, {
      capture: true,
    });

    GM_registerMenuCommand(t("menuShowShare"), () => ui.showModal());
    GM_registerMenuCommand(t("menuShowList"), () => ui.showCookieList());
    GM_registerMenuCommand(t("menuSwitchLanguage"), switchLanguage);
  }

  init();

  function switchLanguage() {
    const newLanguage =
      currentLanguage === LANGUAGES.EN ? LANGUAGES.ZH : LANGUAGES.EN;
    GM_setValue(STORAGE_KEYS.LANGUAGE_PREFERENCE, newLanguage);
    currentLanguage = newLanguage;
    notification.show(t("menuSwitchLanguage"), "success");
  }
})();
