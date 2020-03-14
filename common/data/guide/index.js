'use strict';

let os = 'windows';
if (navigator.userAgent.indexOf('Mac') !== -1) {
  os = 'mac';
}
else if (navigator.userAgent.indexOf('Linux') !== -1) {
  os = 'linux';
}
document.body.dataset.os = (os === 'mac' || os === 'linux') ? 'linux' : 'windows';

const notify = (function() {
  const parent = document.getElementById('notify');
  const elems = [];
  return {
    show: function(type, msg, delay) {
      const elem = document.createElement('div');
      elem.textContent = msg;
      elem.dataset.type = type;
      parent.appendChild(elem);
      window.setTimeout(() => {
        try {
          parent.removeChild(elem);
        }
        catch (e) {}
      }, delay || 3000);
      elems.push(elem);
    },
    destroy: function() {
      elems.forEach(elem => {
        try {
          parent.removeChild(elem);
        }
        catch (e) {}
      });
    }
  };
})();

document.addEventListener('click', e => {
  const target = e.target;
  if (target.dataset.cmd === 'download') {
    chrome.permissions.request({
      permissions: ['downloads']
    }, granted => {
      if (granted) {
        notify.show('info', 'Looking for the latest version of the native-client', 60000);
        const req = new window.XMLHttpRequest();
        req.open('GET', 'https://api.github.com/repos/belaviyo/native-client/releases/latest');
        req.responseType = 'json';
        req.onload = () => {
          try {
            chrome.downloads.download({
              url: req.response.assets.filter(a => a.name === os + '.zip')[0].browser_download_url,
              filename: os + '.zip'
            }, () => {
              notify.destroy();
              notify.show('success', 'Download is started. Extract and install when it is done');
              document.body.dataset.step = 1;
            });
          }
          catch (e) {
            notify.show('error', e.message || e);
          }
        };
        req.onerror = () => {
          notify('error', 'Something went wrong! Please download the package manually');
          window.setTimeout(() => {
            window.open('https://github.com/belaviyo/native-client/releases');
          }, 5000);
        };
        req.send();
      }
      else {
        notify.show('error', 'Cannot initiate file downloading. Please download the file manually', 60000);
      }
    });
  }
  else if (target.dataset.cmd === 'check') {
    chrome.runtime.sendNativeMessage('com.add0n.native_client', {
      method: 'spec'
    }, response => {
      if (response) {
        notify.show('success', 'Native client version is ' + response.version);
      }
      else {
        notify.show('error', 'Cannot find the native client. Follow the 3 steps to install the native client');
      }
    });
  }
  else if (target.dataset.cmd === 'options') {
    chrome.runtime.openOptionsPage();
  }
});
