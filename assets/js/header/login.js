VOID_Ui.toggleLoginForm = function () {
    var form = document.getElementById('loggin-form');
    var loginPanel = document.getElementById('login-panel');
    var referer;

    if (!loginPanel) return;
    loginPanel.classList.toggle('show');
    referer = loginPanel.querySelector('input[name=referer]');
    if (referer) referer.value = window.location.href;

    if (form && form.classList.contains('need-refresh')
        && loginPanel.classList.contains('show')) {
        VOID_Ui.refreshLoginAction(form);
    }
};

VOID_Ui.refreshLoginAction = function (form) {
    var controller = typeof window.AbortController === 'function'
        ? new window.AbortController()
        : null;
    var generation;
    var options;
    var requestUrl;

    if (!form || VOID_Ui.loginActionRequest) return VOID_Ui.loginActionRequest;
    if (typeof window.fetch !== 'function') {
        VOID_Ui.handleLoginActionError();
        return null;
    }

    generation = ++VOID_Ui.loginActionGeneration;
    requestUrl = window.location.href;
    options = {
        body: 'void_action=getLoginAction',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest'
        },
        method: 'POST'
    };
    if (controller) options.signal = controller.signal;
    VOID_Ui.loginActionController = controller;
    // 计时覆盖请求和响应正文；超时只作废本次请求，不刷新整页，以免丢失评论草稿。
    VOID_Ui.loginActionTimer = window.setTimeout(function () {
        VOID_Ui.loginActionTimer = null;
        if (generation !== VOID_Ui.loginActionGeneration) return;
        VOID_Ui.invalidateLoginAction();
        VOID.alert('请求登录参数超时，请重新打开登录面板再试。');
    }, VOID_Ui.loginActionTimeout);
    VOID_Ui.loginActionRequest = window.fetch(requestUrl, options).then(function (response) {
        if (!response || !response.ok) {
            throw new Error('Login action request failed.');
        }
        return response.text();
    }).then(function (data) {
        if (generation !== VOID_Ui.loginActionGeneration) return;
        VOID_Ui.releaseLoginAction();
        if (form.isConnected === false || requestUrl !== window.location.href) return;
        if (typeof data === 'string' && data.trim() !== '') {
            form.setAttribute('action', data.trim());
            form.classList.remove('need-refresh');
        }
    }, function (error) {
        if (generation !== VOID_Ui.loginActionGeneration
            || (error && error.name === 'AbortError')) {
            return;
        }
        VOID_Ui.releaseLoginAction();
        VOID_Ui.handleLoginActionError();
    });
    return VOID_Ui.loginActionRequest;
};

VOID_Ui.releaseLoginAction = function () {
    if (VOID_Ui.loginActionTimer !== null) {
        window.clearTimeout(VOID_Ui.loginActionTimer);
    }
    VOID_Ui.loginActionTimer = null;
    VOID_Ui.loginActionController = null;
    VOID_Ui.loginActionRequest = null;
};

VOID_Ui.handleLoginActionError = function () {
    VOID.alert('请求登陆参数错误。请在刷新后尝试登陆。');
    window.setTimeout(function () {
        window.location.reload();
    }, 1000);
};

VOID_Ui.invalidateLoginAction = function () {
    var form = document.getElementById('loggin-form');

    VOID_Ui.loginActionGeneration += 1;
    if (VOID_Ui.loginActionController) {
        VOID_Ui.loginActionController.abort();
    }
    VOID_Ui.releaseLoginAction();
    if (form) form.classList.add('need-refresh');
};
