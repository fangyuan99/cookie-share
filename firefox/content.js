let isFullscreen = false;
let floatButton = null;
let modal = null;

// 监听全屏变化
document.addEventListener("fullscreenchange", handleFullscreenChange);
document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

function handleFullscreenChange() {
  isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
  updateFloatButtonVisibility();
}

// 更新浮动按钮可见性
async function updateFloatButtonVisibility() {
  if (!floatButton) return;

  try {
    const settings = await new Promise((resolve) => {
      browser.storage.sync.get(
        {
          showFloatButton: true,
          autoHideFullscreen: true,
        },
        resolve
      );
    });

    floatButton.style.display =
      !settings.showFloatButton || (settings.autoHideFullscreen && isFullscreen)
        ? "none"
        : "flex";
  } catch (error) {
    console.error("Error updating float button visibility:", error);
  }
}

// 创建弹窗
function createModal() {
  modal = document.createElement("div");
  modal.className = "cookie-share-modal hidden";
  modal.innerHTML = `
    <div class="cookie-share-modal-content">
      <div class="cookie-share-modal-header">
        <h3 class="text-xl font-semibold">Cookies List</h3>
        <button class="cookie-share-close">&times;</button>
      </div>
      <div id="cookieSharePasswordContainer" class="hidden">
        <input type="password" id="cookieSharePassword" placeholder="Enter admin password" class="cookie-share-input" />
      </div>
      <div id="cookieShareList"></div>
    </div>
  `;

  document.body.appendChild(modal);

  // 添加关闭按钮事件
  modal.querySelector(".cookie-share-close").addEventListener("click", () => {
    modal.classList.add("hidden");
  });

  // 添加点击外部关闭
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.add("hidden");
    }
  });
}

// 初始化函数
function initFloatButton() {
  if (floatButton) return; // 如果已经存在，直接返回

  floatButton = document.createElement("div");
  floatButton.className = "cookie-share-float-btn";
  floatButton.innerHTML = `
    <svg t="1732536814920" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1636" width="128" height="128"><path d="M1003.56796 470.474919c-59.400116-20.998041-99.598195-77.398151-99.598194-140.398274 1.202002-10.20202-3.600007-18.600036-11.400023-25.800051-6.600013-5.402011-16.798033-7.800015-25.198049-6.602013-50.402098 7.200014-98.400192-7.200014-135.000264-36.600071s-62.402122-73.798144-66.60013-125.398245c-0.600001-9.002018-6.002012-17.402034-13.802027-22.800045-7.800015-4.802009-17.398034-6.002012-26.400051-2.402004-81.600159 29.400057-158.400309-22.200043-188.998369-92.398181-6.002012-13.202026-19.802039-20.40204-34.200067-17.398034-115.202225 25.80005-218.802427 98.120192-289.600566 189.32237-163.79832 210.600411-147.000287 500.402977 36.600072 684.603337 199.80239 199.196389 522.00102 199.196389 721.203408 0 92.39818-92.40218 153.4003-224.126438 153.4003-364.524712-1.206002-19.802039-1.806004-33.000064-20.40604-39.604077z" fill="#FEA832" p-id="1637"></path><path d="M1023.968 510.076996c0 140.398274-61.000119 272.122531-153.4003 364.524712-199.200389 199.196389-521.401018 199.196389-721.203408 0l583.003138-613.527198c36.600071 29.400057 84.598165 43.798086 135.000264 36.600071 8.400016-1.198002 18.600036 1.202002 25.198049 6.602013 7.800015 7.200014 12.602025 15.59603 11.400023 25.800051 0 63.000123 40.198079 119.400233 99.598194 140.398274 18.604036 6.604013 19.204038 19.802039 20.40404 39.602077z" fill="#FE9923" p-id="1638"></path><path d="M386.968756 624.999221c-15.000029-13.198026-35.402069-20.998041-57.000112-20.998041-49.802097 0-90.000176 40.198079-90.000175 90.000175 0 23.400046 9.002018 44.400087 23.400045 60.000118 16.198032 18.600036 40.198079 30.000059 66.60013 30.000058 49.802097 0 90.000176-40.202079 90.000176-90.000176-0.002-28.202055-12.602025-52.800103-33.000064-69.002134z" fill="#994C0F" p-id="1639"></path><path d="M629.96723 604.00118c-49.628097 0-90.000176-40.372079-90.000175-90.000176s40.372079-90.000176 90.000175-90.000176 90.000176 40.372079 90.000176 90.000176-40.370079 90.000176-90.000176 90.000176zM599.967172 844.001648c-33.076065 0-60.000117-26.924053-60.000117-60.000117s26.924053-60.000117 60.000117-60.000117 60.000117 26.924053 60.000117 60.000117-26.924053 60.000117-60.000117 60.000117z" fill="#713708" p-id="1640"></path><path d="M359.966703 424.000828c-33.076065 0-60.000117-26.924053-60.000117-60.000117s26.924053-60.000117 60.000117-60.000117 60.000117 26.924053 60.000117 60.000117-26.924053 60.000117-60.000117 60.000117z" fill="#994C0F" p-id="1641"></path><path d="M808.477579 636.261243m-30.000059 0a30.000059 30.000059 0 1 0 60.000118 0 30.000059 30.000059 0 1 0-60.000118 0Z" fill="#713708" p-id="1642"></path><path d="M208.456407 516.261008m-30.000058 0a30.000059 30.000059 0 1 0 60.000117 0 30.000059 30.000059 0 1 0-60.000117 0Z" fill="#994C0F" p-id="1643"></path><path d="M419.96682 694.001355c0 49.798097-40.198079 90.000176-90.000176 90.000176-26.400052 0-50.402098-11.400022-66.60013-30.000058l123.600242-129.002252c20.40004 16.202032 33.000064 40.80008 33.000064 69.002134z" fill="#713708" p-id="1644"></path></svg>
  `;

  // 添加点击事件
  floatButton.addEventListener("click", () => {
    if (!modal) {
      createModal();
    }
    modal.classList.remove("hidden");
    checkPasswordAndLoadCookies();
  });

  // 延迟添加按钮,确保页面加载完成
  setTimeout(() => {
    if (document.body) {
      document.body.appendChild(floatButton);
      updateFloatButtonVisibility();
    }
  }, 1000); // 延迟1秒

  // 监听存储变化
  browser.storage.onChanged.addListener((changes, namespace) => {
    if (
      namespace === "sync" &&
      (changes.showFloatButton || changes.autoHideFullscreen)
    ) {
      updateFloatButtonVisibility();
    }
  });
}

