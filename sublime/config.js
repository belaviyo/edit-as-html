'use strict';

const config = {};

config.id = 'com.add0n.native_client';

config.command = () => new Promise(resolve => {
  chrome.storage.local.get({
    Mac: 'open -a "Sublime Text" %path;',
    Lin: '/opt/sublime_text/sublime_text %path;',
    Win: '"%ProgramFiles%\\Sublime Text 3\\subl.exe" %path;'
  }, prefs => {
    resolve(prefs[navigator.platform.substr(0, 3)]);
  });
});
