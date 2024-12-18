addEventListener("fetch", (event) => {
  event.respondWith(
    handleRequest(event.request).catch((error) => {
      return createJsonResponse(500, { success: false, error: error.message });
    })
  );
});

function setCorsHeaders(response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Admin-Password"
  );
}

function verifyAdminPassword(request) {
  const adminPassword = request.headers.get("X-Admin-Password");
  if (adminPassword !== ADMIN_PASSWORD) {
    return createJsonResponse(401, { success: false, message: "Unauthorized" });
  }
  return null;
}

function isValidId(id) {
  return /^[a-zA-Z0-9]+$/.test(id);
}

// 定义路由表
const routes = {
  [`POST:/${PATH_SECRET}/send-cookies`]: handleSendCookies,
  [`GET:/${PATH_SECRET}/admin`]: handleAdminPage,
  [`GET:/${PATH_SECRET}/admin/list-cookies`]: handleListCookies,
  [`GET:/${PATH_SECRET}/admin/list-cookies-by-host`]: handleListCookiesByHost,
  [`DELETE:/${PATH_SECRET}/admin/delete`]: handleDelete,
  [`PUT:/${PATH_SECRET}/admin/update`]: handleUpdate,
  [`OPTIONS:/${PATH_SECRET}/`]: handleCorsPreflightRequest,
};

