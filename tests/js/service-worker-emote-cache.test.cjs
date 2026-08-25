const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ORIGIN = 'https://example.test';
const ANIMATED_CACHE = 'emote-animated-native-v6';
const EMOTE_STATIC_CACHE = 'emote-static-native-v6';
const FONT_ASSETS_CACHE = 'font-assets-native-v1';
const STATIC_ASSETS_CACHE = 'static-assets-native-v6';
const STATIC_VENDOR_CACHE = 'static-vendor-native-v6';
const WORKER_PATH = path.resolve(__dirname, '../../assets/VOIDCacheRule.js');

class FakeRequest {
    constructor(url, options = {}) {
        this.url = url;
        this.method = options.method || 'GET';
    }

    clone() {
        return new FakeRequest(this.url, { method: this.method });
    }
}

class FakeResponse {
    constructor(body, status = 200) {
        this.body = body;
        this.status = status;
    }

    clone() {
        return new FakeResponse(this.body, this.status);
    }
}

class FakeCache {
    constructor() {
        this.entries = new Map();
        this.deleteCount = 0;
        this.putCount = 0;
        this.keysCount = 0;
        this.deleteGate = null;
        this.keysGate = null;
        this.putGates = new Map();
        this.putError = null;
    }

    match(request) {
        const response = this.entries.get(request.url);
        return Promise.resolve(response ? response.clone() : undefined);
    }

    delete(request) {
        const waitForDelete = this.deleteGate || Promise.resolve();

        this.deleteCount += 1;
        return waitForDelete.then(() => this.entries.delete(request.url));
    }

    put(request, response) {
        const waitForPut = this.putGates.get(request.url) || Promise.resolve();

        this.putCount += 1;
        if (this.putError) {
            return Promise.reject(this.putError);
        }
        return waitForPut.then(() => {
            this.entries.set(request.url, response.clone());
        });
    }

    keys() {
        const waitForKeys = this.keysGate || Promise.resolve();

        this.keysCount += 1;
        return waitForKeys.then(() => (
            [...this.entries.keys()].map((url) => new FakeRequest(url))
        ));
    }
}

function loadWorker(fetchImplementation, existingCacheStores) {
    const listeners = new Map();
    const cacheStores = existingCacheStores || new Map();
    const deletedDatabases = [];
    const pendingFetchCompletions = new Set();
    let claimCount = 0;
    let skipWaitingCount = 0;
    const caches = {
        open(name) {
            if (!cacheStores.has(name)) {
                cacheStores.set(name, new FakeCache());
            }
            return Promise.resolve(cacheStores.get(name));
        },
        keys() {
            return Promise.resolve([...cacheStores.keys()]);
        },
        delete(name) {
            return Promise.resolve(cacheStores.delete(name));
        }
    };
    const self = {
        Promise,
        location: { origin: ORIGIN },
        registration: { scope: `${ORIGIN}/` },
        clients: {
            claim() {
                claimCount += 1;
                return Promise.resolve();
            }
        },
        skipWaiting() {
            skipWaitingCount += 1;
            return Promise.resolve();
        },
        indexedDB: {
            deleteDatabase(name) {
                const request = {};

                deletedDatabases.push(name);
                Promise.resolve().then(() => request.onsuccess());
                return request;
            }
        },
        addEventListener(type, listener) {
            listeners.set(type, listener);
        }
    };
    const context = {
        URL,
        caches,
        fetch: fetchImplementation,
        self
    };

    vm.runInNewContext(fs.readFileSync(WORKER_PATH, 'utf8'), context);

    function trackFetchCompletion(operation) {
        const completion = Promise.resolve(operation);

        pendingFetchCompletions.add(completion);
        completion.then(
            () => pendingFetchCompletions.delete(completion),
            () => pendingFetchCompletions.delete(completion)
        );
        return completion;
    }

    function dispatchFetch(request) {
        let responsePromise;
        let dispatching = true;
        const event = {
            request,
            respondWith(response) {
                responsePromise = Promise.resolve(response);
            },
            waitUntil(operation) {
                assert.equal(dispatching, true, 'fetch waitUntil must be registered synchronously');
                trackFetchCompletion(operation);
            }
        };

        listeners.get('fetch')(event);
        dispatching = false;
        return responsePromise;
    }

    async function settleFetches() {
        while (pendingFetchCompletions.size > 0) {
            await Promise.all([...pendingFetchCompletions]);
        }
    }

    function dispatchLifecycle(type) {
        let completion;
        const event = {
            waitUntil(operation) {
                completion = Promise.resolve(operation);
            }
        };

        listeners.get(type)(event);
        return completion;
    }

    return {
        cacheStores,
        deletedDatabases,
        dispatchFetch,
        dispatchLifecycle,
        settleFetches,
        getClaimCount: () => claimCount,
        getSkipWaitingCount: () => skipWaitingCount
    };
}

