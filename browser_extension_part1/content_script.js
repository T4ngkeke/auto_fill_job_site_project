// AI Job Tracker - Content Script
// This script runs on LinkedIn job pages to inject the analyze button and handle interactions

let analyzeButton = null;
let sidebarIframe = null;

// Initialize the extension when page loads
function initializeExtension() {
  // Wait for page to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
    return;
  }

  // Inject the analyze button
  injectAnalyzeButton();
  
  // Create the sidebar iframe
  createSidebarIframe();
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(handleBackgroundMessage);
  
  // Listen for messages from sidebar iframe
  window.addEventListener('message', handleSidebarMessage);
}

// Inject the "Analyze this Job" button
function injectAnalyzeButton() {
  // Find the target element (job title area)
  const targetElement = document.querySelector('.jobs-unified-top-card');
  
  if (!targetElement) {
    // Retry after a short delay if element not found
    setTimeout(injectAnalyzeButton, 1000);
    return;
  }

  // Check if button already exists
  if (document.getElementById('ai-job-tracker-button')) {
    return;
  }

  // Create the analyze button
  analyzeButton = document.createElement('button');
  analyzeButton.id = 'ai-job-tracker-button';
  analyzeButton.textContent = '✨ Analyze this Job';
  analyzeButton.className = 'ai-job-tracker-analyze-btn';
  
  // Add click event listener
  analyzeButton.addEventListener('click', handleAnalyzeClick);
  
  // Append button to target element
  targetElement.appendChild(analyzeButton);
}

// Create the sidebar iframe
function createSidebarIframe() {
  // Check if iframe already exists
  if (document.getElementById('ai-job-tracker-sidebar-iframe')) {
    return;
  }

  // Create iframe element
  sidebarIframe = document.createElement('iframe');
  sidebarIframe.id = 'ai-job-tracker-sidebar-iframe';
  sidebarIframe.src = chrome.runtime.getURL('sidebar.html');
  sidebarIframe.className = 'ai-job-tracker-sidebar';
  sidebarIframe.style.display = 'none'; // Hidden by default
  
  // Append to body
  document.body.appendChild(sidebarIframe);
}

// Handle analyze button click
function handleAnalyzeClick() {
  // Show the sidebar
  if (sidebarIframe) {
    sidebarIframe.style.display = 'block';
    
    // Send loading message to sidebar
    sidebarIframe.contentWindow.postMessage({
      type: 'SHOW_LOADING'
    }, '*');
  }

  // Scrape job description text
  const jobDescriptionElement = document.querySelector('.jobs-description-content__text');
  
  if (!jobDescriptionElement) {
    console.error('Job description element not found');
    return;
  }

  const scrapedText = jobDescriptionElement.innerText;
  
  // Send scraped text to background script
  chrome.runtime.sendMessage({
    type: 'ANALYZE_JD',
    payload: scrapedText
  });
}

// Handle messages from background script
function handleBackgroundMessage(message, sender, sendResponse) {
  if (message.type === 'ANALYSIS_COMPLETE') {
    // Send analysis results to sidebar iframe
    if (sidebarIframe && sidebarIframe.contentWindow) {
      sidebarIframe.contentWindow.postMessage({
        type: 'ANALYSIS_COMPLETE',
        payload: message.payload
      }, '*');
    }
  }
}

// Handle messages from sidebar iframe
function handleSidebarMessage(event) {
  if (event.data.type === 'CLOSE_SIDEBAR') {
    if (sidebarIframe) {
      sidebarIframe.style.display = 'none';
    }
  }
}

// Initialize when script loads
initializeExtension();