async function handleAdminPage(request) {
  const htmlContent = `
  <!DOCTYPE html>
  <html lang="zh">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Cookie 管理器</title>
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background: url('https://picsum.photos/1920/1080?blur=5') no-repeat center center fixed;
        background-size: cover;
        margin: 10px;
        padding: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
      }
      .container {
        background: rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        padding: 2rem;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        width: 90%;
        max-width: 800px;
      }
      h1, h2 {
        color: #0078D4;
      }
      input, textarea, button {
        width: 100%;
        padding: 0.5rem;
        margin-bottom: 1rem;
        border: 1px solid #ccc;
        border-radius: 4px;
      }
      button {
        background-color: #0078D4;
        color: white;
        border: none;
        cursor: pointer;
        transition: background-color 0.3s;
      }
      button:hover {
        background-color: #005a9e;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        border: 1px solid #ddd;
        padding: 0.5rem;
        text-align: left;
      }
      th {
        background-color: #f2f2f2;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Cookie 管理器</h1>
      
      <!-- 添加管理员密码输入和保存按钮 -->
      <div>
        <h2>管理员密码</h2>
        <input type="password" id="adminPassword" placeholder="输入管理员密码">
        <button id="savePassword">保存密码</button>
      </div>
      
      <!-- 创建 Cookie -->
      <div id="cookieManagement" style="display: none;">
        <h2>创建 Cookie</h2>
        <form id="createForm">
          <input type="text" id="createId" placeholder="ID" required>
          <input type="url" id="createUrl" placeholder="URL" required>
          <textarea id="createCookies" placeholder="Cookies (JSON 格式)" rows="3" required></textarea>
          <button type="submit">创建</button>
        </form>
      </div>
  
      <!-- 列出 Cookies -->
      <div id="cookieList" style="display: none;">
        <h2>已存储的 Cookies</h2>
        <button id="refreshList">刷新列表</button>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>URL</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody id="cookieList">
            <!-- 动态内容 -->
          </tbody>
        </table>
      </div>
  
      <!-- 更新 Cookie -->
      <div id="updateCookie" style="display: none;">
        <h2>更新 Cookie</h2>
        <form id="updateForm">
          <input type="text" id="updateId" placeholder="ID" required>
          <input type="text" id="updateUrl" placeholder="URL">
          <textarea id="updateCookies" placeholder="Cookies (JSON 格式)" rows="3" required></textarea>
          <button type="submit">更新</button>
        </form>
      </div>
  
      <!-- 删除 Cookie -->
      <div id="deleteCookie" style="display: none;">
        <h2>删除 Cookie</h2>
        <form id="deleteForm">
          <input type="text" id="deleteId" placeholder="ID" required>
          <button type="submit">删除</button>
        </form>
      </div>
    </div>
  
    <script>
      const API_BASE = '/${PATH_SECRET}';
      let adminPassword = '';
  
      document.addEventListener('DOMContentLoaded', () => {
        // 从本地存储中获取保存的密码
        adminPassword = localStorage.getItem('adminPassword') || '';
        if (adminPassword) {
          document.getElementById('adminPassword').value = adminPassword;
          showCookieManagement();
        }
  
        document.getElementById('savePassword').addEventListener('click', saveAdminPassword);
        document.getElementById('createForm').addEventListener('submit', createCookie);
        document.getElementById('updateForm').addEventListener('submit', updateCookie);
        document.getElementById('deleteForm').addEventListener('submit', deleteCookie);
        document.getElementById('refreshList').addEventListener('click', loadCookies);
      });
  
      function saveAdminPassword() {
        const password = document.getElementById('adminPassword').value;
        if (password) {
          localStorage.setItem('adminPassword', password);
          adminPassword = password;
          showCookieManagement();
          loadCookies();
          alert('管理员密码已保存');
        } else {
          alert('请输入有效的管理员密码');
        }
      }
  
      function showCookieManagement() {
        document.getElementById('cookieManagement').style.display = 'block';
        document.getElementById('cookieList').style.display = 'block';
        document.getElementById('updateCookie').style.display = 'block';
        document.getElementById('deleteCookie').style.display = 'block';
        loadCookies();
      }
  
      async function loadCookies() {
        const response = await fetch(API_BASE + '/admin/list-cookies', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Password': adminPassword
          }
        });
  
        if (response.ok) {
          const data = await response.json();
          const list = data.cookies;
          const tbody = document.getElementById('cookieList');
          tbody.innerHTML = '';
  
          list.forEach(cookie => {
            const tr = document.createElement('tr');
            tr.innerHTML = \`
              <td>\${cookie.id}</td>
              <td>\${new URL(cookie.url).hostname}</td>
              <td>
                <button onclick="deleteCookieById('\${cookie.id}')">删除</button>
              </td>
            \`;
            tbody.appendChild(tr);
          });
        } else {
          alert('无法加载 Cookies 列表，请检查管理员密码是否正确');
        }
      }
  
      async function createCookie(event) {
        event.preventDefault();
        const id = document.getElementById('createId').value;
        const url = document.getElementById('createUrl').value;
        let cookies;
        try {
          cookies = JSON.parse(document.getElementById('createCookies').value);
        } catch {
          alert('Cookies 必须是有效的 JSON');
          return;
        }
  
        const response = await fetch(API_BASE + '/send-cookies', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Admin-Password': adminPassword
          },
          body: JSON.stringify({ id, url, cookies })
        });
  
        const result = await response.json();
        alert(result.message);
        if (response.ok) {
          loadCookies();
          document.getElementById('createForm').reset();
        }
      }
  
      async function updateCookie(event) {
        event.preventDefault();
        const key = document.getElementById('updateId').value;
        const url = document.getElementById('updateUrl').value;
        let value;
        try {
          value = JSON.parse(document.getElementById('updateCookies').value);
        } catch {
          alert('Cookies 必须是有效的 JSON');
          return;
        }
  
        const response = await fetch(API_BASE + '/admin/update', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPassword },
          body: JSON.stringify({ key, value, url })
        });
  
        const result = await response.json();
        alert(result.message);
        if (response.ok) {
          loadCookies();
          document.getElementById('updateForm').reset();
        }
      }
  
      async function deleteCookie(event) {
        event.preventDefault();
        const key = document.getElementById('deleteId').value;
  
        const response = await fetch(API_BASE + '/admin/delete?key='+encodeURIComponent(key), {
          method: 'DELETE',
          headers: { 
            'Content-Type': 'application/json', 
            'X-Admin-Password': adminPassword 
          }
        });
  
        const result = await response.json();
        alert(result.message);
        if (response.ok) {
          loadCookies();
          document.getElementById('deleteForm').reset();
        }
      }
  
      async function deleteCookieById(id) {
        if (!confirm('确定要删除 ID 为'+id+' 的 Cookie 吗？')) return;
  
        const response = await fetch(API_BASE + '/admin/delete?key='+encodeURIComponent(id), {
          method: 'DELETE',
          headers: { 
            'Content-Type': 'application/json', 
            'X-Admin-Password': adminPassword 
          }
        });
  
        const result = await response.json();
        alert(result.message);
        if (response.ok) {
          loadCookies();
        }
      }
    </script>
  </body>
  </html>
  `;
  const response = new Response(htmlContent, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
  setCorsHeaders(response);
  return response;
}


async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // 检查路径是否包含正确的 PATH_SECRET
  if (!path.startsWith(`/${PATH_SECRET}/`)) {
    return createJsonResponse(404, { success: false, message: "Not Found" });
  }

  // 处理 OPTIONS 请求
  if (method === "OPTIONS") {
    return handleCorsPreflightRequest();
  }

  // 对所有 /admin 开头的路径进行密码校验
  if (path.includes("/admin/")) {
    const authResponse = verifyAdminPassword(request);
    if (authResponse) return authResponse;
  }

  // 处理动态路由
  if (path.includes("/receive-cookies/")) {
    return handleReceiveCookies(request, path);
  }
  if (path.includes("/admin/list-cookies-by-host/")) {
    return handleListCookiesByHost(request, path);
  }

  const routeKey = `${method}:${path}`;
  const handler = routes[routeKey];
  if (handler) {
    return handler(request);
  }

  return createJsonResponse(404, { success: false, message: "Not Found" });
}

