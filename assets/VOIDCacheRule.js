/* eslint-disable indent */
'use strict';

(function () {
  'use strict';
  /**
  * Service Worker Toolbox caching
  */

  var cacheVersion = '-toolbox-v5';
  var staticVendorCacheName = 'static-vendor' + cacheVersion;
  var staticAssetsCacheName = 'static-assets' + cacheVersion;
  var emoteStaticCacheName = 'emote-static' + cacheVersion;
  var emoteAnimatedCacheName = 'emote-animated' + cacheVersion;
  var staticMaxEntries = 200;
  var emoteStaticMaxEntries = 140;
  var emoteAnimatedMaxEntries = 48;
  var emoteAnimatedLruQueue = self.Promise.resolve();
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
    'emote-animated-toolbox-v4'
  ];


  self.importScripts('usr/themes/VOID/assets/sw-toolbox.js');

  self.toolbox.options.debug = false;

  function queueAnimatedCacheMutation(callback) {
    var operation = emoteAnimatedLruQueue.then(callback, callback);

    emoteAnimatedLruQueue = operation.catch(function () {
      // Keep later cache mutations running if one Cache API operation fails.
    });
    return operation;
  }

  function trimAnimatedCache(cache, maximumEntries) {
    return cache.keys().then(function (requests) {
      var overflow = requests.length - maximumEntries;

      if (overflow <= 0) {
        return self.Promise.resolve();
      }
      return self.Promise.all(requests.slice(0, overflow).map(function (request) {
        return cache.delete(request);
      }));
    });
  }

  function storeAnimatedResponse(cache, request, response) {
    // Cache.keys() is insertion ordered. Delete before put moves a hit to MRU.
    return cache.delete(request).then(function () {
      // Make room first so the cache never temporarily contains entry 49.
      return trimAnimatedCache(cache, emoteAnimatedMaxEntries - 1);
    }).then(function () {
      return cache.put(request, response.clone());
    });
  }

  function isSuccessfulResponse(response) {
    return response.status === 0 || (response.status >= 200 && response.status < 300);
  }

  function animatedCacheFirst(request) {
    return caches.open(emoteAnimatedCacheName).then(function (cache) {
      return cache.match(request).then(function (cachedResponse) {
        if (cachedResponse) {
          return queueAnimatedCacheMutation(function () {
            return storeAnimatedResponse(cache, request, cachedResponse);
          }).then(function () {
            return cachedResponse;
          }, function () {
            return cachedResponse;
          });
        }

        return fetch(request.clone()).then(function (networkResponse) {
          if (!isSuccessfulResponse(networkResponse)) {
            return networkResponse;
          }
          return queueAnimatedCacheMutation(function () {
            return storeAnimatedResponse(cache, request, networkResponse);
          }).then(function () {
            return networkResponse;
          }, function () {
            return networkResponse;
          });
        });
      });
    });
  }

  // Bangumi 动画单独维护 LRU，必须先于通用 /usr 路由注册
  self.toolbox.router.get('/usr/themes/VOID/assets/libs/emotes/bangumi/animated/(.*)', animatedCacheFirst);

  // 索引和 manifest 优先联网，避免分组或文案更新后长期命中旧清单
  self.toolbox.router.get('/usr/themes/VOID/assets/libs/emotes/packs.json', self.toolbox.networkFirst, {
    cache: {
      name: emoteStaticCacheName,
      maxEntries: emoteStaticMaxEntries
    }
  });
  self.toolbox.router.get('/usr/themes/VOID/assets/libs/emotes/packs/(.*)', self.toolbox.networkFirst, {
    cache: {
      name: emoteStaticCacheName,
      maxEntries: emoteStaticMaxEntries
    }
  });
  self.toolbox.router.get('/usr/themes/VOID/assets/libs/emotes/bangumi/poster/(.*)', self.toolbox.cacheFirst, {
    cache: {
      name: emoteStaticCacheName,
      maxEntries: emoteStaticMaxEntries
    }
  });

  // 缓存本站静态文件
  self.toolbox.router.get('/usr/(.*)', self.toolbox.cacheFirst, {
    cache: {
      name: staticAssetsCacheName,
      maxEntries: staticMaxEntries
    }
  });

  // 缓存 Gravatar 头像
  self.toolbox.router.get('/avatar/(.*)', self.toolbox.cacheFirst, {
    origin: /(secure\.gravatar\.com)/,
    cache: {
      name: staticVendorCacheName,
      maxEntries: staticMaxEntries
    }
  });

  // 缓存 Google 字体
  self.toolbox.router.get('/(.*)', self.toolbox.cacheFirst, {
    origin: /(fonts\.googleapis\.com)/,
    cache: {
      name: staticVendorCacheName,
      maxEntries: staticMaxEntries
    }
  });
  self.toolbox.router.get('/(.*)', self.toolbox.cacheFirst, {
    origin: /(fonts\.gstatic\.com)/,
    cache: {
      name: staticVendorCacheName,
      maxEntries: staticMaxEntries
    }
  });

  // immediately activate this serviceworker
  self.addEventListener('install', function (event) {
    return event.waitUntil(self.skipWaiting());
  });

  self.addEventListener('activate', function (event) {
    return event.waitUntil(self.Promise.all([
      self.clients.claim(),
      caches.keys().then(function (cacheNames) {
        return self.Promise.all(cacheNames.map(function (cacheName) {
          if (retiredCacheNames.indexOf(cacheName) !== -1) {
            return caches.delete(cacheName);
          }
          return self.Promise.resolve(false);
        }));
      })
    ]));
  });

})();
