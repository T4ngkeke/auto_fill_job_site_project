// AI Job Tracker - Sidebar Script
// This script handles the sidebar UI and communication with the content script

// Listen for messages from the parent window (content script)
window.addEventListener('message', (event) => {
  if (event.data.type === 'SHOW_LOADING') {
    showLoadingState();
  } else if (event.data.type === 'ANALYSIS_COMPLETE') {
    displayAnalysisResults(event.data.payload);
  }
});

// Show loading indicator
function showLoadingState() {
  document.getElementById('loading-state').style.display = 'block';
  document.getElementById('results-state').style.display = 'none';
}

// Display the analysis results
function displayAnalysisResults(analysisData) {
  // Hide loading state
  document.getElementById('loading-state').style.display = 'none';
  
  // Populate job information
  document.getElementById('job-title').textContent = analysisData.job_title;
  document.getElementById('company-name').textContent = analysisData.company;
  
  // Populate match analysis
  document.getElementById('match-score').textContent = analysisData.match_analysis.score;
  document.getElementById('match-summary').textContent = analysisData.match_analysis.summary;
  
  // Populate pros list
  const prosList = document.getElementById('match-pros');
  prosList.innerHTML = '';
  analysisData.match_analysis.pros.forEach(pro => {
    const listItem = document.createElement('li');
    listItem.textContent = pro;
    prosList.appendChild(listItem);
  });
  
  // Populate cons list
  const consList = document.getElementById('match-cons');
  consList.innerHTML = '';
  analysisData.match_analysis.cons.forEach(con => {
    const listItem = document.createElement('li');
    listItem.textContent = con;
    consList.appendChild(listItem);
  });
  
  // Show results state
  document.getElementById('results-state').style.display = 'block';
}

// Close sidebar function
function closeSidebar() {
  // Send message to parent window to hide the sidebar
  window.parent.postMessage({
    type: 'CLOSE_SIDEBAR'
  }, '*');
}