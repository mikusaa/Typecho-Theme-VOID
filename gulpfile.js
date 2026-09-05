var gulp = require('gulp');
var sass = require('gulp-sass')(require('sass'));
var prefix = require('gulp-autoprefixer').default;
var minify = require('gulp-clean-css');
var rev = require('gulp-rev').default;
var revCollector = require('gulp-rev-collector');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var del = require('del');
var path = require('path');
var Transform = require('stream').Transform;
var finished = require('stream/promises').finished;
var voidJsSources = require('./scripts/void-sources.cjs');

var productionRoot = './build';
var developmentRoot = './dev-build';
var revisionRoot = './temp/rev';

var prefixerOptions = {
    overrideBrowserslist: ['last 2 versions']
};
var watchOptions = {
    usePolling: true,
    interval: 500
};

var dependencyCssSources = [
    './assets/libs/photoswipe/photoswipe.css',
    './assets/libs/emotes/emote-picker.css',
    './assets/libs/littlefoot/littlefoot.css',
    './assets/libs/pjax/np.css',
    './assets/libs/tocbot/tocbot.css'
];

var dependencyJsSources = [
    './assets/libs/photoswipe/photoswipe.umd.min.js',
    './assets/libs/photoswipe/photoswipe-lightbox.umd.min.js',
    './assets/libs/emotes/emote-picker.js',
    './assets/libs/headroom/headroom.min.js',
    './assets/libs/hyphen/hyphen.js',
    './assets/libs/littlefoot/littlefoot.js',
    './assets/libs/pangu/pangu.js',
    './assets/libs/pjax/np.js',
    './assets/libs/pjax/void-pjax.js',
    './assets/libs/prism/prism.js',
    './assets/libs/tocbot/tocbot.min.js'
];

var scssSources = [
    './assets/VOID.scss',
    './assets/parts/**/*.scss'
];

var standaloneJsSources = [
    './assets/editor.js',
    './assets/header.js',
    './assets/check_update.js'
];

var runtimePhpSources = [
    './*.php',
    './includes/**/*.php',
    './libs/**/*.php'
];

var runtimeLibrarySources = [
    './assets/libs/littlefoot/LICENSE',
    './assets/libs/mathjax/**/*',
    './assets/libs/octicons/LICENSE',
    './assets/libs/pangu/LICENSE',
    './assets/libs/photoswipe/LICENSE',
    './assets/libs/tocbot/LICENSE',
    './assets/libs/emotes/{quyin,bilibili,mihoyo,aru}/**/*',
    './assets/libs/emotes/packs.json',
    './assets/libs/emotes/packs/*.json',
    './assets/libs/emotes/bangumi/{poster,animated}/**/*'
];

var rootSources = [
    './LICENSE',
    './README.md',
    './screenshot.webp',
    './advanceSetting.md',
    './advanceSetting.sample.json',
    './change-log.md'
];

var legacyDevelopmentOutputs = [
    './assets/VOID.js',
    './assets/VOID.css',
    './assets/VOID.css.map',
    './assets/bundle.js',
    './assets/bundle.css',
    './assets/bundle-header.js'
];

function revisionManifestPath(name) {
    return path.join(revisionRoot, name);
}

function writeRevisioned(stream, destination, manifestDirectory) {
    return stream
        .pipe(rev())
        .pipe(gulp.dest(destination))
        .pipe(rev.manifest())
        .pipe(gulp.dest(revisionManifestPath(manifestDirectory)));
}

async function copyFontsource(outputRoot) {
    var fontsource = await import('./scripts/check-fontsource-build.mjs');

    await Promise.all(fontsource.FONTSOURCE_FAMILIES.map(function (family) {
        var packageRoot = path.resolve('./node_modules', family.packageName);
        var sourcePatterns = family.sourceFiles.map(function (relativePath) {
            return path.join(packageRoot, relativePath);
        });
        var normalizeCss = new Transform({
            objectMode: true,
            transform: function (file, encoding, callback) {
                if (path.extname(file.path) === '.css') {
                    file.contents = Buffer.from(fontsource.toWoff2OnlyCss(
                        file.contents.toString('utf8')
                    ));
                }
                callback(null, file);
            }
        });
        var destination = path.join(
            outputRoot,
            'assets/fonts/fontsource',
            family.directory,
            fontsource.FONTSOURCE_ASSET_VERSION
        );
        var stream = gulp.src(sourcePatterns, {
            base: packageRoot,
            encoding: false
        })
            .pipe(normalizeCss)
            .pipe(gulp.dest(destination));

        return finished(stream);
    }));
}

gulp.task('clean:build', function () {
    return del.deleteAsync(['build', 'temp']);
});

gulp.task('clean:dev', function () {
    return del.deleteAsync(['dev-build']);
});

gulp.task('clean:legacy', function () {
    return del.deleteAsync(legacyDevelopmentOutputs);
});

gulp.task('clean', gulp.parallel('clean:build', 'clean:dev', 'clean:legacy'));

