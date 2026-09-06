const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const FOOTER_PATH = path.resolve(__dirname, '../../includes/footer.php');
const FOOTER_SOURCE = fs.readFileSync(FOOTER_PATH, 'utf8').replace(/\r\n/g, '\n');
const REGISTRATION_PATH = path.resolve(
    __dirname,
    '../../assets/service-worker-registration.js'
);
const REGISTRATION_SOURCE = fs.readFileSync(REGISTRATION_PATH, 'utf8').replace(/\r\n/g, '\n');
const OWNERSHIP_KEY = 'VOIDServiceWorkerOwnership';

function createStorage(initial = {}) {
    const values = new Map(Object.entries(initial));

    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        value(key) {
            return values.has(key) ? values.get(key) : null;
        }
    };
}

function createRegistration(options = {}) {
    const calls = { unregister: 0 };
    const registration = {
        scope: options.scope || 'https://blog.example.test/',
        active: options.active === undefined
            ? { scriptURL: 'https://blog.example.test/VOIDCacheRule.js' }
            : options.active,
        waiting: options.waiting || null,
        installing: options.installing || null,
        unregister() {
            calls.unregister += 1;
            if (options.unregisterError) {
                return Promise.reject(options.unregisterError);
            }
            return Promise.resolve(options.unregisterResult === undefined
                ? true
                : options.unregisterResult);
        }
    };

    return { calls, registration };
}

async function runRegistrationScript(options = {}) {
    const pageUrl = options.pageUrl || 'https://blog.example.test/archives/post/';
    const location = new URL(pageUrl);
    const storage = options.storage || createStorage();
    const calls = { getRegistration: [], register: [] };
    const serviceWorker = options.unsupported ? undefined : {
        controller: options.controller || null,
        getRegistration(scope) {
            const normalizedScope = String(scope);
            calls.getRegistration.push(normalizedScope);
            if (options.getRegistrationError) {
                return Promise.reject(options.getRegistrationError);
            }
            if (options.lookupByScope) {
                return Promise.resolve(options.lookupByScope[normalizedScope] || null);
            }
            return Promise.resolve(options.lookupRegistration || null);
        },
        register(scriptURL) {
            calls.register.push(String(scriptURL));
            if (options.registrationError) {
                return Promise.reject(options.registrationError);
            }
            return Promise.resolve(options.registeredRegistration);
        }
    };
    const window = { location };

    if (options.storageGetterError) {
        Object.defineProperty(window, 'localStorage', {
            get() {
                throw options.storageGetterError;
            }
        });
    } else {
        window.localStorage = storage;
    }

    const navigator = options.unsupported ? {} : { serviceWorker };
    const logs = [];
    const context = vm.createContext({
        Array,
        JSON,
        Promise,
        URL,
        console: {
            log() {
                logs.push(Array.from(arguments));
            }
        },
        navigator,
        window
    });
    const configuredUri = Object.prototype.hasOwnProperty.call(options, 'configuredUri')
        ? options.configuredUri
        : null;
    const configurationSource = Object.prototype.hasOwnProperty.call(options, 'configurationSource')
        ? options.configurationSource
        : JSON.stringify(configuredUri);
    const configurationElement = options.missingConfiguration
        ? null
        : { textContent: configurationSource };
    const document = {
        getElementById(id) {
            assert.equal(id, 'void-service-worker-config');
            return configurationElement;
        }
    };

    context.document = document;
    vm.runInContext(REGISTRATION_SOURCE, context);
    for (let index = 0; index < 2; index += 1) {
        await new Promise((resolve) => setImmediate(resolve));
    }

    return { calls, logs, storage };
}

function ownedRegistration(scope, scriptURLs) {
    return { scope, scriptURLs };
}

function ownershipRecord(registrations) {
    return JSON.stringify({ version: 1, registrations });
}

function readOwnership(storage) {
    return JSON.parse(storage.value(OWNERSHIP_KEY));
}

