import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import ts from 'typescript';

// Exercise the real hook with the retained ref shapes from both previous builds.
// The numeric case reproduces the reported Fast Refresh crash in the old hook.
const source = readFileSync(new URL('../src/features/home/components/flightEnvironment.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
for (const retained of [5, { value: 5 }]) {
  test(`retained ${typeof retained} counter survives prepare, theme changes and cleanup`, async () => {
    const effects = [], updates = [], listeners = new Set();
    let completeDecode;
    const decoded = new Promise(resolve => { completeDecode = resolve; });
    const react = {
      useRef: () => ({ current: retained }),
      useCallback: callback => callback,
      useEffect: callback => effects.push(callback),
      useState: initial => [initial(), update => updates.push(update)],
    };
    const query = { matches: false, addEventListener: (_, cb) => listeners.add(cb), removeEventListener: (_, cb) => listeners.delete(cb) };
    const exports = {};
    new Function('require', 'exports', 'window', 'Image', compiled)(
      () => react, exports, { matchMedia: () => query }, class { decode() { return decoded; } },
    );
    const hook = exports.useFlightEnvironment();
    const cleanup = effects[0]();
    const pending = hook.prepare();
    query.matches = true;
    for (const listener of listeners) listener();
    cleanup();
    completeDecode();
    await pending;
    await Promise.resolve();
    assert.equal(listeners.size, 0);
    assert.equal(updates.length, 0, 'an unmounted environment must not commit late image loads');
  });
}