// 移除DOMContentLoaded事件监听,改为load事件
window.addEventListener("load", () => {
  // 延迟初始化,确保其他DOM操作完成
  setTimeout(initFloatButton, 1000);
});

// 添加定期检查按钮是否存在的逻辑
setInterval(() => {
  if (!document.body.contains(floatButton)) {
    console.log("Float button was removed, recreating...");
    initFloatButton();
  }
}, 2000); // 每2秒检查一次

// 检查密码并加载 cookies
async function checkPasswordAndLoadCookies() {
  const passwordContainer = document.getElementById(
    "cookieSharePasswordContainer"
  );
  const cookiesList = document.getElementById("cookieShareList");

  try {
    // 从 storage 获取密码
    const result = await new Promise((resolve) => {
      browser.storage.sync.get(["customUrl"], resolve);
    });

    if (!result.customUrl) {
      cookiesList.innerHTML = `<div class="cookie-share-error">Please set custom URL in extension popup first</div>`;
      return;
    }

    // 从 storage 获取密码
    const passwordResult = await new Promise((resolve) => {
      browser.storage.local.get("adminPassword", resolve);
    });

    if (!passwordResult.adminPassword) {
      // 如果没有密码，显示密码输入框
      passwordContainer.classList.remove("hidden");
      cookiesList.innerHTML = "";

      // 添加密码输入框的事件监听
      const passwordInput = passwordContainer.querySelector("input");
      if (passwordInput) {
        passwordInput.onkeydown = async (e) => {
          if (e.key === "Enter") {
            e.preventDefault(); // 阻止默认的回车行为
            const password = passwordInput.value.trim();
            if (password) {
              // 显示加载状态
              cookiesList.innerHTML = `
                <div class="cookie-share-loading">
                  <div class="cookie-share-spinner"></div>
                  <span>Loading cookies...</span>
                </div>
              `;

              try {
                // 先验证密码是否正确
                const response = await fetch(
                  `${result.customUrl}/admin/list-cookies`,
                  {
                    headers: {
                      "Content-Type": "application/json",
                      "X-Admin-Password": password,
                    },
                  }
                );

                const data = await response.json();
                if (data.success) {
                  // 密码正确，保存并加载 cookies
                  await browser.storage.local.set({ adminPassword: password });
                  passwordContainer.classList.add("hidden");
                  await loadCookies(password);
                } else {
                  // 密码错误
                  cookiesList.innerHTML = `<div class="cookie-share-error">Invalid password</div>`;
                  passwordInput.value = ""; // 清空密码输入
                }
              } catch (error) {
                console.error("Error validating password:", error);
                cookiesList.innerHTML = `<div class="cookie-share-error">Failed to validate password</div>`;
              }
            }
          }
        };
      }
    } else {
      // 如果有密码，显示加载状态并加载 cookies
      cookiesList.innerHTML = `
        <div class="cookie-share-loading">
          <div class="cookie-share-spinner"></div>
          <span>Loading cookies...</span>
        </div>
      `;
      passwordContainer.classList.add("hidden");
      await loadCookies(passwordResult.adminPassword);
    }
  } catch (error) {
    console.error("Error:", error);
    cookiesList.innerHTML = `<div class="cookie-share-error">Failed to load cookies: ${error.message}</div>`;
  }
}

