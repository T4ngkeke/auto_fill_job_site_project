// content_script.js (robust, defensive posting + debug logs)
console.log("🚀 AI Job Tracker: content_script injected");

// --- 配置 ---
const TARGET_SELECTOR = '.job-details-jobs-unified-top-card__job-title';
const BUTTON_ID = 'ai-job-tracker-button';
const JD_SELECTOR = '#job-details';
const SIDEBAR_ID = 'ai-job-tracker-sidebar-iframe';

let sidebarIframe = null;
let sidebarReady = false;
let pendingMessages = [];

// --- 创建或获取 sidebar iframe（并设置 src） ---
function getOrCreateSidebar() {
  try {
    const existing = document.getElementById(SIDEBAR_ID);
    if (existing) {
      sidebarIframe = existing;
      return existing;
    }

    const iframe = document.createElement('iframe');
    iframe.id = SIDEBAR_ID;

    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.right = '0';
    iframe.style.width = '400px';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.style.boxShadow = '-2px 0 15px rgba(0,0,0,0.12)';
    iframe.style.zIndex = '999999';
    iframe.style.backgroundColor = 'white';
    iframe.style.display = 'none';

    // 关键：加载扩展内页面
    iframe.src = chrome.runtime.getURL('sidebar.html');

    document.body.appendChild(iframe);
    sidebarIframe = iframe;

    // 父页面接收来自 iframe 的消息（握手 & close）
    window.addEventListener('message', (ev) => {
      const msg = ev.data || {};
      if (!msg.type) return;

      if (msg.type === 'SIDEBAR_READY') {
        console.log('📨 Received SIDEBAR_READY from iframe');
        sidebarReady = true;
        // flush pending messages
        while (pendingMessages.length > 0) {
          const m = pendingMessages.shift();
          _postToSidebarImmediate(m);
        }
      } else if (msg.type === 'CLOSE_SIDEBAR') {
        console.log('📨 Received CLOSE_SIDEBAR from iframe, hiding sidebar');
        if (sidebarIframe) sidebarIframe.style.display = 'none';
      }
    });

    // Safety: if iframe never sends SIDEBAR_READY, log after timeout
    setTimeout(() => {
      if (!sidebarReady && pendingMessages.length > 0) {
        console.warn('Sidebar not ready after 5s; pendingMessages:', pendingMessages.length);
      }
    }, 5000);

    return iframe;
  } catch (e) {
    console.error('getOrCreateSidebar error:', e);
    return null;
  }
}

// --- 发送到 sidebar (队列) ---
function postToSidebar(message) {
  if (!sidebarIframe) {
    getOrCreateSidebar();
  }
  if (!sidebarReady) {
    console.log('Sidebar not ready yet — queuing message:', message.type);
    pendingMessages.push(message);
    return;
  }
  _postToSidebarImmediate(message);
}

function _postToSidebarImmediate(message) {
  if (!sidebarIframe) {
    console.warn('No sidebarIframe available to post message:', message.type);
    return;
  }
  const cw = sidebarIframe.contentWindow;
  if (!cw) {
    console.warn('sidebarIframe.contentWindow is null — cannot post:', message.type);
    // try a short retry
    setTimeout(() => {
      if (sidebarIframe && sidebarIframe.contentWindow) {
        try {
          sidebarIframe.contentWindow.postMessage(message, '*');
        } catch (err) {
          console.error('Retry postToSidebar failed:', err);
        }
      } else {
        console.error('Retry failed: contentWindow still unavailable for', message.type);
      }
    }, 200);
    return;
  }
  try {
    cw.postMessage(message, '*');
  } catch (err) {
    console.error('Error posting message to sidebar contentWindow:', err, 'message:', message.type);
  }
}

// --- 点击处理函数（带诊断日志） ---
function handleAnalyzeClick() {
  try {
    console.log('✨ Analyze button clicked! sidebarIframe exists?', !!sidebarIframe, 'sidebarReady?', sidebarReady);

    const sidebar = getOrCreateSidebar();
    if (!sidebar) {
      console.error('Failed to create sidebar iframe.');
      return;
    }
    // 显示侧边栏即刻给出视觉反馈
    sidebar.style.display = 'block';

    // 立即告诉 sidebar 显示 loading（会被队列处理）
    postToSidebar({ type: 'SHOW_LOADING' });

    // 抓取 JD
    const jdElement = document.querySelector(JD_SELECTOR);
    if (!jdElement) {
      console.error('Could not find job description element:', JD_SELECTOR);
      postToSidebar({ type: 'SHOW_ERROR', payload: 'Could not find job description on the page.' });
      return;
    }
    const scrapedText = jdElement.innerText || jdElement.textContent || '';
    console.log('Scraped JD length:', scrapedText.length);
    // 打印前 1000 字用于快速验证
    console.log('Scraped JD preview:', scrapedText ? scrapedText.substring(0, 1000) : '<empty>');

    // 测试阶段：先把 raw JD 发送到 sidebar 显示，验证抓取是否正确
    postToSidebar({ type: 'SHOW_JD', payload: { raw: scrapedText } });

    // 然后把 JD 发送给 background 做模拟分析
    chrome.runtime.sendMessage({ type: 'ANALYZE_JD', payload: scrapedText }, (resp) => {
      // optional ack handling
      if (chrome.runtime.lastError) {
        console.warn('chrome.runtime.sendMessage error:', chrome.runtime.lastError);
      } else {
        console.log('ANALYZE_JD message sent to background');
      }
    });

  } catch (e) {
    console.error('Unhandled error in handleAnalyzeClick:', e);
  }
}

// --- 注入按钮 ---
function injectAnalyzeButton(targetElement) {
  try {
    if (document.getElementById(BUTTON_ID)) return;

    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.innerText = '✨ Analyze this Job';
    btn.style.marginLeft = '10px';
    btn.style.padding = '8px 12px';
    btn.style.fontSize = '14px';
    btn.style.color = '#fff';
    btn.style.backgroundColor = '#0a66c2';
    btn.style.border = 'none';
    btn.style.borderRadius = '16px';
    btn.style.cursor = 'pointer';
    btn.style.fontWeight = '600';

    btn.addEventListener('click', handleAnalyzeClick);
    targetElement.appendChild(btn);
    console.log('Injected Analyze button.');
  } catch (e) {
    console.error('injectAnalyzeButton error:', e);
  }
}

// --- 接收 background 的分析结果并转发 ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message && message.type === 'ANALYSIS_COMPLETE') {
      console.log('📨 Received ANALYSIS_COMPLETE in content_script:', message.payload);
      getOrCreateSidebar();
      if (sidebarIframe) sidebarIframe.style.display = 'block';
      postToSidebar({ type: 'SHOW_RESULTS', payload: message.payload });
    }
  } catch (e) {
    console.error('Error handling ANALYSIS_COMPLETE:', e);
  }
});

// --- 等待目标 DOM 出现并注入按钮 ---
const observer = setInterval(() => {
  const target = document.querySelector(TARGET_SELECTOR);
  if (target) {
    injectAnalyzeButton(target);
    clearInterval(observer);
    console.log('✅ Button injected.');
  }
}, 500);

// 预创建 sidebar（不显示）
getOrCreateSidebar();