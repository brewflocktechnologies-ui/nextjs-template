// Records every CSP violation on this page into window.__cspViolations and #csp-violations.
(function () {
  window.__cspViolations = [];
  document.addEventListener('securitypolicyviolation', function (e) {
    var v = {
      directive: e.effectiveDirective,
      blocked: e.blockedURI,
      source: e.sourceFile,
      sample: e.sample,
    };
    window.__cspViolations.push(v);
    var out = document.getElementById('csp-violations');
    if (out) out.textContent = JSON.stringify(window.__cspViolations, null, 2);
  });
})();
