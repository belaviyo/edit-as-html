'use strict';

if (chrome.devtools.panels.elements.createSidebarPane) {
  chrome.devtools.panels.elements.createSidebarPane(chrome.runtime.getManifest().name, sidebar => {
    sidebar.setPage('/data/devtools/index.html');
  });
}
