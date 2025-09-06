// sidebar.js (runs inside iframe)
console.log('🧭 sidebar.js loaded');

function showLoading() {
  document.getElementById('loading-state').style.display = 'block';
  document.getElementById('results-state').style.display = 'none';
  document.getElementById('error-state').style.display = 'none';
  // keep raw visible for testing
}

function showError(msg) {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('results-state').style.display = 'none';
  document.getElementById('error-state').style.display = 'block';
  document.getElementById('error-message').innerText = msg || 'Unknown error';
}

function showResults(data) {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('error-state').style.display = 'none';
  document.getElementById('results-state').style.display = 'block';

  document.getElementById('job-title').innerText = data.job_title || '-';
  document.getElementById('company-name').innerText = data.company || '';
  document.getElementById('match-score').innerText = (data.match_analysis && data.match_analysis.score) ? data.match_analysis.score + '%' : '-';
  document.getElementById('match-summary').innerText = (data.match_analysis && data.match_analysis.summary) || '';

  const prosEl = document.getElementById('match-pros');
  const consEl = document.getElementById('match-cons');
  prosEl.innerHTML = '';
  consEl.innerHTML = '';

  const pros = (data.match_analysis && data.match_analysis.pros) || [];
  const cons = (data.match_analysis && data.match_analysis.cons) || [];
  for (const p of pros) {
    const li = document.createElement('li'); li.innerText = p; prosEl.appendChild(li);
  }
  for (const c of cons) {
    const li = document.createElement('li'); li.innerText = c; consEl.appendChild(li);
  }
}

function showRawJD(text) {
  const el = document.getElementById('raw-jd');
  el.innerText = text || '-';
}

// Batch scan functions
function showBatchProgress(data) {
  // Show batch controls and hide other states
  document.getElementById('batch-controls').style.display = 'block';
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('results-state').style.display = 'none';
  document.getElementById('error-state').style.display = 'none';
  
  const { total, processed, successes, failures, currentJobId, status } = data;
  
  // Update progress bar
  const progressPercent = total > 0 ? (processed / total) * 100 : 0;
  document.getElementById('progress-bar').style.width = progressPercent + '%';
  
  // Update progress text
  document.getElementById('progress-text').innerText = `${processed} / ${total} jobs processed`;
  
  // Update status
  const statusEl = document.getElementById('progress-status');
  statusEl.innerText = status || 'Running';
  statusEl.className = 'status ' + (status || 'running').toLowerCase();
  
  // Update stats
  document.getElementById('success-count').innerText = successes || 0;
  document.getElementById('failure-count').innerText = failures || 0;
  document.getElementById('current-job').innerText = currentJobId || '-';
  
  // Update control buttons based on status
  const pauseBtn = document.getElementById('pause-batch-btn');
  const resumeBtn = document.getElementById('resume-batch-btn');
  const stopBtn = document.getElementById('stop-batch-btn');
  
  if (status === 'completed' || status === 'stopped') {
    pauseBtn.style.display = 'none';
    resumeBtn.style.display = 'none';
    stopBtn.style.display = 'none';
  } else if (status === 'paused') {
    pauseBtn.style.display = 'none';
    resumeBtn.style.display = 'inline-block';
    stopBtn.style.display = 'inline-block';
  } else {
    pauseBtn.style.display = 'inline-block';
    resumeBtn.style.display = 'none';
    stopBtn.style.display = 'inline-block';
  }
}

function hideBatchProgress() {
  document.getElementById('batch-controls').style.display = 'none';
}

// Handle batch control button clicks
function setupBatchControls() {
  document.getElementById('pause-batch-btn').addEventListener('click', () => {
    window.parent.postMessage({ type: 'PAUSE_BATCH_SCAN' }, '*');
  });
  
  document.getElementById('resume-batch-btn').addEventListener('click', () => {
    window.parent.postMessage({ type: 'RESUME_BATCH_SCAN' }, '*');
  });
  
  document.getElementById('stop-batch-btn').addEventListener('click', () => {
    window.parent.postMessage({ type: 'STOP_BATCH_SCAN' }, '*');
  });
}

// 当 iframe 加载完成，主动通知父页面（握手）
window.addEventListener('load', () => {
  try {
    window.parent.postMessage({ type: 'SIDEBAR_READY' }, '*');
  } catch (e) {
    console.error('Failed to post SIDEBAR_READY:', e);
  }
});

// 接收父窗口的消息
window.addEventListener('message', (ev) => {
  const msg = ev.data || {};
  if (!msg.type) return;
  if (msg.type === 'SHOW_LOADING') {
    hideBatchProgress();
    showLoading();
  } else if (msg.type === 'SHOW_ERROR') {
    hideBatchProgress();
    showError(msg.payload || 'Error');
  } else if (msg.type === 'SHOW_RESULTS') {
    hideBatchProgress();
    showResults(msg.payload || {});
  } else if (msg.type === 'SHOW_JD') {
    // display raw JD for testing
    showRawJD(msg.payload && msg.payload.raw ? msg.payload.raw : '');
    // also keep loading visible until real results come
  } else if (msg.type === 'BATCH_PROGRESS') {
    showBatchProgress(msg.payload || {});
  }
});

// Close button -> notify parent to hide sidebar
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      try {
        window.parent.postMessage({ type: 'CLOSE_SIDEBAR' }, '*');
      } catch (e) {
        console.error('Failed to post CLOSE_SIDEBAR:', e);
      }
    });
  }
  
  // Setup batch control buttons
  setupBatchControls();
});

// initial state
showLoading();