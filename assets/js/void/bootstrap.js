function VOID_onReady(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
        callback();
    }
}

function updateVoidRuntime() {
    var uptime = document.getElementById('uptime');
    if (!uptime) {
        return;
    }

    var times = new Date().getTime() - Date.parse(VOIDConfig.buildTime);
    times = Math.floor(times / 1000); // convert total milliseconds into total seconds
    var days = Math.floor(times / (60 * 60 * 24)); //separate days
    times %= 60 * 60 * 24; //subtract entire days
    var hours = Math.floor(times / (60 * 60)); //separate hours
    times %= 60 * 60; //subtract entire hours
    var minutes = Math.floor(times / 60); //separate minutes
    times %= 60; //subtract entire minutes
    var seconds = Math.floor(times / 1); // remainder is seconds
    uptime.textContent = days + ' 天 ' + hours + ' 小时 ' + minutes + ' 分 ' + seconds + ' 秒 ';
}

// 复制到剪贴板（带 fallback）
function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }
    // fallback for non-HTTPS or older browsers
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(textarea);
    // 兼容早期 iOS
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    try {
        var success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success ? Promise.resolve() : Promise.reject(new Error('Copy failed'));
    } catch (e) {
        document.body.removeChild(textarea);
        return Promise.reject(e);
    }
}

function createClipboardButton() {
    var namespace = 'http://www.w3.org/2000/svg';
    var button = document.createElement('div');
    var icon = document.createElementNS(namespace, 'svg');
    var path = document.createElementNS(namespace, 'path');

    button.className = 'clipboard';
    button.setAttribute('title', '复制代码');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('role', 'img');
    icon.setAttribute('class', 'clipboard-icon');
    icon.setAttribute('viewBox', '0 0 16 16');
    icon.setAttribute('width', '16');
    icon.setAttribute('height', '16');
    icon.setAttribute('fill', 'currentColor');
    icon.setAttribute('style', 'display: inline-block; user-select: none; vertical-align: text-bottom;');
    path.setAttribute('fill-rule', 'evenodd');
    path.setAttribute('d', 'M5.75 1a.75.75 0 00-.75.75v3c0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75v-3a.75.75 0 00-.75-.75h-4.5zm.75 3V2.5h3V4h-3zm-2.874-.467a.75.75 0 00-.752-1.298A1.75 1.75 0 002 3.75v9.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0014 13.25v-9.5a1.75 1.75 0 00-.874-1.515.75.75 0 10-.752 1.298.25.25 0 01.126.217v9.5a.25.25 0 01-.25.25h-8.5a.25.25 0 01-.25-.25v-9.5a.25.25 0 01.126-.217z');
    icon.appendChild(path);
    button.appendChild(icon);
    return button;
}

function loadClipboard() {
    var blocks = document.querySelectorAll('pre');
    for (var index = 0; index < blocks.length; index++) {
        if (!blocks[index].querySelector('.clipboard')) {
            blocks[index].insertBefore(createClipboardButton(), blocks[index].firstChild);
        }
    }
}

var clipboardClickBound = false;

function bindClipboard() {
    if (clipboardClickBound || !document.body) {
        return;
    }

    clipboardClickBound = true;
    document.body.addEventListener('click', function (event) {
        var target = event.target;
        var button = target && typeof target.closest === 'function'
            ? target.closest('.clipboard') : null;
        if (!button || !document.body.contains(button)) {
            return;
        }

        var block = button.closest('pre');
        if (!block) {
            return;
        }
        var codeNode = block.querySelector('code');
        var code = codeNode && codeNode.textContent ? codeNode.textContent : block.textContent;
        copyToClipboard(code).then(function () {
            VOID.alert('复制成功');
        }).catch(function () {
            VOID.alert('复制失败');
        });
    });
}

(function () {
    VOID_onReady(function () {
        if (VOIDConfig.PJAX) {
            VOID.bindPjaxLifecycle();
        }
        VOID.init();
        loadClipboard();
        bindClipboard();
    });

    window.setInterval(updateVoidRuntime, 1000);
})();