// 依赖 CSS minify、打包，除 MathJax
gulp.task('pack:css:dep', function () {
    return writeRevisioned(
        gulp.src(dependencyCssSources)
            .pipe(concat('bundle.css'))
            .pipe(minify()),
        path.join(productionRoot, 'assets'),
        'css_bundle'
    );
});

// 主 CSS 编译、autoprefix、minify
gulp.task('pack:css:main', function () {
    return writeRevisioned(
        gulp.src('./assets/VOID.scss')
            .pipe(sass())
            .pipe(prefix(prefixerOptions))
            .pipe(minify()),
        path.join(productionRoot, 'assets'),
        'css_main'
    );
});

// 编辑器后台 CSS 处理
gulp.task('pack:css:admin', function () {
    return writeRevisioned(
        gulp.src('./assets/editor-admin.css')
            .pipe(prefix(prefixerOptions))
            .pipe(minify()),
        path.join(productionRoot, 'assets'),
        'css_admin'
    );
});

// 后台表情选择器独立加载，需要内容哈希避免 Service Worker 留住旧内核
gulp.task('pack:css:emotes', function () {
    return writeRevisioned(
        gulp.src('./assets/libs/emotes/emote-picker.css')
            .pipe(prefix(prefixerOptions))
            .pipe(minify()),
        path.join(productionRoot, 'assets/libs/emotes'),
        'css_emotes'
    );
});

// 页头依赖 JS 压缩混淆
gulp.task('pack:js:header', function () {
    return writeRevisioned(
        gulp.src('./assets/libs/header/**/*.js')
            .pipe(concat('bundle-header.js'))
            .pipe(uglify({ output: { comments: /^!/ } })),
        path.join(productionRoot, 'assets'),
        'js_bundle-header'
    );
});

// 依赖 JS 压缩混淆，除 MathJax
gulp.task('pack:js:dep', function () {
    return writeRevisioned(
        gulp.src(dependencyJsSources)
            .pipe(concat('bundle.js'))
            .pipe(uglify()),
        path.join(productionRoot, 'assets'),
        'js_bundle'
    );
});

// 后台表情选择器独立加载，需要内容哈希避免 Service Worker 留住旧内核
gulp.task('pack:js:emotes', function () {
    return writeRevisioned(
        gulp.src('./assets/libs/emotes/emote-picker.js')
            .pipe(uglify()),
        path.join(productionRoot, 'assets/libs/emotes'),
        'js_emotes'
    );
});

// VOID 前台源码按权威顺序合并、压缩混淆
gulp.task('pack:js:void', function () {
    return writeRevisioned(
        gulp.src(voidJsSources)
            .pipe(concat('VOID.js'))
            .pipe(uglify()),
        path.join(productionRoot, 'assets'),
        'js_void'
    );
});

// 其他独立 JS 压缩混淆
gulp.task('pack:js:main', function () {
    return writeRevisioned(
        gulp.src(standaloneJsSources)
            .pipe(uglify()),
        path.join(productionRoot, 'assets'),
        'js_main'
    );
});

// 静态文件加戳
gulp.task('md5', function () {
    return gulp.src(['temp/rev/**/*.json'].concat(runtimePhpSources), { base: './' })
        .pipe(revCollector())
        .pipe(gulp.dest(productionRoot));
});

// 无需处理的依赖资源
gulp.task('move:libs', function () {
    return gulp.src(runtimeLibrarySources, { base: './assets/libs/', encoding: false })
        .pipe(gulp.dest(path.join(productionRoot, 'assets/libs')));
});

gulp.task('move:assets', function () {
    return gulp.src('./assets/VOIDCacheRule.js')
        .pipe(gulp.dest(path.join(productionRoot, 'assets')));
});

gulp.task('move:fonts', function () {
    return gulp.src('./assets/fonts/*', { encoding: false })
        .pipe(gulp.dest(path.join(productionRoot, 'assets/fonts')));
});

gulp.task('move:fontsource', async function () {
    await copyFontsource(productionRoot);
});

gulp.task('move:root', function () {
    return gulp.src(rootSources, { encoding: false })
        .pipe(gulp.dest(productionRoot));
});

gulp.task('move', gulp.parallel(
    'move:libs',
    'move:assets',
    'move:fonts',
    'move:fontsource',
    'move:root'
));

gulp.task('build', gulp.series(gulp.parallel('clean:build', 'clean:legacy'), gulp.parallel(
    'pack:css:main',
    'pack:css:admin',
    'pack:css:emotes',
    'pack:css:dep',
    'pack:js:void',
    'pack:js:main',
    'pack:js:header',
    'pack:js:emotes',
    'pack:js:dep'
), 'md5', 'move'));

// 开发运行单元：保留逻辑文件名，不压缩、不写回源码目录
gulp.task('dev:css', function () {
    return gulp.src(dependencyCssSources)
        .pipe(concat('bundle.css'))
        .pipe(gulp.dest(path.join(developmentRoot, 'assets')));
});

gulp.task('dev:css:main', function () {
    return gulp.src('./assets/VOID.scss')
        .pipe(sass())
        .pipe(prefix(prefixerOptions))
        .pipe(gulp.dest(path.join(developmentRoot, 'assets')));
});

