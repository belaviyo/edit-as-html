/* globals config */
'use strict';

const toast = document.getElementById('toast');

function save() {
  const command = document.getElementById('command').value;
  chrome.storage.local.set({command}, () => {
    toast.textContent = 'Options saved.';
    setTimeout(() => toast.textContent = '', 750);
  });
}

document.addEventListener('DOMContentLoaded', () => config.command().then(command => {
  document.getElementById('command').value = command;
}));
document.getElementById('save').addEventListener('click', save);
document.getElementById('support').addEventListener('click', () => chrome.tabs.create({
  url: chrome.runtime.getManifest().homepage_url + '&rd=donate'
}));
document.getElementById('permission').addEventListener('click', () => chrome.permissions.request({
  origins: ['<all_urls>']
}, granted => {
  toast.textContent = 'Remote frames access ' + (granted ? 'is' : 'is not') + ' granted';
  setTimeout(() => toast.textContent = '', 2000);
}));
