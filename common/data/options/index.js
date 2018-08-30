/* globals config */
'use strict';

function save() {
  const command = document.getElementById('command').value;
  chrome.storage.local.set({command}, () => {
    const status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(() => status.textContent = '', 750);
  });
}

document.addEventListener('DOMContentLoaded', () => config.command().then(command => {
  document.getElementById('command').value = command;
}));
document.getElementById('save').addEventListener('click', save);
document.getElementById('support').addEventListener('click', () => chrome.tabs.create({
  url: chrome.runtime.getManifest().homepage_url + '&rd=donate'
}));
