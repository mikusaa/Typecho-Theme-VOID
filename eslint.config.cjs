const js = require('@eslint/js');
const globals = require('globals');

const firstPartyBrowserFiles = [
    'assets/VOID.js',
    'assets/VOIDCacheRule.js',
    'assets/check_update.js',
    'assets/editor.js',
    'assets/header.js',
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
        files: ['eslint.config.cjs', 'gulpfile.js'],
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
