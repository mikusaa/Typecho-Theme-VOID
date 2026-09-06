const js = require('@eslint/js');
const globals = require('globals');
const headerJsSources = require('./scripts/header-sources.cjs');

const firstPartyBrowserFiles = [
    ...headerJsSources,
    'assets/js/void/**/*.js',
    'assets/VOIDCacheRule.js',
    'assets/service-worker-registration.js',
    'assets/check_update.js',
    'assets/editor.js',
    'assets/libs/emotes/emote-picker.js',
    'assets/libs/pjax/void-pjax.js'
];

const sharedRules = {
    indent: ['error', 4, { SwitchCase: 1 }],
    'linebreak-style': 'off',
    quotes: ['error', 'single', { avoidEscape: true }],
    semi: ['error', 'always']
};

module.exports = [
    {
        ignores: [
            'build/**',
            'temp/**',
            'node_modules/**',
            'assets/bundle*.js',
            'assets/libs/header/**',
            'assets/libs/headroom/**',
            'assets/libs/hyphen/**',
            'assets/libs/littlefoot/**',
            'assets/libs/mathjax/**',
            'assets/libs/owo/**',
            'assets/libs/pangu/**',
            'assets/libs/pjax/np.js',
            'assets/libs/prism/**',
            'assets/libs/tocbot/**'
        ]
    },
    js.configs.recommended,
    {
        files: ['eslint.config.cjs', 'gulpfile.js', 'scripts/**/*.cjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: {
                ...globals.node
            }
        },
        rules: sharedRules
    },
    {
        files: ['scripts/**/*.mjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node
            }
        },
        rules: sharedRules
    },
    {
        files: firstPartyBrowserFiles,
        languageOptions: {
            ecmaVersion: 5,
            sourceType: 'script',
            globals: {
                ...globals.browser,
                ...globals.jquery,
                ...globals.serviceworker
            }
        },
        rules: sharedRules
    },
    {
        files: headerJsSources,
        languageOptions: {
            globals: {
                Headroom: 'readonly',
                Masonry: 'readonly',
                TOC: 'writable',
                VOID: 'readonly',
                VOIDConfig: 'readonly',
                VOID_AnchorScroller: 'writable',
                VOID_CardCover: 'writable',
                VOID_ControllerPanel: 'writable',
                VOID_GalleryLazyload: 'writable',
                VOID_SmoothScroller: 'writable',
                VOID_Ui: 'writable',
                VOID_Util: 'writable',
                tocbot: 'readonly'
            }
        },
        rules: {
            ...sharedRules,
            'no-redeclare': ['error', { builtinGlobals: false }],
            'no-unused-vars': ['error', { caughtErrors: 'none' }]
        }
    },
    {
        files: ['assets/js/void/**/*.js'],
        languageOptions: {
            globals: {
                AjaxComment: 'writable',
                NProgress: 'readonly',
                PhotoSwipe: 'readonly',
                PhotoSwipeLightbox: 'readonly',
                Prism: 'readonly',
                Promise: 'readonly',
                Share: 'writable',
                TOC: 'writable',
                VOID: 'writable',
                VOID_AnchorScroller: 'readonly',
                VOID_CardCover: 'readonly',
                VOIDConfig: 'readonly',
                VOID_Content: 'writable',
                VOID_ControllerPanel: 'readonly',
                VOID_DialogScrollLock: 'writable',
                VOID_Gallery: 'writable',
                VOID_GalleryLazyload: 'readonly',
                VOID_PhotoSets: 'writable',
                VOID_PhotoSwipe: 'writable',
                VOID_RewardDialog: 'writable',
                VOID_Ui: 'readonly',
                VOID_Util: 'readonly',
                VOID_Vote: 'writable',
                WeakSet: 'readonly',
                littlefoot: 'readonly',
                loadClipboard: 'readonly',
                pangu: 'readonly',
                tocbot: 'readonly'
            }
        },
        rules: {
            ...sharedRules,
            'no-redeclare': ['error', { builtinGlobals: false }],
            'no-unused-vars': ['error', {
                caughtErrors: 'none',
                varsIgnorePattern: '^(VOID_DialogScrollLock|VOID_RewardDialog)$'
            }]
        }
    },
    {
        files: ['assets/service-worker-registration.js'],
        languageOptions: {
            globals: {
                Promise: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': ['error', { caughtErrors: 'none' }]
        }
    },
    {
        files: ['assets/libs/emotes/emote-picker.js'],
        languageOptions: {
            ecmaVersion: 5,
            sourceType: 'script',
            globals: {
                ...globals.browser
            }
        },
        rules: sharedRules
    },
    {
        files: ['assets/libs/pjax/void-pjax.js'],
        rules: {
            'no-unused-vars': ['error', { caughtErrors: 'none' }]
        }
    }
];
