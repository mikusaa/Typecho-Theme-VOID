<?php
/**
 * footer.php
 *
 * 底栏
 *
 * @author      熊猫小A
 * @version     2019-01-15 0.1
 */
if (!defined('__TYPECHO_ROOT_DIR__')) exit;
$setting = $GLOBALS['VOIDSetting'];
?>
        <footer>
            <div class="container wide">
                <section>
                    <p>© <?php echo date('Y '); ?> <span class="brand"><?php echo Utils::escapeHtml(Utils::decodeHtmlText($this->options->title)); ?></span></p>
                    <p>感谢陪伴：<span id="uptime"></span></p>
                </section>
                <section>
                    <p>Powered by <a href="http://typecho.org/">Typecho</a> • <a href="https://blog.imalan.cn/archives/247/">Theme VOID</a></p>
                    <p><?php echo $setting['footer']; ?></p>
                </section>
            </div>
        </footer>

        <!--侧边控制按钮-->
        <aside id="ctrler-panel">
            <div class="ctrler-item" id="go-top">
                <a target="_self" aria-label="返回顶部" href="javascript:void(0);" style="transform: translateX(-2px);" onclick="VOID_SmoothScroller.scrollTo(0);"><i class="voidicon-up"></i></a>
            </div>

            <?php if($this->user->hasLogin()): ?>
                <div class="ctrler-item hidden-xs">
                    <a target="_blank" aria-label="进入后台" href="<?php $this->options->adminUrl(); ?>" style="transform: translateX(-2px);"><i class="voidicon-login"></i></a>
                </div>
                <div class="ctrler-item hidden-xs">
                    <a target="_blank" aria-label="管理评论" href="<?php $this->options->adminUrl('manage-comments.php'); ?>" style="transform: translateX(-2px);"><i class="voidicon-comment"></i></a>
                </div>
            <?php endif; ?>

            <div aria-label="展开或关闭设置面板" id="toggle-setting-pc" class="ctrler-item hidden-xs">
                <a target="_self" href="javascript:void(0);" style="transform: translateX(-2px);" onclick="VOID_Ui.toggleSettingPanel();"><i class="voidicon-cog"></i></a>
            </div>
            <div aria-label="展开或关闭文章目录" class="ctrler-item" id="toggle-toc">
                <a target="_self" href="javascript:void(0);" style="margin-left: -2px" onclick="TOC.toggle()"><i class="voidicon-left"></i></a>
            </div>
        </aside>

        <!--站点设置面板-->
        <aside hidden id="setting-panel">
            <section>
                <div id="toggle-night">
                    <button type="button" data-theme-state="auto" aria-label="跟随主题设置；切换至日间模式" title="跟随主题设置；切换至日间模式" onclick="VOID_Ui.DarkModeSwitcher.toggleByHand();"><i aria-hidden="true"></i></button>
                </div>
                <div id="adjust-text-container">
                    <div class="adjust-text-item">
                        <a target="_self" href="javascript:void(0)" onclick="VOID_Ui.adjustTextsize(false);"><i class="voidicon-font"></i>-</a>
                        <span id="current_textsize"></span>
                        <a target="_self" href="javascript:void(0)" onclick="VOID_Ui.adjustTextsize(true);"><i class="voidicon-font"></i>+</a>
                    </div>
                    <div class="adjust-text-item">
                        <a target="_self" class="font-indicator <?php if(!Utils::isSerif($setting)) echo ' checked'; ?>" href="javascript:void(0)" onclick="VOID_Ui.toggleSerif(this, false);">Sans</a>
                        <a target="_self" class="font-indicator <?php if(Utils::isSerif($setting)) echo ' checked'; ?>" href="javascript:void(0)" onclick="VOID_Ui.toggleSerif(this, true);">Serif</a>
                    </div>
                </div>
            </section>
            <section id="links">
                <?php if(!$this->user->hasLogin()): ?>
                    <a target="_self" class="link" href="javascript:void(0)" onclick="VOID_Ui.toggleLoginForm()"><i class="voidicon-user"></i></a>       
                <?php endif; ?>
                <a class="link" title="RSS" target="_blank" href="<?php $this->options->feedUrl(); ?>"><i class="voidicon-rss"></i></a>
                <?php
                    foreach ($setting['link'] as $link) {
                        $name = Utils::escapeHtml($link['name']);
                        $target = Utils::escapeHtml($link['target']);
                        $href = Utils::escapeHtml($link['href']);
                        $icon = Utils::escapeHtml($link['icon']);
                        echo "<a class=\"link\" title=\"{$name}\" target=\"{$target}\" href=\"{$href}\"><i class=\"voidicon-{$icon}\"></i></a>";
                    }
                ?>
            </section>
            <section id="login-panel" <?php if($this->user->hasLogin()) echo 'class="force-show"'; ?>>
                <?php if(!$this->user->hasLogin()): ?>
                    <?php $loginAction = Utils::decodeHtmlEntities(Utils::captureOutput($this->options, 'loginAction')); ?>
                    <form action="<?php echo Utils::escapeHtml($loginAction); ?>" id="loggin-form" method="post" name="login" role="form">
                        <div id="loggin-inputs">
                            <input type="text" name="name" autocomplete="username" placeholder="请输入用户名" required/>
                            <input type="password" name="password" autocomplete="current-password" placeholder="请输入密码" required/>
                            <input type="hidden" name="referer" value="<?php 
                                if($this->have() && ($this->is('post') || $this->is('page'))) {
                                    $referer = Utils::decodeHtmlEntities(Utils::captureOutput($this, 'permalink'));
                                    echo Utils::escapeHtml($referer);
                                } else {
                                    $referer = rtrim($this->options->rootUrl, '/') . '/'
                                        . ltrim($this->request->getRequestUri(), '/');
                                    echo htmlspecialchars($referer, ENT_QUOTES, 'UTF-8');
                                }
                            ?>">
                        </div>
                        <div class="buttons" id="loggin-buttons">
                            <button class="btn btn-normal" type="button" onclick="$('#login-panel').removeClass('show');$('#setting-panel').removeClass('show')">关闭</button>
                            <button class="btn btn-normal" type="submit" onclick="VOID_Ui.rememberPos()">登录</button>
                            <span hidden id="wait" class="btn btn-normal">请稍等……</span>
                        </div>
                    </form>
                <?php else: ?>
                    <div class="buttons" id="manage-buttons">
                        <a class="btn btn-normal" no-pjax target="_blank" href="<?php $this->options->adminUrl(); ?>">后台</a>
                        <a class="btn btn-normal" no-pjax title="登出" onclick="VOID_Ui.rememberPos()" href="<?php $this->options->logoutUrl(); ?>">登出</a>
                    </div>
                <?php endif; ?> 
            </section> 
        </aside>

        <?php
            $serviceWorkerSetting = isset($setting['serviceworker']) && is_string($setting['serviceworker'])
                ? $setting['serviceworker']
                : '';
            $serviceWorkerUri = empty($serviceWorkerSetting)
                ? null
                : '/' . ltrim($serviceWorkerSetting, '/');
        ?>
        <script>
        (function() {
            var configuredUri = <?php echo Utils::encodeJsonForHtml($serviceWorkerUri); ?>;
            var ownershipKey = 'VOIDServiceWorkerOwnership';

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
        </script>
        <script data-manual src="<?php Utils::indexTheme('/assets/bundle-24ecfd191f.js'); ?>"></script>
        <?php if($setting['enableMath']): ?>
        <script>
            window.MathJax = {
                startup: {
                    typeset: false
                },
                tex: {
                    inlineMath: [['$', '$'], ['\\(', '\\)']],
                    displayMath: [['$$', '$$'], ['\\[', '\\]']],
                    processEscapes: true
                },
                svg: {
                    fontCache: 'global'
                }
            };
        </script>
        <script id="MathJax-script" src='<?php Utils::indexTheme('/assets/libs/mathjax/4.1.3/tex-svg.js'); ?>'></script>
        <?php endif; ?>
        <script src="<?php Utils::indexTheme('/assets/VOID-8a29d5c843.js'); ?>"></script>
        <?php if($setting['pjax']): ?>
        <script>
            $(document).on('pjax:complete', function(event, xhr, status, options){
                options = VOID.resolvePjaxOptions(arguments);
                if (!VOID.isMainPjaxRequest(options)) {
                    return;
                }
                <?php echo $setting['pjaxreload']; ?>
            })
            <?php if(Utils::isPluginAvailable('ExSearch')): ?>
            function ExSearchCall(item){
                if (item && item.length) {
                    $('.ins-close').click(); // 关闭搜索框
                    let url = item.attr('data-url'); // 获取目标页面 URL
                    if (window.VoidPjax && typeof window.VoidPjax.visit === 'function') {
                        window.VoidPjax.visit({
                            url: url,
                            container: '#pjax-container',
                            fragment: '#pjax-container',
                            timeout: 8000
                        }); // 发起一次 PJAX 请求
                    } else {
                        window.open(url, '_self');
                    }
                }
            }
            <?php endif; ?>
        </script>
        <?php endif; ?>
        <?php $this->footer(); ?>
    </body>
</html>
