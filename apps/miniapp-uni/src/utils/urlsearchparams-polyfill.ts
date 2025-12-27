// URLSearchParams polyfill for miniapp runtimes that don't provide it.
// orval-generated SDK mainly uses:
//   const p = new URLSearchParams(); p.append(k, v); p.toString()
// Keep it minimal and safe.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const globalThis: any;

function encode(s: unknown): string {
  return encodeURIComponent(String(s));
}

export function ensureURLSearchParams() {
  try {
    if (typeof globalThis !== 'undefined' && typeof globalThis.URLSearchParams === 'function') return;
  } catch {}

  class MiniURLSearchParams {
    private _pairs: Array<[string, string]> = [];

    append(key: string, value: string) {
      this._pairs.push([String(key), String(value)]);
    }

    toString() {
      if (!this._pairs.length) return '';
      return this._pairs.map(([k, v]) => `${encode(k)}=${encode(v)}`).join('&');
    }
  }

  try {
    globalThis.URLSearchParams = MiniURLSearchParams;
  } catch {}
}

// auto-run on import (must be early)
ensureURLSearchParams();


