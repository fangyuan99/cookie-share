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
  "POST:/send-cookies": handleSendCookies,
  "GET:/admin/list-cookies": handleListCookies,
  "GET:/admin/list-cookies-by-host": handleListCookiesByHost,
  "DELETE:/admin/delete": handleDelete,
  "OPTIONS:/": handleCorsPreflightRequest
};

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // 处理 OPTIONS 请求
  if (method === "OPTIONS") {
    return handleCorsPreflightRequest();
  }

  // 对所有 /admin 开头的路径进行密码校验
  if (path.startsWith("/admin/")) {
    const authResponse = verifyAdminPassword(request);
    if (authResponse) return authResponse;
  }

  // 处理动态路由
  if (path.startsWith("/receive-cookies/")) {
    return handleReceiveCookies(request, path);
  }
  if (path.startsWith("/admin/list-cookies-by-host/")) {
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

  // 存储数据，确保域名不带点前缀
  await COOKIE_STORE.put(id, JSON.stringify({
    id,
    url,
    cookies: cookies.map(cookie => {
      // 如果域名以点开头，去掉点
      const domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
      return {
        domain: domain, // 使用处理后的域名
        expirationDate: cookie.expirationDate,
        hostOnly: true, // 总是设置为 true，因为我们使用不带点的域名
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

function createJsonResponse(status, body) {
  const response = new Response(JSON.stringify(body), {
    status: status,
    headers: { "Content-Type": "application/json" },
  });
  setCorsHeaders(response);
  return response;
}
