// AI Job Tracker - Background Service Worker
// This script simulates the backend processing for job analysis

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_JD') {
    // Simulate backend processing with 2-second delay
    setTimeout(() => {
      // Hardcoded mock analysis result
      const mockAnalysis = {
        job_title: "Senior Frontend Engineer",
        company: "Tech Innovations Inc.",
        match_analysis: {
          score: 75,
          summary: "Good fit for frontend skills, but lacks backend experience mentioned in the JD.",
          pros: [
            "Strong experience with React and TypeScript.",
            "CV shows projects using GraphQL."
          ],
          cons: [
            "JD mentions Node.js experience, which is not prominent in the CV.",
            "5 years of experience required, CV shows 4 years."
          ]
        }
      };

      // Send mock analysis back to content script
      chrome.tabs.sendMessage(sender.tab.id, {
        type: 'ANALYSIS_COMPLETE',
        payload: mockAnalysis
      });
    }, 2000); // 2-second delay to simulate processing
  }
});