async function handleListCookiesByHost(request, path) {
  const host = decodeURIComponent(path.split("/").pop());
  const list = await COOKIE_STORE.list();
  const cookies = await Promise.all(
    list.keys.map(async (key) => {
      const data = await COOKIE_STORE.get(key.name);
      if (data) {
        try {
          const { id, url } = JSON.parse(data);
          if (new URL(url).hostname === host) {
            return { id, url };
          }
        } catch (e) {
          console.error(`Error parsing data for key ${key.name}:`, e);
        }
      }
      return null;
    })
  );

  const filteredCookies = cookies.filter((cookie) => cookie !== null);
  return createJsonResponse(200, { success: true, cookies: filteredCookies });
}

function handleCorsPreflightRequest() {
  const response = new Response(null, { status: 204 });
  setCorsHeaders(response);
  return response;
}

async function handleSendCookies(request) {
  const { id, url, cookies } = await request.json();

  if (!isValidId(id)) {
    return createJsonResponse(400, {
      success: false,
      message: "Invalid ID. Only letters and numbers are allowed.",
    });
  }

  // 验证 cookies 格式
  if (!Array.isArray(cookies) || !cookies.every(cookie => 
    cookie.name && 
    cookie.value && 
    cookie.domain && 
    typeof cookie.httpOnly === 'boolean' &&
    typeof cookie.secure === 'boolean' &&
    cookie.sameSite
  )) {
    return createJsonResponse(400, {
      success: false,
      message: "Invalid cookie format",
    });
  }

  // 处理 URL 格式：如果不是完整的 URL，则添加 https:// 前缀
  const processedUrl = url.includes('://') ? url : `https://${url}`;

  // 存储数据，确保域名不带点前缀
  await COOKIE_STORE.put(id, JSON.stringify({
    id,
    url: processedUrl,
    cookies: cookies.map(cookie => {
      // 如果域名以点开头，去掉点
      const domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
      return {
        domain: domain,
        expirationDate: cookie.expirationDate,
        hostOnly: true,
        httpOnly: cookie.httpOnly,
        name: cookie.name,
        path: cookie.path || "/",
        sameSite: cookie.sameSite.toLowerCase(),
        secure: cookie.secure,
        session: cookie.session || false,
        storeId: null,
        value: cookie.value
      };
    })
  }));

  return createJsonResponse(200, {
    success: true,
    message: "Cookies saved successfully",
  });
}