test('footer safely serializes configuration and loads the first-party runtime', () => {
    assert.match(
        FOOTER_SOURCE,
        /Utils::encodeJsonForHtml\(\$serviceWorkerUri\)/,
        'configured URI should use the shared HTML-safe JSON encoder'
    );
    assert.match(
        FOOTER_SOURCE,
        /<script id="void-service-worker-config" type="application\/json">/
    );
    assert.match(
        FOOTER_SOURCE,
        /Utils::indexTheme\('\/assets\/service-worker-registration\.js'\)/
    );
    assert.match(
        FOOTER_SOURCE,
        /isset\(\$setting\['serviceworker'\]\)\s*&&\s*is_string\(\$setting\['serviceworker'\]\)/,
        'non-string settings should be rejected before ltrim'
    );
    assert.doesNotMatch(FOOTER_SOURCE, /\.getRegistrations\s*\(/);
    assert.match(FOOTER_SOURCE, /empty\(\$serviceWorkerSetting\)/);
    assert.doesNotMatch(FOOTER_SOURCE, /VOIDServiceWorkerOwnership/);
    assert.match(REGISTRATION_SOURCE, /VOIDServiceWorkerOwnership/);
    assert.doesNotMatch(REGISTRATION_SOURCE, /<\?php/);
    assert.doesNotMatch(REGISTRATION_SOURCE, /\.getRegistrations\s*\(/);
});

test('missing or invalid configuration cannot trigger registration cleanup', async (t) => {
    const cases = [
        { name: 'missing element', options: { missingConfiguration: true } },
        { name: 'invalid JSON', options: { configurationSource: '{invalid' } },
        { name: 'non-string JSON', options: { configurationSource: '{}' } }
    ];

    for (const item of cases) {
        await t.test(item.name, async () => {
            const result = await runRegistrationScript(item.options);

            assert.deepEqual(result.calls, { getRegistration: [], register: [] });
            assert.equal(result.storage.value(OWNERSHIP_KEY), null);
        });
    }
});

test('successful registration records its canonical script URL and actual scope', async () => {
    const { registration } = createRegistration({
        scope: 'https://blog.example.test/cache/'
    });
    const result = await runRegistrationScript({
        configuredUri: '/cache/../VOIDCacheRule.js?build=7',
        registeredRegistration: registration
    });

    assert.deepEqual(result.calls.register, [
        'https://blog.example.test/VOIDCacheRule.js?build=7'
    ]);
    assert.deepEqual(readOwnership(result.storage), {
        version: 1,
        registrations: [{
            scope: 'https://blog.example.test/cache/',
            scriptURLs: ['https://blog.example.test/VOIDCacheRule.js?build=7']
        }]
    });
});

test('registration failure does not create an ownership record', async () => {
    const result = await runRegistrationScript({
        configuredUri: '/VOIDCacheRule.js',
        registrationError: new Error('register failed')
    });

    assert.equal(result.storage.value(OWNERSHIP_KEY), null);
});

test('registration keeps known script URLs for the same scope during updates', async () => {
    const storage = createStorage({
        [OWNERSHIP_KEY]: ownershipRecord([
            ownedRegistration(
                'https://blog.example.test/',
                ['https://blog.example.test/old-worker.js']
            )
        ])
    });
    const { registration } = createRegistration();
    await runRegistrationScript({
        configuredUri: '/VOIDCacheRule.js',
        registeredRegistration: registration,
        storage
    });

    assert.deepEqual(readOwnership(storage).registrations[0].scriptURLs, [
        'https://blog.example.test/old-worker.js',
        'https://blog.example.test/VOIDCacheRule.js'
    ]);
});

test('registration retains independently owned scopes when the script directory changes', async () => {
    const storage = createStorage({
        [OWNERSHIP_KEY]: ownershipRecord([
            ownedRegistration(
                'https://blog.example.test/',
                ['https://blog.example.test/VOIDCacheRule.js']
            )
        ])
    });
    const { registration } = createRegistration({
        scope: 'https://blog.example.test/cache/',
        active: { scriptURL: 'https://blog.example.test/cache/worker.js' }
    });
    await runRegistrationScript({
        configuredUri: '/cache/worker.js',
        registeredRegistration: registration,
        storage
    });

    assert.deepEqual(readOwnership(storage).registrations, [
        ownedRegistration(
            'https://blog.example.test/',
            ['https://blog.example.test/VOIDCacheRule.js']
        ),
        ownedRegistration(
            'https://blog.example.test/cache/',
            ['https://blog.example.test/cache/worker.js']
        )
    ]);
});

test('disabled setting verifies and unregisters every independently owned scope', async () => {
    const storage = createStorage({
        [OWNERSHIP_KEY]: ownershipRecord([
            ownedRegistration(
                'https://blog.example.test/',
                ['https://blog.example.test/VOIDCacheRule.js']
            ),
            ownedRegistration(
                'https://blog.example.test/cache/',
                [
                    'https://blog.example.test/cache/worker.js',
                    'https://blog.example.test/cache/worker-next.js'
                ]
            )
        ])
    });
    const root = createRegistration();
    const cache = createRegistration({
        scope: 'https://blog.example.test/cache/',
        active: { scriptURL: 'https://blog.example.test/cache/worker.js' },
        waiting: { scriptURL: 'https://blog.example.test/cache/worker-next.js' }
    });
    const result = await runRegistrationScript({
        lookupByScope: {
            'https://blog.example.test/': root.registration,
            'https://blog.example.test/cache/': cache.registration
        },
        storage
    });

    assert.deepEqual(result.calls.getRegistration, [
        'https://blog.example.test/',
        'https://blog.example.test/cache/'
    ]);
    assert.equal(root.calls.unregister, 1);
    assert.equal(cache.calls.unregister, 1);
    assert.deepEqual(readOwnership(storage), { version: 1, registrations: [] });
});

test('unregister false retains only the registration that still needs cleanup', async () => {
    const rootOwnership = ownedRegistration(
        'https://blog.example.test/',
        ['https://blog.example.test/VOIDCacheRule.js']
    );
    const cacheOwnership = ownedRegistration(
        'https://blog.example.test/cache/',
        ['https://blog.example.test/cache/worker.js']
    );
    const storage = createStorage({
        [OWNERSHIP_KEY]: ownershipRecord([rootOwnership, cacheOwnership])
    });
    const root = createRegistration({ unregisterResult: false });
    const cache = createRegistration({
        scope: 'https://blog.example.test/cache/',
        active: { scriptURL: 'https://blog.example.test/cache/worker.js' }
    });
    await runRegistrationScript({
        lookupByScope: {
            'https://blog.example.test/': root.registration,
            'https://blog.example.test/cache/': cache.registration
        },
        storage
    });

    assert.equal(root.calls.unregister, 1);
    assert.equal(cache.calls.unregister, 1);
    assert.deepEqual(readOwnership(storage), {
        version: 1,
        registrations: [rootOwnership]
    });
});

test('scope or worker URL mismatch abandons ownership without unregistering', async (t) => {
    const cases = [
        {
            name: 'scope mismatch',
            registration: createRegistration({
                scope: 'https://blog.example.test/application/'
            })
        },
        {
            name: 'active worker mismatch',
            registration: createRegistration({
                active: { scriptURL: 'https://blog.example.test/application-worker.js' }
            })
        },
        {
            name: 'waiting worker mismatch',
            registration: createRegistration({
                waiting: { scriptURL: 'https://blog.example.test/application-worker.js' }
            })
        },
        {
            name: 'missing worker',
            registration: createRegistration({ active: null })
        }
    ];

    for (const item of cases) {
        await t.test(item.name, async () => {
            const storage = createStorage({
                [OWNERSHIP_KEY]: ownershipRecord([
                    ownedRegistration(
                        'https://blog.example.test/',
                        ['https://blog.example.test/VOIDCacheRule.js']
                    )
                ])
            });
            await runRegistrationScript({
                lookupRegistration: item.registration.registration,
                storage
            });

            assert.equal(item.registration.calls.unregister, 0);
            assert.deepEqual(readOwnership(storage), { version: 1, registrations: [] });
        });
    }
});

test('invalid ownership records fall back to exact legacy default migration', async (t) => {
    const cases = [
        { name: 'invalid JSON', raw: '{invalid' },
        {
            name: 'cross-origin scope',
            raw: ownershipRecord([
                ownedRegistration(
                    'https://application.example.test/',
                    ['https://application.example.test/worker.js']
                )
            ])
        }
    ];

    for (const item of cases) {
        await t.test(item.name, async () => {
            const storage = createStorage({ [OWNERSHIP_KEY]: item.raw });
            const legacy = createRegistration();
            const result = await runRegistrationScript({
                lookupRegistration: legacy.registration,
                storage
            });

            assert.deepEqual(result.calls.getRegistration, ['https://blog.example.test/']);
            assert.equal(legacy.calls.unregister, 1);
            assert.deepEqual(readOwnership(storage), { version: 1, registrations: [] });
        });
    }
});

test('missing record migrates only the exact root VOIDCacheRule.js registration', async () => {
    const exact = createRegistration();
    const result = await runRegistrationScript({ lookupRegistration: exact.registration });

    assert.deepEqual(result.calls.getRegistration, ['https://blog.example.test/']);
    assert.equal(exact.calls.unregister, 1);
    assert.deepEqual(readOwnership(result.storage), { version: 1, registrations: [] });
});

test('missing record preserves unrelated and historical custom registrations', async (t) => {
    const cases = [
        {
            name: 'different script',
            registration: createRegistration({
                active: { scriptURL: 'https://blog.example.test/application-worker.js' }
            })
        },
        {
            name: 'historical custom filename',
            registration: createRegistration({
                active: { scriptURL: 'https://blog.example.test/custom-cache.js' }
            })
        },
        {
            name: 'different scope',
            registration: createRegistration({
                scope: 'https://blog.example.test/application/'
            })
        }
    ];

    for (const item of cases) {
        await t.test(item.name, async () => {
            const result = await runRegistrationScript({
                lookupRegistration: item.registration.registration
            });

            assert.equal(item.registration.calls.unregister, 0);
            assert.deepEqual(readOwnership(result.storage), {
                version: 1,
                registrations: []
            });
        });
    }
});

test('storage failure still permits only the exact legacy default migration', async () => {
    const exact = createRegistration();
    const result = await runRegistrationScript({
        lookupRegistration: exact.registration,
        storageGetterError: new Error('storage blocked')
    });

    assert.deepEqual(result.calls.getRegistration, ['https://blog.example.test/']);
    assert.equal(exact.calls.unregister, 1);
});

test('storage failure preserves a historical custom registration', async () => {
    const custom = createRegistration({
        active: { scriptURL: 'https://blog.example.test/custom-cache.js' }
    });
    const result = await runRegistrationScript({
        lookupRegistration: custom.registration,
        storageGetterError: new Error('storage blocked')
    });

    assert.deepEqual(result.calls.getRegistration, ['https://blog.example.test/']);
    assert.equal(custom.calls.unregister, 0);
});

test('storage failure does not prevent explicitly configured registration', async () => {
    const { registration } = createRegistration();
    const result = await runRegistrationScript({
        configuredUri: '/VOIDCacheRule.js',
        registeredRegistration: registration,
        storageGetterError: new Error('storage blocked')
    });

    assert.deepEqual(result.calls.register, ['https://blog.example.test/VOIDCacheRule.js']);
});

test('cross-origin configured URI is rejected before registration', async () => {
    const result = await runRegistrationScript({
        configuredUri: 'https://application.example.test/worker.js'
    });

    assert.deepEqual(result.calls.register, []);
});

test('unsupported browsers leave Service Worker and storage state untouched', async () => {
    const storage = createStorage();
    const result = await runRegistrationScript({ storage, unsupported: true });

    assert.deepEqual(result.calls, { getRegistration: [], register: [] });
    assert.equal(storage.value(OWNERSHIP_KEY), null);
});
