// ==UserScript==
// @name         Cookie Share
// @namespace    https://github.com/fangyuan99/cookie-share
// @version      0.7.0
// @description  Sends and receives cookies with your friends
// @author       fangyuan99,aBER
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_setClipboard
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
    TRANSPORT_SECRET: "cookie_share_transport_secret",
    SHOW_FLOATING_BUTTON: "cookie_share_show_floating_button",
    AUTO_HIDE_FULLSCREEN: "cookie_share_auto_hide_fullscreen",
    SAVE_LOCALLY: "cookie_share_save_locally",
    LANGUAGE_PREFERENCE: "cookie_share_language_preference",
    THEME: "cookie_share_theme",
    FLOATING_BUTTON_POS: "cookie_share_floating_button_pos",
  };

  const THEMES = { DARK: "dark", CLAUDE: "claude" };

  // Must stay in sync with the backend's validateId rule.
  const COOKIE_ID_PATTERN = /^[A-Za-z0-9]{1,64}$/;

  const GM_COOKIE_SUPPORTED =
    typeof GM_cookie !== "undefined" &&
    GM_cookie &&
    typeof GM_cookie.list === "function" &&
    typeof GM_cookie.set === "function" &&
    typeof GM_cookie.delete === "function";

  const GM_COOKIE_HELP_URLS = {
    en: "https://github.com/fangyuan99/cookie-share#faq",
    zh: "https://github.com/fangyuan99/cookie-share/blob/main/README_CN.md#%E5%B8%B8%E8%A7%81%E9%97%AE%E9%A2%98",
  };

  const CLOSE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

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
      placeholderTransportSecret: "Enter transport secret",
      copyButton: "Copy",
      searchPlaceholder: "Search by ID or URL",
      listFilterEmpty: "No records match your search",
      settingsShowFloatingButton: `Show Floating Button (${getShortcutLabel("L")})`,
      settingsAutoHideFullscreen:
        "Auto Hide in Fullscreen (Not Available For Safari)",
      settingsSaveLocally:
        "Prefer Local Save ('Send' will only save locally if checked)",
      settingsConfigTransferTitle: "Import / Export Config",
      settingsConfigTransferHint:
        "Normal exports exclude backend addresses, credentials and cookie records. Use encrypted backup to migrate credentials.",
      settingsExportConfigButton: "Export Config",
      settingsImportConfigButton: "Import Config",
      settingsTheme: "Theme",
      settingsLanguage: "Language",
      themeDark: "Dark",
      themeClaude: "Claude",
      menuShowShare: `Show Cookie Share (${getShortcutLabel("C")})`,
      menuShowList: `Show Cookie List (${getShortcutLabel("L")})`,
      menuSwitchLanguage: "Switch Language",
      notificationEnterCookieId: "Please enter or generate a Cookie ID",
      notificationInvalidCookieId:
        "Cookie ID can only contain letters and digits (max 64 chars)",
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
      notificationNeedTransportSecret:
        "Cloud operations require a transport secret",
      notificationCloudDeleted: "Cloud cookie deleted",
      notificationDeleteFailed: "Delete {{source}} cookie failed: {{message}}",
      notificationListInitFailed:
        "Failed to initialize cookie list: {{message}}",
      notificationLoadCloudFailed:
        "Failed to load cloud cookies: {{message}} (Local cookies will still be shown)",
      notificationLoadLocalFailed: "Failed to load local cookies: {{message}}",
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
      notificationUpdatedSuccess: "Updated successfully",
      notificationImportCompleted: "Import completed",
      notificationReceiveRestored: "original cookies have been restored",
      notificationGmCookieUnsupported:
        "Your userscript manager does not support GM_cookie. Please use Tampermonkey and allow cookie access for this script.",
      notificationGmCookieHelp: "View setup guide",
      notificationIdCopied: "Cookie ID copied to clipboard",
      notificationCopyFailed: "Copy failed",
      notificationLanguageSwitched: "Language switched",
      floatMenuPanel: "Open panel",
      floatMenuList: "Open list",
      hideFloatingConfirmTitle: "Hide Floating Ball",
      hideFloatingConfirmMessage:
        "Hide the floating ball permanently? You can re-enable it in Settings, or open the panel with {{shortcut}}.",
      hideForeverButton: "Hide Permanently",
      hideSessionButton: "Just This Time",
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
      placeholderTransportSecret: "输入传输密钥",
      copyButton: "复制",
      searchPlaceholder: "按 ID 或 URL 搜索",
      listFilterEmpty: "没有匹配的记录",
      settingsShowFloatingButton: `显示悬浮按钮 (${getShortcutLabel("L")})`,
      settingsAutoHideFullscreen: "全屏时自动隐藏 (Safari 不可用)",
      settingsSaveLocally: "优先本地保存 (勾选后'发送'将仅保存本地)",
      settingsConfigTransferTitle: "导入 / 导出配置",
      settingsConfigTransferHint:
        "普通导出不含后台地址、凭据和 Cookie 记录；迁移凭据请使用加密备份。",
      settingsExportConfigButton: "导出配置",
      settingsImportConfigButton: "导入配置",
      settingsTheme: "主题",
      settingsLanguage: "语言",
      themeDark: "Dark",
      themeClaude: "Claude",
      menuShowShare: `显示 Cookie 分享面板 (${getShortcutLabel("C")})`,
      menuShowList: `显示 Cookie 列表 (${getShortcutLabel("L")})`,
      menuSwitchLanguage: "切换语言",
      notificationEnterCookieId: "请输入或生成一个 Cookie ID",
      notificationInvalidCookieId: "Cookie ID 只能包含字母和数字（最长 64 位）",
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
      notificationNeedTransportSecret: "云端操作需要传输密钥",
      notificationCloudDeleted: "云端 Cookie 已删除",
      notificationDeleteFailed: "删除 {{source}} Cookie 失败: {{message}}",
      notificationListInitFailed: "初始化 Cookie 列表失败: {{message}}",
      notificationLoadCloudFailed:
        "加载云端 Cookie 失败: {{message}} (本地 Cookie 仍会显示)",
      notificationLoadLocalFailed: "加载本地 Cookie 失败: {{message}}",
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
      notificationUpdatedSuccess: "更新成功",
      notificationImportCompleted: "导入成功",
      notificationReceiveRestored: "已恢复原有 Cookie",
      notificationGmCookieUnsupported:
        "当前脚本管理器不支持 GM_cookie，请使用 Tampermonkey 并为脚本开启 Cookie 访问权限。",
      notificationGmCookieHelp: "查看授权说明",
      notificationIdCopied: "Cookie ID 已复制到剪贴板",
      notificationCopyFailed: "复制失败",
      notificationLanguageSwitched: "已切换语言",
      floatMenuPanel: "打开面板",
      floatMenuList: "打开列表",
      hideFloatingConfirmTitle: "隐藏悬浮球",
      hideFloatingConfirmMessage:
        "要永久隐藏悬浮球吗？可在设置中重新开启，或使用 {{shortcut}} 打开面板。",
      hideForeverButton: "永久隐藏",
      hideSessionButton: "仅本次隐藏",
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
      const regex = new RegExp(`{{\\s*${placeholder}\\s*}}`, "g");
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

  // "Hide for this session" from the floating ball's × bubble; reset when the
  // user re-enables the floating button in settings.
  let floatingSessionHidden = false;

  const CONFIG_NORMALIZERS = {
    [STORAGE_KEYS.CUSTOM_URL]: (value) =>
      typeof value === "string" ? value.replace(/\/+$/, "") : "",
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
        shadowRoot = shadowHost.attachShadow({ mode: "closed" });
        shadowWrapper = document.createElement("div");
        shadowWrapper.id = "cs-wrapper";
        shadowRoot.appendChild(shadowWrapper);
        // Native user interactions still reach their target handlers; synthetic
        // page events are rejected before any privileged handler runs.
        for (const type of ['click', 'input', 'change', 'submit', 'keydown', 'pointerdown', 'pointerup']) {
          shadowRoot.addEventListener(type, (event) => {
            if (!event.isTrusted) { event.preventDefault(); event.stopImmediatePropagation(); }
          }, { capture: true });
        }
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
      const shouldHide =
        (state.isFullscreen && autoHideFullscreen) || floatingSessionHidden;
      // Inline !important is required to beat the stylesheet's
      // `display: flex !important` on the float group.
      state.floatingButton.style.setProperty(
        "display",
        !shouldHide && showFloatingButton ? "flex" : "none",
        "important",
      );
    },
  };

  // ===================== Cookie Management =====================
  // Callback errors must reject. A timeout has an uncertain outcome because
  // GM_cookie has no cancellation API; retain the recovery snapshot in that case.
  const COOKIE_OPERATION_TIMEOUT_MS = 15000;
  let cookieMutationBusy = false;
  function cookieCall(method, details) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = new Error('Cookie operation timed out; outcome uncertain. Recovery backup retained.');
        error.uncertain = true;
        reject(error);
      }, COOKIE_OPERATION_TIMEOUT_MS);
      try {
        GM_cookie[method](details, (...args) => {
          clearTimeout(timer);
          const error = method === 'list' ? args[1] : args[0];
          if (error) reject(new Error(String(error)));
          else if (method === 'list' && !Array.isArray(args[0])) reject(new Error('Invalid cookie API response'));
          else resolve(method === 'list' ? args[0] : undefined);
        });
      } catch (error) { clearTimeout(timer); reject(error); }
    });
  }

  function cookieIdentity(cookie) {
    return JSON.stringify([cookie.name, cookie.domain.replace(/^\./, '').toLowerCase(),
      cookie.path || '/', cookie.partitionKey?.topLevelSite || '',
      cookie.partitionKey?.hasCrossSiteAncestor ?? null, cookie.firstPartyDomain || '']);
  }

  function cookieUrl(cookie) {
    const url = new URL(window.location.origin);
    url.pathname = cookie.path || '/';
    return url.href;
  }

  function validateCookieImport(cookies, sourceUrl) {
    if (!Array.isArray(cookies) || !cookies.length || cookies.length > 1000) {
      throw new Error('Expected 1–1000 cookies; nothing has been changed.');
    }
    const host = window.location.hostname.toLowerCase();
    if (sourceUrl && new URL(sourceUrl).hostname.toLowerCase() !== host) {
      throw new Error('This record belongs to another site; nothing has been changed.');
    }
    const seen = new Set();
    const now = Date.now() / 1000;
    return cookies.map((input) => {
      if (!input || typeof input.name !== 'string' || !input.name ||
          typeof input.value !== 'string' || typeof input.domain !== 'string' ||
          input.name.length > 1024 || input.value.length > 16384) {
        throw new Error('Invalid cookie data; nothing has been changed.');
      }
      const domain = input.domain.replace(/^\./, '').toLowerCase();
      const hostOnly = typeof input.hostOnly === 'boolean' ? input.hostOnly : !input.domain.startsWith('.');
      if (!domain || (hostOnly ? host !== domain : host !== domain && !host.endsWith('.' + domain))) {
        throw new Error('Cookie domain does not match this site; nothing has been changed.');
      }
      const cookie = { ...input, domain, hostOnly, path: input.path || '/' };
      if (!cookie.path.startsWith('/') || /[\x00-\x1f\x7f;\r\n]/.test(cookie.path) ||
          /[\x00-\x20\x7f;=]/.test(cookie.name)) throw new Error('Invalid cookie name/path');
      const sameSite = utils.normalizeSameSiteFromBrowser(cookie.sameSite);
      cookie.sameSite = sameSite;
      if (cookie.secure && window.location.protocol !== 'https:') throw new Error('Secure cookies require an HTTPS page.');
      if (sameSite === 'none' && !cookie.secure) throw new Error('SameSite=None requires Secure.');
      if (cookie.name.startsWith('__Secure-') && !cookie.secure) throw new Error('Invalid __Secure- cookie');
      if (cookie.name.startsWith('__Host-') && (!cookie.secure || !hostOnly || cookie.path !== '/')) throw new Error('Invalid __Host- cookie');
      if (!cookie.session && cookie.expirationDate != null &&
          (!Number.isFinite(cookie.expirationDate) || cookie.expirationDate <= now)) {
        throw new Error('The record contains expired cookies. Review it before replacing this session.');
      }
      if (cookie.partitionKey != null) {
        if (typeof cookie.partitionKey !== 'object' || typeof cookie.partitionKey.topLevelSite !== 'string') throw new Error('Invalid partition key');
        const site = new URL(cookie.partitionKey.topLevelSite);
        if (!['https:', 'http:'].includes(site.protocol)) throw new Error('Invalid partition site');
        cookie.partitionKey = { ...cookie.partitionKey };
      }
      const id = cookieIdentity(cookie);
      if (seen.has(id)) throw new Error('Duplicate cookies in record');
      seen.add(id);
      return cookie;
    });
  }

  async function withCookieMutation(task) {
    if (cookieMutationBusy) throw new Error('Another cookie operation is in progress.');
    cookieMutationBusy = true;
    try {
      if (navigator.locks?.request) {
        return await navigator.locks.request('cookie-share-mutation', { ifAvailable: true }, (lock) => {
          if (!lock) throw new Error('Another tab is changing cookies for this origin.');
          return task();
        });
      }
      return await task();
    } finally { cookieMutationBusy = false; }
  }

  const cookieManager = {
    async getAll(allowDuringMutation = false) {
      if (cookieMutationBusy && !allowDuringMutation) throw new Error('Cookie mutation in progress; retry after it finishes.');
      const cookies = await cookieCall('list', { url: window.location.href, partitionKey: {} });
      return cookies.map((cookie) => ({ ...cookie, path: cookie.path || '/',
        sameSite: utils.normalizeSameSiteFromBrowser(cookie.sameSite) }));
    },

    async set(cookie) {
      const details = {
        url: cookieUrl(cookie), name: cookie.name, value: cookie.value,
        path: cookie.path || '/', secure: Boolean(cookie.secure), httpOnly: Boolean(cookie.httpOnly),
      };
      if (!cookie.hostOnly) details.domain = cookie.domain;
      const sameSite = utils.normalizeSameSiteForSet(cookie.sameSite);
      if (sameSite !== undefined) details.sameSite = sameSite;
      if (!cookie.session && cookie.expirationDate != null) details.expirationDate = cookie.expirationDate;
      if (cookie.partitionKey) details.partitionKey = { ...cookie.partitionKey };
      if (cookie.firstPartyDomain) details.firstPartyDomain = cookie.firstPartyDomain;
      await cookieCall('set', details);
    },

    async remove(cookie) {
      // GM_cookie.delete accepts url/name (plus partition identity), not domain/path.
      const details = { url: cookieUrl(cookie), name: cookie.name };
      if (cookie.partitionKey) details.partitionKey = { ...cookie.partitionKey };
      if (cookie.firstPartyDomain) details.firstPartyDomain = cookie.firstPartyDomain;
      await cookieCall('delete', details);
    },

    async readScope(extra = []) {
      const result = new Map((await this.getAll(true)).map((c) => [cookieIdentity(c), c]));
      const queries = new Map();
      for (const cookie of extra) {
        const query = { url: cookieUrl(cookie), partitionKey: cookie.partitionKey || {} };
        queries.set(JSON.stringify(query), query);
      }
      for (const query of queries.values()) {
        for (const c of await cookieCall('list', query)) {
          result.set(cookieIdentity(c), { ...c, sameSite: utils.normalizeSameSiteFromBrowser(c.sameSite) });
        }
      }
      return [...result.values()];
    },

    async verify(expected, scope = expected) {
      const actual = await this.readScope(scope);
      const actualMap = new Map(actual.map((c) => [cookieIdentity(c), c]));
      if (actual.length !== expected.length) throw new Error('Cookie verification failed: unexpected or missing cookies.');
      for (const cookie of expected) {
        const observed = actualMap.get(cookieIdentity(cookie));
        if (!observed || observed.value !== cookie.value ||
            Boolean(observed.hostOnly) !== Boolean(cookie.hostOnly) ||
            Boolean(observed.secure) !== Boolean(cookie.secure) ||
            Boolean(observed.httpOnly) !== Boolean(cookie.httpOnly) ||
            utils.normalizeSameSiteFromBrowser(observed.sameSite) !== utils.normalizeSameSiteFromBrowser(cookie.sameSite) ||
            (cookie.session === true && observed.session !== true) ||
            (!cookie.session && cookie.expirationDate != null &&
             (!Number.isFinite(observed.expirationDate) || Math.abs(observed.expirationDate - cookie.expirationDate) > 2))) {
          throw new Error('Cookie verification failed; the browser did not preserve a cookie or its attributes.');
        }
      }
    },

    backupKey() { return 'cookie_share_recovery_' + window.location.hostname; },

    async replaceAll(input, emptyErrorMessage, sourceUrl) {
      // Validation must complete before acquiring a snapshot or deleting anything.
      const cookies = validateCookieImport(input, sourceUrl);
      return withCookieMutation(() => this.replaceUnlocked(cookies, false));
    },

    async replaceUnlocked(cookies, retainBackup = false) {
      const snapshot = await this.readScope(cookies);
      const backup = JSON.stringify({ version: 1, url: window.location.origin,
        createdAt: Date.now(), cookies: snapshot });
      // Persist before the first mutation. Existing local records are never rewritten.
      await GM_setValue(this.backupKey(), backup);
      if (await GM_getValue(this.backupKey()) !== backup) throw new Error('Unable to save recovery backup; nothing has been changed.');
      try {
        for (const cookie of snapshot) await this.remove(cookie);
        for (const cookie of cookies) await this.set(cookie);
        await this.verify(cookies, [...snapshot, ...cookies]);
        if (!retainBackup) await GM_deleteValue(this.backupKey());
        return cookies.length;
      } catch (error) {
        if (error.uncertain) throw error; // A late callback may still mutate state.
        try {
          for (const cookie of await this.readScope([...snapshot, ...cookies])) await this.remove(cookie);
          for (const cookie of snapshot) await this.set(cookie);
          await this.verify(snapshot, [...snapshot, ...cookies]);
        } catch (restoreError) {
          throw new Error(`${error.message}; RESTORE FAILED: ${restoreError.message}. Recovery backup retained.`);
        }
        throw new Error(`${error.message} (${t('notificationReceiveRestored')}). Recovery backup retained.`);
      }
    },

    async clearAll() {
      return withCookieMutation(() => this.replaceUnlocked([], true));
    },

    async restoreBackup() {
      const raw = await GM_getValue(this.backupKey());
      if (!raw) throw new Error('No recovery backup exists for this host.');
      const backup = JSON.parse(raw);
      if (backup.url !== window.location.origin || !Array.isArray(backup.cookies)) throw new Error('Invalid backup origin/data');
      // Preserve the original backup if a manual recovery attempt fails.
      const saved = raw;
      try {
        if (backup.cookies.length) await this.replaceAll(backup.cookies, '', backup.url);
        else await this.clearAll();
        await GM_deleteValue(this.backupKey());
      } catch (error) { await GM_setValue(this.backupKey(), saved); throw error; }
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
        const parsed = new URL(url);
        if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('Invalid backend URL');
        return parsed.href.replace(/\/+$/, '');
      } catch (e) {
        throw new Error("Invalid URL format");
      }
    },

    generateId(length = 22) {
      const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let result = '';
      while (result.length < length) {
        for (const byte of crypto.getRandomValues(new Uint8Array(length))) {
          if (byte < 248 && result.length < length) result += chars[byte % chars.length];
        }
      }
      return result;
    },

    localizeServerMessage(message) {
      const mapping = {
        "Cookies saved successfully": t("notificationSentSuccess"),
        "Cookies saved successfully.": t("notificationSentSuccess"),
        "Cookies not found": t("notificationReceiveFailed", {
          source: t("sourceCloud"),
          message: t("apiErrorInvalidData"),
        }),
        "Cookies and URL updated successfully": t("notificationUpdatedSuccess"),
        "Data deleted successfully": t("notificationCloudDeleted"),
        "Import completed": t("notificationImportCompleted"),
        Unauthorized: t("notificationAdminPermission"),
        "Invalid encrypted payload": t("notificationDecryptFailed"),
        "Transport secret mismatch or corrupted payload": t(
          "notificationInvalidTransportSecret",
        ),
      };
      return mapping[message] || message;
    },

    normalizeSameSiteFromBrowser(value) {
      if (typeof value !== "string") return "unspecified";
      const normalized = value.toLowerCase();
      if (
        normalized === "no_restriction" ||
        normalized === "none"
      ) {
        return "none";
      }
      if (normalized === "unspecified") return "unspecified";
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
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(value, 'text');
        return;
      }
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
    sensitiveKeys: [STORAGE_KEYS.TRANSPORT_SECRET, STORAGE_KEYS.CUSTOM_URL],

    normalizeValue(storageKey, value) {
      const normalizer = CONFIG_NORMALIZERS[storageKey];
      return normalizer ? normalizer(value) : value;
    },

    collectConfig(includeSecrets = false) {
      const values = {};
      this.exportKeys.forEach((storageKey) => {
        if (!includeSecrets && this.sensitiveKeys.includes(storageKey)) return;
        values[storageKey] = this.normalizeValue(
          storageKey,
          GM_getValue(storageKey, undefined),
        );
      });
      if (includeSecrets) values[DEVICE_TOKEN_KEY] = GM_getValue(DEVICE_TOKEN_KEY, '');
      return { version: this.version, values };
    },

    exportToBase64() {
      return utils.encodeBase64(JSON.stringify(this.collectConfig()));
    },

    async exportSensitive() {
      const password = nativePrompt('Choose a backup password (12+ characters) / 备份密码（至少12位）', '');
      if (password === null) return null;
      if (password.length < 12) throw new Error('Backup password is too short.');
      return utils.encodeBase64(JSON.stringify({ format: 'cookie-share-encrypted-config', version: 2,
        envelope: await transportCrypto.encrypt(password, this.collectConfig(true)) }));
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
      if (parsedConfig?.format === 'cookie-share-encrypted-config') {
        const password = nativePrompt('Backup password / 备份密码', '');
        if (password === null) throw new Error('Import cancelled');
        parsedConfig = await transportCrypto.decrypt(password, parsedConfig.envelope);
      }
      if (!parsedConfig || typeof parsedConfig !== "object") {
        throw new Error(t("notificationConfigInvalid"));
      }
      const values =
        parsedConfig.values && typeof parsedConfig.values === "object"
          ? parsedConfig.values
          : parsedConfig;
      if ((this.sensitiveKeys.some((key) => Object.hasOwn(values, key)) || Object.hasOwn(values, DEVICE_TOKEN_KEY)) &&
          !nativeConfirm('This import can change your backend and credentials. Import only a trusted configuration. Continue? / 此配置会更改后台或凭据，确认来源可信后继续？')) throw new Error('Import cancelled');
      if (values[STORAGE_KEYS.CUSTOM_URL]) utils.validateUrl(values[STORAGE_KEYS.CUSTOM_URL]);
      if (values[DEVICE_TOKEN_KEY] && !/^[A-Za-z0-9_-]{43,128}$/.test(values[DEVICE_TOKEN_KEY])) throw new Error('Invalid device token');
      let appliedCount = 0;
      for (const storageKey of [...this.exportKeys, DEVICE_TOKEN_KEY]) {
        if (!Object.prototype.hasOwnProperty.call(values, storageKey)) {
          continue;
        }
        await GM_setValue(
          storageKey,
          this.normalizeValue(storageKey, values[storageKey]),
        );
        appliedCount += 1;
      }
      capabilityCache.clear();
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
        typeof value.payload === "string" && value.payload.length <= 12 * 1024 * 1024,
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
    async requestEncryptedJson({ method, url, body, transportSecret, headers, signal }) {
      const token = GM_getValue(DEVICE_TOKEN_KEY, '');
      transportSecret = token || transportSecret || getTransportSecret();
      if (!transportSecret) throw new Error(t('notificationNeedTransportSecret'));
      const target = new URL(url);
      if (token && target.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) {
        throw new Error('Device tokens require HTTPS outside localhost.');
      }
      const base = utils.validateUrl(getServerUrl() || url.replace(/\/(send-cookies|receive-cookies|list-cookies-by-host|delete)(\/.*)?$/, ''));
      if (target.origin !== new URL(base).origin) throw new Error('Backend origin changed');
      const caps = token ? await capabilities(base) : {};
      if (token && !caps.protocolVersions?.includes(2)) throw new Error('Device tokens require an upgraded Worker; refusing an insecure fallback.');
      const context = token ? { method, path: target.pathname,
        requestId: transportCrypto.base64UrlEncode(crypto.getRandomValues(new Uint8Array(16))), timestamp: Date.now() } : null;
      const requestHeaders = { Accept: 'application/json', ...(headers || {}) };
      if (token) Object.assign(requestHeaders, { Authorization: 'Bearer ' + token, 'X-Cookie-Protocol': '2',
        'X-Request-Id': context.requestId, 'X-Request-Time': String(context.timestamp) });
      if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
      const data = body === undefined ? undefined : JSON.stringify(token
        ? await deviceCipher(token, body, context) : await transportCrypto.encrypt(transportSecret, body));
      const response = await new Promise((resolve, reject) => {
        if (signal?.aborted) { reject(new Error('Request cancelled')); return; }
        let request;
        const abort = () => { request?.abort(); reject(new Error('Request cancelled')); };
        const finish = (callback) => (value) => { signal?.removeEventListener('abort', abort); callback(value); };
        request = GM_xmlhttpRequest({ method, url, headers: requestHeaders, data, responseType: 'text',
          timeout: 10000, anonymous: true, redirect: 'error',
          onload: finish(resolve), onerror: finish(() => reject(new Error(t('apiErrorNetwork')))),
          ontimeout: finish(() => reject(new Error(t('apiErrorTimeout')))),
          onabort: finish(() => reject(new Error('Request cancelled'))) });
        signal?.addEventListener('abort', abort, { once: true });
      });
      if (response.finalUrl && new URL(response.finalUrl).origin !== target.origin) throw new Error('Cross-origin redirect rejected');
      if ((response.responseText || '').length > 12 * 1024 * 1024) throw new Error('Response too large');
      let payload;
      try { payload = JSON.parse(response.responseText || '{}'); } catch { throw new Error(t('notificationDecryptFailed')); }
      if (payload && (payload.version === 1 || payload.version === 2)) {
        payload = token ? await deviceCipher(token, null, context, payload) : await transportCrypto.decrypt(transportSecret, payload);
      } else if (response.status >= 200 && response.status < 300) throw new Error(t('notificationDecryptFailed'));
      if (response.status < 200 || response.status >= 300) {
        const error = new Error(utils.localizeServerMessage(payload.message || payload.error || 'Request failed'));
        error.status = response.status;
        throw error;
      }
      return payload;
    },

    async sendCookies(cookieId, customUrl, transportSecret) {
      try {
        const cookies = await cookieManager.getAll();
        if (!cookies.length) {
          return { success: false, message: t("notificationNoCookiesToSave") };
        }
        const formattedUrl = utils.validateUrl(customUrl);
        const caps = await capabilities(formattedUrl);
        let existing = null;
        try {
          existing = await this.requestEncryptedJson({ method: 'GET', url: `${formattedUrl}/receive-cookies/${cookieId}`, transportSecret });
        } catch (error) { if (error.status !== 404 && error.status !== 403) throw error; }
        if (existing?.success && !nativeConfirm('A record with this ID already exists. Overwrite it? / 该 ID 已存在，是否覆盖？')) return { success: false, message: 'Cancelled / 已取消' };
        if (!caps.cookieAttributes && cookies.some((c) => c.partitionKey || c.firstPartyDomain)) throw new Error('This backend cannot preserve partitioned cookies; upgrade the backend first.');
        if (!caps.cookieAttributes && cookies.some((c) => c.sameSite === 'unspecified') && !nativeConfirm('This old backend cannot preserve unspecified SameSite. Save with Lax instead? Upgrade the backend for exact preservation. / 旧后台无法完整保存 SameSite，是否以 Lax 保存？建议先升级后台。')) return { success: false, message: 'Cancelled / 已取消' };
        const wireCookies = cookies.map((c) => ({ ...c,
          sameSite: !caps.cookieAttributes && c.sameSite === 'unspecified' ? 'lax' : c.sameSite,
          ...(c.sameSite === 'unspecified' ? { sameSiteUnspecified: true } : {}) }));
        const data = { id: cookieId, url: recordUrl(), cookies: wireCookies,
          ...(caps.conditionalWrites ? (existing?.success ? { expectedRevision: existing.revision } : { createOnly: true }) : {}) };
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
        if (!nativeConfirm('Replace this site’s cookies with this record? A recovery backup will be saved. / 确认切换账号？将先保存恢复备份。')) return { success: false, message: 'Cancelled / 已取消' };
        await cookieManager.replaceAll(response.cookies, t("apiErrorNoImport"), response.url);
        offerRefresh();
        return { success: true, message: t("notificationReceivedSuccess") };
      } catch (error) {
        console.error("Error receiving cookies:", error);
        throw error;
      }
    },
  };

  // ===================== Notification =====================
  const notification = {
    show(message, type = "success", link = null) {
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
      notificationEl.setAttribute("role", type === "error" ? "alert" : "status");
      if (link) {
        const anchor = document.createElement("a");
        anchor.className = "cookie-share-notification-link";
        anchor.href = link.url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.textContent = link.text;
        notificationEl.appendChild(anchor);
      }
      root.appendChild(notificationEl);
      notificationEl.offsetHeight;
      notificationEl.classList.add("show");
      // Give the user extra time to click when a link is attached.
      const duration = type === "error" ? 15000 : link ? 8000 : 5000;
      setTimeout(() => {
        notificationEl.classList.remove("show");
        setTimeout(() => notificationEl.remove(), 300);
      }, duration);
    },
  };

  function ensureGmCookieSupport() {
    if (GM_COOKIE_SUPPORTED) return true;
    notification.show(t("notificationGmCookieUnsupported"), "error", {
      text: t("notificationGmCookieHelp"),
      url: GM_COOKIE_HELP_URLS[currentLanguage] || GM_COOKIE_HELP_URLS.en,
    });
    return false;
  }

  function validateCookieIdInput(cookieId) {
    if (!cookieId) {
      notification.show(t("notificationEnterCookieId"), "error");
      return false;
    }
    if (!COOKIE_ID_PATTERN.test(cookieId)) {
      notification.show(t("notificationInvalidCookieId"), "error");
      return false;
    }
    return true;
  }

  async function runWithButtonLoading(button, task) {
    if (button.disabled || uiOperationBusy) { notification.show('Another operation is in progress / 正在执行其他操作', 'error'); return; }
    uiOperationBusy = true;
    const buttons = [...(getShadowWrapper()?.querySelectorAll('button') || [])];
    const previous = buttons.map((b) => b.disabled);
    buttons.forEach((b) => { b.disabled = true; });
    button.disabled = true;
    try {
      await task();
    } catch (error) {
      notification.show(error.message || 'Operation failed', 'error');
    } finally {
      uiOperationBusy = false;
      buttons.forEach((b, i) => { b.disabled = previous[i]; });
    }
  }

  // ===================== UI Components =====================
  const ui = {
    confirmDelete() {
      return new Promise((resolve) => {
        const root = getShadowWrapper();
        if (!root) { resolve(false); return; }
        const container = document.createElement("div");
        container.className = "cookie-share-confirm-layer";
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
        container.className = "cookie-share-confirm-layer";
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
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
          transition: opacity 0.2s ease, visibility 0.2s ease !important;
        }
        .cookie-share-overlay.visible {
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
        }

        /* ===== Modal ===== */
        .cookie-share-modal {
          background: var(--cs-surface) !important;
          border-radius: var(--cs-radius-lg) !important;
          border: var(--cs-card-border) !important;
          box-shadow: var(--cs-shadow) !important;
          width: min(480px, 90vw) !important;
          max-height: 90vh !important;
          /* Clip children (incl. any inner scrollbar) to the rounded corners */
          overflow: hidden !important;
          position: relative !important;
          display: block !important;
          z-index: 2147483647 !important;
          padding: 0 !important;
          opacity: 0 !important;
          transform: scale(0.96) translateY(8px) !important;
          transition: opacity 0.2s ease, transform 0.2s ease !important;
        }
        .cookie-share-modal.visible {
          opacity: 1 !important;
          transform: none !important;
        }
        .cookie-list-modal {
          width: min(560px, 90vw) !important;
        }

        /* ===== Container ===== */
        .cookie-share-container {
          font-family: -apple-system, system-ui, 'Segoe UI', sans-serif !important;
          padding: 28px !important;
          color: var(--cs-text) !important;
          max-height: 90vh !important;
          overflow-y: auto !important;
          scrollbar-width: thin !important;
          scrollbar-color: var(--cs-input-border) transparent !important;
        }
        .cookie-share-container::-webkit-scrollbar {
          width: 6px !important;
        }
        .cookie-share-container::-webkit-scrollbar-track {
          background: transparent !important;
        }
        .cookie-share-container::-webkit-scrollbar-thumb {
          background: var(--cs-input-border) !important;
          border-radius: 3px !important;
        }

        /* Settings acts as a swapped view: hide the main controls while open */
        .cookie-share-container.cs-settings-open .id-input-container,
        .cookie-share-container.cs-settings-open .action-buttons,
        .cookie-share-container.cs-settings-open .bottom-buttons {
          display: none !important;
        }

        /* ===== Close Button ===== */
        .cookie-share-container .close-btn {
          position: absolute !important;
          right: 16px !important; top: 16px !important;
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
        .cookie-share-container .close-btn svg,
        .cookie-share-container .settings-btn svg {
          width: 16px !important;
          height: 16px !important;
          display: block !important;
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
        .cookie-share-container input.cookie-share-search {
          margin-top: 16px !important;
        }
        .cookie-list-container {
          margin-top: 10px !important;
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
        .cookie-share-item-info {
          flex: 1 !important;
          min-width: 0 !important;
          margin-right: 10px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 2px !important;
        }
        .cookie-share-item-id {
          font-size: 13px !important;
          font-weight: 500 !important;
          word-break: break-all !important;
        }
        .cookie-share-item-source {
          color: var(--cs-text-muted) !important;
          font-weight: 400 !important;
        }
        .cookie-share-item-url {
          font-size: 12px !important;
          color: var(--cs-text-muted) !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }
        .cookie-share-buttons {
          display: flex !important;
          gap: 6px !important;
          flex-shrink: 0 !important;
        }
        .cookie-share-copy,
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
        .cookie-share-copy {
          background: var(--cs-btn-secondary-bg) !important;
          color: var(--cs-btn-secondary-text) !important;
        }
        .cookie-share-copy:hover {
          background: var(--cs-btn-secondary-hover) !important;
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
        .cs-hidden {
          display: none !important;
        }
        .cookie-share-container button:disabled {
          opacity: 0.55 !important;
          cursor: not-allowed !important;
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

        /* ===== Floating Ball ===== */
        .cookie-share-float-group {
          position: fixed !important;
          width: 36px !important; height: 36px !important;
          z-index: 2147483645 !important;
          pointer-events: auto !important;
          display: flex !important;
          transition: left 0.25s ease-out, top 0.25s ease-out, opacity 0.3s ease !important;
        }
        .cookie-share-float-group.cs-dragging {
          transition: opacity 0.3s ease !important;
        }
        .cookie-share-float-group.cs-idle {
          opacity: 0.4 !important;
        }
        .cookie-share-floating-btn {
          width: 36px !important; height: 36px !important;
          background: var(--cs-float-bg) !important;
          border: var(--cs-float-border) !important;
          border-radius: 50% !important;
          cursor: grab !important;
          transition: transform 0.2s ease-out, box-shadow 0.15s ease !important;
          box-shadow: var(--cs-float-shadow) !important;
          padding: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          backdrop-filter: blur(8px) !important;
          -webkit-backdrop-filter: blur(8px) !important;
          touch-action: none !important;
          user-select: none !important;
          -webkit-user-select: none !important;
        }
        .cookie-share-floating-btn:hover {
          transform: scale(1.08) !important;
        }
        .cookie-share-float-group.cs-dragging .cookie-share-floating-btn {
          cursor: grabbing !important;
        }
        .cookie-share-float-group.cs-docked .cookie-share-floating-btn {
          cursor: pointer !important;
        }
        /* Docked ball sits flush with the screen edge; scale from the edge
           side so the enlarged circle only grows inward, never off-screen. */
        .cookie-share-float-group.cs-docked-left .cookie-share-floating-btn {
          transform-origin: left center !important;
        }
        .cookie-share-float-group.cs-docked-right .cookie-share-floating-btn {
          transform-origin: right center !important;
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

        /* Quick actions revealed on hover while docked */
        .cs-float-menu {
          position: absolute !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          display: none !important;
          flex-direction: column !important;
          gap: 6px !important;
          padding: 6px 0 !important;
        }
        .cookie-share-float-group.cs-expanded .cs-float-menu {
          display: flex !important;
        }
        .cookie-share-float-group.cs-menu-above .cs-float-menu {
          bottom: 100% !important;
        }
        .cookie-share-float-group.cs-menu-below .cs-float-menu {
          top: 100% !important;
        }
        .cs-float-action {
          width: 32px !important; height: 32px !important;
          border-radius: 50% !important;
          background: var(--cs-float-bg) !important;
          border: var(--cs-float-border) !important;
          box-shadow: var(--cs-float-shadow) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          padding: 0 !important;
          backdrop-filter: blur(8px) !important;
          -webkit-backdrop-filter: blur(8px) !important;
          transition: transform 0.15s ease !important;
        }
        .cs-float-action:hover {
          transform: scale(1.1) !important;
        }
        .cs-float-action svg {
          width: 16px !important; height: 16px !important;
          stroke: var(--cs-accent) !important;
        }

        /* Small × bubble to hide the ball */
        .cs-float-hide {
          position: absolute !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          width: 18px !important; height: 18px !important;
          border-radius: 50% !important;
          background: var(--cs-float-bg) !important;
          border: var(--cs-float-border) !important;
          box-shadow: var(--cs-float-shadow) !important;
          display: none !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          padding: 0 !important;
          color: var(--cs-text-secondary) !important;
        }
        .cs-float-hide:hover {
          color: var(--cs-danger) !important;
        }
        .cookie-share-float-group.cs-expanded .cs-float-hide {
          display: flex !important;
        }
        .cookie-share-float-group.cs-docked-right .cs-float-hide {
          left: -22px !important;
        }
        .cookie-share-float-group.cs-docked-left .cs-float-hide {
          right: -22px !important;
        }
        .cs-float-hide svg {
          width: 10px !important; height: 10px !important;
          stroke: currentColor !important;
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
        .cookie-share-notification-link {
          display: block !important;
          margin-top: 6px !important;
          color: var(--cs-accent) !important;
          text-decoration: underline !important;
          font-size: 13px !important;
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
      if (!showFloatingButton || floatingSessionHidden) return;

      const cookieSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path d="M21.598 13.789c-1.646-.583-2.76-2.145-2.76-3.891 0-.284-.1-.516-.316-.715-.184-.15-.466-.217-.699-.183-1.397.2-2.728-.2-3.743-1.015-1.015-.816-1.73-2.045-1.847-3.476-.017-.25-.167-.483-.383-.633-.217-.133-.483-.167-.732-.067-2.262.815-4.391-.616-5.239-2.562-.167-.366-.549-.566-.949-.482-3.193.715-6.07 2.72-8.031 5.248C-6.804 11.66-6.354 19.82.366 26.54c5.538 5.53 14.48 5.53 20.002 0 2.562-2.562 4.257-6.22 4.257-10.11-.033-.55-.05-.915-.566-1.098z"/>
          <circle cx="10" cy="12" r="1.5"/>
          <circle cx="16" cy="9" r="1.5"/>
          <circle cx="14" cy="15" r="1.5"/>
        </svg>
      `;
      const panelSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="3" y1="9" x2="21" y2="9"/></svg>`;
      const listSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
      const xSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

      const group = document.createElement("div");
      group.className = "cookie-share-float-group";

      const menu = document.createElement("div");
      menu.className = "cs-float-menu";

      const makeAction = (svg, titleKey, onClick) => {
        const button = document.createElement("button");
        button.className = "cs-float-action";
        button.innerHTML = svg;
        button.title = t(titleKey);
        button.onclick = (e) => {
          e.stopPropagation();
          collapse();
          onClick();
        };
        menu.appendChild(button);
      };
      makeAction(panelSvg, "floatMenuPanel", () => ui.showModal());
      makeAction(listSvg, "floatMenuList", () => ui.showCookieList());

      const floatingBtn = document.createElement("button");
      floatingBtn.innerHTML = cookieSvg;
      floatingBtn.className = "cookie-share-floating-btn";

      const hideBtn = document.createElement("button");
      hideBtn.className = "cs-float-hide";
      hideBtn.innerHTML = xSvg;
      hideBtn.title = t("hideFloatingConfirmTitle");
      hideBtn.onclick = async (e) => {
        e.stopPropagation();
        collapse();
        const choice = await ui.confirmHideFloating();
        if (choice === "permanent") {
          GM_setValue(STORAGE_KEYS.SHOW_FLOATING_BUTTON, false);
          ui.refreshFloatingButton();
        } else if (choice === "session") {
          floatingSessionHidden = true;
          fullscreenManager.updateFloatingButtonVisibility();
        }
      };

      group.appendChild(menu);
      group.appendChild(floatingBtn);
      group.appendChild(hideBtn);
      getShadowWrapper().appendChild(group);
      state.floatingButton = group;

      const BTN_SIZE = 36;
      const DOCK_THRESHOLD = 20;
      const DRAG_THRESHOLD = 5;
      const IDLE_DELAY = 3000;

      function clampX(x) {
        return Math.min(Math.max(0, x), window.innerWidth - BTN_SIZE);
      }

      function clampY(y) {
        return Math.min(Math.max(0, y), window.innerHeight - BTN_SIZE);
      }

      function setPos(x, y) {
        group.style.left = x + "px";
        group.style.top = y + "px";
      }

      // Idle fade (docked only)
      let idleTimer = null;
      function cancelIdle() {
        clearTimeout(idleTimer);
        idleTimer = null;
        group.classList.remove("cs-idle");
      }
      function armIdleFade() {
        cancelIdle();
        if (!state._floatingDocked) return;
        idleTimer = setTimeout(() => group.classList.add("cs-idle"), IDLE_DELAY);
      }

      // Hover-expanded quick actions (docked only)
      let collapseTimer = null;
      function expand() {
        if (!state._floatingDocked) return;
        clearTimeout(collapseTimer);
        const rect = group.getBoundingClientRect();
        const openBelow = rect.top < window.innerHeight / 2;
        group.classList.toggle("cs-menu-below", openBelow);
        group.classList.toggle("cs-menu-above", !openBelow);
        group.classList.add("cs-expanded");
        cancelIdle();
      }
      function collapse() {
        clearTimeout(collapseTimer);
        group.classList.remove("cs-expanded");
        armIdleFade();
      }
      function scheduleCollapse() {
        clearTimeout(collapseTimer);
        collapseTimer = setTimeout(collapse, 200);
      }

      function applyDocked(side, y) {
        group.classList.add("cs-docked");
        group.classList.toggle("cs-docked-left", side === "left");
        group.classList.toggle("cs-docked-right", side === "right");
        setPos(side === "left" ? 0 : window.innerWidth - BTN_SIZE, clampY(y));
        state._floatingDocked = side;
        armIdleFade();
      }

      function undock() {
        group.classList.remove(
          "cs-docked",
          "cs-docked-left",
          "cs-docked-right",
          "cs-expanded",
        );
        state._floatingDocked = null;
        cancelIdle();
      }

      function savePos(x, y, docked) {
        GM_setValue(STORAGE_KEYS.FLOATING_BUTTON_POS, { x, y, docked: docked || null });
      }

      // Initial position
      setPos(window.innerWidth - BTN_SIZE - 20, window.innerHeight - BTN_SIZE - 20);
      const savedPos = GM_getValue(STORAGE_KEYS.FLOATING_BUTTON_POS, null);
      if (savedPos && savedPos.docked) {
        applyDocked(savedPos.docked === "left" ? "left" : "right", savedPos.y);
      } else if (savedPos) {
        setPos(clampX(savedPos.x), clampY(savedPos.y));
      }

      // Hover interactions (mouse)
      group.addEventListener("mouseenter", () => {
        cancelIdle();
        if (state._floatingDocked) expand();
      });
      group.addEventListener("mouseleave", () => {
        if (group.classList.contains("cs-expanded")) {
          scheduleCollapse();
        } else {
          armIdleFade();
        }
      });

      // Tap outside collapses the menu (touch)
      const outsideHandler = (e) => {
        if (!group.classList.contains("cs-expanded")) return;
        const path = e.composedPath ? e.composedPath() : [];
        if (!path.includes(group)) collapse();
      };
      document.addEventListener("pointerdown", outsideHandler, true);
      state._floatingOutsideHandler = outsideHandler;

      // Drag
      let isDragging = false;
      let dragStarted = false;
      let startX, startY, btnStartX, btnStartY;
      let totalMovement = 0;

      floatingBtn.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        e.preventDefault();
        floatingBtn.setPointerCapture(e.pointerId);
        const rect = group.getBoundingClientRect();
        btnStartX = rect.left;
        btnStartY = rect.top;
        startX = e.clientX;
        startY = e.clientY;
        totalMovement = 0;
        isDragging = true;
        dragStarted = false;
        cancelIdle();
      });

      floatingBtn.addEventListener("pointermove", (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        totalMovement = Math.max(totalMovement, Math.abs(dx) + Math.abs(dy));
        if (totalMovement < DRAG_THRESHOLD) return;

        if (!dragStarted) {
          dragStarted = true;
          group.classList.add("cs-dragging");
          undock();
        }

        const newX = clampX(btnStartX + dx);
        const newY = clampY(btnStartY + dy);
        setPos(newX, newY);

        const nearEdge =
          newX <= DOCK_THRESHOLD ||
          newX >= window.innerWidth - BTN_SIZE - DOCK_THRESHOLD;
        group.style.opacity = nearEdge ? "0.5" : "";
      });

      floatingBtn.addEventListener("pointerup", (e) => {
        if (!isDragging) return;
        isDragging = false;
        group.classList.remove("cs-dragging");
        group.style.opacity = "";

        if (totalMovement < DRAG_THRESHOLD) {
          // Tap/click. Touch has no hover: first tap expands the docked menu.
          if (
            e.pointerType === "touch" &&
            state._floatingDocked &&
            !group.classList.contains("cs-expanded")
          ) {
            expand();
          } else {
            collapse();
            ui.showCookieList();
          }
          return;
        }

        const rect = group.getBoundingClientRect();
        const currentX = rect.left;
        const currentY = rect.top;

        if (currentX <= DOCK_THRESHOLD) {
          applyDocked("left", currentY);
          savePos(0, currentY, "left");
        } else if (currentX >= window.innerWidth - BTN_SIZE - DOCK_THRESHOLD) {
          applyDocked("right", currentY);
          savePos(window.innerWidth - BTN_SIZE, currentY, "right");
        } else {
          savePos(currentX, currentY, null);
        }
      });

      floatingBtn.addEventListener("pointercancel", () => {
        isDragging = false;
        dragStarted = false;
        group.classList.remove("cs-dragging");
        group.style.opacity = "";
      });

      let resizeTimer;
      const handleResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (!state.floatingButton) return;
          const docked = state._floatingDocked;
          if (docked) {
            const currentTop = parseFloat(group.style.top) || 0;
            applyDocked(docked, currentTop);
          } else {
            let x = parseFloat(group.style.left) || 0;
            let y = parseFloat(group.style.top);
            if (isNaN(y)) y = window.innerHeight - BTN_SIZE - 20;
            setPos(clampX(x), clampY(y));
          }
        }, 100);
      };
      window.addEventListener("resize", handleResize);
      state._floatingResizeHandler = handleResize;

      fullscreenManager.updateFloatingButtonVisibility();
      armIdleFade();
    },

    refreshFloatingButton() {
      if (state._floatingResizeHandler) {
        window.removeEventListener("resize", state._floatingResizeHandler);
        state._floatingResizeHandler = null;
      }
      if (state._floatingOutsideHandler) {
        document.removeEventListener(
          "pointerdown",
          state._floatingOutsideHandler,
          true,
        );
        state._floatingOutsideHandler = null;
      }
      state._floatingDocked = null;
      const existingGroup = getShadowWrapper()?.querySelector(".cookie-share-float-group");
      if (existingGroup) {
        existingGroup.remove();
      }
      state.floatingButton = null;
      if (GM_getValue(STORAGE_KEYS.SHOW_FLOATING_BUTTON, true)) {
        this.createFloatingButton();
      } else {
        fullscreenManager.updateFloatingButtonVisibility();
      }
    },

    confirmHideFloating() {
      return new Promise((resolve) => {
        const root = getShadowWrapper();
        if (!root) { resolve(null); return; }
        const container = document.createElement("div");
        container.className = "cookie-share-confirm-layer";
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
          max-width: min(400px, 90vw); border: var(--cs-card-border);
          box-shadow: var(--cs-shadow);
          font-family: -apple-system, system-ui, 'Segoe UI', sans-serif;
          color: var(--cs-text);
        `;

        dialog.innerHTML = `
          <h3 style="margin: 0 0 16px 0; color: var(--cs-heading); font-size: 18px; font-weight: 600;">${t("hideFloatingConfirmTitle")}</h3>
          <p style="margin: 0 0 24px 0; color: var(--cs-text-secondary);">${t("hideFloatingConfirmMessage", { shortcut: getShortcutLabel("C") })}</p>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button id="sessionBtn" class="cs-btn cs-btn-secondary" style="min-width: 100px; margin: 0 !important;">${t("hideSessionButton")}</button>
            <button id="permanentBtn" class="cs-btn cs-btn-danger" style="min-width: 100px; margin: 0 !important;">${t("hideForeverButton")}</button>
          </div>
        `;

        container.appendChild(dialog);
        root.appendChild(container);

        dialog.querySelector("#sessionBtn").onclick = () => {
          container.remove();
          resolve("session");
        };
        dialog.querySelector("#permanentBtn").onclick = () => {
          container.remove();
          resolve("permanent");
        };
        container.onclick = (e) => {
          if (e.target === container) {
            container.remove();
            resolve(null);
          }
        };
      });
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
          registerMenuCommands();
          themeManager.init();
          this.refreshFloatingButton();
          this.showModal({
            cookieId: idInput?.value || "",
            openSettings: true,
            openConfigTransfer: true,
            configTransferValue: "",
          });
          notification.show(t("notificationConfigImported"), "success");
        } catch (error) {
          notification.show(error.message, "error");
        }
      };

      const sensitiveBtn = document.createElement('button');
      sensitiveBtn.className = 'generate-btn';
      sensitiveBtn.textContent = '加密备份凭据 / Encrypted backup';
      sensitiveBtn.onclick = async () => {
        try { const backup = await configManager.exportSensitive(); if (backup) { transferInput.value = backup; transferContainer.open = true; } }
        catch (error) { notification.show(error.message, 'error'); }
      };
      buttonRow.appendChild(sensitiveBtn);
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

      // Language selector
      const langRow = document.createElement("div");
      langRow.className = "cs-setting-row";
      const langLabel = document.createElement("span");
      langLabel.className = "cs-setting-label";
      langLabel.textContent = t("settingsLanguage");
      const langSelector = document.createElement("div");
      langSelector.className = "cs-theme-selector";

      const createLangBtn = (language, label) => {
        const btn = document.createElement("button");
        btn.className = `cs-theme-btn${currentLanguage === language ? " active" : ""}`;
        btn.textContent = label;
        btn.onclick = () => setLanguage(language);
        return btn;
      };

      langSelector.appendChild(createLangBtn(LANGUAGES.EN, "English"));
      langSelector.appendChild(createLangBtn(LANGUAGES.ZH, "中文"));
      langRow.appendChild(langLabel);
      langRow.appendChild(langSelector);

      settingsContainer.appendChild(themeRow);
      settingsContainer.appendChild(langRow);
      settingsContainer.appendChild(
        createToggle(
          "settingsShowFloatingButton",
          STORAGE_KEYS.SHOW_FLOATING_BUTTON,
          (checked) => {
            if (checked) floatingSessionHidden = false;
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
          () => this.updateStorageModeLabels(),
          false,
        ),
      );

      container.appendChild(settingsContainer);
    },

    updateStorageModeLabels() {
      const local = GM_getValue(STORAGE_KEYS.SAVE_LOCALLY, false);
      const root = getShadowWrapper();
      const send = root?.querySelector('.send-btn');
      const receive = root?.querySelector('.receive-btn');
      if (send) send.textContent = local ? (currentLanguage === LANGUAGES.ZH ? '保存到本地' : 'Save locally') : t('sendCookieButton');
      if (receive) receive.textContent = local ? (currentLanguage === LANGUAGES.ZH ? '恢复本地账号' : 'Restore local account') : t('receiveCookieButton');
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
      closeBtn.innerHTML = CLOSE_ICON_SVG;
      closeBtn.setAttribute("aria-label", "Close");
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
          container.classList.toggle("cs-settings-open");
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
      serverInput.value = '';
      serverInput.readOnly = true;
      serverInput.placeholder = getServerUrl() ? 'Backend configured / 后台已配置' : t('placeholderServerAddress');
      const configureServerBtn = document.createElement('button');
      configureServerBtn.className = 'generate-btn';
      configureServerBtn.textContent = '设置地址 / Configure';
      configureServerBtn.onclick = () => { try { configureServer(); serverInput.placeholder = 'Backend configured / 后台已配置'; } catch (error) { notification.show(error.message, 'error'); } };
      serverContainer.appendChild(configureServerBtn);

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
      transportInput.value = '';
      transportInput.readOnly = true;
      transportInput.placeholder = getTransportSecret() ? 'Credential configured / 凭据已配置' : t('placeholderTransportSecret');

      const toggleTransportBtn = document.createElement("button");
      toggleTransportBtn.className = "generate-btn";
      toggleTransportBtn.textContent = '设置密钥 / Configure';
      toggleTransportBtn.setAttribute('aria-label', 'Configure transport secret');
      toggleTransportBtn.onclick = () => {
        try { configureSecret(); transportInput.placeholder = 'Credential configured / 凭据已配置'; }
        catch (error) { notification.show(error.message, 'error'); }
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
      prepareDialog(overlay, modal);
      overlay.appendChild(modal);
      getShadowWrapper().appendChild(overlay);

      // Event listeners
      sendBtn.onclick = () => runWithButtonLoading(sendBtn, async () => {
        try {
          if (!ensureGmCookieSupport()) return;
          const saveLocally = GM_getValue(STORAGE_KEYS.SAVE_LOCALLY, false);
          const cookieId = idInput.value.trim();
          const serverUrl = getServerUrl();
          const transportSecret = getTransportSecret();

          if (!validateCookieIdInput(cookieId)) return;

          if (saveLocally) {
            const cookies = await cookieManager.getAll();
            if (!cookies.length) {
              notification.show(t("notificationNoCookiesToSave"), "error");
              return;
            }
            const data = { id: cookieId, url: recordUrl(), cookies };
            const localKey = `cookie_share_local_${data.id}`;
            if (await GM_getValue(localKey) && !nativeConfirm('Overwrite this local record? / 覆盖此本地记录？')) return;
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
      });

      receiveBtn.onclick = () => runWithButtonLoading(receiveBtn, async () => {
        try {
          if (!ensureGmCookieSupport()) return;
          if (GM_getValue(STORAGE_KEYS.SAVE_LOCALLY, false)) {
            if (!validateCookieIdInput(idInput.value.trim())) return;
            const raw = await GM_getValue('cookie_share_local_' + idInput.value.trim());
            if (!raw) throw new Error(t('notificationLocalDataNotFound'));
            const record = JSON.parse(raw);
            if (!nativeConfirm('Restore this local account? / 恢复此本地账号？')) return;
            await cookieManager.replaceAll(record.cookies, t('notificationLocalImportFailed'), record.url);
            offerRefresh();
            return;
          }
          if (!getServerUrl()) {
            notification.show(t("notificationEnterServer"), "error");
            return;
          }
          if (!validateCookieIdInput(idInput.value.trim())) return;
          if (!getTransportSecret()) {
            notification.show(t("notificationNeedTransportSecret"), "error");
            return;
          }
          const result = await api.receiveCookies(idInput.value.trim(), getServerUrl(), getTransportSecret());
          if (!result.success) return;
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
      });

      addAccountBtn.onclick = () => runWithButtonLoading(addAccountBtn, async () => {
        if (!ensureGmCookieSupport()) return;
        if (!(await this.confirmAddAccount())) {
          return;
        }
        try {
          const saveLocally = GM_getValue(STORAGE_KEYS.SAVE_LOCALLY, false);
          const cookieId = idInput.value.trim();
          const serverUrl = getServerUrl();
          const transportSecret = getTransportSecret();

          if (!validateCookieIdInput(cookieId)) return;

          if (saveLocally) {
            const cookies = await cookieManager.getAll();
            if (!cookies.length) {
              notification.show(t("notificationNoCookiesToSave"), "error");
              return;
            }
            const data = { id: cookieId, url: recordUrl(), cookies };
            const localKey = `cookie_share_local_${data.id}`;
            if (await GM_getValue(localKey) && !nativeConfirm('Overwrite this local record? / 覆盖此本地记录？')) return;
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
          offerRefresh();
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
      });

      clearBtn.onclick = () => runWithButtonLoading(clearBtn, async () => {
        if (!ensureGmCookieSupport()) return;
        if (await this.confirmDelete()) {
          await cookieManager.clearAll();
          notification.show(t("notificationClearedSuccess"), "success");
          offerRefresh();
        }
      });

      ui.createSettingsView(settingsPanel);
      this.updateStorageModeLabels();
      const configTransferView = this.createConfigTransferView({
        idInput,
        options,
      });
      settingsPanel.appendChild(configTransferView);
      container.appendChild(settingsPanel);

      if (options.openSettings) {
        settingsPanel.classList.add("visible");
        settingsBtn.classList.add("active");
        container.classList.add("cs-settings-open");
      }
    },

    showModal(options = {}) {
      this._listController?.abort();
      const root = getShadowWrapper();
      if (!root) return;
      const existingOverlay = root.querySelector(".cookie-share-overlay");
      if (existingOverlay) existingOverlay.remove();
      this.createMainView(options);
      const overlay = root.querySelector(".cookie-share-overlay");
      const modal = root.querySelector(".cookie-share-modal");
      if (overlay && modal) {
        overlay.offsetHeight; // force reflow so the fade-in transition runs
        overlay.classList.add("visible");
        modal.classList.add("visible");
      }
    },

    hideModal() {
      const overlay = getShadowWrapper()?.querySelector(".cookie-share-overlay");
      if (overlay) {
        overlay.classList.remove("visible");
        overlay.querySelector(".cookie-share-modal")?.classList.remove("visible");
        setTimeout(() => { overlay.remove(); overlay._restoreFocus?.(); }, 220);
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
          <button class="close-btn" aria-label="Close" onclick="return false;">${CLOSE_ICON_SVG}</button>
          <div class="title-container">
            <h1>${t("cookiesListTitle")}</h1>
          </div>
          <input type="text" id="cookieShareSearch" class="cookie-id-input cookie-share-search" placeholder="${t("searchPlaceholder")}" spellcheck="false">
          <div id="cookieShareList" class="cookie-list-container"></div>
          <div style="display: flex; justify-content: center;">
            <button id="cookieShareGoToMainBtn" class="generate-btn">${t("showPanelButton")}</button>
          </div>
        </div>
      `;

      const searchInput = modal.querySelector("#cookieShareSearch");
      const cookiesList = modal.querySelector("#cookieShareList");
      searchInput.addEventListener("input", () => {
        const query = searchInput.value.trim().toLowerCase();
        const items = cookiesList.querySelectorAll(".cookie-share-item");
        let visibleCount = 0;
        items.forEach((item) => {
          const matches =
            !query || (item.dataset.searchText || "").includes(query);
          item.classList.toggle("cs-hidden", !matches);
          if (matches) visibleCount++;
        });
        let filterEmpty = cookiesList.querySelector(".cookie-share-filter-empty");
        if (visibleCount === 0 && items.length > 0) {
          if (!filterEmpty) {
            filterEmpty = document.createElement("div");
            filterEmpty.className = "cookie-share-empty cookie-share-filter-empty";
            filterEmpty.textContent = t("listFilterEmpty");
            cookiesList.appendChild(filterEmpty);
          }
        } else if (filterEmpty) {
          filterEmpty.remove();
        }
      });

      modal.querySelector(".close-btn").onclick = () => this.hideCookieList();
      modal.querySelector("#cookieShareGoToMainBtn").onclick = () => {
        this.hideCookieList();
        this.showModal();
      };

      prepareDialog(overlay, modal);
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
      overlay.offsetHeight; // force reflow so the fade-in transition runs
      overlay.classList.add("visible");
      modal.classList.add("visible");
      const cookiesList = modal.querySelector("#cookieShareList");
      this.initializeCookieList(cookiesList);
    },

    hideCookieList() {
      this._listController?.abort();
      const root = getShadowWrapper();
      const overlay = root?.querySelector(".cookie-share-overlay");
      const modal = root?.querySelector(".cookie-share-modal");
      if (overlay && modal) {
        overlay.classList.remove("visible");
        modal.classList.remove("visible");
        setTimeout(() => { overlay.remove(); overlay._restoreFocus?.(); }, 220);
      }
    },

    async initializeCookieList(cookiesList) {
      try {
        const customUrl = GM_getValue(STORAGE_KEYS.CUSTOM_URL);
        cookiesList.innerHTML = "";
        const transportSecret = getTransportSecret();
        await this.loadCombinedCookieList(
          cookiesList,
          customUrl,
          transportSecret,
        );
      } catch (error) {
        console.error("Error initializing cookies list:", error);
        cookiesList.textContent = t('notificationListInitFailed', { message: error.message });
      }
    },

    async loadCombinedCookieList(cookiesList, customUrl, transportSecret, loadOnlyLocal = false) {
      this._listController?.abort();
      const controller = new AbortController();
      this._listController = controller;
      cookiesList.replaceChildren();
      const localRoot = document.createElement('section');
      const cloudRoot = document.createElement('section');
      cookiesList.append(localRoot, cloudRoot);
      const currentHost = window.location.hostname;
      const active = () => !controller.signal.aborted && cookiesList.isConnected;
      localRoot.textContent = t('loadingCookies');
      const localTask = (async () => {
        const records = [];
        const keys = (await GM_listValues()).filter((key) => key.startsWith('cookie_share_local_'));
        for (let index = 0; index < keys.length; index++) {
          if (!active()) return;
          try {
            const raw = await GM_getValue(keys[index]);
            const data = typeof raw === 'string' ? JSON.parse(raw) : null;
            if (data && COOKIE_ID_PATTERN.test(data.id) && new URL(data.url).hostname === currentHost) {
              records.push({ id: data.id, source: 'local', url: data.url });
            }
          } catch { /* A damaged record must not hide healthy records. */ }
          if (index % 50 === 49) await new Promise((resolve) => setTimeout(resolve, 0));
        }
        if (!active()) return;
        this.renderCookieRows(localRoot, records);
        if (!records.length) localRoot.textContent = t('listEmptyLocalOnly', { host: currentHost });
      })().catch((error) => { if (active()) localRoot.textContent = t('notificationLoadLocalFailed', { message: error.message }); });
      const cloudTask = (async () => {
        if (loadOnlyLocal || !customUrl) return;
        cloudRoot.textContent = t('loadingCookies');
        if (!transportSecret) throw new Error(t('notificationNeedTransportSecret'));
        const data = await api.requestEncryptedJson({ method: 'GET',
          url: utils.validateUrl(customUrl) + '/list-cookies-by-host/' + encodeURIComponent(currentHost),
          transportSecret, signal: controller.signal });
        if (!data.success || !Array.isArray(data.cookies)) throw new Error('Invalid cloud list');
        if (!active()) return;
        const unique = new Map();
        for (const cookie of data.cookies) {
          if (COOKIE_ID_PATTERN.test(cookie.id)) unique.set(cookie.id, { id: cookie.id, url: cookie.url, source: 'cloud' });
        }
        this.renderCookieRows(cloudRoot, [...unique.values()]);
      })().catch((error) => { if (active()) cloudRoot.textContent = t('notificationLoadCloudFailed', { message: error.message }); });
      await Promise.all([localTask, cloudTask]);
    },

    renderCookieRows(cookiesList, records) {
      cookiesList.replaceChildren();
        records.forEach((cookie) => {
          const item = document.createElement("div");
          item.className = "cookie-share-item";
          item.dataset.searchText =
            `${cookie.id} ${cookie.url || ""}`.toLowerCase();
          const sourceText = t(
            cookie.source === "local" ? "sourceLocal" : "sourceCloud",
          );

          const info = document.createElement("div");
          info.className = "cookie-share-item-info";

          const idLine = document.createElement("span");
          idLine.className = "cookie-share-item-id";
          idLine.textContent = `ID: ${cookie.id} `;
          const sourceSpan = document.createElement("span");
          sourceSpan.className = "cookie-share-item-source";
          sourceSpan.textContent = `(${sourceText})`;
          idLine.appendChild(sourceSpan);
          info.appendChild(idLine);

          if (cookie.url) {
            const urlLine = document.createElement("div");
            urlLine.className = "cookie-share-item-url";
            urlLine.textContent = cookie.url;
            urlLine.title = cookie.url;
            info.appendChild(urlLine);
          }

          const buttons = document.createElement("div");
          buttons.className = "cookie-share-buttons";
          const makeButton = (className, labelKey) => {
            const button = document.createElement("button");
            button.className = className;
            button.textContent = t(labelKey);
            button.dataset.id = cookie.id;
            button.dataset.source = cookie.source;
            buttons.appendChild(button);
            return button;
          };
          makeButton("cookie-share-copy", "copyButton");
          makeButton("cookie-share-receive", "receiveButton");
          makeButton("cookie-share-delete", "deleteButton");

          item.appendChild(info);
          item.appendChild(buttons);
          cookiesList.appendChild(item);
        });

      this.attachButtonListeners(cookiesList);
      applyCookieFilter(cookiesList);
    },

    attachButtonListeners(container) {
      container.querySelectorAll(".cookie-share-copy").forEach((button) => {
        button.onclick = async () => {
          try {
            await utils.copyToClipboard(button.dataset.id);
            notification.show(t("notificationIdCopied"), "success");
          } catch (error) {
            notification.show(t("notificationCopyFailed"), "error");
          }
        };
      });

      container.querySelectorAll(".cookie-share-receive").forEach((button) => {
        button.onclick = () => runWithButtonLoading(button, async () => {
          if (!ensureGmCookieSupport()) return;
          const cookieId = button.dataset.id;
          const source = button.dataset.source;
          const customUrl = GM_getValue(STORAGE_KEYS.CUSTOM_URL);
          const transportSecret = getTransportSecret();
          const sourceText = t(
            source === "local" ? "sourceLocal" : "sourceCloud",
          );

          try {
            if (source === "local") {
              if (!nativeConfirm('Replace this site’s cookies with this local record? / 使用本地记录切换此站点账号？')) return;
              const localKey = `cookie_share_local_${cookieId}`;
              const rawData = await GM_getValue(localKey);
              if (!rawData) throw new Error(t("notificationLocalDataNotFound"));
              const cookieData = JSON.parse(rawData);
              if (!Array.isArray(cookieData.cookies))
                throw new Error(t("notificationLocalDataInvalid"));
              const importedCount = await cookieManager.replaceAll(
                cookieData.cookies,
                t("notificationLocalImportFailed"),
                cookieData.url,
              );
              notification.show(
                t("notificationImportSuccess", { count: importedCount }),
                "success",
              );
              offerRefresh();
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
              const result = await api.receiveCookies(cookieId, customUrl, transportSecret);
              if (!result.success) return;
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
        });
      });

      container.querySelectorAll(".cookie-share-delete").forEach((button) => {
        button.onclick = () => runWithButtonLoading(button, async () => {
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
                await api.requestEncryptedJson({
                  method: "DELETE",
                  url: `${customUrl}/delete`,
                  body: { key: cookieId },
                  transportSecret,
                });
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
        });
      });
    },
  };

  // Credentials stay in userscript storage/closures, not in the host document.
  const nativePrompt = window.prompt.bind(window);
  const nativeConfirm = window.confirm.bind(window);
  const DEVICE_TOKEN_KEY = 'cookie_share_device_token';
  const capabilityCache = new Map();
  let uiOperationBusy = false;

  function getTransportSecret() {
    return GM_getValue(DEVICE_TOKEN_KEY, '') || GM_getValue(STORAGE_KEYS.TRANSPORT_SECRET, '');
  }
  function getServerUrl() { return GM_getValue(STORAGE_KEYS.CUSTOM_URL, ''); }
  function recordUrl() { return window.location.origin + window.location.pathname; }
  function configureSecret(device = false) {
    const value = nativePrompt(device ? 'Device token (blank removes it) / 设备令牌（留空移除）' : 'Transport secret / 传输密钥（不显示原值）', '');
    if (value === null) return;
    if (device && value && !/^[A-Za-z0-9_-]{43,128}$/.test(value)) throw new Error('Expected a server-issued random device token.');
    GM_setValue(device ? DEVICE_TOKEN_KEY : STORAGE_KEYS.TRANSPORT_SECRET, value);
    capabilityCache.clear();
  }
  function configureServer() {
    const value = nativePrompt('Backend URL, including secret path / 后台地址（含秘密路径）', getServerUrl());
    if (value === null) return;
    const url = utils.validateUrl(value);
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) &&
        !nativeConfirm('HTTP exposes traffic and credentials. Continue only on a trusted private network? / HTTP 会暴露通信，确定继续？')) return;
    GM_setValue(STORAGE_KEYS.CUSTOM_URL, url);
    capabilityCache.clear();
  }

  async function capabilities(base) {
    base = utils.validateUrl(base);
    if (!capabilityCache.has(base)) {
      if (capabilityCache.size >= 8) capabilityCache.clear();
      const promise = new Promise((resolve) => {
        GM_xmlhttpRequest({ method: 'GET', url: base + '/capabilities', timeout: 5000,
          anonymous: true, redirect: 'error',
          onload: (response) => {
            try {
              const data = JSON.parse(response.responseText);
              resolve(response.status === 200 && data.success && Array.isArray(data.protocolVersions) ? data : {});
            } catch { resolve({}); }
          }, ontimeout: () => resolve({}), onerror: () => resolve({}), onabort: () => resolve({}) });
      });
      capabilityCache.set(base, promise);
    }
    return capabilityCache.get(base);
  }

  async function deviceCipher(secret, body, context, envelope) {
    const salt = envelope ? transportCrypto.base64UrlDecode(envelope.salt) : crypto.getRandomValues(new Uint8Array(16));
    const iv = envelope ? transportCrypto.base64UrlDecode(envelope.iv) : crypto.getRandomValues(new Uint8Array(12));
    if (salt.length !== 16 || iv.length !== 12) throw new Error('Invalid device envelope');
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'HKDF', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt,
      info: new TextEncoder().encode('cookie-share/device-protocol/v2') }, material,
      { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const params = { name: 'AES-GCM', iv,
      additionalData: new TextEncoder().encode(JSON.stringify({ ...context, direction: envelope ? 'response' : 'request' })) };
    if (envelope) {
      if (envelope.version !== 2 || typeof envelope.payload !== 'string' || envelope.payload.length > 12 * 1024 * 1024) throw new Error('Invalid device envelope');
      return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt(params, key, transportCrypto.base64UrlDecode(envelope.payload))));
    }
    const data = new Uint8Array(await crypto.subtle.encrypt(params, key, new TextEncoder().encode(JSON.stringify(body))));
    return { version: 2, salt: transportCrypto.base64UrlEncode(salt), iv: transportCrypto.base64UrlEncode(iv), payload: transportCrypto.base64UrlEncode(data) };
  }

  function applyCookieFilter(container) {
    const query = container.closest('.cookie-share-modal')?.querySelector('.cookie-share-search')?.value.trim().toLowerCase() || '';
    for (const item of container.querySelectorAll('.cookie-share-item')) {
      item.classList.toggle('cs-hidden', !!query && !item.dataset.searchText.includes(query));
    }
  }

  function prepareDialog(overlay, modal) {
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', modal.querySelector('h1, h3')?.textContent || 'Cookie Share');
    modal.tabIndex = -1;
    const previous = shadowRoot?.activeElement || document.activeElement;
    overlay._restoreFocus = () => { if (previous?.isConnected) previous.focus(); };
    queueMicrotask(() => { if (modal.isConnected) modal.focus(); });
    modal.addEventListener('keydown', (event) => {
      if (!event.isTrusted || event.key !== 'Tab') return;
      const nodes = [...modal.querySelectorAll('button, input, textarea, select, [tabindex="0"]')].filter((n) => !n.disabled && n.getClientRects().length);
      if (!nodes.length) { event.preventDefault(); modal.focus(); return; }
      const current = shadowRoot.activeElement;
      if (event.shiftKey && (current === nodes[0] || current === modal)) { event.preventDefault(); nodes.at(-1).focus(); }
      else if (!event.shiftKey && (current === nodes.at(-1) || current === modal)) { event.preventDefault(); nodes[0].focus(); }
    });
  }

  function offerRefresh() {
    notification.show('Cookie 已写入并核对 / Cookies written and verified.', 'success');
    if (nativeConfirm('Cookie 已核对。现在刷新页面？ / Cookies verified. Reload now?')) window.location.reload();
  }

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

    // Match on event.code (physical key): on macOS Option+Shift+letter
    // produces a special character in event.key, which used to break the
    // advertised Option+Shift shortcuts.
    const matchesShortcut = (event, actionKey) => {
      if (event.code !== `Key${actionKey.toUpperCase()}`) return false;
      if (!event.shiftKey) return false;
      const hasMacShortcut =
        isMacOS && !event.ctrlKey && (event.metaKey || event.altKey);
      const hasDefaultShortcut =
        !isMacOS && !event.ctrlKey && !event.metaKey && event.altKey;
      return hasMacShortcut || hasDefaultShortcut;
    };

    const isEditableTarget = (event) => {
      const target = shadowRoot?.activeElement || (event.composedPath ? event.composedPath()[0] : event.target);
      if (!target || target.nodeType !== 1) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable === true
      );
    };

    const handleKeyboardShortcuts = (e) => {
      if (!e.isTrusted) return;
      const root = getShadowWrapper();
      if (!root) return;
      if (e.key === "Escape") {
        // A confirm dialog is on top; let its own buttons handle dismissal.
        const confirmLayer = root.querySelector('.cookie-share-confirm-layer');
        if (confirmLayer) {
          const cancel = confirmLayer.querySelector('#cancelBtn');
          if (cancel) { e.preventDefault(); cancel.onclick?.(); }
          return;
        }
        const overlay = root.querySelector(".cookie-share-overlay.visible");
        if (!overlay) return;
        e.preventDefault();
        e.stopPropagation();
        if (overlay.querySelector(".cookie-list-modal")) {
          ui.hideCookieList();
        } else {
          ui.hideModal();
        }
        return;
      }
      // Don't hijack typing: Option+Shift+letter types special chars on macOS.
      if (isEditableTarget(e)) return;
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

    document.addEventListener("keydown", handleKeyboardShortcuts, {
      capture: true,
    });

    registerMenuCommands();
  }

  let registeredMenuCommandIds = [];

  function registerMenuCommands() {
    // GM_unregisterMenuCommand is unavailable in some managers; menu labels
    // then keep the previous language until the next page load. Skip
    // re-registration there, otherwise entries would stack up as duplicates.
    const canUnregister = typeof GM_unregisterMenuCommand === "function";
    if (registeredMenuCommandIds.length > 0 && !canUnregister) {
      return;
    }
    if (canUnregister) {
      registeredMenuCommandIds.forEach((commandId) => {
        try {
          GM_unregisterMenuCommand(commandId);
        } catch (e) {
          // ignore
        }
      });
      registeredMenuCommandIds = [];
    }
    registeredMenuCommandIds = [
      GM_registerMenuCommand(t("menuShowShare"), () => ui.showModal()),
      GM_registerMenuCommand(t("menuShowList"), () => ui.showCookieList()),
      GM_registerMenuCommand(t("menuSwitchLanguage"), switchLanguage),
      GM_registerMenuCommand('Configure backend / 设置后台', () => { try { configureServer(); } catch (error) { notification.show(error.message, 'error'); } }),
      GM_registerMenuCommand('Configure device token / 设置设备令牌', () => { try { configureSecret(true); } catch (error) { notification.show(error.message, 'error'); } }),
      GM_registerMenuCommand('Restore recovery backup / 恢复备份', async () => {
        if (!nativeConfirm('Restore the recovery backup for this site? / 恢复此站点备份？')) return;
        try { await cookieManager.restoreBackup(); offerRefresh(); } catch (error) { notification.show(error.message, 'error'); }
      }),
    ];
  }

  function setLanguage(newLanguage) {
    if (newLanguage !== LANGUAGES.EN && newLanguage !== LANGUAGES.ZH) return;
    if (newLanguage === currentLanguage) return;
    GM_setValue(STORAGE_KEYS.LANGUAGE_PREFERENCE, newLanguage);
    currentLanguage = newLanguage;
    registerMenuCommands();

    // Re-open whichever modal is showing so its text updates immediately,
    // preserving input and settings/config-transfer state.
    const root = getShadowWrapper();
    const overlay = root?.querySelector(".cookie-share-overlay");
    if (overlay) {
      const isListModal = Boolean(overlay.querySelector(".cookie-list-modal"));
      if (isListModal) {
        overlay.remove();
        ui.showCookieList();
      } else {
        const cookieId =
          overlay.querySelector(".cookie-id-input")?.value || "";
        const openSettings = Boolean(
          overlay.querySelector(".cookie-share-container.cs-settings-open"),
        );
        const transferDetails = overlay.querySelector(
          ".cookie-share-config-transfer",
        );
        const openConfigTransfer = Boolean(transferDetails?.open);
        const configTransferValue =
          transferDetails?.querySelector(".cookie-share-config-textarea")
            ?.value || "";
        overlay.remove();
        ui.showModal({
          cookieId,
          openSettings,
          openConfigTransfer,
          configTransferValue,
        });
      }
    }
    notification.show(t("notificationLanguageSwitched"), "success");
  }

  function switchLanguage() {
    setLanguage(currentLanguage === LANGUAGES.EN ? LANGUAGES.ZH : LANGUAGES.EN);
  }

  init();
})();
