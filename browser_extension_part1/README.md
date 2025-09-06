# AI Job Tracker Chrome Extension

A Chrome extension that analyzes job descriptions on LinkedIn using AI.

## Features

- **Smart Job Analysis**: Analyzes job descriptions with AI to provide match scores and insights
- **LinkedIn Integration**: Works seamlessly on LinkedIn job posting pages
- **Batch Job Scanning**: Automatically scan and analyze multiple jobs from LinkedIn search results
- **Floating Sidebar**: Clean, non-intrusive sidebar interface for displaying results
- **Mock AI Backend**: Includes simulated AI processing for testing and development

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" by clicking the toggle in the top right
3. Click "Load unpacked" and select this directory
4. The extension should now appear in your extensions list

## Usage

### Single Job Analysis
1. Navigate to any LinkedIn job posting (e.g., `https://www.linkedin.com/jobs/view/[job-id]`)
2. Look for the "✨ Analyze this Job" button near the job title
3. Click the button to analyze the job description
4. View the AI analysis in the sidebar that appears on the right
5. Use the "×" button to close the sidebar

### Batch Job Scanning (NEW)
1. Navigate to LinkedIn job search results (e.g., `https://www.linkedin.com/jobs/search/?keywords=data%20scientist`)
2. Look for the "✨ Scan list" button in the search header area
3. Click the button to start batch scanning all visible job cards
4. The extension will:
   - Automatically click each job card in sequence
   - Wait for the job details to load
   - Scrape and analyze the job description
   - Show progress in the sidebar with success/failure counts
5. Use the progress controls to pause, resume, or stop the batch scan
6. The scan state is automatically saved and can resume if the page is refreshed

### Batch Scan Features
- **Automatic Processing**: Sequentially processes all job cards in the search results
- **Human-like Behavior**: Random delays between clicks to simulate natural browsing
- **Robust Error Handling**: Retry logic for failed job loads with timeout protection
- **Progress Tracking**: Real-time display of processed jobs, successes, and failures
- **Pause/Resume**: Full control over the scanning process
- **State Persistence**: Resume scanning after page refresh or accidental closure

## Files Structure

- `manifest.json` - Extension configuration and permissions
- `content_script.js` - Main logic for button injection and job scraping
- `background.js` - Service worker that simulates AI processing
- `sidebar.html` - UI structure for the analysis results
- `sidebar.js` - Logic for displaying analysis data
- `sidebar.css` - Styling for button and sidebar
- `popup.html` - Extension popup with instructions
- `icons/` - Placeholder icon files

## Development Notes

- This is a prototype/testing version with mock AI responses
- The extension currently returns hardcoded analysis data after a 2-second delay
- Real AI integration would replace the mock response in `background.js`
- The extension follows Chrome Manifest V3 specifications
- Batch scanning works only on LinkedIn job search pages (`/jobs/search/`)
- Individual job analysis works on both search pages and individual job pages
- The extension uses `chrome.storage.local` to persist batch scan state for resume capability

## Browser Compatibility

- Chrome (Manifest V3)
- Compatible browsers that support Manifest V3 extensions