function localUrl(pathname) {
    return `${ORIGIN}${pathname}`;
}

function animatedUrl(id) {
    return localUrl(`/usr/themes/VOID/assets/libs/emotes/bangumi/animated/${id}.gif`);
}

function fontUrl(id) {
    return localUrl(`/usr/themes/VOID/assets/fonts/fontsource/${id}.woff2`);
}

test('native routes replace sw-toolbox and leave unrelated requests alone', async () => {
    const source = fs.readFileSync(WORKER_PATH, 'utf8');
    const worker = loadWorker((request) => Promise.resolve(new FakeResponse(request.url)));

    assert.ok(!source.includes('importScripts'));
    assert.ok(!source.includes('self.toolbox'));
    assert.ok(!fs.existsSync(path.resolve(__dirname, '../../assets/sw-toolbox.js')));
    assert.equal(worker.dispatchFetch(new FakeRequest(localUrl('/'))), undefined);
    assert.equal(worker.dispatchFetch(new FakeRequest(localUrl('/usr/theme.css'), { method: 'POST' })), undefined);

    await worker.dispatchFetch(new FakeRequest(animatedUrl('001')));
    await worker.dispatchFetch(new FakeRequest(
        localUrl('/usr/themes/VOID/assets/libs/emotes/bangumi/poster/001.webp')
    ));
    await worker.dispatchFetch(new FakeRequest(fontUrl('open-sans-latin-400-normal')));
    await worker.dispatchFetch(new FakeRequest(localUrl('/usr/themes/VOID/assets/app.js')));
    await worker.dispatchFetch(new FakeRequest('https://secure.gravatar.com/avatar/example'));
    await worker.dispatchFetch(new FakeRequest('https://fonts.googleapis.com/css2?family=Roboto'));
    await worker.dispatchFetch(new FakeRequest('https://fonts.googleapis.cn/css2?family=Roboto'));
    await worker.dispatchFetch(new FakeRequest('https://fonts.gstatic.com/s/roboto.woff2'));
    await worker.dispatchFetch(new FakeRequest('https://fonts.gstatic.cn/s/roboto.woff2'));
    await worker.settleFetches();

    assert.equal((await worker.cacheStores.get(ANIMATED_CACHE).keys()).length, 1);
    assert.equal((await worker.cacheStores.get(EMOTE_STATIC_CACHE).keys()).length, 1);
    assert.equal((await worker.cacheStores.get(FONT_ASSETS_CACHE).keys()).length, 1);
    assert.equal((await worker.cacheStores.get(STATIC_ASSETS_CACHE).keys()).length, 1);
    assert.equal((await worker.cacheStores.get(STATIC_VENDOR_CACHE).keys()).length, 5);
});

test('font cache serves warm responses offline without another network request', async () => {
    const url = fontUrl('open-sans-latin-400-normal');
    let fetchCount = 0;
    let offline = false;
    const worker = loadWorker((request) => {
        fetchCount += 1;
        if (offline) {
            return Promise.reject(new Error('offline'));
        }
        return Promise.resolve(new FakeResponse(`font:${request.url}`));
    });

    const networkResponse = await worker.dispatchFetch(new FakeRequest(url));
    await worker.settleFetches();
    offline = true;
    const cachedResponse = await worker.dispatchFetch(new FakeRequest(url));
    await worker.settleFetches();

    assert.equal(networkResponse.body, `font:${url}`);
    assert.equal(cachedResponse.body, `font:${url}`);
    assert.equal(fetchCount, 1, 'warm font hit must not use the network');
    assert.equal((await worker.cacheStores.get(FONT_ASSETS_CACHE).keys()).length, 1);
});

