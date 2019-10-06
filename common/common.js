/*  globals config */
'use strict';

function notify(message) {
  chrome.notifications.create({
    title: 'Edit as HTML',
    type: 'basic',
    iconUrl: '/data/icons/48.png',
    message
  });
}

chrome.browserAction.onClicked.addListener(tab => {
  chrome.tabs.insertCSS(tab.id, {
    allFrames: true,
    matchAboutBlank: true,
    runAt: 'document_start',
    file: '/data/inject/inspect.css'
  }, () => {
    if (chrome.runtime.lastError) {
      notify(chrome.runtime.lastError.message);
    }
    else {
      chrome.tabs.executeScript(tab.id, {
        allFrames: true,
        matchAboutBlank: true,
        runAt: 'document_start',
        file: '/data/inject/inspect.js'
      });
    }
  });
});

function editor(request, observe) {
  const native = chrome.runtime.connectNative(config.id);
  native.onDisconnect.addListener(() => observe());
  native.onMessage.addListener(observe);
  native.postMessage({
    permissions: ['crypto', 'fs', 'path', 'os'],
    args: [request.content, request.ext],
    script: `
      const crypto = require('crypto');
      const fs = require('fs');

      const [content, ext] = args;

      const filename = require('path').join(
        require('os').tmpdir(),
        'editor-' + crypto.randomBytes(4).readUInt32LE(0) + '.' + ext
      );
      fs.writeFile(filename, content, e => {
        if (e) {
          push({
            method: 'error',
            error: e.message
          });
          close();
        }
        else {
          push({
            method: 'file-created',
            filename
          });
          fs.watchFile(filename, event => {
            fs.readFile(filename, 'utf8', (e, content) => {
              if (e) {
                push({
                  type: 'error',
                  error: e.message
                });
              }
              else {
                push({
                  method: 'file-changed',
                  content,
                  event
                });
              }
            });
          });
        }
      });
    `
  });
  return native;
}

chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.method === 'bounce-release') {
    chrome.tabs.sendMessage(sender.tab.id, {
      method: 'release'
    });
  }
});

const panels = {};
chrome.tabs.onRemoved.addListener(tabId => delete panels[tabId]);

chrome.runtime.onConnect.addListener(devToolsConnection => {
  if (devToolsConnection.name === 'devtools-panel') {
    return devToolsConnection.onMessage.addListener(request => {
      if (request.method === 'tabId') {
        panels[request.tabId] = devToolsConnection;
        devToolsConnection.onDisconnect.addListener(() => {
          delete panels[request.tabId];
        });
      }
    });
  }
  const connectListener = request => {
    const id = devToolsConnection.sender.tab.id;
    const log = msg => panels[id] ? panels[id].postMessage({
      method: 'log',
      msg
    }) : '';
    if (request.method === 'edit-with') {
      const native = editor(request, res => {
        if (!res) {
          const lastError = chrome.runtime.lastError;
          let msg = 'The native client is not installed or the native application exited with an error.';
          if (lastError) {
            msg += ' -- ' + lastError.message;
          }
          notify(msg);
          chrome.tabs.create({
            url: '/data/guide/index.html'
          });
        }
        else if (res.method === 'error') {
          notify(res.error);
        }
        else if (res.method === 'file-created') {
          log('Temporary file is created at ' + res.filename);
          config.command().then(command => {
            chrome.runtime.sendNativeMessage(config.id, {
              permissions: ['child_process'],
              args: [command.replace('%path;', res.filename)],
              script: String.raw`
                const {exec} = require('child_process');
                const command = args[0].replace(/%([^%]+)%/g, (_, n) => env[n]);
                exec(command, (error, stdout, stderr) => {
                  push({error, stdout, stderr});
                  close();
                });
              `
            }, res => {
              if (res.stderr) {
                notify(res.stderr);
              }
            });
          });
        }
        else if (res.method === 'file-changed') {
          log('File content is changed');
          devToolsConnection.postMessage({
            method: 'file-changed',
            content: res.content
          });
        }
      });
      connectListener.natives.push(native);
    }
  };
  connectListener.natives = [];
  // add the listener
  devToolsConnection.onMessage.addListener(connectListener);
  // disconnect
  devToolsConnection.onDisconnect.addListener(() => {
    connectListener.natives.forEach(n => n.disconnect());
    devToolsConnection.onMessage.removeListener(connectListener);
  });
});

// context menu
{
  const callback = () => {
    chrome.contextMenus.create({
      id: 'edit-with',
      title: chrome.runtime.getManifest().name,
      contexts: ['editable']
    });
  };
  chrome.runtime.onInstalled.addListener(callback);
  chrome.runtime.onStartup.addListener(callback);
}
chrome.contextMenus.onClicked.addListener((info, tab) => {
  chrome.tabs.executeScript(tab.id, {
    frameId: info.frameId,
    runAt: 'document_start',
    matchAboutBlank: true,
    code: `{
      const target = document.activeElement;
      const background = chrome.runtime.connect({
        name: 'context-menu'
      });
      background.postMessage({
        method: 'edit-with',
        content: target.value,
        ext: 'txt'
      });
      background.onMessage.addListener(request => {
        if (request.method === 'file-changed') {
          target.value = request.content;
        }
      });
    }`
  });
});

// FAQs & Feedback
{
  const {onInstalled, setUninstallURL, getManifest} = chrome.runtime;
  const {name, version} = getManifest();
  const page = getManifest().homepage_url;
  onInstalled.addListener(({reason, previousVersion}) => {
    chrome.storage.local.get({
      'faqs': true,
      'last-update': 0
    }, prefs => {
      if (reason === 'install' || (prefs.faqs && reason === 'update')) {
        const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
        if (doUpdate && previousVersion !== version) {
          chrome.tabs.create({
            url: page + '&version=' + version +
              (previousVersion ? '&p=' + previousVersion : '') +
              '&type=' + reason,
            active: reason === 'install'
          });
          chrome.storage.local.set({'last-update': Date.now()});
        }
      }
    });
  });
  setUninstallURL(page + '&rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
}
