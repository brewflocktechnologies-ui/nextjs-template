// Embeds the widget the way a customer would, with options read from this page's URL:
//   ?key=wk_globex_demo   widget key (default wk_acme_demo)
//   ?case=timeout|json|version|missing   failure fixtures (slow-config.html)
//   ?frame=open           create the frame on first open instead of at idle (Q-015 measurement)
//   ?locale=ar            visitor locale
// The playground always asks for the frame's test hook (data-mode="test"); production embeds never do.
(function () {
  var WIDGET_ORIGIN = 'http://localhost:4400';
  var CASES = {
    timeout: 'wk_slow',
    json: 'wk_broken_json',
    version: 'wk_broken_version',
    missing: 'wk_missing',
  };
  var LABELS = {
    wk_acme_demo: 'Chat with Acme Corp',
    wk_globex_demo: 'Chat with Globex',
    wk_initech_demo: 'Chat with Initech',
  };

  var params = new URLSearchParams(location.search);
  // A fixture page can pin its key with data-key on this script tag (wrong-domain.html).
  var pinned = document.currentScript && document.currentScript.dataset.key;
  var key =
    pinned || CASES[params.get('case')] || params.get('key') || 'wk_acme_demo';

  var s = document.createElement('script');
  s.async = true;
  s.src = WIDGET_ORIGIN + '/v1/loader.js';
  s.dataset.widgetKey = key;
  s.dataset.mode = 'test';
  if (LABELS[key]) s.dataset.launcherLabel = LABELS[key];
  if (params.get('frame') === 'open') s.dataset.frame = 'open';
  if (params.get('locale')) s.dataset.locale = params.get('locale');
  document.body.appendChild(s);

  var label = document.getElementById('fixture-key');
  if (label) label.textContent = key;
})();
