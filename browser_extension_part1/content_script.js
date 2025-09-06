// content_script.js (robust, defensive posting + debug logs)
console.log("🚀 AI Job Tracker: content_script injected");

// --- 配置 ---
const TARGET_SELECTOR = '.job-details-jobs-unified-top-card__job-title';
const BUTTON_ID = 'ai-job-tracker-button';
const JD_SELECTOR = '#job-details';
const SIDEBAR_ID = 'ai-job-tracker-sidebar-iframe';

// Batch scan configuration
const HEADER_SELECTOR = 'header.scaffold-layout__list-header';
const BATCH_BUTTON_ID = 'ai-job-tracker-batch-button';
const JOB_CARD_SELECTORS = 'li[data-occludable-job-id], div[data-job-id]';
const WAIT_FOR_DETAIL_TIMEOUT = 12000; // 12 seconds
const RETRY_ATTEMPTS = 2;
const HUMAN_DELAY_MIN = 300;
const HUMAN_DELAY_MAX = 1200;

let sidebarIframe = null;
let sidebarReady = false;
let pendingMessages = [];

// Batch scan state
let batchScanState = {
  isRunning: false,
  isPaused: false,
  queue: [],
  currentIndex: 0,
  processed: 0,
  successes: 0,
  failures: 0,
  startTime: null,
  _resumeAttempted: false
};

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
    const handleSidebarMessage = (ev) => {
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
      } else if (msg.type === 'PAUSE_BATCH_SCAN') {
        pauseBatchScan();
      } else if (msg.type === 'RESUME_BATCH_SCAN') {
        resumeBatchScan();
      } else if (msg.type === 'STOP_BATCH_SCAN') {
        stopBatchScan();
      }
    };

    // Remove any existing listener to avoid conflicts
    window.removeEventListener('message', handleSidebarMessage);
    window.addEventListener('message', handleSidebarMessage);

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
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'ANALYZE_JD', payload: scrapedText }, (resp) => {
        // optional ack handling
        if (chrome.runtime.lastError) {
          console.warn('chrome.runtime.sendMessage error:', chrome.runtime.lastError);
        } else {
          console.log('ANALYZE_JD message sent to background');
        }
      });
    } else {
      console.warn('Chrome runtime API not available');
      postToSidebar({ type: 'SHOW_ERROR', payload: 'Extension runtime not available. Please reload the page.' });
    }

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

// --- Batch scan functions ---

// Inject batch scan button in header
function injectBatchScanButton() {
  try {
    if (document.getElementById(BATCH_BUTTON_ID)) return;
    
    const header = document.querySelector(HEADER_SELECTOR);
    if (!header) {
      console.log('Header not found for batch scan button');
      return;
    }

    const btn = document.createElement('button');
    btn.id = BATCH_BUTTON_ID;
    btn.innerText = '✨ Scan list';
    btn.style.marginLeft = '10px';
    btn.style.padding = '8px 12px';
    btn.style.fontSize = '14px';
    btn.style.color = '#fff';
    btn.style.backgroundColor = '#0a66c2';
    btn.style.border = 'none';
    btn.style.borderRadius = '16px';
    btn.style.cursor = 'pointer';
    btn.style.fontWeight = '600';

    btn.addEventListener('click', handleBatchScanClick);
    header.appendChild(btn);
    console.log('Injected Batch Scan button.');
  } catch (e) {
    console.error('injectBatchScanButton error:', e);
  }
}

// Handle batch scan button click
function handleBatchScanClick() {
  try {
    console.log('🔍 Batch scan button clicked!');
    
    if (batchScanState.isRunning) {
      console.log('Batch scan already running');
      return;
    }

    const sidebar = getOrCreateSidebar();
    if (!sidebar) {
      console.error('Failed to create sidebar iframe.');
      return;
    }
    sidebar.style.display = 'block';

    // Initialize batch scan
    initializeBatchScan();
    
  } catch (e) {
    console.error('handleBatchScanClick error:', e);
  }
}

