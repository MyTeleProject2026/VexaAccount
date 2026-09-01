/* React notification runtime for VexaAccount Account Center. */
(function (global, React, ReactDOM) {
  'use strict';
  if (!React || !ReactDOM || !global.VexaNotificationCore) return;
  var root = document.getElementById('vexa-react-root');
  if (!root) return;

  function NotificationHost() {
    var n = global.VexaNotificationCore.useNotification();
    return React.createElement('div', {
      className: 'vexa-react-notification-host',
      'aria-live': 'polite',
      'aria-atomic': 'false'
    }, n.toasts.map(function (t) {
      return React.createElement('div', {
        key: t.id,
        className: 'vx-toast ' + (t.type || 'info') + ' is-visible',
        role: t.type === 'error' ? 'alert' : 'status'
      },
        React.createElement('div', { className: 'vx-toast-inner' },
          React.createElement('span', { className: 'vx-toast-icon', 'aria-hidden': 'true' },
            t.type === 'success' ? '✓' : t.type === 'error' ? '×' : t.type === 'warning' ? '!' : 'i'
          ),
          React.createElement('div', { className: 'vx-toast-message' }, String(t.message)),
          React.createElement('button', {
            type: 'button',
            className: 'vx-toast-close',
            onClick: function () { n.removeToast(t.id); },
            'aria-label': 'Close notification'
          }, '×')
        ),
        React.createElement('div', { className: 'vx-toast-progress' })
      );
    }));
  }

  function Root() {
    return React.createElement(global.VexaNotificationCore.NotificationProvider, null,
      React.createElement(NotificationHost, null)
    );
  }

  try {
    ReactDOM.createRoot(root).render(React.createElement(Root, null));
    global.vexaReactNotificationsReady = true;
  } catch (e) {
    global.vexaReactNotificationsReady = false;
    console.error('VexaAccount notification runtime failed:', e);
  }
})(window, window.React, window.ReactDOM);