test('font cache refreshes LRU order before strict 160-entry eviction', async () => {
    let fetchCount = 0;
    const worker = loadWorker((request) => {
        fetchCount += 1;
        return Promise.resolve(new FakeResponse(request.url));
    });

    for (let id = 1; id <= 160; id++) {
        await worker.dispatchFetch(new FakeRequest(fontUrl(String(id).padStart(3, '0'))));
    }
    await worker.settleFetches();
    await worker.dispatchFetch(new FakeRequest(fontUrl('001')));
    await worker.settleFetches();
    await worker.dispatchFetch(new FakeRequest(fontUrl('161')));
    await worker.settleFetches();

    const keys = await worker.cacheStores.get(FONT_ASSETS_CACHE).keys();
    const urls = keys.map((request) => request.url);

    assert.equal(fetchCount, 161, 'warm font hit must not use the network');
    assert.equal(urls.length, 160);
    assert.ok(urls.includes(fontUrl('001')), 'recently read font must remain cached');
    assert.ok(!urls.includes(fontUrl('002')), 'least recently used font must be evicted');
    assert.equal(urls.at(-1), fontUrl('161'));
});

test('animated cache hits refresh recency before strict 48-entry eviction', async () => {
    let fetchCount = 0;
    const worker = loadWorker((request) => {
        fetchCount += 1;
        return Promise.resolve(new FakeResponse(request.url));
    });

    for (let id = 1; id <= 48; id++) {
        await worker.dispatchFetch(new FakeRequest(animatedUrl(String(id).padStart(3, '0'))));
    }
    await worker.settleFetches();
    await worker.dispatchFetch(new FakeRequest(animatedUrl('001')));
    await worker.settleFetches();
    await worker.dispatchFetch(new FakeRequest(animatedUrl('049')));
    await worker.settleFetches();

    const keys = await worker.cacheStores.get(ANIMATED_CACHE).keys();
    const urls = keys.map((request) => request.url);
    assert.equal(fetchCount, 49, 'cache hit must not use the network');
    assert.equal(urls.length, 48);
    assert.ok(urls.includes(animatedUrl('001')), 'recently read entry must remain cached');
    assert.ok(!urls.includes(animatedUrl('002')), 'least recently used entry must be evicted');
    assert.equal(urls.at(-1), animatedUrl('049'));
});

test('warm static hits avoid rewrites while animated LRU refresh stays non-blocking', async () => {
    const staticUrl = localUrl('/usr/themes/VOID/assets/app.js');
    const animation = animatedUrl('001');
    let fetchCount = 0;
    const worker = loadWorker((request) => {
        fetchCount += 1;
        return Promise.resolve(new FakeResponse(request.url));
    });

    await worker.dispatchFetch(new FakeRequest(staticUrl));
    await worker.dispatchFetch(new FakeRequest(animation));
    await worker.settleFetches();

    const staticCache = worker.cacheStores.get(STATIC_ASSETS_CACHE);
    const staticMutationCounts = [
        staticCache.deleteCount,
        staticCache.putCount,
        staticCache.keysCount
    ];
    const staticResponse = await worker.dispatchFetch(new FakeRequest(staticUrl));

    await worker.settleFetches();
    assert.equal(staticResponse.body, staticUrl);
    assert.deepEqual([
        staticCache.deleteCount,
        staticCache.putCount,
        staticCache.keysCount
    ], staticMutationCounts);

    const animatedCache = worker.cacheStores.get(ANIMATED_CACHE);
    const animatedMutationCounts = [
        animatedCache.deleteCount,
        animatedCache.putCount,
        animatedCache.keysCount
    ];
    let releaseDelete;

    animatedCache.deleteGate = new Promise((resolve) => {
        releaseDelete = resolve;
    });
    let timeout;
    const animatedResponse = await Promise.race([
        worker.dispatchFetch(new FakeRequest(animation)),
        new Promise((resolve) => {
            timeout = setTimeout(() => resolve(null), 100);
        })
    ]);
    clearTimeout(timeout);

    assert.ok(animatedResponse, 'cache hit must not wait for the LRU write');
    assert.equal(animatedResponse.body, animation);
    releaseDelete();
    animatedCache.deleteGate = null;
    await worker.settleFetches();
    assert.deepEqual([
        animatedCache.deleteCount,
        animatedCache.putCount,
        animatedCache.keysCount
    ], [
        animatedMutationCounts[0] + 1,
        animatedMutationCounts[1] + 1,
        animatedMutationCounts[2]
    ]);
    assert.equal(fetchCount, 2, 'warm cache hits must not use the network');
});

