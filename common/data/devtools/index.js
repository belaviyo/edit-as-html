'use strict';

var background = chrome.runtime.connect({
  name: 'devtools-page'
});

document.getElementById('command').addEventListener('click', () => {
  const id = Math.random();
  const type = document.querySelector('input[type=radio]:checked').value;
  const cmd = `
    $0.dataset.editor = ${id};
    $0.${type}
  `;
  chrome.devtools.inspectedWindow.eval(cmd, (content, exception) => {
    if (exception) {
      alert(exception.value);
    }
    else {
      background.postMessage({
        method: 'edit-with',
        content,
        id,
        type,
        tabId: chrome.devtools.inspectedWindow.tabId
      });
    }
  });
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
    list.join('>') + (cl ? '.' + cl : '') + ' | ' +
      rect.width.toFixed(2) + 'x' + rect.height.toFixed(2)
  }`;
  chrome.devtools.inspectedWindow.eval(cmd, (result, exception) => {
    if (!exception) {
      document.getElementById('inspect').textContent = result;
    }
  });
}

chrome.devtools.panels.elements.onSelectionChanged.addListener(inspect);

document.addEventListener('DOMContentLoaded', inspect);

background.onMessage.addListener(request => {
  if (request.method === 'log') {
    const p = document.createElement('p');
    p.textContent = (new Date()).toLocaleTimeString() + ': ' + request.msg;
    document.querySelector('details').appendChild(p);
  }
});

/*
chrome.devtools.inspectedWindow.onResourceAdded.addListener(resource => {
  resource.getContent(content => {
    console.log(content);
  });
});
*/
