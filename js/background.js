// Clicking the toolbar icon opens a new tab (which shows the homepage).
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({});
});
