/* eslint-disable no-undef */
function normalizeVOIDVersion(version) {
    var value = String(version).replace(/^v/i, '');
    var legacy = value.match(/^(\d+)\.(\d)(\d)$/);

    if (legacy) {
        return [Number(legacy[1]), Number(legacy[2]), Number(legacy[3])];
    }

    return value.split('.').map(function (part) {
        var number = parseInt(part, 10);
        return isNaN(number) ? 0 : number;
    });
}

function compareVOIDVersions(left, right) {
    var leftParts = normalizeVOIDVersion(left);
    var rightParts = normalizeVOIDVersion(right);
    var length = Math.max(leftParts.length, rightParts.length);
    var index;

    for (index = 0; index < length; index++) {
        var leftPart = leftParts[index] || 0;
        var rightPart = rightParts[index] || 0;

        if (leftPart !== rightPart) {
            return leftPart > rightPart ? 1 : -1;
        }
    }

    return 0;
}

function clearVOIDUpdateMessage(container) {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
}

function appendVOIDUpdateLink(container, label, value, openInNewTab) {
    var link = document.createElement('a');
    link.href = String(value);
    if (link.protocol !== 'https:' && link.protocol !== 'http:') {
        container.appendChild(document.createTextNode(label));
        return;
    }

    if (openInNewTab) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
    }
    link.textContent = label;
    container.appendChild(link);
}

function showVOIDUpdateFailure(container) {
    clearVOIDUpdateMessage(container);
    container.appendChild(document.createTextNode('检查更新失败，'));
    appendVOIDUpdateLink(container, '前往 GitHub 查看最新版本', 'https://github.com/mikusaa/Typecho-Theme-VOID/releases', true);
    container.appendChild(document.createTextNode('。'));
}

function parseVOIDRelease(ajax) {
    if (ajax.status != 200) {
        return null;
    }

    try {
        var release = JSON.parse(ajax.responseText);
        return release && release.tag_name ? release : null;
    } catch (error) {
        return null;
    }
}

if (document.getElementById('void-check-update')) {
    var container = document.getElementById('void-check-update');
    var ajax = new XMLHttpRequest();
    ajax.open('get', 'https://api.github.com/repos/mikusaa/Typecho-Theme-VOID/releases/latest');
    ajax.send();
    ajax.onreadystatechange = function () {
        if (ajax.readyState != 4) {
            return;
        }

        var obj = parseVOIDRelease(ajax);
        if (!obj) {
            showVOIDUpdateFailure(container);
            return;
        }

        var newest = obj.tag_name;
        var asset = Array.isArray(obj.assets) && obj.assets.length > 0 ? obj.assets[0] : null;
        // Release 没有附件时退回到 Release 页面。
        var downloadUrl = asset && asset.browser_download_url ? asset.browser_download_url : obj.html_url;
        clearVOIDUpdateMessage(container);
        if (compareVOIDVersions(newest, VOIDVersion) > 0) {
            container.appendChild(document.createTextNode('发现新主题版本：' + String(obj.name) + '。下载地址：'));
            appendVOIDUpdateLink(container, '点击下载', downloadUrl);
            container.appendChild(document.createElement('br'));
            container.appendChild(document.createTextNode('您目前的版本：VOID ' + String(VOIDVersion) + '。'));
            appendVOIDUpdateLink(container, '👉查看新版亮点', obj.html_url, true);
        } else {
            container.textContent = '您目前使用的是最新版主题。';
        }
    };
}