test('animated LRU order survives a Service Worker restart', async () => {
    const sharedCacheStores = new Map();
    const firstWorker = loadWorker(
        (request) => Promise.resolve(new FakeResponse(request.url)),
        sharedCacheStores
    );

    for (let id = 1; id <= 48; id++) {
        await firstWorker.dispatchFetch(new FakeRequest(animatedUrl(String(id).padStart(3, '0'))));
    }
    await firstWorker.settleFetches();
    await firstWorker.dispatchFetch(new FakeRequest(animatedUrl('001')));
    await firstWorker.settleFetches();

    const restartedWorker = loadWorker(
        (request) => Promise.resolve(new FakeResponse(request.url)),
        sharedCacheStores
    );

    await restartedWorker.dispatchFetch(new FakeRequest(animatedUrl('049')));
    await restartedWorker.settleFetches();

    const keys = await sharedCacheStores.get(ANIMATED_CACHE).keys();
    const urls = keys.map((request) => request.url);

    assert.ok(urls.includes(animatedUrl('001')));
    assert.ok(!urls.includes(animatedUrl('002')));
});

test('response bodies enter Cache API before an earlier metadata trim finishes', async () => {
    const worker = loadWorker((request) => Promise.resolve(new FakeResponse(request.url)));
    const cache = new FakeCache();
    let releaseKeys;

    cache.keysGate = new Promise((resolve) => {
        releaseKeys = resolve;
    });
    worker.cacheStores.set(STATIC_ASSETS_CACHE, cache);

    await worker.dispatchFetch(new FakeRequest(localUrl('/usr/assets/first.jpg')));
    await Promise.resolve();
    await worker.dispatchFetch(new FakeRequest(localUrl('/usr/assets/second.jpg')));
    await Promise.resolve();

    assert.equal(cache.putCount, 2, 'cache bodies must not wait in the mutation queue');
    releaseKeys();
    cache.keysGate = null;
    await worker.settleFetches();
});

test('an in-flight trim delete cannot erase a later manifest replacement', async () => {
    const target = localUrl('/usr/themes/VOID/assets/libs/emotes/packs/000.json');
    const newcomer = localUrl('/usr/themes/VOID/assets/libs/emotes/packs/140.json');
    const cacheStores = new Map();
    const cache = new FakeCache();
    let releaseTargetDelete;

    cache.entries.set(target, new FakeResponse('cached-target'));
    for (let id = 1; id < 140; id++) {
        const url = localUrl(
            `/usr/themes/VOID/assets/libs/emotes/packs/${String(id).padStart(3, '0')}.json`
        );
        cache.entries.set(url, new FakeResponse(url));
    }
    cache.deleteGate = new Promise((resolve) => {
        releaseTargetDelete = resolve;
    });
    cacheStores.set(EMOTE_STATIC_CACHE, cache);

    const worker = loadWorker(
        (request) => Promise.resolve(new FakeResponse(`network:${request.url}`)),
        cacheStores
    );

    await worker.dispatchFetch(new FakeRequest(newcomer));
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal((await cache.match(new FakeRequest(target))).body, 'cached-target');
    assert.equal(cache.deleteCount, 1);

    await worker.dispatchFetch(new FakeRequest(target));
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal((await cache.match(new FakeRequest(target))).body, 'cached-target');

    releaseTargetDelete();
    cache.deleteGate = null;
    await worker.settleFetches();

    assert.equal((await cache.match(new FakeRequest(target))).body, `network:${target}`);
    assert.equal((await cache.keys()).length, 140);
});

