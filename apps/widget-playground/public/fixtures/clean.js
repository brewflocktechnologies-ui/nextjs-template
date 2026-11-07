// Host-page buttons that use the public API (ENDP-05). The calls are queued until the launcher is ready.
(function () {
  function api() {
    window.ByteflockChat =
      window.ByteflockChat ||
      function () {
        (window.ByteflockChat.q = window.ByteflockChat.q || []).push(arguments);
      };
    window.ByteflockChat.apply(null, arguments);
  }
  document.getElementById('consent').addEventListener('click', function () {
    api('consent', { granted: true });
  });
  document.getElementById('open').addEventListener('click', function () {
    api('open');
  });
})();
