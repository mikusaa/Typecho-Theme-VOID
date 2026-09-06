var VOID_BannerMeta = (function ($) {
    var MAX_DIMENSION = 100000;
    var PROBE_DELAY = 300;
    var instance = null;

    function normalizeSource(value) {
        return String(value == null ? '' : value).trim();
    }

    function parseDimension(value) {
        var text = String(value == null ? '' : value);
        var number;

        if (!/^[1-9][0-9]*$/.test(text)) {
            return null;
        }

        number = Number(text);
        return number >= 1 && number <= MAX_DIMENSION && Math.floor(number) === number
            ? number
            : null;
    }

    function parseMeta(value, source) {
        var meta;
        var width;
        var height;

        try {
            meta = JSON.parse(String(value || ''));
        } catch (error) {
            return null;
        }

        if (!meta || meta.version !== 1 || typeof meta.source !== 'string'
            || meta.source !== normalizeSource(source)) {
            return null;
        }

        width = typeof meta.width === 'number' ? parseDimension(meta.width) : null;
        height = typeof meta.height === 'number' ? parseDimension(meta.height) : null;
        return width && height ? [width, height] : null;
    }

    function serializeMeta(source, width, height) {
        return JSON.stringify({
            version: 1,
            source: normalizeSource(source),
            width: width,
            height: height
        });
    }

    function init() {
        var $banner = $('[name="fields[banner]"], [name="banner"]').first();
        var $meta = $('[name="fields[bannerMeta]"], [name="bannerMeta"]').first();
        var probeTimer = null;
        var probeImage = null;
        var probeToken = 0;
        var controller;

        if (instance || !$banner.length || !$meta.length) {
            return instance;
        }

        function setMeta(source, width, height) {
            var normalizedSource = normalizeSource(source);
            var serialized;

            if (!normalizedSource || normalizeSource($banner.val()) !== normalizedSource
                || !parseDimension(width) || !parseDimension(height)) {
                return false;
            }

            serialized = serializeMeta(normalizedSource, Number(width), Number(height));
            if ($meta.val() === serialized) {
                return false;
            }

            $meta.val(serialized).trigger('input').trigger('change');
            return true;
        }

        function clearMeta() {
            if ($meta.val() === '') {
                return false;
            }

            $meta.val('').trigger('input').trigger('change');
            return true;
        }

        function clearStaleMeta() {
            var source = normalizeSource($banner.val());

            if ($meta.val() !== '' && (!source || !parseMeta($meta.val(), source))) {
                clearMeta();
            }
        }

        function cancelProbe() {
            probeToken++;
            if (probeTimer !== null) {
                window.clearTimeout(probeTimer);
                probeTimer = null;
            }
            if (probeImage) {
                probeImage.onload = null;
                probeImage.onerror = null;
                probeImage = null;
            }
        }

        function startProbe(source, token) {
            var image;

            probeTimer = null;
            if (token !== probeToken || normalizeSource($banner.val()) !== source) {
                return;
            }

            image = new window.Image();
            probeImage = image;

            function finish(succeeded) {
                if (token !== probeToken || probeImage !== image) {
                    return;
                }

                probeImage = null;
                image.onload = null;
                image.onerror = null;
                if (succeeded) {
                    setMeta(source, image.naturalWidth, image.naturalHeight);
                }
            }

            image.onload = function () {
                finish(true);
            };
            image.onerror = function () {
                finish(false);
            };
            image.src = source;

            if (image.complete) {
                finish(image.naturalWidth > 0 && image.naturalHeight > 0);
            }
        }

        function scheduleProbe() {
            var source;
            var token;

            cancelProbe();
            clearStaleMeta();
            source = normalizeSource($banner.val());
            if (!source || parseMeta($meta.val(), source) || typeof window.Image !== 'function') {
                return false;
            }

            token = probeToken;
            probeTimer = window.setTimeout(function () {
                startProbe(source, token);
            }, PROBE_DELAY);
            return true;
        }

        controller = {
            destroy: function () {
                if (instance !== controller) {
                    return;
                }

                cancelProbe();
                $banner.off('.voidBannerMeta');
                instance = null;
            }
        };

        instance = controller;
        $banner.on('input.voidBannerMeta change.voidBannerMeta', scheduleProbe);
        scheduleProbe();
        return controller;
    }

    return {
        __test: {
            parseMeta: parseMeta,
            serializeMeta: serializeMeta
        },
        init: init
    };
})(window.jQuery);
