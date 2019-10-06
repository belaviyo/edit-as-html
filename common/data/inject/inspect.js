'use strict';

function release() {
  document.removeEventListener('mouseover', window.mouseover);
  document.removeEventListener('click', window.click);
  [...document.querySelectorAll('.inspectEditor')]
    .forEach(n => document.body.removeChild(n));
}
release();
window.div = document.createElement('div');
window.div.classList.add('inspectEditor');
document.body.appendChild(window.div);

window.mouseover = e => {
  let node = e.target;
  if (node.nodeType !== 1) {
    node = document.body;
  }
  const rect = node.getBoundingClientRect();
  Object.assign(window.div.style, {
    width: Math.min(rect.width, document.body.clientWidth) + 'px',
    height: rect.height + 'px',
    left: Math.max(window.scrollX + rect.left, 0) + 'px',
    top: (window.scrollY + rect.top) + 'px',
    display: node.localName === 'iframe' ? 'none' : 'block'
  });
  const cl = [...node.classList].join('.');
  const list = [node.parentNode.parentNode, node.parentNode, node]
    .filter((n, i, l) => l.indexOf(n) === i)
    .map(n => n.localName)
    .filter(n => n);
  window.div.dataset.value = list.join('>') + (cl ? '.' + cl : '') + ' | ' +
    rect.width.toFixed(2) + 'x' + rect.height.toFixed(2);
};

window.click = e => {
  if (document.querySelector('.inspectEditor')) {
    e.preventDefault();
    chrome.runtime.sendMessage({
      method: 'bounce-release'
    });

    const target = e.target;
    const background = chrome.runtime.connect({
      name: 'content-script'
    });
    background.postMessage({
      method: 'edit-with',
      content: target.innerHTML,
      ext: 'html'
    });
    background.onMessage.addListener(request => {
      if (request.method === 'file-changed') {
        target.innerHTML = request.content;
      }
    });
  }
};

document.addEventListener('mouseover', window.mouseover);

chrome.runtime.onMessage.addListener(request => {
  if (request.method === 'release') {
    release();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Esc' || e.key === 'Escape') {
    chrome.runtime.sendMessage({
      method: 'bounce-release'
    });
  }
});

document.addEventListener('click', window.click);
