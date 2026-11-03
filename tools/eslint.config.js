// lint for the extracted game script: undefined names, unused names, unreachable code. Browser names are listed by hand (no `globals`
// package here). It must print nothing (tools/check.sh, CI)
const B = 'window document performance requestAnimationFrame innerWidth innerHeight devicePixelRatio localStorage navigator setTimeout clearTimeout setInterval clearInterval console Image Audio AudioContext webkitAudioContext OfflineAudioContext fetch atob btoa Blob URL Uint8Array Float32Array Int32Array Uint16Array Uint32Array Int16Array Map Set WeakMap Promise Math JSON Date Array Object Number String Boolean Symbol Error matchMedia getComputedStyle screen location history addEventListener removeEventListener dispatchEvent CustomEvent Event KeyboardEvent PointerEvent TouchEvent HTMLCanvasElement HTMLElement OffscreenCanvas createImageBitmap FontFace TextDecoder TextEncoder isFinite parseFloat parseInt NaN Infinity encodeURIComponent decodeURIComponent structuredClone queueMicrotask cancelAnimationFrame alert confirm'.split(' ');
module.exports = [
  {
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: Object.fromEntries([...B, 'THREE'].map(n => [n, 'readonly'])) },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { args: 'none' }], 'no-unreachable': 'error', 'no-dupe-keys': 'error', 'no-redeclare': 'error' }
  }
];
