// ==UserScript==
// @name         Cookie Share
// @namespace    https://github.com/fangyuan99/cookie-share
// @version      0.0.2
// @description  Sends and receives cookies with your friends
// @author       fangyuan99,aBER
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
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
      return document.cookie
        .split(";")
        .filter((cookie) => cookie.trim())
        .map((cookie) => {
          const [name, ...valueParts] = cookie.split("=").map((c) => c.trim());
          const value = valueParts.join("=");
          return {
            name,
            value,
            domain: window.location.hostname,
            path: "/",
            secure: window.location.protocol === "https:",
            sameSite: "Lax",
          };
        });
    },

    set(cookie) {
      let cookieStr = `${cookie.name}=${cookie.value}`;
      if (cookie.path) cookieStr += `; path=${cookie.path}`;
      if (cookie.domain) cookieStr += `; domain=${cookie.domain}`;
      if (cookie.secure) cookieStr += "; secure";
      if (cookie.sameSite) cookieStr += `; samesite=${cookie.sameSite}`;
      document.cookie = cookieStr;
    },

    clearAll() {
      try {
        const cookies = document.cookie.split(";");
        const domain = window.location.hostname;
        const topDomain = domain.split(".").slice(-2).join(".");

        // 获取所有可能的域名组合
        const domains = [
          domain, // 完整域名
          "." + domain, // 带点的完整域名
          topDomain, // 顶级域名
          "." + topDomain, // 带点的顶级域名
          domain.replace(/^www\./, ""), // 无www的域名
          domain.replace(/^www\./, "."), // 无www带点的域名
          "", // 空域名
        ];

        // 获取所有可能的路径
        const paths = ["/", "/admin", "", "*"];

        // 获取所有可能的协议
        const protocols = ["https:", "http:"];

        for (let cookie of cookies) {
          const eqPos = cookie.indexOf("=");
          const name =
            eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          if (!name) continue;

          // 遍历所有可能的组合
          for (let domain of domains) {
            for (let path of paths) {
              for (let protocol of protocols) {
                // 构建完整的cookie URL
                const cookieUrl = `${protocol}//${domain}${path}`;

                // 基本cookie字符串
                let cookieStr = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;

                // 添加路径
                if (path) {
                  cookieStr += `; path=${path}`;
                }

                // 添加域名
                if (domain) {
                  cookieStr += `; domain=${domain}`;
                }

                // 尝试不同的属性组合
                const attributes = [
                  "",
                  "; secure",
                  "; samesite=lax",
                  "; samesite=strict",
                  "; secure; samesite=lax",
                  "; secure; samesite=strict",
                ];

                for (let attr of attributes) {
                  document.cookie = cookieStr + attr;
                }
              }
            }
          }
        }

        // 验证是否清除成功
        if (document.cookie) {
          console.warn("Some cookies could not be cleared:", document.cookie);
          // 最后尝试使用通配符方式清除
          document.cookie.split(";").forEach(function (c) {
            document.cookie =
              c.trim().split("=")[0] +
              "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=." +
              domain;
          });
        }

        return true;
      } catch (error) {
        console.error("Error clearing cookies:", error);
        return false;
      }
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
        const cookies = cookieManager.getAll();
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
          cookies: cookies.map((cookie) => ({
            ...cookie,
            domain: cookie.domain || window.location.hostname,
            path: cookie.path || "/",
            secure: cookie.secure === true,
            sameSite: cookie.sameSite || "Lax",
            hostOnly: false,
            httpOnly: false,
            session: false,
          })),
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

        cookieManager.clearAll();

        let importedCount = 0;
        for (const cookie of response.response.cookies) {
          if (cookie?.name && cookie?.value) {
            cookieManager.set(cookie);
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

      const cookieSvg = `<svg t="1732536814920" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1636" width="128" height="128"><path d="M1003.56796 470.474919c-59.400116-20.998041-99.598195-77.398151-99.598194-140.398274 1.202002-10.20202-3.600007-18.600036-11.400023-25.800051-6.600013-5.402011-16.798033-7.800015-25.198049-6.602013-50.402098 7.200014-98.400192-7.200014-135.000264-36.600071s-62.402122-73.798144-66.60013-125.398245c-0.600001-9.002018-6.002012-17.402034-13.802027-22.800045-7.800015-4.802009-17.398034-6.002012-26.400051-2.402004-81.600159 29.400057-158.400309-22.200043-188.998369-92.398181-6.002012-13.202026-19.802039-20.40204-34.200067-17.398034-115.202225 25.80005-218.802427 98.120192-289.600566 189.32237-163.79832 210.600411-147.000287 500.402977 36.600072 684.603337 199.80239 199.196389 522.00102 199.196389 721.203408 0 92.39818-92.40218 153.4003-224.126438 153.4003-364.524712-1.206002-19.802039-1.806004-33.000064-20.40604-39.604077z" fill="#FEA832" p-id="1637"></path><path d="M1023.968 510.076996c0 140.398274-61.000119 272.122531-153.4003 364.524712-199.200389 199.196389-521.401018 199.196389-721.203408 0l583.003138-613.527198c36.600071 29.400057 84.598165 43.798086 135.000264 36.600071 8.400016-1.198002 18.600036 1.202002 25.198049 6.602013 7.800015 7.200014 12.602025 15.59603 11.400023 25.800051 0 63.000123 40.198079 119.400233 99.598194 140.398274 18.604036 6.604013 19.204038 19.802039 20.40404 39.602077z" fill="#FE9923" p-id="1638"></path><path d="M386.968756 624.999221c-15.000029-13.198026-35.402069-20.998041-57.000112-20.998041-49.802097 0-90.000176 40.198079-90.000175 90.000175 0 23.400046 9.002018 44.400087 23.400045 60.000118 16.198032 18.600036 40.198079 30.000059 66.60013 30.000058 49.802097 0 90.000176-40.202079 90.000176-90.000176-0.002-28.202055-12.602025-52.800103-33.000064-69.002134z" fill="#994C0F" p-id="1639"></path><path d="M629.96723 604.00118c-49.628097 0-90.000176-40.372079-90.000175-90.000176s40.372079-90.000176 90.000175-90.000176 90.000176 40.372079 90.000176 90.000176-40.370079 90.000176-90.000176 90.000176zM599.967172 844.001648c-33.076065 0-60.000117-26.924053-60.000117-60.000117s26.924053-60.000117 60.000117-60.000117 60.000117 26.924053 60.000117 60.000117-26.924053 60.000117-60.000117 60.000117z" fill="#713708" p-id="1640"></path><path d="M359.966703 424.000828c-33.076065 0-60.000117-26.924053-60.000117-60.000117s26.924053-60.000117 60.000117-60.000117 60.000117 26.924053 60.000117 60.000117-26.924053 60.000117-60.000117 60.000117z" fill="#994C0F" p-id="1641"></path><path d="M808.477579 636.261243m-30.000059 0a30.000059 30.000059 0 1 0 60.000118 0 30.000059 30.000059 0 1 0-60.000118 0Z" fill="#713708" p-id="1642"></path><path d="M208.456407 516.261008m-30.000058 0a30.000059 30.000059 0 1 0 60.000117 0 30.000059 30.000059 0 1 0-60.000117 0Z" fill="#994C0F" p-id="1643"></path><path d="M419.96682 694.001355c0 49.798097-40.198079 90.000176-90.000176 90.000176-26.400052 0-50.402098-11.400022-66.60013-30.000058l123.600242-129.002252c20.40004 16.202032 33.000064 40.80008 33.000064 69.002134z" fill="#713708" p-id="1644"></path></svg>`;

      // Create button element
      const floatingBtn = document.createElement("button");
      floatingBtn.innerHTML = cookieSvg;
      floatingBtn.className = "cookie-share-floating-btn";

      floatingBtn.onclick = () => this.showModal();
      document.body.appendChild(floatingBtn);

      // Save button reference
      state.floatingButton = floatingBtn;

      // Update visibility on initialization
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
                    <h1>Cookie Share</h1>
                    <div class="cookie-share-version">
                        <span>Version 0.0.1</span>
                        <a href="https://github.com/fangyuan99/cookie-share" target="_blank">GitHub</a>
                        <a href="#" class="admin-panel-a">Admin Panel</a>
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

                    <button class="clear-btn">Clear All Cookies for This Site</button>
                </div>
            `;

      modal.querySelector(".admin-panel-a").onclick = () => {
        const serverUrl = modal.querySelector(".server-url-input").value.trim();

        if (!serverUrl) {
          alert("Please enter the server address first");
          return;
        }

        try {
          // Validate URL format
          utils.validateUrl(serverUrl);

          // Construct admin panel URL
          const adminUrl = serverUrl.endsWith("/")
            ? `${serverUrl}admin`
            : `${serverUrl}/admin`;

          // Open admin panel in a new tab
          window.open(adminUrl, "_blank");
        } catch (error) {
          alert("Invalid server address");
        }
      };

      GM_addStyle(`
                .server-url-input {
                    width: 100%;
                    height: 36px;
                    padding: 0 12px;
                    margin: 16px 0;  // Change this to ensure consistent vertical spacing
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 14px;
                    box-sizing: border-box;}

                .header-actions {
                    display: flex !important;
                    justify-content: space-between !important;
                    align-items: center !important;
                    margin-bottom: 16px !important;
                }

                .admin-panel-btn {
                    padding: 4px 12px !important;
                    background: #2196F3 !important;
                    border: none !important;
                    border-radius: 4px !important;
                    cursor: pointer !important;
                    font-size: 12px !important;
                    color: white !important;
                    transition: background 0.3s !important;
                }

                .admin-panel-btn:hover {
                    background: #1976D2 !important;
                }
            `);

      // Add event listeners
      modal.querySelector(".close-btn").onclick = ui.hideModal;
      modal.querySelector(".generate-btn").onclick = () => {
        const idInput = modal.querySelector(".cookie-id-input");
        idInput.value = utils.generateId();
      };

      modal.querySelector(".send-btn").onclick = async () => {
        try {
          const urlInput = modal.querySelector(".server-url-input");
          const idInput = modal.querySelector(".cookie-id-input");

          if (!urlInput.value.trim()) {
            alert("Please enter the server address");
            return;
          }

          if (!idInput.value.trim()) {
            alert("Please enter or generate a Cookie ID");
            return;
          }

          GM_setValue(STORAGE_KEYS.CUSTOM_URL, urlInput.value.trim());
          const result = await api.sendCookies(
            idInput.value.trim(),
            urlInput.value.trim()
          );
          alert(result.message || "Sent successfully");
        } catch (error) {
          alert("Send failed: " + error.message);
        }
      };

      modal.querySelector(".receive-btn").onclick = async () => {
        try {
          const urlInput = modal.querySelector(".server-url-input");
          const idInput = modal.querySelector(".cookie-id-input");

          if (!urlInput.value.trim()) {
            alert("Please enter the server address");
            return;
          }

          if (!idInput.value.trim()) {
            alert("Please enter a Cookie ID");
            return;
          }

          GM_setValue(STORAGE_KEYS.CUSTOM_URL, urlInput.value.trim());
          const result = await api.receiveCookies(
            idInput.value.trim(),
            urlInput.value.trim()
          );
          alert(result.message || "Received successfully");
        } catch (error) {
          alert("Receive failed: " + error.message);
        }
      };

      modal.querySelector(".clear-btn").onclick = () => {
        if (confirm("Are you sure you want to clear all cookies?")) {
          cookieManager.clearAll();
          alert("Cookies have been cleared, the page will refresh shortly");
          // Use a short delay to ensure the message is seen
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
  };

  // ===================== Initialize =====================
  function init() {
    ui.injectStyles();
    ui.createMainView();
    ui.createFloatingButton();

    // Add fullscreen event listeners
    document.addEventListener("fullscreenchange", () =>
      fullscreenManager.handleFullscreenChange()
    );
    document.addEventListener("webkitfullscreenchange", () =>
      fullscreenManager.handleFullscreenChange()
    );

    GM_registerMenuCommand("Show Cookie Share", () => ui.showModal());
  }

  // Start the application
  init();
})();
