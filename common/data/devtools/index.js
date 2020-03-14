'use strict';

const background = chrome.runtime.connect({
  name: 'devtools-panel'
});

background.onMessage.addListener(request => {
  if (request.method === 'log') {
    const p = document.createElement('p');
    p.textContent = (new Date()).toLocaleTimeString() + ': ' + request.msg;
    document.querySelector('details').appendChild(p);
    p.scrollIntoView();
  }
});
background.postMessage({
  method: 'tabId',
  tabId: chrome.devtools.inspectedWindow.tabId
});

document.getElementById('toolbar').addEventListener('click', e => {
  const type = e.target.id;
  if (type !== 'outerHTML' && type !== 'innerHTML') {
    return;
  }

  const cmd = `
    $0.${type}
  `;
  chrome.devtools.inspectedWindow.eval(cmd, (content, exception) => {
    if (exception) {
      alert(exception.value);
    }
    else {
      chrome.devtools.inspectedWindow.eval('location.href', (result, isException) => {
        if (isException) {
          return alert('Cannot access page URL');
        }
        chrome.permissions.request({
          origins: [result]
        }, granted => {
          if (granted) {
            const tabId = chrome.devtools.inspectedWindow.tabId;
            chrome.tabs.executeScript(tabId, {
              runAt: 'document_start',
              matchAboutBlank: true,
              allFrames: true,
              code: `var test = target => {
                const background = chrome.runtime.connect({
                  name: 'devtools-inject'
                });
                let ext = 'html';
                if (target.tagName === 'STYLE' && '${type}' === 'innerHTML') {
                  ext = 'css';
                }
                if (target.tagName === 'SCRIPT' && '${type}' === 'innerHTML') {
                  ext = 'js';
                }
                background.postMessage({
                  method: 'edit-with',
                  content: target.${type},
                  ext
                });
                background.onMessage.addListener(request => {
                  if (request.method === 'file-changed') {
                    if ('${type}' === 'outerHTML') {
                      const template = document.createElement('template');
                      template.innerHTML = request.content;
                      const root = template.content.firstChild;
                      target.replaceWith(template.content);
                      target = root;
                    }
                    else {
                      target.${type} = request.content;
                    }
                  }
                });
              };`
            }, () => chrome.devtools.inspectedWindow.eval(`test($0)`, {
              useContentScriptContext: true
            }));
          }
          else {
            alert('Cannot access to the DOM object. Permission denied');
          }
        });
      });
    }
  });
});
document.getElementById('local').addEventListener('click', () => {
  chrome.devtools.inspectedWindow.eval(`{
    const target = $0;
    fetch(target.href || target.src).then(r => r.text()).then(content => {
      const e = document.createElement(target.tagName === 'LINK' ? 'style' : target.localName);
      e.textContent = content;
      target.replaceWith(e);
    }).catch(e => alert(e.message));
  };`);
});

function inspect() {
  const cmd = `{
    const node = $0;
    const rect = node.getBoundingClientRect();
    const cl = [...node.classList].join('.');
    const list = [node.parentNode.parentNode, node.parentNode, node]
      .filter((n, i, l) => l.indexOf(n) === i)
      .map(n => n.localName)
      .filter(n => n);

    [list, cl, {
      width: rect.width,
      height: rect.height
    }, Boolean(node.textContent), (node.tagName === 'LINK' && node.href && node.href.indexOf('.css') !== -1) || (node.tagName === 'SCRIPT' && node.src)]
  }`;
  chrome.devtools.inspectedWindow.eval(cmd, (result, exception) => {
    if (!exception) {
      const [list, cl, rect, text, remote] = result;

      document.getElementById('inspect').textContent = list.join('>');
      document.getElementById('class').textContent = cl ? '.' + cl : '';
      document.getElementById('dimension').textContent = rect.width.toFixed(2) + 'x' + rect.height.toFixed(2);

      document.getElementById('local').disabled = !remote;
      document.getElementById('innerHTML').disabled = text === false;
    }
  });
}

chrome.devtools.panels.elements.onSelectionChanged.addListener(inspect);

document.addEventListener('DOMContentLoaded', inspect);