// Initialize batch scan by collecting job cards
function initializeBatchScan() {
  try {
    // Collect job cards
    const jobCards = document.querySelectorAll(JOB_CARD_SELECTORS);
    console.log(`Found ${jobCards.length} job cards`);
    
    if (jobCards.length === 0) {
      postToSidebar({ type: 'SHOW_ERROR', payload: 'No job cards found. Make sure you are on a LinkedIn jobs search page.' });
      return;
    }

    // Build queue with job IDs and elements
    const queue = [];
    jobCards.forEach((card, index) => {
      const jobId = card.getAttribute('data-occludable-job-id') || 
                   card.querySelector('[data-job-id]')?.getAttribute('data-job-id');
      if (jobId) {
        queue.push({
          jobId,
          index,
          attempts: 0,
          status: 'pending' // pending, processing, success, failed
        });
      }
    });

    if (queue.length === 0) {
      postToSidebar({ type: 'SHOW_ERROR', payload: 'No valid job cards with IDs found.' });
      return;
    }

    // Reset state
    batchScanState = {
      isRunning: true,
      isPaused: false,
      queue: queue,
      currentIndex: 0,
      processed: 0,
      successes: 0,
      failures: 0,
      startTime: Date.now()
    };

    // Save to storage
    saveBatchState();

    // Show batch progress UI
    postToSidebar({ 
      type: 'BATCH_PROGRESS', 
      payload: {
        total: queue.length,
        processed: 0,
        successes: 0,
        failures: 0,
        currentJobId: queue[0]?.jobId,
        status: 'starting'
      }
    });

    // Start processing
    processBatchQueue();
    
  } catch (e) {
    console.error('initializeBatchScan error:', e);
    postToSidebar({ type: 'SHOW_ERROR', payload: 'Error initializing batch scan: ' + e.message });
  }
}

// Main batch processing function
async function processBatchQueue() {
  while (batchScanState.currentIndex < batchScanState.queue.length && 
         batchScanState.isRunning && 
         !batchScanState.isPaused) {
    
    const currentJob = batchScanState.queue[batchScanState.currentIndex];
    console.log(`Processing job ${batchScanState.currentIndex + 1}/${batchScanState.queue.length}: ${currentJob.jobId}`);
    
    // Update progress
    postToSidebar({ 
      type: 'BATCH_PROGRESS', 
      payload: {
        total: batchScanState.queue.length,
        processed: batchScanState.processed,
        successes: batchScanState.successes,
        failures: batchScanState.failures,
        currentJobId: currentJob.jobId,
        status: 'processing'
      }
    });

    try {
      const success = await processJob(currentJob);
      
      if (success) {
        currentJob.status = 'success';
        batchScanState.successes++;
      } else {
        currentJob.status = 'failed';
        batchScanState.failures++;
      }
      
      batchScanState.processed++;
      batchScanState.currentIndex++;
      
      // Save progress
      saveBatchState();
      
      // Human-like delay between jobs
      if (batchScanState.currentIndex < batchScanState.queue.length) {
        const delay = Math.random() * (HUMAN_DELAY_MAX - HUMAN_DELAY_MIN) + HUMAN_DELAY_MIN;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
    } catch (e) {
      console.error(`Error processing job ${currentJob.jobId}:`, e);
      currentJob.status = 'failed';
      batchScanState.failures++;
      batchScanState.processed++;
      batchScanState.currentIndex++;
      saveBatchState();
    }
  }

  // Batch complete
  if (batchScanState.currentIndex >= batchScanState.queue.length) {
    batchScanState.isRunning = false;
    postToSidebar({ 
      type: 'BATCH_PROGRESS', 
      payload: {
        total: batchScanState.queue.length,
        processed: batchScanState.processed,
        successes: batchScanState.successes,
        failures: batchScanState.failures,
        currentJobId: null,
        status: 'completed'
      }
    });
    console.log('✅ Batch scan completed!');
    clearBatchState();
  }
}

// Process a single job
async function processJob(jobData) {
  let attempts = 0;
  
  while (attempts <= RETRY_ATTEMPTS) {
    try {
      console.log(`Attempting job ${jobData.jobId}, attempt ${attempts + 1}`);
      
      // Find and click the job card
      const success = await clickJobCard(jobData.jobId);
      if (!success) {
        attempts++;
        if (attempts <= RETRY_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
          continue;
        }
        return false;
      }

      // Wait for detail pane to load
      const detailLoaded = await waitForDetailPane(jobData.jobId);
      if (!detailLoaded) {
        attempts++;
        if (attempts <= RETRY_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
          continue;
        }
        return false;
      }

      // Scrape and analyze
      const jdElement = document.querySelector(JD_SELECTOR);
      if (!jdElement) {
        console.error('Could not find job description element');
        attempts++;
        if (attempts <= RETRY_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
          continue;
        }
        return false;
      }

      const scrapedText = jdElement.innerText || jdElement.textContent || '';
      console.log(`Scraped JD for ${jobData.jobId}, length: ${scrapedText.length}`);

      // Send to background for analysis
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ 
          type: 'ANALYZE_JD', 
          payload: scrapedText,
          metadata: { jobId: jobData.jobId, batchMode: true }
        });
      } else {
        console.warn('Chrome runtime API not available for sending analysis message');
      }

      return true;

    } catch (e) {
      console.error(`Error in processJob attempt ${attempts + 1}:`, e);
      attempts++;
      if (attempts <= RETRY_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
      }
    }
  }
  
  return false;
}

