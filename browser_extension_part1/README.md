# AI Job Tracker Chrome Extension

A Chrome extension that analyzes job descriptions on LinkedIn using AI.

## Features

- **Smart Job Analysis**: Analyzes job descriptions with AI to provide match scores and insights
- **LinkedIn Integration**: Works seamlessly on LinkedIn job posting pages
- **Floating Sidebar**: Clean, non-intrusive sidebar interface for displaying results
- **Mock AI Backend**: Includes simulated AI processing for testing and development

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" by clicking the toggle in the top right
3. Click "Load unpacked" and select this directory
4. The extension should now appear in your extensions list

## Usage

1. Navigate to any LinkedIn job posting (e.g., `https://www.linkedin.com/jobs/view/[job-id]`)
2. Look for the "✨ Analyze this Job" button near the job title
3. Click the button to analyze the job description
4. View the AI analysis in the sidebar that appears on the right
5. Use the "×" button to close the sidebar

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

## Browser Compatibility

- Chrome (Manifest V3)
- Compatible browsers that support Manifest V3 extensions