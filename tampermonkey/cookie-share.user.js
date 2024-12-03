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
// @connect      *
// ==/UserScript==

(function () {
    'use strict';

    // ===================== Constants =====================
    const STORAGE_KEYS = {
        CUSTOM_URL: 'cookie_share_custom_url',
        ADMIN_PASSWORD: 'cookie_share_admin_password',
        SHOW_FLOATING_BUTTON: 'cookie_share_show_floating_button',
        AUTO_HIDE_FULLSCREEN: 'cookie_share_auto_hide_fullscreen'
    };


    // ===================== State Management =====================
    const state = {
        isFullscreen: false,
        floatingButton: null,
        sendModal: null,
        receiveModal: null,
        settingsModal: null
    };
    // ===================== Fullscreen Handlers =====================
    const fullscreenManager = {
        handleFullscreenChange() {
            state.isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
            this.updateFloatingButtonVisibility();
        },

        updateFloatingButtonVisibility() {
            if (!state.floatingButton) return;

            const showFloatingButton = GM_getValue(STORAGE_KEYS.SHOW_FLOATING_BUTTON, true);
            const autoHideFullscreen = GM_getValue(STORAGE_KEYS.AUTO_HIDE_FULLSCREEN, true);

            const shouldHide = state.isFullscreen && autoHideFullscreen;
            state.floatingButton.style.display = (!shouldHide && showFloatingButton) ? 'block' : 'none';
        }
    };




    // ===================== Cookie Management =====================
    const cookieManager = {
        getAll() {
            return document.cookie
                .split(';')
                .filter(cookie => cookie.trim())
                .map(cookie => {
                    const [name, ...valueParts] = cookie.split('=').map(c => c.trim());
                    const value = valueParts.join('=');
                    return {
                        name,
                        value,
                        domain: window.location.hostname,
                        path: '/',
                        secure: window.location.protocol === 'https:',
                        sameSite: 'Lax'
                    };
                });
        },

        set(cookie) {
            let cookieStr = `${cookie.name}=${cookie.value}`;
            if (cookie.path) cookieStr += `; path=${cookie.path}`;
            if (cookie.domain) cookieStr += `; domain=${cookie.domain}`;
            if (cookie.secure) cookieStr += '; secure';
            if (cookie.sameSite) cookieStr += `; samesite=${cookie.sameSite}`;
            document.cookie = cookieStr;
        },

        clearAll() {
            const cookies = document.cookie.split(';');

            for (let cookie of cookies) {
                const eqPos = cookie.indexOf('=');
                const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
                document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';

                // 同时也清除其他可能的路径
                document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=' + window.location.hostname;
                document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.' + window.location.hostname;
            }
        }
    };

    // ===================== Utility Functions =====================
    const utils = {
        validateUrl(url) {
            try {
                if (!/^https?:\/\//i.test(url)) {
                    url = 'https://' + url;
                }
                url = url.replace(/\/+$/, '');
                new URL(url);
                return url;
            } catch (e) {
                throw new Error('Invalid URL format');
            }
        },

        generateId(length = 10) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            return Array.from(
                { length },
                () => chars.charAt(Math.floor(Math.random() * chars.length))
            ).join('');
        }
    };

    // ===================== API Operations =====================
    const api = {
        async sendCookies(cookieId, customUrl) {
            try {
                const cookies = cookieManager.getAll();
                if (!cookies.length) {
                    return { success: false, message: 'No cookies to send on the current page' };
                }

                const formattedUrl = utils.validateUrl(customUrl);
                const data = {
                    id: cookieId,
                    url: window.location.href,
                    cookies: cookies.map(cookie => ({
                        ...cookie,
                        domain: cookie.domain || window.location.hostname,
                        path: cookie.path || '/',
                        secure: cookie.secure === true,
                        sameSite: cookie.sameSite || 'Lax',
                        hostOnly: false,
                        httpOnly: false,
                        session: false
                    }))
                };

                return new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'POST',
                        url: `${formattedUrl}/send-cookies`,
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        data: JSON.stringify(data),
                        responseType: 'json',
                        timeout: 10000,
                        onload: response => {
                            if (response.status >= 200 && response.status < 300) {
                                resolve(response.response || { success: true });
                            } else {
                                reject(new Error(`Server returned error: ${response.status}\n${response.responseText}`));
                            }
                        },
                        onerror: () => reject(new Error('Network request failed')),
                        ontimeout: () => reject(new Error('Request timeout'))
                    });
                });
            } catch (error) {
                console.error('Error sending cookies:', error);
                throw error;
            }
        },

        async receiveCookies(cookieId, customUrl) {
            try {
                const formattedUrl = utils.validateUrl(customUrl);
                const response = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: `${formattedUrl}/receive-cookies/${cookieId}`,
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        responseType: 'json',
                        timeout: 10000,
                        onload: resolve,
                        onerror: () => reject(new Error('Request failed')),
                        ontimeout: () => reject(new Error('Request timeout'))
                    });
                });

                if (!response?.response?.success || !Array.isArray(response.response.cookies)) {
                    throw new Error('Invalid data format');
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
                    throw new Error('No cookies were successfully imported');
                }

                setTimeout(() => window.location.reload(), 500);
                return { success: true, message: `Successfully imported ${importedCount} cookies` };
            } catch (error) {
                console.error('Error receiving cookies:', error);
                throw error;
            }
        }
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
            const showFloatingButton = GM_getValue(STORAGE_KEYS.SHOW_FLOATING_BUTTON, true);
            if (!showFloatingButton) {
                return;
            }

            const cookieSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 64 64"><path fill="#dda85f" d="m36.9 22.7l2.5-18.6C37 3.5 34.6 2 32 2s-5 1.5-7.5 2.2c-2.5.6-5.3.5-7.5 1.8s-3.6 3.8-5.4 5.6S7.3 14.8 6 17s-1.2 5-1.9 7.5C3.5 27 2 29.4 2 32s1.5 5 2.2 7.5c.6 2.5.5 5.3 1.8 7.5s3.8 3.6 5.6 5.4s3.1 4.3 5.4 5.6c2.2 1.3 5 1.2 7.5 1.9c2.5.6 4.9 2.1 7.5 2.1s5-1.5 7.5-2.2s5.3-.6 7.5-1.9s3.6-3.8 5.4-5.6s4.3-3.1 5.6-5.4c1.3-2.2 1.2-5 1.9-7.5c.6-2.4 2.1-4.8 2.1-7.4s-2.1-8.1-2.1-8.1z"/><path fill="#f2cb7d" d="M59.4 22.4c-1 .3-2.4.2-3.9-.4c-2.1-.8-3.4-2.5-3.8-4.5c-1 .3-3.4 0-5-1c-2.4-1.5-2.9-5.7-2.9-5.7c-2.7-.8-4.7-4-4.4-6.7c-2.2-.6-5-.5-7.4-.5s-4.6 1.4-6.8 2c-2.3.6-4.9.5-6.9 1.7s-3.3 3.5-4.9 5.1c-1.7 1.7-4 2.9-5.1 4.9c-1.2 2-1.1 4.6-1.7 6.9c-.6 2.2-2 4.4-2 6.8s1.4 4.6 2 6.8c.6 2.3.5 4.9 1.7 6.9s3.5 3.3 5.1 4.9c1.7 1.7 2.9 4 4.9 5.1c2 1.2 4.6 1.1 6.9 1.7c2.2.6 4.4 2 6.8 2s4.6-1.4 6.8-2c2.3-.6 4.9-.5 6.9-1.7s3.3-3.5 4.9-5.1c1.7-1.7 4-2.9 5.1-4.9c1.2-2 1.1-4.6 1.7-6.9c.6-2.2 3-4 3.3-6.4c.8-3.9-1.2-8.3-1.3-9"/><path fill="#dda85f" d="m50.1 10.8l-1.4 1.4l-1.3-1.4l1.3-1.3zm5.7 7l-.6.7l-.7-.7l.7-.7zm-5-4.6l-.7.7l-.7-.7l.7-.7zm-6.2-6.1l-.7.7l-.7-.7l.7-.7zm12.6 13.2l-.7.7l-.7-.7l.7-.7zm.6-2.5l-.7.7l-.7-.7l.7-.7z"/><path fill="#6d4934" d="M11.8 20.6c-1 1.7.5 4.8 2.5 5.7c2.9 1.2 4.6 1.4 6.4-1.7c.6-1.1 1.4-4 1.1-4.7c-.4-1-2.1-3-3.2-3c-3.1.1-6.1 2.5-6.8 3.7"/><path fill="#a37f6a" d="M12.3 20.6c-.7 1.2 1.1 4.8 3.5 4.5c3.3-.4 3-7.2 1.6-7.2c-2.4 0-4.6 1.8-5.1 2.7"/><path fill="#6d4934" d="M45.2 39.1c1.4-.4 2.4-2.9 1.8-4.4c-.9-2.3-1.8-3.3-4.4-2.6c-.9.3-3 1.4-3.2 1.9c-.3.8-.5 2.8.1 3.4c1.7 1.7 4.7 2 5.7 1.7"/><path fill="#a37f6a" d="M43.8 36.7c1.1-.3 2.8-3.7 1-3.9c-3.1-.5-5.5 1-5.2 2.7s3.4 1.4 4.2 1.2"/><path fill="#6d4934" d="M24.9 44.5c-.3-1.2-2.5-2.1-3.9-1.5c-2 .8-2.9 1.5-2.2 3.8c.2.8 1.2 2.6 1.7 2.7c.7.3 2.4.4 2.9-.1c1.5-1.4 1.7-4 1.5-4.9"/><path fill="#a37f6a" d="M23.2 43.6c-.2-.9-4.4.4-4 2c.8 2.7.8 3.1 1.6 3c1.5-.4 2.5-4.3 2.4-5"/><path fill="#6d4934" d="M51.1 25.5c-1.2.3-2.1 2.5-1.5 3.9c.8 2 2.7 2.3 4.8 1.2c1.8-.9 1.9-4.1 1.4-4.7c-1.5-1.5-3.8-.6-4.7-.4"/><path fill="#a37f6a" d="M50.6 26.6c-.6.7-1.1 3.5.4 3.1c2.7-.8 4.6-3.5 3.4-3.9c-1.5-.5-3.1 0-3.8.8"/><path fill="#6d4934" d="m22.74 16.112l1.98-1.98l1.98 1.98l-1.98 1.98z"/><path fill="#dda85f" d="m14.706 33.483l1.979-1.98l1.98 1.979l-1.979 1.98zm19.992 11.328l1.98-1.98l1.98 1.98l-1.98 1.98zm-2.66-5.522l2.687-2.687l2.687 2.687l-2.687 2.687zM24.696 9.827l2.687-2.687l2.687 2.687l-2.687 2.687z"/><path fill="#6d4934" d="m41.122 46.347l1.98-1.98l1.98 1.98l-1.98 1.98zm7.954-11.132l1.98-1.98l1.98 1.98l-1.98 1.98zm-7.264-10.578l.99-.99l.99.99l-.99.99zM13.726 38.266l.99-.99l.99.99l-.99.99z"/></svg>
                `;

            // Create button element
            const floatingBtn = document.createElement('button');
            floatingBtn.innerHTML = cookieSvg;
            floatingBtn.className = 'cookie-share-floating-btn';

            floatingBtn.onclick = () => this.showModal();
            document.body.appendChild(floatingBtn);

            // Save button reference
            state.floatingButton = floatingBtn;

            // Update visibility on initialization
            fullscreenManager.updateFloatingButtonVisibility();
        },

        createSettingsView(container) {
            const settingsContainer = document.createElement('div');
            settingsContainer.className = 'settings-container';
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
                const toggleContainer = document.createElement('div');
                toggleContainer.style.cssText = `
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    width: 100%;
                `;

                const labelSpan = document.createElement('span');
                labelSpan.textContent = labelText;
                labelSpan.style.cssText = `
                    font-size: 14px;
                    color: #333;
                    user-select: none;
                `;

                const toggleWrapper = document.createElement('div');
                toggleWrapper.style.cssText = `
                    display: flex;
                    align-items: center;
                `;

                const toggleSwitch = document.createElement('label');
                toggleSwitch.className = 'toggle-switch';
                toggleSwitch.style.cssText = `
                    position: relative;
                    display: inline-block;
                    width: 40px;
                    height: 20px;
                    margin-left: 12px;
                `;

                const toggleInput = document.createElement('input');
                toggleInput.type = 'checkbox';
                toggleInput.checked = GM_getValue(storageKey, true);
                toggleInput.style.cssText = `
                    opacity: 0;
                    width: 0;
                    height: 0;
                    position: absolute;
                `;

                const toggleSlider = document.createElement('span');
                toggleSlider.className = 'toggle-slider';
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
                const sliderBefore = document.createElement('span');
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
                    toggleSlider.style.backgroundColor = '#0078d4';
                    sliderBefore.style.transform = 'translateX(20px)';
                }

                toggleInput.addEventListener('change', () => {
                    const newState = toggleInput.checked;
                    GM_setValue(storageKey, newState);

                    // Update toggle styles
                    toggleSlider.style.backgroundColor = newState ? '#0078d4' : '#ccc';
                    sliderBefore.style.transform = newState ? 'translateX(20px)' : 'translateX(0)';

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
            const floatingBtnToggle = createToggle('Show Floating Button', STORAGE_KEYS.SHOW_FLOATING_BUTTON, (newState) => {
                const existingBtn = document.querySelector('.cookie-share-floating-btn');
                if (existingBtn) {
                    existingBtn.remove();
                }
                if (newState) {
                    ui.createFloatingButton();
                }
            });

            // Create fullscreen auto-hide toggle
            const fullscreenToggle = createToggle('Auto Hide in Fullscreen(Not Available For Safari)', STORAGE_KEYS.AUTO_HIDE_FULLSCREEN, (newState) => {
                fullscreenManager.updateFloatingButtonVisibility();
            });

            settingsContainer.appendChild(floatingBtnToggle);
            settingsContainer.appendChild(fullscreenToggle);
            container.appendChild(settingsContainer);
        },


        createMainView() {
            const overlay = document.createElement('div');
            overlay.className = 'cookie-share-overlay';
            overlay.onclick = e => {
                if (e.target === overlay) ui.hideModal();
            };

            const modal = document.createElement('div');
            modal.className = 'cookie-share-modal';
            modal.innerHTML = `
                <div class="cookie-share-container">
                    <button class="close-btn" onclick="return false;">×</button>
                    <h1>Cookie Share</h1>
                    <div class="cookie-share-version">
                        <span>Version 0.0.1</span>
                        <a href="https://github.com/fangyuan99/cookie-share" target="_blank">GitHub</a>
                        <a href="#" class="admin-panel-a">Admin Panel</a>
                    </div>

                    <input type="text"
                        class="server-url-input"
                        placeholder="Server Address (e.g., https://example.com)"
                        value="${GM_getValue(STORAGE_KEYS.CUSTOM_URL, '')}"
                    >

                    <div class="id-input-container">
                        <input type="text"
                            class="cookie-id-input"
                            placeholder="Cookie ID"
                        >
                        <button class="generate-btn" onclick="return false;">Generate ID</button>
                    </div>

                    <div class="action-buttons">
                        <button class="action-btn send-btn">Send Cookie</button>
                        <button class="action-btn receive-btn">Receive Cookie</button>
                    </div>

                    <button class="clear-btn">Clear All Cookies</button>
                </div>
            `;

            modal.querySelector('.admin-panel-a').onclick = () => {
                const serverUrl = modal.querySelector('.server-url-input').value.trim();

                if (!serverUrl) {
                    alert('Please enter the server address first');
                    return;
                }

                try {
                    // Validate URL format
                    utils.validateUrl(serverUrl);

                    // Construct admin panel URL
                    const adminUrl = serverUrl.endsWith('/')
                        ? `${serverUrl}admin`
                        : `${serverUrl}/admin`;

                    // Open admin panel in a new tab
                    window.open(adminUrl, '_blank');
                } catch (error) {
                    alert('Invalid server address');
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
            modal.querySelector('.close-btn').onclick = ui.hideModal;
            modal.querySelector('.generate-btn').onclick = () => {
                const idInput = modal.querySelector('.cookie-id-input');
                idInput.value = utils.generateId();
            };

            modal.querySelector('.send-btn').onclick = async () => {
                try {
                    const urlInput = modal.querySelector('.server-url-input');
                    const idInput = modal.querySelector('.cookie-id-input');

                    if (!urlInput.value.trim()) {
                        alert('Please enter the server address');
                        return;
                    }

                    if (!idInput.value.trim()) {
                        alert('Please enter or generate a Cookie ID');
                        return;
                    }

                    GM_setValue(STORAGE_KEYS.CUSTOM_URL, urlInput.value.trim());
                    const result = await api.sendCookies(idInput.value.trim(), urlInput.value.trim());
                    alert(result.message || 'Sent successfully');
                } catch (error) {
                    alert('Send failed: ' + error.message);
                }
            };

            modal.querySelector('.receive-btn').onclick = async () => {
                try {
                    const urlInput = modal.querySelector('.server-url-input');
                    const idInput = modal.querySelector('.cookie-id-input');

                    if (!urlInput.value.trim()) {
                        alert('Please enter the server address');
                        return;
                    }

                    if (!idInput.value.trim()) {
                        alert('Please enter a Cookie ID');
                        return;
                    }

                    GM_setValue(STORAGE_KEYS.CUSTOM_URL, urlInput.value.trim());
                    const result = await api.receiveCookies(idInput.value.trim(), urlInput.value.trim());
                    alert(result.message || 'Received successfully');
                } catch (error) {
                    alert('Receive failed: ' + error.message);
                }
            };

            modal.querySelector('.clear-btn').onclick = () => {
                if (confirm('Are you sure you want to clear all cookies?')) {
                    cookieManager.clearAll();
                    alert('Cookies have been cleared, the page will refresh shortly');
                    // Use a short delay to ensure the message is seen
                    setTimeout(() => {
                        window.location.reload();
                    }, 500);
                }
            };

            ui.createSettingsView(modal.querySelector('.cookie-share-container'));
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
        },

        showModal() {
            const overlay = document.querySelector('.cookie-share-overlay');
            const modal = document.querySelector('.cookie-share-modal');

            if (overlay && modal) {
                overlay.classList.add('visible');
                modal.classList.add('visible');
            }
        },

        hideModal() {
            const overlay = document.querySelector('.cookie-share-overlay');
            const modal = document.querySelector('.cookie-share-modal');

            if (overlay && modal) {
                const idInput = modal.querySelector('.cookie-id-input');
                if (idInput) {
                    idInput.value = '';
                }

                overlay.classList.remove('visible');
                modal.classList.remove('visible');
                if (state.floatingButton) {
                    fullscreenManager.updateFloatingButtonVisibility();
                }
            }
        }
    };

    // ===================== Initialize =====================
    function init() {
        ui.injectStyles();
        ui.createMainView();
        ui.createFloatingButton();

        // Add fullscreen event listeners
        document.addEventListener("fullscreenchange", () => fullscreenManager.handleFullscreenChange());
        document.addEventListener("webkitfullscreenchange", () => fullscreenManager.handleFullscreenChange());

        GM_registerMenuCommand('Show Cookie Share', () => ui.showModal());
    }

    // Start the application
    init();
})();