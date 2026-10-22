import test from 'node:test';
import assert from 'node:assert/strict';
import {createLeafletStylesLoader} from '../src/map/leafletStyles.ts';

function fixture(timeout = 1000) {
  const links = [];
  const doc = {
    createElement() {
      return {onload: null, onerror: null, remove() {const index = links.indexOf(this); if (index >= 0) links.splice(index, 1);}};
    },
    head: {append(link) {links.push(link);}},
  };
  return {links, doc, loader: createLeafletStylesLoader(doc, timeout)};
}

test('stylesheet success shares pending work and reuses the loaded link after release', async () => {
  const {links, loader} = fixture();
  const first = loader.acquire(), second = loader.acquire();
  assert.equal(first.promise, second.promise);
  assert.equal(links.length, 1);
  const link = links[0];
  assert.equal(link.href, '/leaflet/leaflet.css');
  link.onload();
  await Promise.all([first.promise, second.promise]);
  first.release(); second.release();
  const remount = loader.acquire();
  await remount.promise;
  assert.equal(links.length, 1);
  assert.equal(link.onload, null); assert.equal(link.onerror, null);
  remount.release();
});

test('stylesheet failure removes the failed link and permits a successful retry', async () => {
  const {links, loader} = fixture();
  const first = loader.acquire(), old = links[0];
  const lateLoad = old.onload;
  const rejected = assert.rejects(first.promise, /failed to load/);
  old.onerror(); await rejected;
  assert.equal(links.length, 0);
  assert.equal(old.onload, null); assert.equal(old.onerror, null);
  const retry = loader.acquire();
  assert.notEqual(links[0].href, old.href);
  lateLoad(); first.release(); // Retired callbacks/releases cannot settle the retry.
  assert.equal(links.length, 1);
  links[0].onload(); await retry.promise; retry.release();
});

test('stylesheet timeout cleans up and does not poison future attempts', async () => {
  const {links, loader} = fixture(5);
  const first = loader.acquire();
  await assert.rejects(first.promise, /timed out/);
  assert.equal(links.length, 0);
  const retry = loader.acquire();
  links[0].onload(); await retry.promise;
  first.release(); retry.release();
});

test('last consumer release cancels pending work; one unmount cannot cancel another consumer', async () => {
  const {links, loader} = fixture();
  const first = loader.acquire(), second = loader.acquire();
  first.release(); first.release();
  assert.equal(links.length, 1);
  const rejected = assert.rejects(second.promise, /cancelled/);
  second.release(); await rejected;
  assert.equal(links.length, 0);
  const retry = loader.acquire();
  links[0].onload(); await retry.promise; retry.release();
});

test('synchronous stylesheet attachment failure can be retried without an unhandled rejection', async () => {
  const {links, loader, doc} = fixture();
  const append = doc.head.append;
  doc.head.append = () => {throw new Error('attachment interrupted');};
  const first = loader.acquire();
  await assert.rejects(first.promise, /could not be attached/);
  first.release(); doc.head.append = append;
  const retry = loader.acquire();
  links[0].onload(); await retry.promise; retry.release();
});
