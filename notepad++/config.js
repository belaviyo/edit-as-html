'use strict';

const config = {};

config.id = 'com.add0n.native_client';

config.command = () => new Promise(resolve => {
  chrome.storage.local.get({
    Mac: 'open -a "Notepad++" %path;',
    Lin: '/opt/notepadpp/notepadpp %path;',
    Win: '"%ProgramFiles(x86)%\\Notepad++\\notepad++.exe" %path;'
  }, prefs => {
    resolve(prefs[navigator.platform.substr(0, 3)]);
  });
});
