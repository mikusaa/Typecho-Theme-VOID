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

if (document.getElementById('void-check-update')) {
    var container = document.getElementById('void-check-update');
    var ajax = new XMLHttpRequest();
    ajax.open('get', 'https://api.github.com/repos/mikusaa/Typecho-Theme-VOID/releases/latest');
    ajax.send();
    ajax.onreadystatechange = function () {
        if (ajax.readyState == 4 && ajax.status == 200) {
            var obj = JSON.parse(ajax.responseText);
            var newest = obj.tag_name;
            if (compareVOIDVersions(newest, VOIDVersion) > 0) {
                container.innerHTML =
                    '发现新主题版本：' + obj.name +
                    '。下载地址：<a href="' + obj.assets[0].browser_download_url + '">点击下载</a>' +
                    '<br>您目前的版本：VOID ' + String(VOIDVersion) + '。' + 
                    '<a target="_blank" href="' + obj.html_url + '">👉查看新版亮点</a>';
            } else {
                container.innerHTML = '您目前使用的是最新版主题。';
            }
        }
    };
}