test('concurrent animated misses settle to the 48-entry limit', async () => {
    const worker = loadWorker((request) => Promise.resolve(new FakeResponse(request.url)));
    const requests = [];

    for (let id = 1; id <= 64; id++) {
        requests.push(worker.dispatchFetch(
            new FakeRequest(animatedUrl(String(id).padStart(3, '0')))
        ));
    }
    await Promise.all(requests);
    await worker.settleFetches();

    const cache = worker.cacheStores.get(ANIMATED_CACHE);
    const keys = await cache.keys();
    assert.equal(keys.length, 48);
    assert.equal(keys[0].url, animatedUrl('017'));
    assert.equal(keys.at(-1).url, animatedUrl('064'));
});

test('failed responses from every cache-first route are never stored', async () => {
    const worker = loadWorker(() => Promise.resolve(new FakeResponse('failed', 404)));
    const requests = [
        new FakeRequest(animatedUrl('001')),
        new FakeRequest(localUrl('/usr/themes/VOID/assets/libs/emotes/bangumi/poster/001.webp')),
        new FakeRequest(fontUrl('missing')),
        new FakeRequest(localUrl('/usr/themes/VOID/assets/missing.js')),
        new FakeRequest('https://secure.gravatar.com/avatar/missing'),
        new FakeRequest('https://fonts.gstatic.com/s/font.woff2')
    ];

    for (const request of requests) {
        const response = await worker.dispatchFetch(request);
        assert.equal(response.status, 404);
    }
    await worker.settleFetches();

    for (const cache of worker.cacheStores.values()) {
        assert.equal((await cache.keys()).length, 0);
    }
});

test('opaque vendor responses remain cacheable', async () => {
    const url = 'https://fonts.gstatic.cn/s/font.woff2';
    const worker = loadWorker(() => Promise.resolve(new FakeResponse('font', 0)));

    const response = await worker.dispatchFetch(new FakeRequest(url));
    await worker.settleFetches();
    const cache = worker.cacheStores.get(STATIC_VENDOR_CACHE);

    assert.equal(response.status, 0);
    assert.equal((await cache.keys()).length, 1);
});

test('manifest routes prefer a successful network response and fall back offline', async () => {
    const url = localUrl('/usr/themes/VOID/assets/libs/emotes/packs.json');
    let fetchCount = 0;
    const worker = loadWorker(() => {
        fetchCount += 1;
        if (fetchCount === 1) {
            return Promise.resolve(new FakeResponse('fresh'));
        }
        return Promise.reject(new Error('offline'));
    });

    const fresh = await worker.dispatchFetch(new FakeRequest(url));
    await worker.settleFetches();
    const cached = await worker.dispatchFetch(new FakeRequest(url));

    assert.equal(fresh.body, 'fresh');
    assert.equal(cached.body, 'fresh');
    assert.equal((await worker.cacheStores.get(EMOTE_STATIC_CACHE).keys()).length, 1);
});

test('manifest error responses do not replace a previously cached success', async () => {
    const url = localUrl('/usr/themes/VOID/assets/libs/emotes/packs/core.json');
    let fetchCount = 0;
    const worker = loadWorker(() => {
        fetchCount += 1;
        return Promise.resolve(fetchCount === 1
            ? new FakeResponse('fresh')
            : new FakeResponse('failed', 503));
    });

    await worker.dispatchFetch(new FakeRequest(url));
    await worker.settleFetches();
    const fallback = await worker.dispatchFetch(new FakeRequest(url));
    const cached = await worker.cacheStores.get(EMOTE_STATIC_CACHE).match(new FakeRequest(url));
    const unavailable = await worker.dispatchFetch(new FakeRequest(
        localUrl('/usr/themes/VOID/assets/libs/emotes/packs/unavailable.json')
    ));

    assert.equal(fallback.status, 200);
    assert.equal(fallback.body, 'fresh');
    assert.equal(cached.body, 'fresh');
    assert.equal(unavailable.status, 503);
});

