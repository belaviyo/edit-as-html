'use strict';

if (chrome.devtools.panels.elements.createSidebarPane) {
  chrome.devtools.panels.elements.createSidebarPane('Sublime Text', sidebar => {
    sidebar.setPage('/data/devtools/index.html');
  });
}
