import './index.js';

// Auto-mount for local development when `#root` exists in the page
if (typeof window !== 'undefined' && document.getElementById('root')) {
  try {
    // `index.js` exposes `window.RobotMascot.mount`
    if (window.RobotMascot && typeof window.RobotMascot.mount === 'function') {
      window.RobotMascot.mount('#root');
    }
  } catch (e) {
    // ignore errors in auto-mount during dev
    // eslint-disable-next-line no-console
    console.error('Auto-mount failed', e);
  }
}