test('native caches settle at their configured limits after concurrent writes', async () => {
    const worker = loadWorker((request) => Promise.resolve(new FakeResponse(request.url)));
    const requests = [];

    for (let id = 1; id <= 150; id++) {
        requests.push(worker.dispatchFetch(new FakeRequest(localUrl(
            `/usr/themes/VOID/assets/libs/emotes/bangumi/poster/${id}.webp`
        ))));
    }
    for (let id = 1; id <= 210; id++) {
        requests.push(worker.dispatchFetch(new FakeRequest(localUrl(`/usr/assets/${id}.js`))));
        requests.push(worker.dispatchFetch(new FakeRequest(
            `https://secure.gravatar.com/avatar/${id}`
        )));
    }

    await Promise.all(requests);
    await worker.settleFetches();

    for (const [cacheName, maximumEntries] of [
        [EMOTE_STATIC_CACHE, 140],
        [STATIC_ASSETS_CACHE, 200],
        [STATIC_VENDOR_CACHE, 200]
    ]) {
        const cache = worker.cacheStores.get(cacheName);

        assert.equal((await cache.keys()).length, maximumEntries, cacheName);
    }
});

test('cache write failures preserve prior success without failing the network response', async () => {
    const url = localUrl('/usr/themes/VOID/assets/libs/emotes/packs/quota-test.json');
    const worker = loadWorker(() => Promise.resolve(new FakeResponse('network')));
    const cache = new FakeCache();

    cache.entries.set(url, new FakeResponse('cached'));
    for (let id = 1; id <= 140; id++) {
        const otherUrl = localUrl(
            `/usr/themes/VOID/assets/libs/emotes/packs/overflow-${id}.json`
        );
        cache.entries.set(otherUrl, new FakeResponse(otherUrl));
    }
    cache.putError = new Error('quota exceeded');
    worker.cacheStores.set(EMOTE_STATIC_CACHE, cache);

    const response = await worker.dispatchFetch(new FakeRequest(url));
    await worker.settleFetches();

    assert.equal(response.body, 'network');
    assert.equal((await cache.match(new FakeRequest(url))).body, 'cached');
    assert.equal((await cache.keys()).length, 140);
});

test('activation retires toolbox caches and metadata without deleting native caches', async () => {
    const worker = loadWorker(() => Promise.reject(new Error('unexpected fetch')));
    const defaultCache = `$$$toolbox-cache$$$${ORIGIN}/$$$`;

    await worker.cacheStores.set('static-assets-toolbox-v5', new FakeCache());
    await worker.cacheStores.set(defaultCache, new FakeCache());
    await worker.cacheStores.set(`${defaultCache}$$$inactive$$$`, new FakeCache());
    await worker.cacheStores.set(FONT_ASSETS_CACHE, new FakeCache());
    await worker.cacheStores.set(STATIC_ASSETS_CACHE, new FakeCache());
    await worker.cacheStores.set('unrelated-cache', new FakeCache());
    await worker.dispatchLifecycle('install');
    await worker.dispatchLifecycle('activate');

    assert.equal(worker.getSkipWaitingCount(), 1);
    assert.equal(worker.getClaimCount(), 1);
    assert.ok(!worker.cacheStores.has('static-assets-toolbox-v5'));
    assert.ok(!worker.cacheStores.has(defaultCache));
    assert.ok(!worker.cacheStores.has(`${defaultCache}$$$inactive$$$`));
    assert.ok(worker.cacheStores.has(FONT_ASSETS_CACHE));
    assert.ok(worker.cacheStores.has(STATIC_ASSETS_CACHE));
    assert.ok(worker.cacheStores.has('unrelated-cache'));
    assert.ok(worker.deletedDatabases.includes('sw-toolbox-static-assets-toolbox-v5'));
});
