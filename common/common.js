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

function editor(content, observe) {
  const native = chrome.runtime.connectNative(config.id);
  native.onDisconnect.addListener(() => observe());
  native.onMessage.addListener(observe);
  native.postMessage({
    permissions: ['crypto', 'fs', 'path', 'os'],
    args: [content],
    script: `
      const crypto = require('crypto');
      const fs = require('fs');

      const filename = require('path').join(
        require('os').tmpdir(),
        'editor-' + crypto.randomBytes(4).readUInt32LE(0) + '.html'
      );
      fs.writeFile(filename, args[0], e => {
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

var cache = {};

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'get-content') {
    response(cache[request.id]);
    delete cache[request.id];
  }
  else if (request.method === 'get-id') {
    response(sender.tab.id);
  }
  else if (request.method === 'bounce-release') {
    chrome.tabs.sendMessage(sender.tab.id, {
      method: 'release'
    });
  }
});

chrome.runtime.onConnect.addListener(devToolsConnection => {
  const devToolsListener = request => {
    if (request.method === 'edit-with') {
      const native = editor(request.content, res => {
        if (!res) {
          notify('Native client is not installed. Follow the instruction.');
          chrome.tabs.create({
            url: '/data/guide/index.html'
          });
        }
        else if (res.method === 'error') {
          notify(res.error);
        }
        else if (res.method === 'file-created') {
          devToolsConnection.postMessage({
            method: 'log',
            msg: 'Temporary file is created at ' + res.filename
          });
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
          devToolsConnection.postMessage({
            method: 'log',
            msg: 'File content is changed'
          });
          const id = Math.random();
          cache[id] = res.content;
          chrome.tabs.executeScript(request.tabId, {
            allFrames: true,
            matchAboutBlank: true,
            code: `
              chrome.runtime.sendMessage({
                method: 'get-content',
                id: ${id}
              }, content => {
                const node = document.querySelector('[data-editor="${request.id}"]');
                if (node) {
                  node.${request.type} = content;
                  node.dataset.editor = ${request.id};
                }
              });
            `
          });
          devToolsConnection.postMessage({
            method: 'file-changed',
            id: request.id,
            type: request.type,
            content: res.content
          });
        }
      });
      devToolsListener.natives.push(native);
    }
  };
  devToolsListener.natives = [];
  // add the listener
  devToolsConnection.onMessage.addListener(devToolsListener);

  devToolsConnection.onDisconnect.addListener(() => {
    devToolsListener.natives.forEach(n => n.disconnect());
    devToolsConnection.onMessage.removeListener(devToolsListener);
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
    code: `{
      const target = document.activeElement;
      const id = Math.random();
      target.dataset.editor = id;
      const background = chrome.runtime.connect({
        name: 'inject-page'
      });
      background.postMessage({
        method: 'edit-with',
        content: target.value,
        id,
        type: 'value',
        tabId: ${tab.id}
      });
    }`
  });
});

// FAQs & Feedback
chrome.storage.local.get({
  'version': null,
  'faqs': true,
  'last-update': 0
}, prefs => {
  const version = chrome.runtime.getManifest().version;

  if (prefs.version ? (prefs.faqs && prefs.version !== version) : true) {
    const now = Date.now();
    const doUpdate = (now - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
    chrome.storage.local.set({
      version,
      'last-update': doUpdate ? Date.now() : prefs['last-update']
    }, () => {
      // do not display the FAQs page if last-update occurred less than 45 days ago.
      if (doUpdate) {
        const p = Boolean(prefs.version);
        chrome.tabs.create({
          url: chrome.runtime.getManifest().homepage_url + '&version=' + version +
            '&type=' + (p ? ('upgrade&p=' + prefs.version) : 'install'),
          active: p === false
        });
      }
    });
  }
});

{
  const {name, version} = chrome.runtime.getManifest();
  chrome.runtime.setUninstallURL(
    chrome.runtime.getManifest().homepage_url + '&rd=feedback&name=' + name + '&version=' + version
  );
}