async function handleReceiveCookies(request, path) {
  const cookieId = path.split("/").pop();

  if (!isValidId(cookieId)) {
    return createJsonResponse(400, {
      success: false,
      message: "Invalid cookie ID",
    });
  }

  const data = await COOKIE_STORE.get(cookieId);
  if (!data) {
    return createJsonResponse(404, {
      success: false,
      message: "Cookies not found",
    });
  }

  const { cookies } = JSON.parse(data);
  return createJsonResponse(200, {
    success: true,
    cookies: cookies.map(cookie => ({
      domain: cookie.domain,
      expirationDate: cookie.expirationDate,
      hostOnly: cookie.hostOnly,
      httpOnly: cookie.httpOnly,
      name: cookie.name,
      path: cookie.path || "/",
      sameSite: cookie.sameSite,
      secure: cookie.secure,
      session: false,
      storeId: null,
      value: cookie.value
    }))
  });
}

async function handleDelete(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!isValidId(key)) {
    return createJsonResponse(400, {
      success: false,
      message: "Invalid key. Only letters and numbers are allowed.",
    });
  }

  await COOKIE_STORE.delete(key);
  return createJsonResponse(200, {
    success: true,
    message: "Data deleted successfully",
  });
}

async function handleListCookies(request) {
  const list = await COOKIE_STORE.list();
  const cookies = await Promise.all(
    list.keys.map(async (key) => {
      const data = await COOKIE_STORE.get(key.name);
      if (data) {
        try {
          const { id, url } = JSON.parse(data);
          return { id, url };
        } catch (e) {
          console.error(`Error parsing data for key ${key.name}:`, e);
          return null;
        }
      }
      return null;
    })
  );

  const filteredCookies = cookies.filter((cookie) => cookie !== null);
  return createJsonResponse(200, { success: true, cookies: filteredCookies });
}

async function handleUpdate(request) {
  const { key, value, url } = await request.json();

  if (!isValidId(key)) {
    return createJsonResponse(400, {
      success: false,
      message: "Invalid key. Only letters and numbers are allowed.",
    });
  }

  // 验证 cookies 格式
  if (!Array.isArray(value) || !value.every(cookie => 
    cookie.name && 
    cookie.value && 
    cookie.domain && 
    typeof cookie.httpOnly === 'boolean' &&
    typeof cookie.secure === 'boolean' &&
    cookie.sameSite
  )) {
    return createJsonResponse(400, {
      success: false,
      message: "Invalid cookie format",
    });
  }

  // 检查记录是否存在
  const existingData = await COOKIE_STORE.get(key);
  if (!existingData) {
    return createJsonResponse(404, {
      success: false,
      message: "Cookie not found",
    });
  }

  // 获取现有数据
  const data = JSON.parse(existingData);
  
  // 如果提供了新的 URL，则更新
  if (url) {
    // 处理 URL 格式：如果不是完整的 URL，则添加 https:// 前缀
    data.url = url.includes('://') ? url : `https://${url}`;
  }

  // 更新 cookies
  data.cookies = value.map(cookie => {
    const domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
    return {
      domain: domain,
      expirationDate: cookie.expirationDate,
      hostOnly: true,
      httpOnly: cookie.httpOnly,
      name: cookie.name,
      path: cookie.path || "/",
      sameSite: cookie.sameSite.toLowerCase(),
      secure: cookie.secure,
      session: cookie.session || false,
      storeId: null,
      value: cookie.value
    };
  });

  // 保存更新后的数据
  await COOKIE_STORE.put(key, JSON.stringify(data));

  return createJsonResponse(200, {
    success: true,
    message: "Cookies and URL updated successfully",
  });
}

function createJsonResponse(status, body) {
  const response = new Response(JSON.stringify(body), {
    status: status,
    headers: { "Content-Type": "application/json" },
  });
  setCorsHeaders(response);
  return response;
}
