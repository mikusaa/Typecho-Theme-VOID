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
            // Cache API appends a replaced entry, so keys() order stays oldest write first.
            this.entries.delete(request.url);
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

function loadWorker(fetchImplementation, existingCacheStores, workerUrl = `${ORIGIN}/VOIDCacheRule.js`) {
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
        location: new URL(workerUrl),
        registration: { scope: new URL('./', workerUrl).href },
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

const HASHED_SCRIPT_URL = localUrl('/usr/themes/VOID/assets/VOID-5b702fb897.js');

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
    for (const url of [
        'https://secure.gravatar.com/avatar/example',
        'https://fonts.googleapis.com/css2?family=Roboto',
        'https://fonts.gstatic.com/s/roboto.woff2'
    ]) {
        assert.equal(worker.dispatchFetch(new FakeRequest(url)), undefined, url);
    }
    await worker.settleFetches();

    assert.equal((await worker.cacheStores.get(ANIMATED_CACHE).keys()).length, 1);
    assert.equal((await worker.cacheStores.get(EMOTE_STATIC_CACHE).keys()).length, 1);
    assert.equal((await worker.cacheStores.get(FONT_ASSETS_CACHE).keys()).length, 1);
    assert.equal((await worker.cacheStores.get(STATIC_ASSETS_CACHE).keys()).length, 1);
    assert.deepEqual([...worker.cacheStores.keys()].sort(), [
        ANIMATED_CACHE, EMOTE_STATIC_CACHE, FONT_ASSETS_CACHE, STATIC_ASSETS_CACHE
    ].sort(), 'third-party requests never open a cache');
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

test('cache-first routes evict the oldest write once over their limit', async () => {
    for (const [cacheName, maximumEntries, urlFor] of [
        [FONT_ASSETS_CACHE, 160, fontUrl],
        [ANIMATED_CACHE, 48, animatedUrl]
    ]) {
        let fetchCount = 0;
        const worker = loadWorker((request) => {
            fetchCount += 1;
            return Promise.resolve(new FakeResponse(request.url));
        });

        for (let id = 1; id <= maximumEntries; id++) {
            await worker.dispatchFetch(new FakeRequest(urlFor(String(id).padStart(3, '0'))));
        }
        await worker.settleFetches();
        await worker.dispatchFetch(new FakeRequest(urlFor('001')));
        await worker.settleFetches();
        await worker.dispatchFetch(new FakeRequest(urlFor(String(maximumEntries + 1))));
        await worker.settleFetches();

        const urls = (await worker.cacheStores.get(cacheName).keys()).map((request) => request.url);

        assert.equal(fetchCount, maximumEntries + 1, `${cacheName} hit must not use the network`);
        assert.equal(urls.length, maximumEntries, cacheName);
        assert.ok(!urls.includes(urlFor('001')), `${cacheName} evicts the oldest write even after a hit`);
        assert.equal(urls[0], urlFor('002'), cacheName);
        assert.equal(urls.at(-1), urlFor(String(maximumEntries + 1)), cacheName);
    }
});

test('warm cache-first hits are read without any cache write or network request', async () => {
    const urls = [HASHED_SCRIPT_URL, animatedUrl('001'), fontUrl('open-sans-latin-400-normal')];
    let fetchCount = 0;
    const worker = loadWorker((request) => {
        fetchCount += 1;
        return Promise.resolve(new FakeResponse(request.url));
    });

    for (const url of urls) {
        await worker.dispatchFetch(new FakeRequest(url));
    }
    await worker.settleFetches();

    const counts = () => [...worker.cacheStores.values()].map((cache) => [
        cache.deleteCount,
        cache.putCount,
        cache.keysCount
    ]);
    const before = counts();

    for (const url of urls) {
        assert.equal((await worker.dispatchFetch(new FakeRequest(url))).body, url);
    }
    await worker.settleFetches();

    assert.deepEqual(counts(), before);
    assert.equal(fetchCount, urls.length, 'warm cache hits must not use the network');
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
        new FakeRequest(localUrl('/usr/themes/VOID/assets/missing-0123456789.js')),
        new FakeRequest(localUrl('/usr/themes/VOID/assets/missing.js'))
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

test('hashed and versioned theme assets are cache-first', async () => {
    const urls = [
        HASHED_SCRIPT_URL,
        localUrl('/usr/themes/VOID/assets/bundle-a00d82e627.css'),
        localUrl('/usr/themes/VOID/assets/libs/mathjax/4.1.3/tex-svg.js')
    ];
    let fetchCount = 0;
    let offline = false;
    const worker = loadWorker((request) => {
        fetchCount += 1;
        if (offline) {
            return Promise.reject(new Error('offline'));
        }
        return Promise.resolve(new FakeResponse(request.url));
    });

    for (const url of urls) {
        await worker.dispatchFetch(new FakeRequest(url));
    }
    await worker.settleFetches();
    offline = true;
    for (const url of urls) {
        assert.equal((await worker.dispatchFetch(new FakeRequest(url))).body, url);
    }

    assert.equal(fetchCount, urls.length, 'warm immutable assets must not use the network');
});

test('replaceable files under usr are network-first with an offline fallback', async () => {
    const urls = [
        localUrl('/usr/uploads/2026/10/cover.jpg'),
        localUrl('/usr/plugins/VOID/assets/plugin.js'),
        localUrl('/usr/themes/VOID/assets/fonts/void-icon.woff2'),
        localUrl('/usr/themes/VOID/assets/libs/mathjax/latest/tex-svg.js'),
        localUrl('/usr/themes/VOID/assets/VOID.js')
    ];
    let revision = 1;
    let offline = false;
    const worker = loadWorker((request) => {
        if (offline) {
            return Promise.reject(new Error('offline'));
        }
        return Promise.resolve(new FakeResponse(`${request.url}#${revision}`));
    });

    for (const url of urls) {
        await worker.dispatchFetch(new FakeRequest(url));
    }
    await worker.settleFetches();
    revision = 2;
    for (const url of urls) {
        assert.equal((await worker.dispatchFetch(new FakeRequest(url))).body, `${url}#2`, url);
    }
    await worker.settleFetches();
    offline = true;
    for (const url of urls) {
        assert.equal((await worker.dispatchFetch(new FakeRequest(url))).body, `${url}#2`, url);
    }

    const cache = worker.cacheStores.get(STATIC_ASSETS_CACHE);
    assert.equal((await cache.keys()).length, urls.length);
});

test('a subdirectory install derives every route from the Worker location', async () => {
    const worker = loadWorker(
        (request) => Promise.resolve(new FakeResponse(request.url)),
        undefined,
        `${ORIGIN}/blog/VOIDCacheRule.js`
    );
    const routed = [
        [localUrl('/blog/usr/themes/VOID/assets/libs/emotes/bangumi/animated/001.gif'), ANIMATED_CACHE],
        [localUrl('/blog/usr/themes/VOID/assets/libs/emotes/packs.json'), EMOTE_STATIC_CACHE],
        [localUrl('/blog/usr/themes/VOID/assets/fonts/fontsource/open-sans.woff2'), FONT_ASSETS_CACHE],
        [localUrl('/blog/usr/themes/VOID/assets/VOID-5b702fb897.js'), STATIC_ASSETS_CACHE],
        [localUrl('/blog/usr/uploads/cover.jpg'), STATIC_ASSETS_CACHE]
    ];

    for (const [url] of routed) {
        assert.ok(worker.dispatchFetch(new FakeRequest(url)), url);
    }
    assert.equal(worker.dispatchFetch(new FakeRequest(HASHED_SCRIPT_URL)), undefined);
    assert.equal(worker.dispatchFetch(new FakeRequest(localUrl('/usr/uploads/cover.jpg'))), undefined);
    await worker.settleFetches();

    for (const [url, cacheName] of routed) {
        assert.ok(await worker.cacheStores.get(cacheName).match(new FakeRequest(url)), url);
    }
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
    }

    await Promise.all(requests);
    await worker.settleFetches();

    for (const [cacheName, maximumEntries] of [
        [EMOTE_STATIC_CACHE, 140],
        [STATIC_ASSETS_CACHE, 200]
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
    assert.equal((await cache.keys()).length, 141, 'a failed write does not trim earlier entries');
});

test('a refreshed network-first entry moves behind older entries for eviction', async () => {
    const manifest = localUrl('/usr/themes/VOID/assets/libs/emotes/packs.json');
    const posterUrl = (id) => localUrl(`/usr/themes/VOID/assets/libs/emotes/bangumi/poster/${id}.webp`);
    const worker = loadWorker((request) => Promise.resolve(new FakeResponse(request.url)));

    await worker.dispatchFetch(new FakeRequest(manifest));
    await worker.settleFetches();
    for (let id = 1; id < 140; id++) {
        await worker.dispatchFetch(new FakeRequest(posterUrl(id)));
    }
    await worker.settleFetches();
    await worker.dispatchFetch(new FakeRequest(manifest));
    await worker.settleFetches();
    await worker.dispatchFetch(new FakeRequest(posterUrl(140)));
    await worker.settleFetches();

    const urls = (await worker.cacheStores.get(EMOTE_STATIC_CACHE).keys()).map((request) => request.url);

    assert.equal(urls.length, 140);
    assert.ok(urls.includes(manifest), 'the manifest refreshed by the network stays cached');
    assert.ok(!urls.includes(posterUrl(1)), 'the oldest untouched poster is evicted');
});

test('activation retires toolbox caches and metadata without deleting native caches', async () => {
    const worker = loadWorker(() => Promise.reject(new Error('unexpected fetch')));
    const defaultCache = `$$$toolbox-cache$$$${ORIGIN}/$$$`;

    await worker.cacheStores.set('static-assets-toolbox-v5', new FakeCache());
    await worker.cacheStores.set('static-vendor-native-v6', new FakeCache());
    await worker.cacheStores.set('static-vendor-native-v7', new FakeCache());
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
    assert.ok(!worker.cacheStores.has('static-vendor-native-v6'), 'opaque-era vendor cache must retire');
    assert.ok(!worker.cacheStores.has('static-vendor-native-v7'), 'unrouted vendor cache must retire');
    assert.ok(!worker.cacheStores.has(defaultCache));
    assert.ok(!worker.cacheStores.has(`${defaultCache}$$$inactive$$$`));
    assert.ok(worker.cacheStores.has(FONT_ASSETS_CACHE));
    assert.ok(worker.cacheStores.has(STATIC_ASSETS_CACHE));
    assert.ok(worker.cacheStores.has('unrelated-cache'));
    assert.ok(worker.deletedDatabases.includes('sw-toolbox-static-assets-toolbox-v5'));
});
