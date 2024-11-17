// 立即执行创建元素，不等待 DOMContentLoaded
function init() {
  // 如果已经存在相关元素，就不重复创建
  if (document.querySelector('.cookie-share-float-btn')) {
    return;
  }

  // 创建悬浮按钮
  const button = document.createElement('div');
  button.className = 'cookie-share-float-btn';
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a10 10 0 1 0 10 10 10 10 0 0 0-10-10zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
      <path d="M15 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm1.5 3a4 4 0 0 0-3.2 1.6l1.6 1.2a2 2 0 0 1 3.2 0l1.6-1.2A4 4 0 0 0 12.5 12z"/>
    </svg>
  `;

  // 创建弹窗
  const modal = document.createElement('div');
  modal.className = 'cookie-share-modal hidden';
  modal.innerHTML = `
    <div class="cookie-share-modal-content">
      <div class="cookie-share-modal-header">
        <h3>Cookies List</h3>
        <span class="cookie-share-close">&times;</span>
      </div>
      <div id="cookieSharePasswordContainer" class="hidden">
        <input type="password" id="cookieSharePassword" placeholder="Enter admin password" class="cookie-share-input" />
      </div>
      <div id="cookieShareList"></div>
    </div>
  `;

  // 确保 body 存在
  if (document.body) {
    document.body.appendChild(button);
    document.body.appendChild(modal);
    
    // 添加事件监听器
    button.addEventListener('click', () => {
      modal.classList.remove('hidden');
      checkPasswordAndLoadCookies();
    });

    modal.querySelector('.cookie-share-close').addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  } else {
    // 如果 body 还不存在，等待它创建完成
    const observer = new MutationObserver((mutations, obs) => {
      if (document.body) {
        document.body.appendChild(button);
        document.body.appendChild(modal);
        
        // 添加事件监听器
        button.addEventListener('click', () => {
          modal.classList.remove('hidden');
          checkPasswordAndLoadCookies();
        });

        modal.querySelector('.cookie-share-close').addEventListener('click', () => {
          modal.classList.add('hidden');
        });
        
        obs.disconnect();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // 添加密码输入事件监听器
  const passwordInput = modal.querySelector('#cookieSharePassword');
  if (passwordInput) {
    passwordInput.addEventListener('change', async (e) => {
      const password = e.target.value;
      if (password) {
        try {
          await new Promise((resolve) => {
            chrome.storage.local.set({ adminPassword: password }, resolve);
          });
          await loadCookies(password);
          document.getElementById('cookieSharePasswordContainer').classList.add('hidden');
        } catch (error) {
          console.error('Error saving password:', error);
        }
      }
    });
  }
}

// 检查密码并加载 cookies
async function checkPasswordAndLoadCookies() {
  const passwordContainer = document.getElementById('cookieSharePasswordContainer');
  const passwordInput = passwordContainer.querySelector('input');
  const cookiesList = document.getElementById('cookieShareList');

  // 显示加载状态
  cookiesList.innerHTML = `
    <div class="cookie-share-loading">
      <div class="cookie-share-spinner"></div>
      <span>Loading cookies...</span>
    </div>
  `;

  try {
    // 从 storage 获取密码
    const result = await new Promise((resolve) => {
      chrome.storage.local.get('adminPassword', resolve);
    });

    if (!result.adminPassword) {
      passwordContainer.classList.remove('hidden');
      cookiesList.innerHTML = '';
    } else {
      await loadCookies(result.adminPassword);
    }
  } catch (error) {
    console.error('Error:', error);
    cookiesList.innerHTML = `<div class="cookie-share-error">Failed to load cookies</div>`;
  }
}

// 加载 cookies
async function loadCookies(password) {
  // 获取正确的 DOM 元素
  const cookiesList = document.getElementById('cookieShareList');
  
  try {
    // 获取自定义 URL
    const result = await new Promise((resolve) => {
      chrome.storage.sync.get(['customUrl'], resolve);
    });

    if (!result.customUrl) {
      cookiesList.innerHTML = `<div class="cookie-share-error">Please set custom URL in extension popup first</div>`;
      return;
    }

    const currentHost = window.location.hostname;
    const response = await fetch(
      `${result.customUrl}/admin/list-cookies-by-host/${encodeURIComponent(currentHost)}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password
        }
      }
    );

    const data = await response.json();
    console.log('Response data:', data); // 添加调试日志

    if (data.success) {
      if (data.cookies.length === 0) {
        cookiesList.innerHTML = `<div class="cookie-share-empty">No cookies found for ${currentHost}</div>`;
      } else {
        cookiesList.innerHTML = data.cookies.map(cookie => `
          <div class="cookie-share-item">
            <div class="flex items-center justify-between w-full">
              <span>ID: ${cookie.id}</span>
              <div class="cookie-share-buttons">
                <button class="cookie-share-receive" data-id="${cookie.id}">Receive</button>
                <button class="cookie-share-delete" data-id="${cookie.id}">Delete</button>
              </div>
            </div>
          </div>
        `).join('');
        attachButtonListeners();
      }
    } else {
      if (response.status === 401) {
        document.getElementById('cookieSharePasswordContainer').classList.remove('hidden');
        cookiesList.innerHTML = `<div class="cookie-share-error">Invalid password</div>`;
      } else {
        cookiesList.innerHTML = `<div class="cookie-share-error">${data.message || 'Failed to load cookies'}</div>`;
      }
    }
  } catch (error) {
    console.error('Error:', error); // 添加错误日志
    cookiesList.innerHTML = `<div class="cookie-share-error">Failed to load cookies: ${error.message}</div>`;
  }
}

// 添加按钮事件监听器
function attachButtonListeners() {
  // Receive 按钮事件
  document.querySelectorAll('.cookie-share-receive').forEach(button => {
    button.addEventListener('click', (e) => {
      const cookieId = e.target.dataset.id;
      chrome.runtime.sendMessage({ 
        action: 'receiveCookies',
        cookieId: cookieId
      });
      document.querySelector('.cookie-share-modal').classList.add('hidden');
    });
  });

  // Delete 按钮事件
  document.querySelectorAll('.cookie-share-delete').forEach(button => {
    button.addEventListener('click', async (e) => {
      const cookieId = e.target.dataset.id;
      if (confirm('Are you sure you want to delete this cookie?')) {
        // 实现删除逻辑
      }
    });
  });
}

// 立即执行初始化
init();

// 为了安全起见，也监听 DOMContentLoaded
document.addEventListener('DOMContentLoaded', init); 