// Click on a job card
async function clickJobCard(jobId) {
  try {
    // Re-query the element to handle DOM changes
    let jobCard = document.querySelector(`[data-occludable-job-id="${jobId}"]`) ||
                  document.querySelector(`[data-job-id="${jobId}"]`);
    
    if (!jobCard) {
      console.error(`Job card with ID ${jobId} not found in DOM`);
      return false;
    }

    // Scroll into view if needed
    jobCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Re-query after scroll
    jobCard = document.querySelector(`[data-occludable-job-id="${jobId}"]`) ||
              document.querySelector(`[data-job-id="${jobId}"]`);
    
    if (!jobCard) {
      console.error(`Job card with ID ${jobId} not found after scroll`);
      return false;
    }

    // Simulate human-like click
    const rect = jobCard.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const clickEvent = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y
    });

    jobCard.dispatchEvent(clickEvent);
    console.log(`Clicked job card ${jobId}`);
    return true;

  } catch (e) {
    console.error(`Error clicking job card ${jobId}:`, e);
    return false;
  }
}

// Wait for detail pane to load
async function waitForDetailPane(expectedJobId) {
  const startTime = Date.now();
  const checkInterval = 500;
  let lastContent = '';

  return new Promise((resolve) => {
    const checkDetailPane = () => {
      try {
        // Check URL first
        const currentJobId = new URL(location.href).searchParams.get('currentJobId');
        if (currentJobId === expectedJobId) {
          console.log(`Detail pane loaded for job ${expectedJobId} (URL check)`);
          resolve(true);
          return;
        }

        // Check content change
        const detailElement = document.querySelector(JD_SELECTOR);
        if (detailElement) {
          const currentContent = detailElement.innerText || detailElement.textContent || '';
          if (currentContent && currentContent !== lastContent && currentContent.length > 100) {
            console.log(`Detail pane loaded for job ${expectedJobId} (content check)`);
            resolve(true);
            return;
          }
          lastContent = currentContent;
        }

        // Check timeout
        if (Date.now() - startTime > WAIT_FOR_DETAIL_TIMEOUT) {
          console.warn(`Timeout waiting for detail pane for job ${expectedJobId}`);
          resolve(false);
          return;
        }

        // Continue checking
        setTimeout(checkDetailPane, checkInterval);
      } catch (e) {
        console.error('Error in checkDetailPane:', e);
        resolve(false);
      }
    };

    checkDetailPane();
  });
}

// Save batch state to storage
function saveBatchState() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        'ai-job-tracker-batch-state': {
          isRunning: batchScanState.isRunning,
          isPaused: batchScanState.isPaused,
          currentIndex: batchScanState.currentIndex,
          processed: batchScanState.processed,
          successes: batchScanState.successes,
          failures: batchScanState.failures,
          queue: batchScanState.queue.map(job => ({
            jobId: job.jobId,
            status: job.status,
            attempts: job.attempts
          })),
          startTime: batchScanState.startTime
        }
      });
    }
  } catch (e) {
    console.error('Error saving batch state:', e);
  }
}

