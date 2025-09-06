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
    showLoading();
  } else if (msg.type === 'SHOW_ERROR') {
    showError(msg.payload || 'Error');
  } else if (msg.type === 'SHOW_RESULTS') {
    showResults(msg.payload || {});
  } else if (msg.type === 'SHOW_JD') {
    // display raw JD for testing
    showRawJD(msg.payload && msg.payload.raw ? msg.payload.raw : '');
    // also keep loading visible until real results come
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
});

// initial state
showLoading();