// 加载 cookies
async function loadCookies(password) {
  const cookiesList = document.getElementById("cookieShareList");
  const passwordContainer = document.getElementById(
    "cookieSharePasswordContainer"
  );

  try {
    const result = await new Promise((resolve) => {
      browser.storage.sync.get(["customUrl"], resolve);
    });

    if (!result.customUrl) {
      cookiesList.innerHTML = `<div class="cookie-share-error">Please set custom URL in extension popup first</div>`;
      return;
    }

    const currentHost = window.location.hostname;
    const response = await fetch(
      `${result.customUrl}/admin/list-cookies-by-host/${encodeURIComponent(
        currentHost
      )}`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": password,
        },
      }
    );

    const data = await response.json();

    if (data.success) {
      if (data.cookies.length === 0) {
        cookiesList.innerHTML = `<div class="cookie-share-empty">No cookies found for ${currentHost}</div>`;
      } else {
        cookiesList.innerHTML = data.cookies
          .map(
            (cookie) => `
          <div class="cookie-share-item">
            <span class="text-sm font-medium" style="color: var(--color-primary);">
              <span style="color: var(--color-text-secondary); font-weight: normal;">ID:</span> 
              ${cookie.id}
            </span>
            <div class="cookie-share-buttons">
              <button class="cookie-share-receive" data-id="${cookie.id}">Receive</button>
              <button class="cookie-share-delete" data-id="${cookie.id}">Delete</button>
            </div>
          </div>
        `
          )
          .join("");
        attachButtonListeners();
      }
    } else {
      if (response.status === 401) {
        // 如果密码无效，清除存储的密码并显示密码输入框
        await browser.storage.local.remove("adminPassword");
        passwordContainer.classList.remove("hidden");
        cookiesList.innerHTML = `<div class="cookie-share-error">Invalid password</div>`;
      } else {
        cookiesList.innerHTML = `<div class="cookie-share-error">${
          data.message || "Failed to load cookies"
        }</div>`;
      }
    }
  } catch (error) {
    console.error("Error:", error);
    cookiesList.innerHTML = `<div class="cookie-share-error">Failed to load cookies: ${error.message}</div>`;
  }
}

// 添加按钮事件监听器
function attachButtonListeners() {
  // Receive 按钮事件
  document.querySelectorAll(".cookie-share-receive").forEach((button) => {
    button.addEventListener("click", async (e) => {
      const cookieId = e.target.dataset.id;
      try {
        const result = await new Promise((resolve) => {
          browser.storage.sync.get(["customUrl"], resolve);
        });

        if (!result.customUrl) {
          throw new Error("Please set custom URL in extension popup first");
        }

        browser.runtime.sendMessage(
          {
            action: "contentReceiveCookies",
            cookieId,
            customUrl: result.customUrl,
          },
          (response) => {
            if (response.success) {
              modal.classList.add("hidden");
              window.location.reload();
            } else {
              throw new Error(response.message || "Failed to receive cookies");
            }
          }
        );
      } catch (error) {
        console.error("Error receiving cookies:", error);
        document.getElementById(
          "cookieShareList"
        ).innerHTML = `<div class="cookie-share-error">${error.message}</div>`;
      }
    });
  });

  // Delete 按钮事件
  document.querySelectorAll(".cookie-share-delete").forEach((button) => {
    button.addEventListener("click", async (e) => {
      const cookieId = e.target.dataset.id;
      if (confirm("Are you sure you want to delete this cookie?")) {
        try {
          const [passwordResult, urlResult] = await Promise.all([
            new Promise((resolve) =>
              browser.storage.local.get("adminPassword", resolve)
            ),
            new Promise((resolve) =>
              browser.storage.sync.get(["customUrl"], resolve)
            ),
          ]);

          if (!passwordResult.adminPassword) {
            throw new Error("Admin password not found");
          }

          if (!urlResult.customUrl) {
            throw new Error("Custom URL not set");
          }

          const response = await fetch(
            `${urlResult.customUrl}/admin/delete?key=${encodeURIComponent(
              cookieId
            )}`,
            {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
                "X-Admin-Password": passwordResult.adminPassword,
              },
            }
          );

          const data = await response.json();
          if (data.success) {
            await loadCookies(passwordResult.adminPassword);
          } else {
            throw new Error(data.message || "Failed to delete cookie");
          }
        } catch (error) {
          console.error("Error deleting cookie:", error);
          document.getElementById(
            "cookieShareList"
          ).innerHTML = `<div class="cookie-share-error">Failed to delete cookie: ${error.message}</div>`;
        }
      }
    });
  });
}
