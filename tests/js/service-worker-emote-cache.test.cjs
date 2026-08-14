const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ANIMATED_CACHE = 'emote-animated-toolbox-v4';
const ANIMATED_ROUTE = '/usr/themes/VOID/assets/libs/emotes/bangumi/animated/(.*)';

class FakeRequest {
    constructor(url) {
        this.url = url;
    }

    clone() {
        return new FakeRequest(this.url);
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
        this.maximumObservedEntries = 0;
    }

    match(request) {
        const response = this.entries.get(request.url);
        return Promise.resolve(response ? response.clone() : undefined);
    }

    delete(request) {
        return Promise.resolve(this.entries.delete(request.url));
    }

    put(request, response) {
        this.entries.set(request.url, response.clone());
        this.maximumObservedEntries = Math.max(this.maximumObservedEntries, this.entries.size);
        return Promise.resolve();
    }

    keys() {
        return Promise.resolve([...this.entries.keys()].map((url) => new FakeRequest(url)));
    }
}

function loadWorker(fetchImplementation) {
    const routes = [];
    const cacheStores = new Map();
    const cacheFirst = function () {};
    const networkFirst = function () {};
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
        clients: { claim: () => Promise.resolve() },
        skipWaiting: () => Promise.resolve(),
        importScripts: () => {},
        addEventListener: () => {},
        toolbox: {
            cacheFirst,
            networkFirst,
            options: {},
            router: {
                get(pattern, handler, options) {
                    routes.push({ pattern, handler, options });
                }
            }
        }
    };
    const context = {
        caches,
        fetch: fetchImplementation,
        self
    };

    vm.runInNewContext(
        fs.readFileSync(path.resolve(__dirname, '../../assets/VOIDCacheRule.js'), 'utf8'),
        context
    );

    return { cacheFirst, networkFirst, cacheStores, routes };
}

function animatedUrl(id) {
    return `https://example.test/usr/themes/VOID/assets/libs/emotes/bangumi/animated/${id}.gif`;
}

test('Bangumi animated route remains first and uses its own cache handler', () => {
    const { cacheFirst, networkFirst, routes } = loadWorker(() => Promise.reject(new Error('unexpected fetch')));

    assert.equal(routes[0].pattern, ANIMATED_ROUTE);
    assert.notEqual(routes[0].handler, cacheFirst);
    assert.equal(routes[1].handler, networkFirst);
    assert.equal(routes[2].handler, networkFirst);
    assert.equal(routes[3].handler, cacheFirst);
    assert.equal(routes[1].options.cache.name, 'emote-static-toolbox-v4');
    assert.equal(routes[4].options.cache.name, 'static-assets-toolbox-v4');
});

test('animated cache hits refresh recency before strict 48-entry eviction', async () => {
    let fetchCount = 0;
    const { cacheStores, routes } = loadWorker((request) => {
        fetchCount += 1;
        return Promise.resolve(new FakeResponse(request.url));
    });
    const handler = routes[0].handler;

    for (let id = 1; id <= 48; id++) {
        await handler(new FakeRequest(animatedUrl(String(id).padStart(3, '0'))));
    }
    await handler(new FakeRequest(animatedUrl('001')));
    await handler(new FakeRequest(animatedUrl('049')));

    const keys = await cacheStores.get(ANIMATED_CACHE).keys();
    const urls = keys.map((request) => request.url);
    assert.equal(fetchCount, 49, 'cache hit must not use the network');
    assert.equal(urls.length, 48);
    assert.ok(urls.includes(animatedUrl('001')), 'recently read entry must remain cached');
    assert.ok(!urls.includes(animatedUrl('002')), 'least recently used entry must be evicted');
    assert.equal(urls.at(-1), animatedUrl('049'));
});

test('concurrent animated misses never leave more than 48 cached responses', async () => {
    const { cacheStores, routes } = loadWorker((request) => Promise.resolve(new FakeResponse(request.url)));
    const handler = routes[0].handler;
    const requests = [];

    for (let id = 1; id <= 64; id++) {
        requests.push(handler(new FakeRequest(animatedUrl(String(id).padStart(3, '0')))));
    }
    await Promise.all(requests);

    const keys = await cacheStores.get(ANIMATED_CACHE).keys();
    const cache = cacheStores.get(ANIMATED_CACHE);
    assert.equal(keys.length, 48);
    assert.equal(cache.maximumObservedEntries, 48);
    assert.equal(keys[0].url, animatedUrl('017'));
    assert.equal(keys.at(-1).url, animatedUrl('064'));
});

test('unsuccessful animated responses are returned without being cached', async () => {
    const { cacheStores, routes } = loadWorker(() => Promise.resolve(new FakeResponse('failed', 503)));
    const response = await routes[0].handler(new FakeRequest(animatedUrl('001')));
    const cache = cacheStores.get(ANIMATED_CACHE);

    assert.equal(response.status, 503);
    assert.equal((await cache.keys()).length, 0);
});
