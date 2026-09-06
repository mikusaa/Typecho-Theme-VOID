(function() {
    var configurationElement = document.getElementById('void-service-worker-config');
    var configuredUri;
    var ownershipKey = 'VOIDServiceWorkerOwnership';

    if (!configurationElement) {
        console.log('Service Worker configuration is missing.');
        return;
    }

    try {
        configuredUri = JSON.parse(configurationElement.textContent);
    } catch (error) {
        console.log('Service Worker configuration is invalid.');
        return;
    }

    if (configuredUri !== null && typeof configuredUri !== 'string') {
        console.log('Service Worker configuration is invalid.');
        return;
    }

    if (!('serviceWorker' in navigator)) {
        console.log('Service workers are not supported in the current browser.');
        return;
    }

    function normalizeSameOriginUrl(value) {
        if (typeof value !== 'string' || value === '') {
            return null;
        }

        try {
            var url = new URL(value, window.location.href);
            return url.origin === window.location.origin ? url.href : null;
        } catch (error) {
            return null;
        }
    }

    function readOwnership() {
        var raw;

        try {
            raw = window.localStorage.getItem(ownershipKey);
        } catch (error) {
            return { available: false };
        }

        if (raw === null) {
            return { available: true, record: null };
        }

        try {
            return { available: true, record: JSON.parse(raw) };
        } catch (error) {
            return { available: true, invalid: true };
        }
    }

    function writeOwnership(record) {
        try {
            window.localStorage.setItem(ownershipKey, JSON.stringify(record));
        } catch (error) {
            // Registration still works when storage is unavailable.
        }
    }

    function validateOwnership(record) {
        if (!record || record.version !== 1 || !Array.isArray(record.registrations)) {
            return null;
        }

        var registrations = [];
        var scopes = [];
        for (var registrationIndex = 0;
            registrationIndex < record.registrations.length;
            registrationIndex += 1) {
            var candidate = record.registrations[registrationIndex];
            if (!candidate || !Array.isArray(candidate.scriptURLs)) {
                return null;
            }

            var scope = normalizeSameOriginUrl(candidate.scope);
            if (scope !== candidate.scope
                || candidate.scriptURLs.length === 0
                || scopes.indexOf(scope) !== -1) {
                return null;
            }

            var scriptURLs = [];
            for (var scriptIndex = 0;
                scriptIndex < candidate.scriptURLs.length;
                scriptIndex += 1) {
                var scriptURL = normalizeSameOriginUrl(candidate.scriptURLs[scriptIndex]);
                if (scriptURL !== candidate.scriptURLs[scriptIndex]) {
                    return null;
                }
                if (scriptURLs.indexOf(scriptURL) === -1) {
                    scriptURLs.push(scriptURL);
                }
            }

            scopes.push(scope);
            registrations.push({
                scope: scope,
                scriptURLs: scriptURLs
            });
        }

        return {
            version: 1,
            registrations: registrations
        };
    }

    function registrationBelongsTo(registration, ownership) {
        if (!registration || registration.scope !== ownership.scope) {
            return false;
        }

        var workers = [registration.active, registration.waiting, registration.installing];
        var workerCount = 0;

        for (var index = 0; index < workers.length; index += 1) {
            if (!workers[index]) {
                continue;
            }

            workerCount += 1;
            var scriptURL = normalizeSameOriginUrl(workers[index].scriptURL);
            if (!scriptURL || ownership.scriptURLs.indexOf(scriptURL) === -1) {
                return false;
            }
        }

        return workerCount > 0;
    }

    function rememberRegistration(registration, scriptURL) {
        var scope = normalizeSameOriginUrl(registration.scope);
        if (!scope) {
            return;
        }

        var current = readOwnership();
        var previous = current.available && current.record
            ? validateOwnership(current.record)
            : null;
        var registrations = previous ? previous.registrations : [];
        var matchedRegistration = null;

        for (var index = 0; index < registrations.length; index += 1) {
            if (registrations[index].scope === scope) {
                matchedRegistration = registrations[index];
                if (matchedRegistration.scriptURLs.indexOf(scriptURL) === -1) {
                    matchedRegistration.scriptURLs.push(scriptURL);
                }
                break;
            }
        }

        if (!matchedRegistration) {
            registrations.push({
                scope: scope,
                scriptURLs: [scriptURL]
            });
        }

        writeOwnership({
            version: 1,
            registrations: registrations
        });
    }

    function unregisterOwnedWorker(ownership) {
        return navigator.serviceWorker.getRegistration(ownership.scope).then(function(registration) {
            if (!registration || !registrationBelongsTo(registration, ownership)) {
                return null;
            }

            return registration.unregister().then(function(unregistered) {
                return unregistered ? null : ownership;
            }).catch(function(error) {
                console.log('Service Worker unregistration failed: ', error);
                return ownership;
            });
        }).catch(function(error) {
            console.log('Service Worker registration lookup failed: ', error);
            return ownership;
        });
    }

    function unregisterOwnedWorkers(ownership) {
        var checks = [];
        for (var index = 0; index < ownership.registrations.length; index += 1) {
            checks.push(unregisterOwnedWorker(ownership.registrations[index]));
        }

        Promise.all(checks).then(function(results) {
            var registrations = [];
            for (var resultIndex = 0; resultIndex < results.length; resultIndex += 1) {
                if (results[resultIndex]) {
                    registrations.push(results[resultIndex]);
                }
            }
            writeOwnership({ version: 1, registrations: registrations });
        });
    }

    function migrateLegacyWorker(canRememberResult) {
        var legacyScope = normalizeSameOriginUrl('/');
        var legacyScriptURL = normalizeSameOriginUrl('/VOIDCacheRule.js');
        var ownership = {
            scope: legacyScope,
            scriptURLs: [legacyScriptURL]
        };

        navigator.serviceWorker.getRegistration(legacyScope).then(function(registration) {
            if (!registrationBelongsTo(registration, ownership)) {
                if (canRememberResult) {
                    writeOwnership({ version: 1, registrations: [] });
                }
                return;
            }

            registration.unregister().then(function(unregistered) {
                if (!canRememberResult) {
                    return;
                }
                writeOwnership({
                    version: 1,
                    registrations: unregistered ? [] : [ownership]
                });
            }).catch(function(error) {
                if (canRememberResult) {
                    writeOwnership({ version: 1, registrations: [ownership] });
                }
                console.log('Service Worker unregistration failed: ', error);
            });
        }).catch(function(error) {
            console.log('Service Worker registration lookup failed: ', error);
        });
    }

    if (configuredUri) {
        var serviceWorkerUri = normalizeSameOriginUrl(configuredUri);
        if (!serviceWorkerUri) {
            console.log('Service Worker URL must use the current origin.');
            return;
        }

        navigator.serviceWorker.register(serviceWorkerUri).then(function(registration) {
            rememberRegistration(registration, serviceWorkerUri);
            if (navigator.serviceWorker.controller) {
                console.log('Service worker is registered and is controlling.');
            } else {
                console.log('Please reload this page to allow the service worker to handle network operations.');
            }
        }).catch(function(error) {
            console.log('Service Worker registration failed: ', error);
        });
        return;
    }

    var ownershipState = readOwnership();
    if (!ownershipState.available) {
        migrateLegacyWorker(false);
        return;
    }

    if (ownershipState.invalid) {
        migrateLegacyWorker(true);
        return;
    }

    if (ownershipState.record) {
        var ownership = validateOwnership(ownershipState.record);
        if (!ownership) {
            migrateLegacyWorker(true);
            return;
        }
        unregisterOwnedWorkers(ownership);
        return;
    }

    migrateLegacyWorker(true);
}());
