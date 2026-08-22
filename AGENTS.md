# Repository Guidelines

## Scope

This file defines durable development rules for the Typecho Theme VOID
repository. It applies to the whole repository unless a more specific
`AGENTS.md` exists in a subdirectory.

Write user-facing documentation, change notes, and delivery summaries in
Chinese unless the surrounding file or the user requests another language.
Keep code identifiers, commands, paths, and protocol names unchanged. Preserve
the language and formatting of existing files and avoid unrelated rewrites.

## Sources of Truth

Use evidence in this order when determining current behavior:

1. The user's current request and explicit decisions.
2. The applicable `AGENTS.md` instructions.
3. Current source, tests, package scripts, CI, and Git history.
4. Versioned repository documentation.
5. External plans, handoffs, and remembered context.

Do not record transient commit IDs, worktree state, deployment state, or
one-time task status in this file. Put detailed architecture and long-form
design rationale in versioned project documentation.

## Project Boundaries

VOID is a Typecho theme. Keep these layers distinct:

```text
repository source -> generated build/ -> deployed runtime copy
```

- Maintain code only in the source repository.
- Treat `build/` as the complete and only deployable theme unit.
- Treat a deployed theme directory as a replaceable runtime copy, never as a
  source of truth.
- Do not replace a full build with ad hoc copies of individual source files.
- Do not mix PHP, bundles, manifests, hashed assets, or service workers from
  different builds.
- A successful source edit or build is not browser verification. Runtime
  claims require checking the deployed copy and the assets actually loaded by
  the browser.

The `master` branch contains source. CI publishes the complete `build/` output
to `nightly`. Do not maintain generated `nightly` content directly or use it as
a source branch.

Do not modify Typecho core, companion plugins, the web server, the database, or
production infrastructure unless the task explicitly includes that component.
For cross-repository issues, identify ownership before editing.

## Starting Work

Before editing, inspect the current state:

```bash
git status -sb
git log --oneline -5
```

- Read the files that own the behavior before choosing an implementation.
- Inspect adjacent code and reuse established Typecho, PHP, JavaScript, and
  SCSS patterns.
- Preserve unrelated user changes in a dirty worktree.
- Do not reset, revert, overwrite, or format unrelated content.
- Keep each task focused on one independently verifiable problem.
- For diagnosis, review, or design-only requests, remain read-only unless the
  user also requests implementation.

Do not commit, push, create tags or releases, publish, deploy, or change an
external service without explicit authorization. An implementation or test
request does not imply permission to commit or deploy.

## Typecho and PHP Compatibility

- Preserve the PHP compatibility baseline documented by the project. Do not
  silently raise the minimum version or introduce newer-only syntax.
- Preserve Typecho 1.3 behavior and existing compatibility layers where
  practical.
- Prefer Typecho APIs, widgets, helpers, hooks, and routing over changes to
  Typecho core.
- Keep `__TYPECHO_ROOT_DIR__` direct-access guards in PHP entry and include
  files.
- Treat post, page, index, archive, search, comment, and 404 as distinct
  runtime contexts.
- Before reading post-only properties such as permalink, author, custom fields,
  created, or modified, verify that a content record exists and the context is
  a post or page.
- Empty archives and 404 responses must render without calling post-only APIs.
- Keep VOID's 404 handling in Typecho routing and theme templates. Do not add a
  root static `404.html` or replace the theme flow with a web-server error page.
- Do not treat a PHP CLI simulation as final proof of request, cookie, routing,
  archive, or template behavior. Verify those through the actual HTTP stack.
- Missing or outdated companion plugins should cause controlled degradation,
  not a blank page.

## Output and Security

- Escape visitor input, request data, content, and configuration for the
  destination context.
- For ordinary HTML attributes, use
  `htmlspecialchars(..., ENT_QUOTES, 'UTF-8')` unless a stricter existing helper
  applies.
- Serialize PHP data into JavaScript or structured data with `json_encode()`;
  never interpolate unescaped data into quoted JavaScript.
- Validate URLs and schemes before outputting links or asset URLs.
- Never derive filesystem or asset paths directly from visitor input,
  shortcodes, request parameters, or untrusted manifest fields.
- Preserve the administrator-controlled HTML behavior of the existing `head`
  and `footer` extension points, but do not extend that exception elsewhere.
- Keep JSON-LD and metadata valid on content and non-content pages. Emit
  post-specific metadata only for real posts and pages.
- Never add credentials, tokens, private keys, personal infrastructure details,
  or production-only data to source, fixtures, documentation, or build output.

## Settings and Backward Compatibility

Theme settings and advanced-setting keys are persistent user data and public
compatibility contracts.

- Do not rename, remove, repurpose, or change the type of an existing setting
  without a migration or compatibility fallback.
- Preserve existing site behavior after an upgrade unless migration is an
  explicit product decision.
- Give new settings safe defaults so older saved configurations continue to
  work when the key is absent.
