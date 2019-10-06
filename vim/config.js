'use strict';

const config = {};

config.id = 'com.add0n.native_client';

config.command = () => new Promise(resolve => {
  chrome.storage.local.get('command', prefs => {
    if (prefs.command) {
      return resolve(prefs.command);
    }
    resolve({
      Mac: 'open -a "MacVim" %path;',
      Lin: '/usr/local/bin/gvim %path;',
      Win: '"%ProgramFiles(x86)%\\Vim\\vim81\\gvim.exe" %path;'
    }[navigator.platform.substr(0, 3)]);
  });
});
