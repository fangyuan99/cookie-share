import { ENCRYPTION_VERSION, PBKDF2_ITERATIONS } from "./crypto";

const WORKER_ADMIN_TEMPLATE = `<!doctype html>
<html lang="zh-CN" data-theme="nord">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Cookie Share Admin</title>
    <link rel="stylesheet" href="https://fastly.jsdelivr.net/npm/daisyui@5/daisyui.css">
    <link rel="stylesheet" href="https://fastly.jsdelivr.net/npm/daisyui@5/themes.css">
    <script src="https://fastly.jsdelivr.net/npm/@tailwindcss/browser@4"><\/script>
  </head>
  <body class="min-h-screen bg-base-200">
    <div class="navbar bg-base-100 shadow-sm sticky top-0 z-50">
      <div class="flex-1">
        <span class="text-xl font-bold px-2">Cookie Share</span>
        <span class="badge badge-soft badge-primary ml-2">Admin</span>
      </div>
      <div class="flex-none">
        <select id="themeSelect" class="select select-bordered select-sm w-auto">
          <option value="nord">Nord</option>
          <option value="corporate">Corporate</option>
          <option value="cupcake">Cupcake</option>
          <option value="emerald">Emerald</option>
          <option value="dark">Dark</option>
          <option value="dracula">Dracula</option>
        </select>
      </div>
    </div>

    <main class="container mx-auto px-4 py-6 max-w-5xl">
      \${devHint}

      <div class="card bg-base-100 shadow-sm mb-6">
        <div class="card-body">
          <h2 class="card-title text-lg">凭据</h2>
          <p class="text-sm opacity-60">所有 <kbd class="kbd kbd-sm">/admin/*</kbd> API 使用 ADMIN_PASSWORD 鉴权与加密。</p>
          <div class="flex flex-col sm:flex-row gap-3 mt-2">
            <input id="adminPassword" type="password" placeholder="管理员密码" class="input input-bordered flex-1">
            <button id="saveCredentials" type="button" class="btn btn-primary">保存并加载</button>
          </div>
          <p id="status" role="status" class="text-sm mt-2"></p>
        </div>
      </div>

      <section id="panels" hidden>
        <div class="card bg-base-100 shadow-sm mb-6">
          <div class="card-body">
            <div role="tablist" class="tabs tabs-bordered mb-4">
              <button role="tab" class="tab tab-active" data-tab="create">创建</button>
              <button role="tab" class="tab" data-tab="update">更新</button>
              <button role="tab" class="tab" data-tab="delete">删除</button>
            </div>

            <div id="tab-create" class="tab-panel">
              <form id="createForm" class="space-y-3 max-w-lg">
                <div class="form-control">
                  <label class="label"><span class="label-text">ID</span></label>
                  <input id="createId" required class="input input-bordered w-full">
                </div>
                <div class="form-control">
                  <label class="label"><span class="label-text">URL</span></label>
                  <input id="createUrl" required class="input input-bordered w-full">
                </div>
                <div class="form-control">
                  <label class="label"><span class="label-text">Cookies JSON</span></label>
                  <textarea id="createCookies" required class="textarea textarea-bordered w-full h-28" placeholder="[...]"></textarea>
                </div>
                <button type="submit" class="btn btn-primary">创建</button>
              </form>
            </div>

            <div id="tab-update" class="tab-panel hidden">
              <form id="updateForm" class="space-y-3 max-w-lg">
                <div class="form-control">
                  <label class="label"><span class="label-text">ID</span></label>
                  <input id="updateId" required class="input input-bordered w-full">
                </div>
                <div class="form-control">
                  <label class="label"><span class="label-text">URL</span></label>
                  <input id="updateUrl" class="input input-bordered w-full" placeholder="留空则保留原值">
                </div>
                <div class="form-control">
                  <label class="label"><span class="label-text">Cookies JSON</span></label>
                  <textarea id="updateCookies" required class="textarea textarea-bordered w-full h-28" placeholder="[...]"></textarea>
                </div>
                <button type="submit" class="btn btn-primary">更新</button>
              </form>
            </div>

            <div id="tab-delete" class="tab-panel hidden">
              <form id="deleteForm" class="space-y-3 max-w-lg">
                <div class="form-control">
                  <label class="label"><span class="label-text">ID</span></label>
                  <input id="deleteId" required class="input input-bordered w-full">
                </div>
                <button type="submit" class="btn btn-error">删除</button>
              </form>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow-sm mb-6">
          <div class="card-body">
            <h2 class="card-title text-lg">导入 / 导出</h2>
            <p class="text-sm opacity-60">导出文件为加密 JSON；导入策略为按 ID 覆盖合并，不会清空现有数据。</p>
            <div class="flex flex-col sm:flex-row gap-3 mt-3 items-center">
              <button id="exportAll" type="button" class="btn btn-outline">导出全部数据</button>
              <input id="importFile" type="file" accept=".json,application/json" class="file-input file-input-bordered flex-1">
              <button id="importAll" type="button" class="btn btn-primary">导入全部数据</button>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow-sm mb-6">
          <div class="card-body">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 class="card-title text-lg">已存储记录</h2>
                <p class="text-sm opacity-60">按最近更新时间倒序排列</p>
              </div>
              <button id="refreshList" type="button" class="btn btn-outline btn-sm">刷新列表</button>
            </div>
            <div class="overflow-x-auto mt-4">
              <table class="table table-zebra">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>URL</th>
                    <th>Cookie 原文</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody id="cookieTableBody"></tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>

    <dialog id="cookieRawDialog" class="modal">
      <div class="modal-box w-11/12 max-w-4xl">
        <h3 id="cookieRawTitle" class="text-lg font-bold">Cookie 原文</h3>
        <div class="mt-3">
          <button id="copyRawDialog" type="button" class="btn btn-outline btn-sm">复制原文</button>
        </div>
        <pre id="cookieRawContent" class="bg-base-200 p-4 rounded-lg mt-4 overflow-auto max-h-96 text-sm whitespace-pre-wrap break-all"></pre>
        <div class="modal-action">
          <button id="closeRawDialog" class="btn">关闭</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>

    <script>
      (function() {
        var sel = document.getElementById("themeSelect");
        var saved = localStorage.getItem("cookie-share-theme");
        if (saved) {
          document.documentElement.setAttribute("data-theme", saved);
          sel.value = saved;
        }
        sel.addEventListener("change", function() {
          document.documentElement.setAttribute("data-theme", this.value);
          localStorage.setItem("cookie-share-theme", this.value);
        });
      })();

      document.querySelectorAll("[data-tab]").forEach(function(tab) {
        tab.addEventListener("click", function() {
          document.querySelectorAll("[data-tab]").forEach(function(t) { t.classList.remove("tab-active"); });
          document.querySelectorAll(".tab-panel").forEach(function(c) { c.classList.add("hidden"); });
          this.classList.add("tab-active");
          document.getElementById("tab-" + this.dataset.tab).classList.remove("hidden");
        });
      });

      const API_BASE = \${JSON.stringify(basePath)};
      const PASSWORD_KEY = "cookie-share-admin-password";
      const VERSION = \${JSON.stringify(ENCRYPTION_VERSION)};
      const ITERATIONS = \${JSON.stringify(PBKDF2_ITERATIONS)};
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      let adminPassword = "";
      let rawDialog;
      let rawTitle;
      let rawContent;

      document.addEventListener("DOMContentLoaded", () => {
        adminPassword = localStorage.getItem(PASSWORD_KEY) || "";
        rawDialog = document.getElementById("cookieRawDialog");
        rawTitle = document.getElementById("cookieRawTitle");
        rawContent = document.getElementById("cookieRawContent");
        document.getElementById("adminPassword").value = adminPassword;
        document.getElementById("saveCredentials").addEventListener("click", saveCredentials);
        document.getElementById("closeRawDialog").addEventListener("click", () => {
          rawDialog.close();
        });
        document.getElementById("copyRawDialog").addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(rawContent.textContent || "");
            setStatus("原文已复制。");
          } catch {
            setStatus("复制失败，请手动复制。", true);
          }
        });
        document.getElementById("createForm").addEventListener("submit", createCookie);
        document.getElementById("updateForm").addEventListener("submit", updateCookie);
        document.getElementById("deleteForm").addEventListener("submit", deleteCookie);
        document.getElementById("refreshList").addEventListener("click", () => loadCookies().catch(showError));
        document.getElementById("exportAll").addEventListener("click", () => exportAll().catch(showError));
        document.getElementById("importAll").addEventListener("click", () => importAll().catch(showError));

        if (adminPassword) {
          showPanels();
          loadCookies().catch(showError);
        }
      });

      function setStatus(message, isError = false) {
        const node = document.getElementById("status");
        node.textContent = message || "";
        node.className = "text-sm mt-2 " + (isError ? "text-error" : "text-success");
      }

      function showError(error) {
        setStatus(error && error.message ? error.message : "请求失败", true);
      }

      function showPanels() {
        document.getElementById("panels").hidden = false;
      }

      function ensureCredentials() {
        if (!adminPassword) {
          throw new Error("请先输入管理员密码。");
        }
      }

      function saveCredentials() {
        const password = document.getElementById("adminPassword").value.trim();
        if (!password) {
          setStatus("管理员密码不能为空。", true);
          return;
        }

        adminPassword = password;
        localStorage.setItem(PASSWORD_KEY, password);
        showPanels();
        setStatus("凭据已保存，正在加载列表。");
        loadCookies().catch(showError);
      }

      function adminHeaders() {
        return {
          "Content-Type": "application/json",
          "X-Admin-Password": adminPassword,
        };
      }

      function base64UrlEncode(bytes) {
        let binary = "";
        for (const value of bytes) {
          binary += String.fromCharCode(value);
        }
        return btoa(binary).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");
      }

      function base64UrlDecode(value) {
        const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
      }

      function isEnvelope(value) {
        return Boolean(
          value &&
          typeof value === "object" &&
          value.version === VERSION &&
          typeof value.salt === "string" &&
          typeof value.iv === "string" &&
          typeof value.payload === "string"
        );
      }

      async function deriveKey(secret, salt) {
        const material = await crypto.subtle.importKey(
          "raw",
          encoder.encode(secret),
          "PBKDF2",
          false,
          ["deriveKey"]
        );

        return await crypto.subtle.deriveKey(
          {
            name: "PBKDF2",
            hash: "SHA-256",
            salt,
            iterations: ITERATIONS,
          },
          material,
          {
            name: "AES-GCM",
            length: 256,
          },
          false,
          ["encrypt", "decrypt"]
        );
      }

      async function encryptClientPayload(secret, data) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKey(secret, salt);
        const payload = new Uint8Array(
          await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            encoder.encode(JSON.stringify(data))
          )
        );

        return {
          version: VERSION,
          salt: base64UrlEncode(salt),
          iv: base64UrlEncode(iv),
          payload: base64UrlEncode(payload),
        };
      }

      async function decryptClientPayload(secret, envelope) {
        if (!isEnvelope(envelope)) {
          throw new Error("Invalid encrypted payload");
        }

        try {
          const key = await deriveKey(secret, base64UrlDecode(envelope.salt));
          const plaintext = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: base64UrlDecode(envelope.iv) },
            key,
            base64UrlDecode(envelope.payload)
          );
          return JSON.parse(decoder.decode(plaintext));
        } catch {
          throw new Error("Transport secret mismatch or corrupted payload");
        }
      }

      async function requestEncryptedJson(path, options = {}) {
        ensureCredentials();

        const init = {
          method: options.method || "GET",
          headers: adminHeaders(),
        };

        if (options.body !== undefined) {
          init.body = JSON.stringify(await encryptClientPayload(adminPassword, options.body));
        }

        const response = await fetch(API_BASE + path, init);
        const responseText = await response.text();
        let payload;

        try {
          payload = responseText ? JSON.parse(responseText) : {};
        } catch {
          throw new Error(responseText || "响应不是合法 JSON");
        }

        if (!response.ok) {
          if (isEnvelope(payload)) {
            const decryptedError = await decryptClientPayload(adminPassword, payload);
            throw new Error(decryptedError.message || decryptedError.error || "请求失败");
          }
          throw new Error(payload.message || payload.error || "请求失败");
        }

        return await decryptClientPayload(adminPassword, payload);
      }

      function parseCookieJson(id) {
        try {
          return JSON.parse(document.getElementById(id).value);
        } catch {
          throw new Error("Cookies 必须是合法 JSON 数组。");
        }
      }

      function showRawCookie(id, cookiesJson) {
        rawTitle.textContent = "Cookie 原文: " + id;
        rawContent.textContent = cookiesJson || "[]";
        rawDialog.showModal();
      }

      async function loadCookies() {
        const data = await requestEncryptedJson("/admin/list-cookies");
        const tbody = document.getElementById("cookieTableBody");
        tbody.replaceChildren();
        const rows = Array.isArray(data.cookies) ? data.cookies : [];

        if (rows.length === 0) {
          const row = document.createElement("tr");
          const cell = document.createElement("td");
          cell.colSpan = 4;
          cell.textContent = "暂无数据";
          cell.className = "text-center opacity-60";
          row.appendChild(cell);
          tbody.appendChild(row);
          setStatus("列表已刷新。");
          return;
        }

        for (const cookie of rows) {
          const row = document.createElement("tr");
          const idCell = document.createElement("td");
          const urlCell = document.createElement("td");
          const rawCell = document.createElement("td");
          const actionCell = document.createElement("td");
          const rawButton = document.createElement("button");
          const button = document.createElement("button");

          idCell.textContent = cookie.id;
          urlCell.textContent = cookie.url;
          rawButton.type = "button";
          rawButton.className = "btn btn-ghost btn-xs";
          rawButton.textContent = "查看原文";
          rawButton.addEventListener("click", () => {
            showRawCookie(cookie.id, cookie.cookiesJson);
          });
          rawCell.appendChild(rawButton);
          button.type = "button";
          button.className = "btn btn-error btn-xs";
          button.textContent = "删除";
          button.addEventListener("click", () => deleteCookieById(cookie.id).catch(showError));
          actionCell.appendChild(button);
          row.append(idCell, urlCell, rawCell, actionCell);
          tbody.appendChild(row);
        }

        setStatus("列表已刷新。");
      }

      async function createCookie(event) {
        event.preventDefault();
        try {
          const result = await requestEncryptedJson("/admin/create", {
            method: "POST",
            body: {
              id: document.getElementById("createId").value.trim(),
              url: document.getElementById("createUrl").value.trim(),
              cookies: parseCookieJson("createCookies"),
            },
          });
          document.getElementById("createForm").reset();
          setStatus("创建成功。");
          await loadCookies();
        } catch (error) {
          showError(error);
        }
      }

      async function updateCookie(event) {
        event.preventDefault();
        try {
          const result = await requestEncryptedJson("/admin/update", {
            method: "PUT",
            body: {
              key: document.getElementById("updateId").value.trim(),
              url: document.getElementById("updateUrl").value.trim(),
              value: parseCookieJson("updateCookies"),
            },
          });
          document.getElementById("updateForm").reset();
          setStatus("更新成功。");
          await loadCookies();
        } catch (error) {
          showError(error);
        }
      }

      async function deleteCookie(event) {
        event.preventDefault();
        await deleteCookieById(document.getElementById("deleteId").value.trim());
        document.getElementById("deleteForm").reset();
      }

      async function deleteCookieById(id) {
        if (!id) {
          throw new Error("请输入要删除的 ID。");
        }
        if (!window.confirm("确定删除 " + id + " 吗？")) {
          return;
        }

        const result = await requestEncryptedJson("/admin/delete?key=" + encodeURIComponent(id), {
          method: "DELETE",
        });
        setStatus("删除成功。");
        await loadCookies();
      }

      function exportFilename() {
        const now = new Date();
        const pad = (value) => String(value).padStart(2, "0");
        return "cookie-share-export-" +
          now.getFullYear() +
          pad(now.getMonth() + 1) +
          pad(now.getDate()) +
          "-" +
          pad(now.getHours()) +
          pad(now.getMinutes()) +
          pad(now.getSeconds()) +
          ".json";
      }

      async function exportAll() {
        ensureCredentials();
        const response = await fetch(API_BASE + "/admin/export-all", {
          method: "GET",
          headers: adminHeaders(),
        });
        const responseText = await response.text();
        let payload;

        try {
          payload = responseText ? JSON.parse(responseText) : {};
        } catch {
          throw new Error("导出响应格式无效");
        }

        if (!response.ok) {
          if (isEnvelope(payload)) {
            const decryptedError = await decryptClientPayload(adminPassword, payload);
            throw new Error(decryptedError.message || decryptedError.error || "导出失败");
          }
          throw new Error(payload.message || payload.error || "导出失败");
        }

        if (!isEnvelope(payload)) {
          throw new Error("导出内容不是合法加密文件");
        }

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = exportFilename();
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(blobUrl);
        setStatus("导出成功。");
      }

      async function importAll() {
        const file = document.getElementById("importFile").files[0];
        if (!file) {
          throw new Error("请先选择导入文件。");
        }

        let payload;
        try {
          payload = JSON.parse(await file.text());
        } catch {
          throw new Error("导入文件不是合法 JSON。");
        }

        if (!isEnvelope(payload)) {
          throw new Error("导入文件不是合法加密信封。");
        }

        const result = await requestEncryptedJson("/admin/import-all", {
          method: "POST",
          body: await decryptClientPayload(adminPassword, payload),
        });
        setStatus("导入成功，已导入 " + result.imported + " 条。");
        await loadCookies();
      }
    <\/script>
  </body>
</html>`;

export function renderAdminPage(basePath: string): string {
  const replacements: Record<string, string> = {
    "${devHint}": "",
    "${JSON.stringify(basePath)}": JSON.stringify(basePath),
    "${JSON.stringify(ENCRYPTION_VERSION)}": JSON.stringify(ENCRYPTION_VERSION),
    "${JSON.stringify(PBKDF2_ITERATIONS)}": JSON.stringify(PBKDF2_ITERATIONS),
  };

  let html = WORKER_ADMIN_TEMPLATE;
  for (const [token, value] of Object.entries(replacements)) {
    html = html.split(token).join(value);
  }
  return html;
}