- For public or advanced-setting changes, review and update all affected parts
  of `functions.php`, `libs/Utils.php`, `advanceSetting.sample.json`, README,
  frontend configuration output, and tests or manual acceptance steps.
- Treat companion-plugin minimum versions and version comparisons as public
  compatibility behavior.

## Frontend JavaScript

- Continue the framework-free, jQuery-compatible architecture unless an
  explicit architecture decision changes it.
- Use syntax supported by the current runtime code and Gulp minification chain.
- Every DOM initializer must support first load and reconstruction after PJAX
  replacement.
- Repeated initialization must not duplicate DOM, listeners, observers, timers,
  requests, or global state.
- Prefer event delegation for replaceable DOM. Namespace handlers or retain
  function references when teardown is required.
- Components that own global listeners, observers, timers, asynchronous work,
  or dynamic DOM need an idempotent destroy path.
- Prevent stale asynchronous work from writing into a closed, destroyed, or
  PJAX-replaced component.
- Preserve focus, selection, scroll position, and mobile-keyboard behavior for
  interactions that depend on them.
- Respect `prefers-reduced-motion`; disabled motion must not continue decorative
  animation or fetch animated media.
- Prefer existing `voidicon-*` glyphs and established controls.
- Do not pass untrusted or remote values to `innerHTML`; build safe DOM or
  escape for the destination context.

## SCSS and UI

- Edit `assets/VOID.scss` or the owning partial under `assets/parts/`.
- Reuse existing variables, breakpoints, typography, spacing, colors, and dark
  mode conventions.
- Scope selectors to the owning component or content region.
- Do not hand-edit generated CSS, source maps, or bundles.
- Support both light and dark themes for every changed UI.
- Preserve keyboard operation, visible focus, accessible names, and adequate
  touch targets.
- Reserve stable dimensions for images and fixed-format controls where
  practical to avoid layout shift.
- Keep truly above-the-fold media eager or high priority and other media lazy.
  Do not change all media to one loading policy without measurement.
- For global layout or typography changes, test long Chinese text, long URLs and
  code, narrow screens, and horizontal overflow.

## Generated Files and Build Inputs

Edit maintained source, not ignored development output.

Ignored generated output includes:

```text
assets/VOID.css
assets/VOID.css.map
assets/bundle*.js
assets/bundle*.css
build/
temp/
```

- Do not edit or commit those ignored outputs.
- `tests/` is maintained source and must remain versioned.
- Gulp owns minification, content hashes, PHP reference rewriting, and asset
  copying. Never hard-code a generated hashed filename.
- `make build` does not implicitly run `npm run emotes:build`; rebuild emote data
  first when its maintained inputs change.
- Preserve binary mode when Gulp copies images, WebP, GIF, and font files.
- Treat filename and manifest-path case as a Linux-sensitive contract. Record
  case-only renames explicitly in Git and confirm them in Linux CI.

## Mature Feature Contracts

Keep implementation details in code, tests, and architecture documentation.
The following externally observable contracts must not change accidentally.

### PJAX and Dynamic Lifecycles

- Keep one native `CustomEvent` lifecycle dispatch. jQuery listeners receive
  the bubbling native event; do not explicitly fire a duplicate jQuery event.
- Preserve `detail.args`, `detail.options`, and the legacy trailing-options
  fallback.
- Keep main-container `#pjax-container` and comment-container `#comments`
  lifecycles separate.
- When changing an event contract, search every native, jQuery, inline, theme,
  and third-party consumer, not only the dispatch site.
- Cover direct entry, main PJAX navigation, browser back/forward, and any
  related local AJAX path.
- Update `tests/js/void-pjax-events.test.cjs` with contract changes.

### Emotes and Shortcodes

- Maintained inputs are `scripts/emotes/bangumi-sources.json`,
  `scripts/emotes/legacy-packs.json`, numbered Bangumi GIFs, and
  `scripts/build-emotes.mjs`.
- `assets/libs/emotes/packs.json`, `packs/*.json`, and Bangumi posters are
  generated runtime assets that remain versioned. Do not edit them manually.
- Published IDs, tokens, paths, and legacy pack payloads are compatibility
  contracts. Preserve unknown or malformed shortcodes as source text.
- A user shortcode payload may only be a manifest lookup key; never use it in
  path construction.
- Do not restore `::(...)` parsing, Emoji/Bubble groups, or search without a new
  product requirement and migration plan.
- Do not mix new assets into a source directory and run a full import until the
  data model has explicit stable IDs and labels.
- Treat a Sharp upgrade as an asset migration: rebuild and review all poster
  binary diffs and deliberately update reproducibility expectations.
- Confirm redistribution, modification, attribution, and commercial-use terms
  before adding third-party assets.

### Theme Color

- Preserve device-following, scheduled, fixed-light, and fixed-dark behavior,
  including compatibility with saved settings.
- Keep first-paint logic in `includes/head.php` aligned with runtime state in
  `assets/header.js` to avoid flashes and divergent state.
- Keep the frontend cycle `auto -> manual light -> manual dark -> auto` unless a
  new product decision changes it.