// Load batch state from storage
async function loadBatchState() {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return false;
    }
    
    const result = await chrome.storage.local.get(['ai-job-tracker-batch-state']);
    const savedState = result['ai-job-tracker-batch-state'];
    
    if (savedState && savedState.isRunning) {
      console.log('Found saved batch state, checking if resumable...');
      
      // Check if we're still on the same page and jobs are available
      const currentJobCards = document.querySelectorAll(JOB_CARD_SELECTORS);
      const availableJobIds = Array.from(currentJobCards).map(card => 
        card.getAttribute('data-occludable-job-id') || 
        card.querySelector('[data-job-id]')?.getAttribute('data-job-id')
      ).filter(Boolean);

      // Check if at least some jobs from the saved queue are still available
      const resumableJobs = savedState.queue.filter(job => 
        availableJobIds.includes(job.jobId) && job.status === 'pending'
      );

      if (resumableJobs.length > 0) {
        // Restore state
        batchScanState = {
          isRunning: true,
          isPaused: false,
          queue: savedState.queue,
          currentIndex: savedState.currentIndex,
          processed: savedState.processed,
          successes: savedState.successes,
          failures: savedState.failures,
          startTime: savedState.startTime,
          _resumeAttempted: true
        };

        console.log(`Resuming batch scan from job ${batchScanState.currentIndex + 1}/${batchScanState.queue.length}`);
        
        // Show sidebar and resume
        const sidebar = getOrCreateSidebar();
        if (sidebar) sidebar.style.display = 'block';
        
        postToSidebar({ 
          type: 'BATCH_PROGRESS', 
          payload: {
            total: batchScanState.queue.length,
            processed: batchScanState.processed,
            successes: batchScanState.successes,
            failures: batchScanState.failures,
            currentJobId: batchScanState.queue[batchScanState.currentIndex]?.jobId,
            status: 'resuming'
          }
        });

        // Resume processing
        processBatchQueue();
        return true;
      }
    }
    
    return false;
  } catch (e) {
    console.error('Error loading batch state:', e);
    return false;
  }
}

// Clear batch state from storage
function clearBatchState() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove(['ai-job-tracker-batch-state']);
    }
  } catch (e) {
    console.error('Error clearing batch state:', e);
  }
}

// Pause/resume batch scan
function pauseBatchScan() {
  batchScanState.isPaused = true;
  saveBatchState();
  console.log('Batch scan paused');
}

function resumeBatchScan() {
  if (batchScanState.isRunning && batchScanState.isPaused) {
    batchScanState.isPaused = false;
    saveBatchState();
    console.log('Batch scan resumed');
    processBatchQueue();
  }
}

function stopBatchScan() {
  batchScanState.isRunning = false;
  batchScanState.isPaused = false;
  clearBatchState();
  console.log('Batch scan stopped');
  
  postToSidebar({ 
    type: 'BATCH_PROGRESS', 
    payload: {
      total: batchScanState.queue.length,
      processed: batchScanState.processed,
      successes: batchScanState.successes,
      failures: batchScanState.failures,
      currentJobId: null,
      status: 'stopped'
    }
  });
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

// --- Check if we're on a jobs search page ---
function isJobsSearchPage() {
  return window.location.pathname.includes('/jobs/search/');
}

// --- 等待目标 DOM 出现并注入按钮 ---
const observer = setInterval(async () => {
  // Always try to inject single job analyze button
  const target = document.querySelector(TARGET_SELECTOR);
  if (target) {
    injectAnalyzeButton(target);
  }

  // Only inject batch scan button on search pages
  if (isJobsSearchPage()) {
    injectBatchScanButton();
    
    // Try to resume any pending batch scan (only once)
    if (!batchScanState.isRunning && !batchScanState._resumeAttempted) {
      batchScanState._resumeAttempted = true;
      await loadBatchState();
    }
  }
}, 1000);

// 预创建 sidebar（不显示）
getOrCreateSidebar();