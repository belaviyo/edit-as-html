'use strict';

if (chrome.devtools.panels.elements.createSidebarPane) {
  const name = chrome.runtime.getManifest().name;
  chrome.devtools.panels.elements.createSidebarPane(name, sidebar => {
    sidebar.setPage('/data/devtools/index.html');
  });
}
