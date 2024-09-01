addEventListener("fetch", (event) => {
  event.respondWith(
    handleRequest(event.request).catch(
      (error) =>
        new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
    )
  );
});

function verifyAdminPassword(request) {
  const adminPassword = request.headers.get("X-Admin-Password");
  if (adminPassword !== ADMIN_PASSWORD) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null; // Continue if password is correct
}

function isValidId(id) {
  return /^[a-zA-Z0-9]+$/.test(id);
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Admin password verification for new endpoints
  if (path.startsWith("/admin/")) {
    const authResponse = verifyAdminPassword(request);
    if (authResponse) return authResponse;
  }

  if (request.method === "POST" && path === "/send-cookies") {
    return handleSendCookies(request);
  } else if (request.method === "GET" && path.startsWith("/receive-cookies/")) {
    return handleReceiveCookies(request, path);
  } else if (request.method === "GET" && path === "/admin/list-cookies") {
    return handleListCookies();
  } else if (request.method === "POST" && path === "/admin/create") {
    return createData(request);
  } else if (request.method === "GET" && path === "/admin/read") {
    return readData(request);
  } else if (request.method === "PUT" && path === "/admin/update") {
    return updateData(request);
  } else if (request.method === "DELETE" && path === "/admin/delete") {
    return deleteData(request);
  } else if (request.method === "DELETE" && path === "/admin/delete-all") {
    return deleteAllData();
  } else if (request.method === "GET" && path === "/admin/list") {
    return listAllData();
  } else {
    return new Response("Not Found", { status: 404 });
  }
}

async function handleSendCookies(request) {
  const { id, url, cookies } = await request.json();

  if (!isValidId(id)) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Invalid ID. Only letters and numbers are allowed.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Check if the ID already exists
  const existing = await COOKIE_STORE.get(id);
  if (existing !== null) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Cookie ID already exists. Please use a unique ID.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Store the new cookies
  await COOKIE_STORE.put(id, JSON.stringify({ id, url, cookies }));

  return new Response(
    JSON.stringify({
      success: true,
      message: "Cookies received and stored successfully",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

async function handleReceiveCookies(request, path) {
  const id = path.split("/").pop();

  if (!isValidId(id)) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Invalid ID. Only letters and numbers are allowed.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const storedData = await COOKIE_STORE.get(id);
  if (storedData === null) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "No cookies found for the given ID: " + id,
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const { cookies } = JSON.parse(storedData);

  return new Response(
    JSON.stringify({
      success: true,
      id,
      cookies: cookies,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

async function handleListCookies() {
  const list = await COOKIE_STORE.list();
  const cookies = [];

  for (const key of list.keys) {
    const value = await COOKIE_STORE.get(key.name);
    const { id, url } = JSON.parse(value);
    cookies.push({ id, url });
  }

  return new Response(
    JSON.stringify({
      success: true,
      cookies: cookies,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

async function createData(request) {
  const { key, value } = await request.json();

  if (!isValidId(key)) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Invalid key. Only letters and numbers are allowed.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  await COOKIE_STORE.put(key, JSON.stringify(value));
  return new Response(
    JSON.stringify({ success: true, message: "Data created successfully" }),
    {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }
  );
}

async function readData(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!isValidId(key)) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Invalid key. Only letters and numbers are allowed.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const value = await COOKIE_STORE.get(key);
  if (value === null) {
    return new Response(
      JSON.stringify({ success: false, message: "Data not found" }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
  return new Response(
    JSON.stringify({ success: true, data: JSON.parse(value) }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

async function updateData(request) {
  const { key, value } = await request.json();

  if (!isValidId(key)) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Invalid key. Only letters and numbers are allowed.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const existingValue = await COOKIE_STORE.get(key);
  if (existingValue === null) {
    return new Response(
      JSON.stringify({ success: false, message: "Data not found" }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
  await COOKIE_STORE.put(key, JSON.stringify(value));
  return new Response(
    JSON.stringify({ success: true, message: "Data updated successfully" }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

async function deleteData(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!isValidId(key)) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Invalid key. Only letters and numbers are allowed.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  await COOKIE_STORE.delete(key);
  return new Response(
    JSON.stringify({ success: true, message: "Data deleted successfully" }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

async function deleteAllData() {
  const keys = await COOKIE_STORE.list();
  await Promise.all(keys.keys.map((key) => COOKIE_STORE.delete(key.name)));
  return new Response(
    JSON.stringify({ success: true, message: "All data deleted successfully" }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

async function listAllData() {
  const list = await COOKIE_STORE.list();
  const data = [];

  for (const key of list.keys) {
    const value = await COOKIE_STORE.get(key.name);
    data.push({ key: key.name, value: JSON.parse(value) });
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: data,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