- Use the existing dotted version comparison and historical `3.54`
  normalization; do not replace it with `parseFloat`.
- Reduced-motion mode changes state directly without decorative transition.

### Service Worker and Caching

- The deployed theme and site-root `VOIDCacheRule.js` must come from the same
  build.
- Preserve route ordering when a resource class must be handled before the
  general static rule.
- Do not cache failed responses as successful static assets.
- After changing cache versions or manifest strategy, verify worker install and
  activation, loaded asset versions, and retirement of old caches in a real
  browser.
- Update service-worker contract tests with cache-policy or limit changes.

## Dependencies and Toolchain

CI uses Node.js 24 LTS. Use the lockfile for normal setup and verification:

```bash
npm ci
```

- Use `npm ci` for routine environment preparation.
- Change `package.json` and `package-lock.json` together only when dependency
  changes are part of the task.
- Do not include broad dependency upgrades in unrelated work.
- Keep the pinned Sharp version unless the task is an explicit poster or asset
  migration.
- Prefer repository scripts and `make build`; do not depend on a global Gulp.

## Verification

Scale verification with risk. Run the smallest useful checks while iterating,
then all applicable gates before delivery.

For every change:

```bash
git diff --check
```

For JavaScript, SCSS, build logic, or frontend assets:

```bash
npm run lint
npm test
make build
```

`npm test` covers emote generation and contracts, emote behavior, PJAX events,
and service-worker emote caching. It is not proof that unrelated templates,
settings, layout, or browser flows work.

For PHP changes:

- Run `php -l` on every changed PHP source file.
- If no host PHP CLI is available, use a compatible PHP CLI container.
- For changes to `libs/Contents.php`, emote parsing, manifests, shortcodes, the
  HTML tokenizer, or related output contracts, run `npm run test:php`.

The PHP tests are intentionally narrow and do not validate every Typecho route
or template.

For emote data or assets:

```bash
npm run emotes:build
npm run emotes:check
npm test
npm run test:php
make build
```

Run a full source import only after verifying the exact source directory:

```bash
npm run emotes:import -- <verified-source-directory>
```

Before release or after shared-architecture changes:

```bash
npm ci
npm run lint
npm test
npm run test:php
make build
git diff --check
```

### Browser and HTTP Verification

Build and deploy one complete runtime unit before browser verification. Select
checks according to the affected behavior:

- Direct page load and relevant PJAX entry and exit.
- Browser back and forward.
- Affected index, post/page, archive/search, comments, and dynamic 404 routes.
- Both HTTP status and complete response body.
- Desktop and approximately `390px` mobile widths.
- Light and dark themes.
- Reduced-motion behavior for animation changes.
- Logged-out and logged-in states for authentication-sensitive controls.
- No unintended horizontal overflow.
- No new console errors or warnings.
- Network requests load the current hashed build assets without unexpected
  duplicate requests or eager-loading regressions.

For broad responsive changes, also test tablet/intermediate widths and the
narrowest supported phone. For keyboard or accessibility changes, complete the
keyboard flow and verify focus restoration.

## Documentation, Versions, and Releases

- Add user-visible changes to the unreleased section of `change-log.md`.
- Update README for installation, configuration, compatibility, public
  behavior, or usage changes.
- Update `advanceSetting.sample.json` for advanced-setting changes.
- Put durable cross-module contract changes in versioned architecture
  documentation.
- Keep plans and handoffs concise and mark completed or superseded material.
  Released architecture must not exist only in external context.

When changing the theme version, review at least:

- The Typecho theme-header version in `index.php`.
- `$GLOBALS['VOIDVersion']` in `functions.php`.
- README release/version text.
- The matching entry in `change-log.md`.
- Tags and packages only when the user explicitly requests a release.

Do not claim release readiness from historical test results. Re-run the full
gate for the exact release commit and build from a clean, immutable commit or
tag rather than an unknown worktree.

## Git Hygiene

- Preserve existing line endings and encodings unless normalization is part of
  the task.
- Record case-only asset renames so Git sees the intended spelling.
- Add regression coverage for confirmed defects when a reasonable test entry
  exists.
- Do not delete compatibility code, assets, settings, or shortcodes merely
  because the current page appears not to use them.
- Do not commit ignored build output. When authoritative inputs change, commit
  the maintained source, tests, and any intentionally versioned emote runtime
  assets.
- Keep requested commits focused and exclude unrelated worktree changes.
- Never rewrite history, force-push, tag, or publish a release without explicit
  authorization.

## Completion Criteria

Before reporting completion:

1. Re-read the request and confirm the implementation stayed in scope.
2. Review the final diff and generated-file boundaries.
3. Run all applicable verification gates.
4. Confirm source, build output, and runtime deployment were not confused.
5. Report behavior changes, key files, tests actually run, browser or runtime
   validation actually completed, and any residual risk or unverified area.

Never claim an unexecuted check passed or substitute historical context for
verification of the current diff.
