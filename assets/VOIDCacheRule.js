/* eslint-disable indent */
'use strict';

(function () {
  'use strict';

  var cacheVersion = '-native-v6';
  var staticVendorCacheName = 'static-vendor' + cacheVersion;
  var staticAssetsCacheName = 'static-assets' + cacheVersion;
  var emoteStaticCacheName = 'emote-static' + cacheVersion;
  var emoteAnimatedCacheName = 'emote-animated' + cacheVersion;
  var staticMaxEntries = 200;
  var emoteStaticMaxEntries = 140;
  var emoteAnimatedMaxEntries = 48;
  var cacheMutationQueues = {};
  var cacheEntryMutationQueues = {};
  var cacheEntryRecency = {};
  var recencyCounter = 0;
  var retiredCacheNames = [
    'dynamic-vendor-toolbox-v1',
    'static-vendor-toolbox-v1',
    'static-assets-toolbox-v1',
    'content-toolbox-v1',
    'static-vendor-toolbox-v2',
    'static-assets-toolbox-v2',
    'emote-static-toolbox-v2',
    'emote-animated-toolbox-v2',
    'static-vendor-toolbox-v3',
    'static-assets-toolbox-v3',
    'emote-static-toolbox-v3',
    'emote-animated-toolbox-v3',
    'static-vendor-toolbox-v4',
    'static-assets-toolbox-v4',
    'emote-static-toolbox-v4',
    'emote-animated-toolbox-v4',
    'static-vendor-toolbox-v5',
    'static-assets-toolbox-v5',
    'emote-static-toolbox-v5',
    'emote-animated-toolbox-v5'
  ];

  function isSuccessfulResponse(response) {
    return response.status === 0 || (response.status >= 200 && response.status < 300);
  }

  function queueCacheMutation(cacheName, callback) {
    var previousOperation = cacheMutationQueues[cacheName] || self.Promise.resolve();
    var operation = previousOperation.then(callback, callback);

    cacheMutationQueues[cacheName] = operation.catch(function () {
      // A failed Cache API operation must not block later mutations.
    });
    return operation;
  }

  function markCacheEntryUsed(cacheName, request) {
    if (!cacheEntryRecency[cacheName]) {
      cacheEntryRecency[cacheName] = {};
    }
    recencyCounter += 1;
    cacheEntryRecency[cacheName][request.url] = recencyCounter;
  }

  function queueCacheEntryMutation(cacheName, request, callback) {
    var queues = cacheEntryMutationQueues[cacheName] || {};
    var previousOperation = queues[request.url] || self.Promise.resolve();
    var operation = previousOperation.then(callback, callback);
    var settledOperation = operation.catch(function () {
      // A failed entry operation must not block a later replacement.
    });

    cacheEntryMutationQueues[cacheName] = queues;
    queues[request.url] = settledOperation;
    settledOperation.then(function () {
      if (queues[request.url] === settledOperation) {
        delete queues[request.url];
      }
    });
    return operation;
  }

  function trimCache(cacheName, cache, maximumEntries) {
    return cache.keys().then(function (requests) {
      var overflow = requests.length - maximumEntries;
      var recency = cacheEntryRecency[cacheName] || {};
      var oldestRequests;

      if (overflow <= 0) {
        return self.Promise.resolve();
      }

      oldestRequests = requests.map(function (request, index) {
        return {
          request: request,
          index: index,
          recency: recency[request.url] || 0
        };
      }).sort(function (left, right) {
        if (left.recency && right.recency) {
          return left.recency - right.recency;
        }
        if (left.recency) {
          return 1;
        }
        if (right.recency) {
          return -1;
        }
        return left.index - right.index;
      }).slice(0, overflow);

      return self.Promise.all(oldestRequests.map(function (entry) {
        return queueCacheEntryMutation(cacheName, entry.request, function () {
          if ((recency[entry.request.url] || 0) !== entry.recency) {
            return self.Promise.resolve(false);
          }
          delete recency[entry.request.url];
          return cache.delete(entry.request);
        });
      })).then(function () {
        // A refreshed victim may have been skipped; keep trimming to the limit.
        return trimCache(cacheName, cache, maximumEntries);
      });
    });
  }

  function storeResponse(cacheName, maximumEntries, request, response) {
    var trimAfterPut;

    // Protect this URL from a concurrent trim before Cache.put finishes.
    markCacheEntryUsed(cacheName, request);
    return caches.open(cacheName).then(function (cache) {
      trimAfterPut = function () {
        return queueCacheMutation(cacheName, function () {
          return trimCache(cacheName, cache, maximumEntries);
        });
      };
      // Distinct response bodies are consumed concurrently; only the same URL is ordered.
      return queueCacheEntryMutation(cacheName, request, function () {
        return cache.put(request, response);
      }).then(function () {
        return trimAfterPut();
      }, function (putError) {
        return trimAfterPut().then(function () {
          throw putError;
        }, function () {
          throw putError;
        });
      });
    });
  }

  function refreshCachedResponse(cacheName, request, response) {
    var responseForCache = response.clone();

    markCacheEntryUsed(cacheName, request);
    return caches.open(cacheName).then(function (cache) {
      return queueCacheEntryMutation(cacheName, request, function () {
        // Persist animated LRU order across Service Worker restarts.
        return cache.delete(request).then(function () {
          return cache.put(request, responseForCache);
        });
      });
    }).catch(function () {
      // A refresh failure must not fail a cache hit.
    });
  }

  function cacheOperation(cacheName, maximumEntries, request, response) {
    // Clone before respondWith can hand the body to the page.
    var responseForCache = response.clone();

    return storeResponse(cacheName, maximumEntries, request, responseForCache).catch(function () {
      // Cache quota or storage failures must not fail the resource request.
    });
  }

  function strategyResult(response, operation) {
    return {
      response: response,
      cacheOperation: operation || self.Promise.resolve()
    };
  }

  function cacheFirst(request, cacheName, maximumEntries, refreshOnHit) {
    return caches.open(cacheName).then(function (cache) {
      return cache.match(request);
    }).then(function (cachedResponse) {
      if (cachedResponse) {
        if (refreshOnHit) {
          return strategyResult(
            cachedResponse,
            refreshCachedResponse(cacheName, request, cachedResponse)
          );
        }
        return strategyResult(cachedResponse);
      }

      return fetch(request.clone()).then(function (networkResponse) {
        if (!isSuccessfulResponse(networkResponse)) {
          return strategyResult(networkResponse);
        }
        return strategyResult(
          networkResponse,
          cacheOperation(cacheName, maximumEntries, request, networkResponse)
        );
      });
    });
  }

  function networkFirst(request, cacheName, maximumEntries) {
    return fetch(request.clone()).then(function (networkResponse) {
      if (isSuccessfulResponse(networkResponse)) {
        return strategyResult(
          networkResponse,
          cacheOperation(cacheName, maximumEntries, request, networkResponse)
        );
      }

      return caches.open(cacheName).then(function (cache) {
        return cache.match(request);
      }).then(function (cachedResponse) {
        return strategyResult(cachedResponse || networkResponse);
      });
    }, function (networkError) {
      return caches.open(cacheName).then(function (cache) {
        return cache.match(request);
      }).then(function (cachedResponse) {
        if (cachedResponse) {
          return strategyResult(cachedResponse);
        }
        throw networkError;
      });
    });
  }

  function hasPathPrefix(pathname, prefix) {
    return pathname.indexOf(prefix) === 0;
  }

  function routeRequest(request) {
    var url;
    var pathname;

    if (request.method !== 'GET') {
      return null;
    }

    url = new URL(request.url);
    pathname = url.pathname;

    if (url.origin === self.location.origin) {
      if (hasPathPrefix(pathname, '/usr/themes/VOID/assets/libs/emotes/bangumi/animated/')) {
        return cacheFirst(request, emoteAnimatedCacheName, emoteAnimatedMaxEntries, true);
      }
      if (pathname === '/usr/themes/VOID/assets/libs/emotes/packs.json' ||
          hasPathPrefix(pathname, '/usr/themes/VOID/assets/libs/emotes/packs/')) {
        return networkFirst(request, emoteStaticCacheName, emoteStaticMaxEntries);
      }
      if (hasPathPrefix(pathname, '/usr/themes/VOID/assets/libs/emotes/bangumi/poster/')) {
        return cacheFirst(request, emoteStaticCacheName, emoteStaticMaxEntries);
      }
      if (hasPathPrefix(pathname, '/usr/')) {
        return cacheFirst(request, staticAssetsCacheName, staticMaxEntries);
      }
    }

    if (url.origin === 'https://secure.gravatar.com' && hasPathPrefix(pathname, '/avatar/')) {
      return cacheFirst(request, staticVendorCacheName, staticMaxEntries);
    }
    if (url.origin === 'https://fonts.googleapis.com' ||
        url.origin === 'https://fonts.googleapis.cn' ||
        url.origin === 'https://fonts.gstatic.com' ||
        url.origin === 'https://fonts.gstatic.cn') {
      return cacheFirst(request, staticVendorCacheName, staticMaxEntries);
    }

    return null;
  }

  function deleteRetiredMetadataDatabases() {
    if (!self.indexedDB) {
      return self.Promise.resolve();
    }

    return self.Promise.all(retiredCacheNames.map(function (cacheName) {
      return new self.Promise(function (resolve) {
        var request = self.indexedDB.deleteDatabase('sw-toolbox-' + cacheName);

        request.onsuccess = resolve;
        request.onerror = resolve;
        request.onblocked = resolve;
      });
    }));
  }

  function getRetiredCacheNames() {
    var scope = self.registration && self.registration.scope ?
      self.registration.scope : new URL('./', self.location).href;
    var defaultCacheName = '$$$toolbox-cache$$$' + scope + '$$$';

    return retiredCacheNames.concat([
      defaultCacheName,
      defaultCacheName + '$$$inactive$$$'
    ]);
  }

  self.addEventListener('fetch', function (event) {
    var operation = routeRequest(event.request);

    if (operation) {
      event.respondWith(operation.then(function (result) {
        return result.response;
      }));
      event.waitUntil(operation.then(function (result) {
        return result.cacheOperation;
      }, function () {
        return self.Promise.resolve();
      }));
    }
  });

  self.addEventListener('install', function (event) {
    event.waitUntil(self.skipWaiting());
  });

  self.addEventListener('activate', function (event) {
    var cachesToDelete = getRetiredCacheNames();

    event.waitUntil(self.Promise.all([
      self.clients.claim(),
      caches.keys().then(function (cacheNames) {
        return self.Promise.all(cacheNames.map(function (cacheName) {
          if (cachesToDelete.indexOf(cacheName) !== -1) {
            return caches.delete(cacheName);
          }
          return self.Promise.resolve(false);
        }));
      }),
      deleteRetiredMetadataDatabases()
    ]));
  });
})();
