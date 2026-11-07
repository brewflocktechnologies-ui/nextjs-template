// Hostile host-page script (T-01). Collects everything a malicious page script could see and writes
// it to #attack-log. The Playwright test types a secret into the chat composer and asserts the secret
// never appears in the log.
(function () {
  var keys = [];
  var mutations = [];

  // Capture-phase listeners see every key event that reaches this document.
  ['keydown', 'keyup', 'input', 'beforeinput', 'paste'].forEach(
    function (type) {
      window.addEventListener(
        type,
        function (e) {
          keys.push(type + ':' + (e.key || e.data || ''));
        },
        true,
      );
    },
  );

  // Watch the whole document, including character data.
  new MutationObserver(function (records) {
    records.forEach(function (r) {
      if (r.type === 'characterData') mutations.push(r.target.data);
      r.addedNodes.forEach(function (n) {
        if (n.textContent) mutations.push(n.textContent);
      });
    });
  }).observe(document, { subtree: true, childList: true, characterData: true });

  function walk(root, out, frames) {
    var nodes = root.querySelectorAll('*');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.value) out.push(String(el.value));
      if (el.shadowRoot) walk(el.shadowRoot, out, frames);
      if (el.tagName === 'IFRAME') frames.push(el);
    }
    if (root.textContent) out.push(root.textContent);
  }

  document.getElementById('attack').addEventListener('click', function () {
    var texts = [];
    var frames = [];
    var findings = [];
    walk(document, texts, frames);

    frames.forEach(function (frame, i) {
      if (frame.contentDocument === null)
        findings.push('iframe ' + i + ': contentDocument is null');
      try {
        var t = frame.contentWindow.document.body.innerText;
        texts.push(t);
        findings.push('iframe ' + i + ': READ FRAME TEXT');
      } catch (e) {
        findings.push(
          'iframe ' + i + ': contentWindow.document threw ' + e.name,
        );
      }
    });
    if (frames.length === 0) findings.push('no iframes found');

    var active = document.activeElement;
    findings.push('activeElement: ' + (active ? active.tagName : 'none'));
    if (active && active.value) texts.push(active.value);

    var accessible = findings.some(function (f) {
      return f.indexOf('READ FRAME TEXT') >= 0;
    });
    findings.push(
      accessible ? 'frame document ACCESSIBLE' : 'no accessible frame document',
    );

    document.getElementById('attack-log').textContent = JSON.stringify(
      {
        findings: findings,
        keys: keys,
        mutations: mutations.slice(-200),
        texts: texts,
      },
      null,
      2,
    );
  });
})();