gulp.task('dev:css:admin', function () {
    return gulp.src('./assets/editor-admin.css')
        .pipe(prefix(prefixerOptions))
        .pipe(gulp.dest(path.join(developmentRoot, 'assets')));
});

gulp.task('dev:css:emotes', function () {
    return gulp.src('./assets/libs/emotes/emote-picker.css')
        .pipe(prefix(prefixerOptions))
        .pipe(gulp.dest(path.join(developmentRoot, 'assets/libs/emotes')));
});

gulp.task('dev:js:header', function () {
    return gulp.src('./assets/libs/header/**/*.js')
        .pipe(concat('bundle-header.js'))
        .pipe(gulp.dest(path.join(developmentRoot, 'assets')));
});

gulp.task('dev:js:dep', function () {
    return gulp.src(dependencyJsSources)
        .pipe(concat('bundle.js'))
        .pipe(gulp.dest(path.join(developmentRoot, 'assets')));
});

gulp.task('dev:js:void', function () {
    return gulp.src(voidJsSources)
        .pipe(concat('VOID.js'))
        .pipe(gulp.dest(path.join(developmentRoot, 'assets')));
});

gulp.task('dev:js:main', function () {
    return gulp.src(standaloneJsSources, { base: './assets' })
        .pipe(gulp.dest(path.join(developmentRoot, 'assets')));
});

gulp.task('dev:js:emotes', function () {
    return gulp.src('./assets/libs/emotes/emote-picker.js')
        .pipe(gulp.dest(path.join(developmentRoot, 'assets/libs/emotes')));
});

gulp.task('dev:move:php', function () {
    return gulp.src(runtimePhpSources, { base: './' })
        .pipe(gulp.dest(developmentRoot));
});

gulp.task('dev:move:libs', function () {
    return gulp.src(runtimeLibrarySources, { base: './assets/libs/', encoding: false })
        .pipe(gulp.dest(path.join(developmentRoot, 'assets/libs')));
});

gulp.task('dev:move:assets', function () {
    return gulp.src('./assets/VOIDCacheRule.js')
        .pipe(gulp.dest(path.join(developmentRoot, 'assets')));
});

gulp.task('dev:move:fonts', function () {
    return gulp.src('./assets/fonts/*', { encoding: false })
        .pipe(gulp.dest(path.join(developmentRoot, 'assets/fonts')));
});

gulp.task('dev:move:fontsource', async function () {
    await copyFontsource(developmentRoot);
});

gulp.task('dev:move:root', function () {
    return gulp.src(rootSources, { encoding: false })
        .pipe(gulp.dest(developmentRoot));
});

gulp.task('dev:move', gulp.parallel(
    'dev:move:php',
    'dev:move:libs',
    'dev:move:assets',
    'dev:move:fonts',
    'dev:move:fontsource',
    'dev:move:root'
));

gulp.task('dev-build', gulp.series(gulp.parallel('clean:dev', 'clean:legacy'), gulp.parallel(
    'dev:css',
    'dev:css:main',
    'dev:css:admin',
    'dev:css:emotes',
    'dev:js:header',
    'dev:js:dep',
    'dev:js:void',
    'dev:js:main',
    'dev:js:emotes',
    'dev:move'
)));

gulp.task('dev', gulp.series('dev-build'));

function watchSass() {
    return gulp.watch(scssSources, watchOptions, gulp.series('dev:css:main'));
}

// 开发过程，监视受维护源码并更新开发运行单元
gulp.task('sass', gulp.series('dev:css:main', watchSass));

gulp.task('watch', gulp.series('dev-build', function watchDevelopment() {
    var watchers = [
        watchSass(),
        gulp.watch(dependencyCssSources, watchOptions, gulp.series('dev:css')),
        gulp.watch('./assets/editor-admin.css', watchOptions, gulp.series('dev:css:admin')),
        gulp.watch(
            './assets/libs/emotes/emote-picker.css',
            watchOptions,
            gulp.series('dev:css:emotes')
        ),
        gulp.watch('./assets/libs/header/**/*.js', watchOptions, gulp.series('dev:js:header')),
        gulp.watch(dependencyJsSources, watchOptions, gulp.series('dev:js:dep')),
        gulp.watch(voidJsSources, watchOptions, gulp.series('dev:js:void')),
        gulp.watch(standaloneJsSources, watchOptions, gulp.series('dev:js:main')),
        gulp.watch(
            './assets/libs/emotes/emote-picker.js',
            watchOptions,
            gulp.series('dev:js:emotes')
        ),
        gulp.watch(runtimePhpSources, watchOptions, gulp.series('dev:move:php')),
        gulp.watch('./assets/VOIDCacheRule.js', watchOptions, gulp.series('dev:move:assets')),
        gulp.watch('./assets/fonts/*', watchOptions, gulp.series('dev:move:fonts')),
        gulp.watch(runtimeLibrarySources, watchOptions, gulp.series('dev:move:libs')),
        gulp.watch(rootSources, watchOptions, gulp.series('dev:move:root'))
    ];

    return watchers[0];
}));
