$(function () {
    initEditorToolbar();

    if (window.VOID_BannerMeta && typeof window.VOID_BannerMeta.init === 'function') {
        window.VOID_BannerMeta.init();
    }

    if (window.VOID_Editor_Admin && typeof window.VOID_Editor_Admin.init === 'function') {
        window.VOID_Editor_Admin.init();
    }
});
