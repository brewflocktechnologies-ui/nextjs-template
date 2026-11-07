// Records the page with rrweb (vendored, MIT) and dumps the events on demand.
(function () {
  var events = [];
  var record = (window.rrweb && window.rrweb.record) || null;
  if (!record) {
    document.getElementById('snapshot').textContent = 'rrweb failed to load';
    return;
  }
  record({
    emit: function (event) {
      events.push(event);
    },
    recordCrossOriginIframes: true,
  });
  window.__rrwebEvents = events;
  document.getElementById('dump').addEventListener('click', function () {
    record.takeFullSnapshot && record.takeFullSnapshot();
    document.getElementById('snapshot').textContent = JSON.stringify(events);
  });
})();
