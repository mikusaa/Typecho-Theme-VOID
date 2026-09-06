VOID_CardCover = {
    marker: 'data-void-card-cover',
    bound: false,
    nextToken: 0,

    isCover: function (image) {
        return image
            && image.hasAttribute
            && image.hasAttribute(VOID_CardCover.marker);
    },

    canWrite: function (image, token) {
        return VOID_CardCover.isCover(image)
            && image.isConnected !== false
            && image.__voidCardCoverToken === token;
    },

    reducedMotion: function () {
        return window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    fail: function (image) {
        var token;

        if (!VOID_CardCover.isCover(image) || image.isConnected === false) {
            return;
        }

        token = ++VOID_CardCover.nextToken;
        image.__voidCardCoverToken = token;
        image.__voidCardCoverPending = false;
        image.classList.remove('loaded');
        image.classList.add('error');
    },

    reveal: function (image, token) {
        var finish = function () {
            if (!VOID_CardCover.canWrite(image, token)) {
                return;
            }
            image.__voidCardCoverPending = false;
            image.classList.add('loaded');
        };

        if (!VOID_CardCover.canWrite(image, token)) {
            return;
        }

        if (VOID_CardCover.reducedMotion() || typeof window.requestAnimationFrame !== 'function') {
            finish();
            return;
        }

        window.requestAnimationFrame(function () {
            if (!VOID_CardCover.canWrite(image, token)) {
                return;
            }
            window.requestAnimationFrame(finish);
        });
    },

    decode: function (image) {
        var decodeResult;
        var token;
        var settle;

        if (!VOID_CardCover.isCover(image)
            || image.isConnected === false
            || image.classList.contains('loaded')
            || image.classList.contains('error')
            || image.__voidCardCoverPending) {
            return;
        }

        if (!(image.naturalWidth > 0)) {
            VOID_CardCover.fail(image);
            return;
        }

        token = ++VOID_CardCover.nextToken;
        image.__voidCardCoverToken = token;
        image.__voidCardCoverPending = true;
        settle = function () {
            if (!VOID_CardCover.canWrite(image, token)) {
                return;
            }
            if (image.naturalWidth > 0) {
                VOID_CardCover.reveal(image, token);
            } else {
                VOID_CardCover.fail(image);
            }
        };

        if (typeof image.decode !== 'function') {
            settle();
            return;
        }

        try {
            decodeResult = image.decode();
        } catch (err) {
            settle(err);
            return;
        }

        if (decodeResult && typeof decodeResult.then === 'function') {
            decodeResult.then(settle, settle);
        } else {
            settle();
        }
    },

    handleLoad: function (event) {
        if (VOID_CardCover.isCover(event.target)) {
            VOID_CardCover.decode(event.target);
        }
    },

    handleError: function (event) {
        if (VOID_CardCover.isCover(event.target)) {
            VOID_CardCover.fail(event.target);
        }
    },

    bind: function () {
        if (VOID_CardCover.bound
            || !document.addEventListener
            || !document.documentElement
            || !document.documentElement.classList) {
            return;
        }

        document.addEventListener('load', VOID_CardCover.handleLoad, true);
        document.addEventListener('error', VOID_CardCover.handleError, true);
        VOID_CardCover.bound = true;
        document.documentElement.classList.add('void-card-cover-transition');
    },

    init: function (root) {
        var images;
        var i;

        if (!root || !root.querySelectorAll) {
            return;
        }

        images = root.querySelectorAll('img[' + VOID_CardCover.marker + ']');
        for (i = 0; i < images.length; i++) {
            if (!images[i].complete) {
                continue;
            }
            if (images[i].naturalWidth > 0) {
                VOID_CardCover.decode(images[i]);
            } else {
                VOID_CardCover.fail(images[i]);
            }
        }
    }
};
