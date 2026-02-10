const gulp = require('gulp');
const path = require('path');
const fs = require('fs');
const os = require('os');
const XML = require('pixl-xml');

const less = require('gulp-less');
const sourcemaps = require('gulp-sourcemaps');
const concat = require('gulp-concat');
const header = require('gulp-header');
const riot = require('gulp-riot');
const rename = require('gulp-rename');
const merge = require('merge-stream');
const through = require('through2');
const colors = require('ansi-colors');
const log = require('fancy-log');
const replace = require('gulp-replace');
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const reporter = require('postcss-reporter');

/* Optional dependency (keeps pipes alive on errors if installed) */
let plumber = null;
try {
    plumber = require('gulp-plumber');
} catch {}

const toPosix = (p) => (p ? String(p).replace(/\\/g, '/') : p);
const joinPosix = (...segs) => toPosix(path.join(...segs));

/**
 * Auto-discovers the theme name from the WebContent/resources/themes/ directory.
 * Falls back to directory name if discovery fails.
 *
 * @returns {string} The theme name
 */
function discoverThemeName() {
    const themesDir = path.join(process.cwd(), 'WebContent', 'resources', 'themes');

    if (fs.existsSync(themesDir)) {
        try {
            const entries = fs.readdirSync(themesDir, { withFileTypes: true });
            const themes = entries.filter((e) => e.isDirectory()).map((e) => e.name);

            if (themes.length > 0) {
                return themes[0];
            }
        } catch (err) {
            log(colors.yellow(`[theme] Could not scan themes directory: ${err.message}`));
        }
    }

    // Fallback to directory name
    const repoDir = path.basename(process.cwd());
    const fallbackName = (repoDir.replace(/^goobi-viewer-theme-/, '') || repoDir).trim().toLowerCase();
    log(colors.yellow(`[theme] WebContent/resources/themes/ not found, using repo name: ${fallbackName}`));
    return fallbackName;
}

const THEME = {
    name: discoverThemeName(),
};

const base = `WebContent/resources/themes/${THEME.name}`;

/** Static paths used throughout the build. */
const paths = {
    staticRoot: 'WebContent',
    themeRoot: base,
    templates: `${base}/`,
    includes: `${base}/includes/`,
    jsDev: `${base}/javascript/dev/`,
    jsDist: `${base}/javascript/dist/`,
    lessViewer: `${base}/css/less/`,
    lessCS: `${base}/css/less/crowdsourcing/`,
    cssDist: `${base}/css/dist/`,
};

/** Standard banner header prepended to built files. */
const banner = `/*!\n * This file is part of the Goobi viewer - a content presentation and management application for digitized objects.\n * - http://www.intranda.com\n * - http://digiverso.com\n * GPLv2 or later. NO WARRANTY.\n */\n`;

/** Absolute root that LESS sourcemap remapping refers to. */
const ABS_LESS_ROOT = path.resolve(paths.lessViewer);

/** Toggle Autoprefixer warnings (set GV_APWARN=0 to hide locally). */
const SHOW_AP_WARNINGS = process.env.GV_APWARN !== '0';
/** Optional: completely disable Autoprefixer (set GV_AUTOPREFIX=0). */
const ENABLE_AUTOPREFIX = process.env.GV_AUTOPREFIX !== '0';

/** JS bundle order (extend as needed). */
const JS_SOURCES = ['custom.js'];

/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ Small utilities                                                       ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

/**
 * Keeps Gulp streams alive on plugin errors (if gulp-plumber is available);
 * otherwise acts as a passthrough transform.
 * @returns {NodeJS.ReadWriteStream}
 */
function guard() {
    return plumber
        ? plumber({
              errorHandler(err) {
                  log(colors.red(err && err.message ? err.message : String(err)));
                  if (this && typeof this.emit === 'function') this.emit('end');
              },
          })
        : through.obj((f, _e, cb) => cb(null, f));
}

/** @returns {bigint} Monotonic start timestamp for timing. */
const tStart = () => process.hrtime.bigint();

/**
 * Formats elapsed time between now and `t0` in milliseconds.
 * @param {bigint} t0
 * @returns {string}
 */
function elapsedMs(t0) {
    return (Number(process.hrtime.bigint() - t0) / 1e6 || 0).toFixed(0) + ' ms';
}

/**
 * Replaces the home directory with ~ for nicer logs.
 * @param {string} p
 * @returns {string}
 */
function pretty(p) {
    return p ? toPosix(String(p).replace(os.homedir(), '~')) : '';
}

/**
 * Prints a titled, indented log block.
 * @param {string} title
 * @param {string[]} lines
 */
function logBlock(title, lines) {
    console.log(colors.white(`\n[${title}]`));
    lines.forEach((l) => console.log('  ' + l));
}

/**
 * Tap transform to observe files flowing through a pipe.
 * @param {(file: import('vinyl')) => void} push
 * @returns {NodeJS.ReadWriteStream}
 */
function collectFiles(push) {
    return through.obj((file, _, cb) => {
        try {
            push(file);
        } catch {}
        cb(null, file);
    });
}

/**
 * No-op stream used when a destination folder is missing.
 * @returns {NodeJS.ReadWriteStream}
 */
function noopThrough() {
    return through.obj((f, _e, cb) => cb(null, f));
}

/**
 * Writes to a deployment subfolder if it exists; otherwise logs a warning
 * and returns a no-op stream (so the pipeline doesn't break).
 * @param {string} subPath
 * @returns {NodeJS.ReadWriteStream}
 */
function safeDest(subPath) {
    const full = path.join(DEPLOYMENT_DIR, subPath);
    fs.mkdirSync(full, { recursive: true });
    if (!fs.existsSync(full)) {
        log(colors.yellow(`[deploy] target does not exist, skipping: ${pretty(full)}`));
        return noopThrough();
    }
    return gulp.dest(full);
}

/**
 * Unified footer for task logs.
 * @param {number} generated
 * @param {number} copied
 * @param {number} errors
 * @param {bigint} started
 * @returns {string}
 */
function taskFooter(generated, copied, errors, started) {
    return (
        colors.green('✓ ') +
        colors.white(`${generated} generated · ${copied} copied · ${errors} errors · `) +
        colors.magenta(elapsedMs(started))
    );
}

/**
 * Compact task logger to avoid reference across tasks.
 * @param {Object} o
 * @param {string} o.name
 * @param {bigint} o.started
 * @param {string=} o.changed
 * @param {string=} o.src
 * @param {string[]=} o.projOut
 * @param {string[]=} o.deployOut
 * @param {number=} o.genCount
 * @param {number=} o.copyCount
 * @param {number=} o.errors
 * @param {string[]=} o.extra
 */
function logTask({
    name,
    started,
    changed,
    src,
    projOut = [],
    deployOut = [],
    genCount,
    copyCount,
    errors = 0,
    extra = [],
}) {
    const lines = [`time: ${colors.gray(new Date().toLocaleTimeString('de-DE', { hour12: false }))}`];
    if (changed) lines.push(`changed: ${colors.green(pretty(changed))}`);
    if (src) lines.push(`src: ${colors.green(src)}`);
    if (projOut.length) lines.push('→ project:', ...projOut.map((p) => '  • ' + colors.blue(pretty(p))));
    if (deployOut.length) lines.push('→ deploy:', ...deployOut.map((p) => '  • ' + colors.blue(pretty(p))));
    if (extra.length) lines.push(...extra);
    const gen = typeof genCount === 'number' ? genCount : projOut.length;
    const copy = typeof copyCount === 'number' ? copyCount : deployOut.length;
    lines.push(taskFooter(gen, copy, errors, started));
    logBlock(name, lines);
}

/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ Resolve deployment/theme directories                                  ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

/**
 * Determines deployment target and relevant config file locations.
 * Honors environment overrides and validates that the deployment dir exists.
 *
 * Env overrides (optional):
 * - GV_GULP_CFG: absolute path to ~/.config/gulp_userconfig.json
 * - GV_VIEWER_CFG: absolute path to config_viewer.xml
 *
 * @returns {{DEPLOYMENT_DIR:string, THEME_DIR:string, VIEWER_CFG:string, USER_CFG:string}}
 * @throws {Error} If required configs cannot be read/parsed.
 */
function resolveDirs() {
    const home = os.homedir();
    const gulpCfgPath = process.env.GV_GULP_CFG || path.join(home, '.config', 'gulp_userconfig.json');
    const viewerCfgPath =
        process.env.GV_VIEWER_CFG ||
        (process.platform.toLowerCase().startsWith('win')
            ? 'c:/opt/digiverso/viewer/config/config_viewer.xml'
            : '/opt/digiverso/viewer/config/config_viewer.xml');

    let cfg;
    try {
        cfg = JSON.parse(fs.readFileSync(gulpCfgPath, 'utf-8'));
    } catch (e) {
        throw new Error(`Cannot parse ${gulpCfgPath}: ${e.message}`);
    }
    if (!cfg.tomcat_dir) {
        throw new Error(`Missing "tomcat_dir" in ${gulpCfgPath}`);
    }

    let viewerConfig;
    try {
        viewerConfig = XML.parse(fs.readFileSync(viewerCfgPath, 'utf-8'));
    } catch (e) {
        throw new Error(`Cannot parse ${viewerCfgPath}: ${e.message}`);
    }

    const theme = viewerConfig?.viewer?.theme || {};
    const special = theme.specialName && String(theme.specialName);
    const mainTheme = String(theme.mainTheme || 'reference');

    // Use repository directory name for deployment path (not theme name from config)
    const repoDir = path.basename(process.cwd());

    let deployDir;
    if (special && special.length) {
        deployDir = path.join(cfg.tomcat_dir, `goobi-viewer-theme-${special}`);
    } else {
        const candidates = [
            // First try: Use repository directory name (e.g., goobi-viewer-theme-hub-evifa)
            path.join(cfg.tomcat_dir, repoDir),
            // Second try: Use theme name from config (e.g., goobi-viewer-theme-evifa)
            path.join(cfg.tomcat_dir, `goobi-viewer-theme-${mainTheme}`),
            // Third try: Development target directory
            path.join(home, 'git', 'goobi-viewer', repoDir, repoDir, 'target', 'viewer'),
            // Fourth try: Old pattern with config theme name
            path.join(
                home,
                'git',
                'goobi-viewer',
                `goobi-viewer-theme-${mainTheme}`,
                `goobi-viewer-theme-${mainTheme}`,
                'target',
                'viewer'
            ),
        ];
        deployDir = candidates.find((c) => fs.existsSync(c)) || candidates[0];
    }

    return {
        DEPLOYMENT_DIR: deployDir,
        THEME_DIR: path.resolve(process.cwd()),
        VIEWER_CFG: viewerCfgPath,
        USER_CFG: gulpCfgPath,
    };
}

/**
 * Ensures a given path exists and is a directory.
 * @param {string} label
 * @param {string} dir
 * @throws {Error}
 */
function assertDirExists(label, dir) {
    if (!dir) throw new Error(`${label} not resolved`);
    try {
        const st = fs.statSync(dir);
        if (!st.isDirectory()) throw new Error(`${label} is not a directory: ${dir}`);
    } catch {
        throw new Error(`${label} does not exist: ${dir}`);
    }
}

/* Resolve once on load, assert lazily for tasks that require deployment */
const { DEPLOYMENT_DIR, THEME_DIR, VIEWER_CFG, USER_CFG } = (() => {
    const d = resolveDirs();
    return d;
})();

let deploymentDirChecked = false;
function requireDeploymentDir() {
    if (!deploymentDirChecked) {
        assertDirExists('DEPLOYMENT_DIR', DEPLOYMENT_DIR);
        deploymentDirChecked = true;
    }
}

/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ Styles: LESS → CSS (+ sourcemaps + autoprefixer)                      ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

/**
 * Normalizes LESS source map paths to be relative to the theme's LESS root
 * when possible (keeps devtools navigation tidy).
 * @param {string} sourcePath
 * @param {string} entryDir
 * @returns {string}
 */
function remapLessSource(sourcePath, entryDir) {
    if (!sourcePath) return sourcePath;
    if (typeof sourcePath === 'string' && sourcePath.startsWith('<')) return sourcePath;
    const normalized = sourcePath.toString().replace(/\\/g, '/');
    const absSource = path.resolve(entryDir, normalized);
    const relToLess = path.relative(ABS_LESS_ROOT, absSource).replace(/\\/g, '/');
    return !relToLess.startsWith('..') ? `../less/${relToLess}` : normalized;
}

/**
 * Builds all LESS bundles (main, crowdsourcing, and discovered subthemes).
 * Outputs minified CSS + sourcemaps; mirrors to deployment if present.
 * @param {?string=} changedFilePath For log context when running in watch mode.
 * @returns {NodeJS.ReadWriteStream} Merged stream of all bundle pipelines.
 */
function buildStyles(changedFilePath = null) {
    requireDeploymentDir();
    if (typeof changedFilePath === 'function') changedFilePath = null;
    const started = tStart();

    const lessEntryMain = path.join(paths.lessViewer, 'constructor.less');
    const lessEntryCS = path.join(paths.lessCS, 'csConstructor.less');
    const subthemesRoot = path.join(paths.lessViewer, 'subthemes');

    // Discover subtheme bundles dynamically
    let subthemeBundles = [];
    try {
        if (fs.existsSync(subthemesRoot)) {
            const entries = fs.readdirSync(subthemesRoot, { withFileTypes: true });
            subthemeBundles = entries
                .filter((d) => d.isDirectory())
                .map((d) => {
                    const dir = path.join(subthemesRoot, d.name);
                    const entryFile = path.join(dir, 'subThemeConstructor.less');
                    return fs.existsSync(entryFile)
                        ? {
                              entry: entryFile,
                              outName: `${d.name}.min.css`,
                              include: [paths.lessViewer, paths.lessCS, dir],
                          }
                        : null;
                })
                .filter(Boolean);
        }
    } catch (e) {
        log(colors.yellow(`[less] subthemes scan skipped: ${e.message}`));
    }

    // Bundle definitions
    const bundles = [
        {
            entry: lessEntryMain,
            outName: `${THEME.name}.min.css`,
            include: [paths.lessViewer, paths.lessCS],
        },
        {
            entry: lessEntryCS,
            outName: `${THEME.name}-cs.min.css`,
            include: [paths.lessViewer, paths.lessCS],
        },
        ...subthemeBundles,
    ].filter((b) => fs.existsSync(b.entry));

    if (bundles.length === 0) {
        log(colors.yellow('[less] no bundles to build (no constructor files found)'));
        return through.obj((f, _e, cb) => cb(null, f));
    }

    const projectOutputs = [];
    const deployOutputs = [];

    const streams = bundles.map((b) => {
        const entryDir = path.dirname(path.resolve(b.entry));
        return gulp
            .src(b.entry, { allowEmpty: true })
            .pipe(guard())
            .pipe(sourcemaps.init())
            .pipe(less({ compress: true, paths: b.include }))
            .pipe(
                postcss([
                    ...(ENABLE_AUTOPREFIX ? [autoprefixer()] : []),
                    ...(SHOW_AP_WARNINGS
                        ? [
                              reporter({
                                  clearReportedMessages: true,
                                  throwError: false,
                                  plugins: ['autoprefixer'],
                              }),
                          ]
                        : []),
                ])
            )
            .pipe(header(banner))
            .pipe(rename(b.outName))
            .pipe(sourcemaps.mapSources((src) => remapLessSource(src, entryDir)))
            .pipe(sourcemaps.write('.', { includeContent: true }))
            .pipe(
                collectFiles((file) => {
                    const outPath = path.join(paths.cssDist, path.basename(file.path));
                    projectOutputs.push(outPath);
                    deployOutputs.push(
                        path.join(
                            DEPLOYMENT_DIR,
                            'resources/themes/' + THEME.name + '/css/dist',
                            path.basename(file.path)
                        )
                    );
                    deployOutputs.push(
                        path.join(
                            DEPLOYMENT_DIR,
                            'WEB-INF/classes/resources/themes/' + THEME.name + '/css/dist',
                            path.basename(file.path)
                        )
                    );
                })
            )
            .pipe(gulp.dest(paths.cssDist))
            .pipe(
                through.obj(function (file, enc, cb) {
                    if (file.stat) {
                        file.stat.mtime = new Date();
                        file.stat.atime = new Date();
                    }
                    cb(null, file);
                })
            )
            .pipe(safeDest('resources/themes/' + THEME.name + '/css/dist'))
            .pipe(
                through.obj(function (file, enc, cb) {
                    if (file.stat) {
                        file.stat.mtime = new Date();
                        file.stat.atime = new Date();
                    }
                    cb(null, file);
                })
            )
            .pipe(safeDest('WEB-INF/classes/resources/themes/' + THEME.name + '/css/dist'));
    });

    return merge(...streams).on('finish', () => {
        logTask({
            name: 'styles',
            started,
            changed: changedFilePath,
            src: `${paths.lessViewer}{constructor.less,**/*.less}`,
            projOut: projectOutputs,
            deployOut: deployOutputs,
        });
    });
}

/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ JavaScript & Riot                                                    ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

/**
 * Concatenates all files listed in JS_SOURCES (in order) into one bundle
 * `custom.min.js`, prepends the banner, and mirrors to deployment.
 * @param {?string=} changedFilePath For log context when running in watch mode.
 * @returns {NodeJS.ReadWriteStream}
 */
function bundleCustomJS(changedFilePath = null) {
    requireDeploymentDir();
    if (typeof changedFilePath === 'function') changedFilePath = null;
    const started = tStart();
    const srcList = JS_SOURCES.map((p) => joinPosix(paths.jsDev, p));
    const outProj = path.join(paths.jsDist, 'custom.min.js');
    const outDeploy = path.join(DEPLOYMENT_DIR, 'resources/javascript/dist', 'custom.min.js');

    return gulp
        .src(srcList, { allowEmpty: true })
        .pipe(guard())
        .pipe(concat('custom.min.js', { newLine: ';' }))
        .pipe(header(banner))
        .pipe(gulp.dest(paths.jsDist))
        .pipe(safeDest('resources/javascript/dist'))
        .on('finish', () => {
            logTask({
                name: 'js_custom',
                started,
                changed: changedFilePath,
                src: joinPosix(paths.jsDev, `{${JS_SOURCES.join(',')}}`),
                projOut: [outProj],
                deployOut: [outDeploy],
            });
        });
}

/**
 * Compiles all Riot `.tag` files into a single bundle `<theme>-tags.js`
 * and mirrors the result to the deployment directory.
 * @param {?string=} changedFilePath For log context when running in watch mode.
 * @returns {NodeJS.ReadWriteStream}
 */
function compileRiotTags(changedFilePath = null) {
    requireDeploymentDir();
    if (typeof changedFilePath === 'function') changedFilePath = null;
    const started = tStart();
    const outProj = path.join(paths.jsDist, `${THEME.name}-tags.js`);
    const outDeploy = path.join(DEPLOYMENT_DIR, 'resources/javascript/dist', `${THEME.name}-tags.js`);

    return gulp
        .src(joinPosix(paths.jsDev, '*.tag'), { allowEmpty: true })
        .pipe(guard())
        .pipe(riot({ compact: true }))
        .pipe(concat(`${THEME.name}-tags.js`))
        .pipe(gulp.dest(paths.jsDist))
        .pipe(safeDest('resources/javascript/dist'))
        .on('finish', () => {
            logTask({
                name: 'riotTags',
                started,
                changed: changedFilePath,
                src: joinPosix(paths.jsDev, '*.tag'),
                projOut: [outProj],
                deployOut: [outDeploy],
            });
        });
}

/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ Static mirror (full + incremental)                                   ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

/**
 * One-shot mirror of the entire static tree into the deployment directory.
 * @returns {NodeJS.ReadWriteStream}
 */
function syncAll() {
    requireDeploymentDir();
    const started = tStart();
    let copied = 0;

    return gulp
		    .src([ 
		        joinPosix(paths.staticRoot, '**/*'),
				'!' + joinPosix(paths.staticRoot, 'resources/themes/*.xml'),
		    ], {
            dot: true,
            allowEmpty: true,
            base: paths.staticRoot,
        })
        .pipe(guard())
        .pipe(
            collectFiles((file) => {
                if (file?.stat?.isFile()) copied++;
            })
        )
        .pipe(gulp.dest(DEPLOYMENT_DIR))
        .on('finish', () => {
            logTask({
                name: 'sync-all',
                started,
                src: toPosix(path.resolve(paths.staticRoot)) + '/**/*',
                projOut: [],
                deployOut: [],
                genCount: 0,
                copyCount: copied,
                extra: [`dst: ${colors.blue(pretty(DEPLOYMENT_DIR))}`],
            });
        });
}

/**
 * Deletes the corresponding file from the deployment directory when a
 * watched source file is removed.
 * @param {string} filePath
 * @returns {Promise<void>}
 */
async function removeFromDeploy(filePath) {
    const rel = path.relative(paths.staticRoot, filePath).replace(/\\/g, '/');
    const dst = path.join(DEPLOYMENT_DIR, rel);
    try {
        const { default: del } = await import('del');
        await del(dst, { force: true });
        logBlock('static', [`dst: ${colors.blue(pretty(dst))}`, colors.yellow('• removed')]);
    } catch (err) {
        log(colors.red(`[sync] failed to delete ${pretty(dst)}: ${err.message}`));
    }
}

/**
 * Mirrors a single changed file into the deployment folder (incremental sync).
 * @param {string} filePath
 * @returns {NodeJS.ReadWriteStream}
 */
function mirrorStatic(filePath) {
    const started = tStart();
    const rel = path.relative(paths.staticRoot, filePath).replace(/\\/g, '/');
    const dst = path.join(DEPLOYMENT_DIR, rel);

    return gulp
        .src(filePath, { base: paths.staticRoot, allowEmpty: true })
        .pipe(guard())
        .pipe(gulp.dest(DEPLOYMENT_DIR))
        .on('finish', () => {
            logTask({
                name: 'static',
                started,
                changed: filePath,
                src: rel,
                projOut: [],
                deployOut: [dst],
                genCount: 0,
                copyCount: 1,
            });
        });
}

/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ Cache-busting utility                                                ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

/**
 * Updates cache-busting query params (cachetimestamp=...) in templates
 * and in the shared include file.
 * @returns {NodeJS.ReadWriteStream}
 */
function cacheBump() {
    requireDeploymentDir();
    const started = tStart();
    const d = new Date();
    const stamp = [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()].join(
        '-'
    );
    const pattern = /cachetimestamp=[0-9-]+/g;

    const projOut = [];
    const deployOut = [];

    const collectTo = (arr, baseDir) =>
        collectFiles((file) => {
            const name = path.basename(file.path);
            const out = path.join(baseDir, name);
            if (!arr.includes(out)) arr.push(out);
        });

    const a = gulp
        .src(joinPosix(paths.templates, '*.html'), { allowEmpty: true })
        .pipe(guard())
        .pipe(replace(pattern, `cachetimestamp=${stamp}`))
        .pipe(collectTo(projOut, paths.templates))
        .pipe(gulp.dest(paths.templates))
        .pipe(collectTo(deployOut, path.join(DEPLOYMENT_DIR, path.relative(paths.staticRoot, paths.templates))))
        .pipe(safeDest(path.relative(paths.staticRoot, paths.templates).replace(/\\/g, '/')));

    const b = gulp
        .src(joinPosix(paths.includes, 'customJS.xhtml'), { allowEmpty: true })
        .pipe(guard())
        .pipe(replace(pattern, `cachetimestamp=${stamp}`))
        .pipe(collectTo(projOut, paths.includes))
        .pipe(gulp.dest(paths.includes))
        .pipe(collectTo(deployOut, path.join(DEPLOYMENT_DIR, path.relative(paths.staticRoot, paths.includes))))
        .pipe(safeDest(path.relative(paths.staticRoot, paths.includes).replace(/\\/g, '/')));

    return merge(a, b).on('finish', () => {
        logTask({
            name: 'cache',
            started,
            extra: [`stamp: ${colors.cyan(stamp)}`],
            projOut,
            deployOut,
        });
    });
}

/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ Debug helper                                                         ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

/**
 * Prints resolved directories and environment override hints.
 * @param {Function} cb
 */
function printTargets(cb) {
    const home = os.homedir();
    const exists = (p) => p && fs.existsSync(p);
    const asHome = (p) => (p ? toPosix(p.replace(home, '~')) : '(none)');
    const mark = (p) => (exists(p) ? colors.green('✓') : colors.red('✗'));
    const row = (label, p) => `${colors.white(label.padEnd(14))} ${mark(p)}  ${colors.blue(asHome(p))}`;

    logBlock('targets', [
        `platform: ${colors.cyan(process.platform)}  node: ${colors.cyan(process.version)}`,
        `theme:    ${colors.cyan(THEME.name)}`,
        row('DEPLOYMENT_DIR', DEPLOYMENT_DIR),
        row('THEME_DIR', THEME_DIR),
        row('VIEWER_CFG', VIEWER_CFG),
        row('USER_CFG', USER_CFG),
        colors.gray('hint: GV_VIEWER_CFG / GV_GULP_CFG can override defaults'),
    ]);

    const depPath = toPosix(DEPLOYMENT_DIR).toLowerCase();
    const projBase = path.basename(THEME_DIR);
    const projBaseLc = projBase.toLowerCase();
    const projBaseStrippedLc = projBaseLc.replace(/^goobi-viewer-theme-/, '');

    const contains =
        depPath.includes(`/${projBaseLc}/`) ||
        depPath.endsWith(`/${projBaseLc}`) ||
        depPath.includes(`/${projBaseStrippedLc}/`) ||
        depPath.endsWith(`/${projBaseStrippedLc}`);

    if (!contains) {
        log(
            colors.yellow(
                `[warn] Possible mismatch: theme folder "${projBase}" not reflected in deployment path.\n` +
                    `           Ensure you are running gulp in the correct theme repo.`
            )
        );
    }

    cb();
}

/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ Watch mode                                                           ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

/**
 * Starts file watchers for styles, JS, Riot tags, and static assets.
 * Rebuilds and mirrors changes into the deployment folder where applicable.
 */
function watchMode() {
    requireDeploymentDir();
    const watchOpts = {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 700, pollInterval: 50 },
        ignored: ['**/*.tmp', '**/*~', '**/#*#', '**/.#*', '**/*.swp', '**/*.swo', '**/.DS_Store'],
    };

    gulp.watch(joinPosix(paths.lessViewer, '**/*.less'), watchOpts).on('change', (p) => buildStyles(p));

    gulp.watch(joinPosix(paths.jsDev, '*.js'), watchOpts)
        .on('change', (p) => bundleCustomJS(p))
        .on('add', (p) => bundleCustomJS(p));

    gulp.watch(joinPosix(paths.jsDev, '*.tag'), watchOpts)
        .on('change', (p) => compileRiotTags(p))
        .on('add', (p) => compileRiotTags(p));

    const staticGlobs = [
        joinPosix(paths.staticRoot, '*.xhtml'),
        joinPosix(paths.staticRoot, '*.xml'),
        joinPosix(paths.staticRoot, '*.xls'),
        joinPosix(paths.themeRoot, '**/*.xhtml'),
        joinPosix(paths.themeRoot, '**/*.html'),
        joinPosix(paths.themeRoot, '**/*.jpg'),
        joinPosix(paths.themeRoot, '**/*.jpeg'),
        joinPosix(paths.themeRoot, '**/*.png'),
        joinPosix(paths.themeRoot, '**/*.svg'),
        joinPosix(paths.themeRoot, '**/*.gif'),
        joinPosix(paths.themeRoot, '**/*.ico'),
    ];

    gulp.watch(staticGlobs, watchOpts)
        .on('change', (p) => mirrorStatic(p))
        .on('add', (p) => mirrorStatic(p))
        .on('unlink', (p) => removeFromDeploy(p));
}

/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ Task composition & exports                                           ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

const buildAssets = gulp.series(gulp.parallel(buildStyles, bundleCustomJS, compileRiotTags));

exports.build = buildAssets;
exports.dev = gulp.series(syncAll, watchMode);
exports['sync-all'] = syncAll;
exports.cache = gulp.series(cacheBump);
exports.target = printTargets;

/* ── Task exports ──────────────────────────────────────────
   - npm run build     → Build styles, JS, riot tags
   - npm run dev       → Start watchers (no full sync)
   - npm run sync      → One-shot full static sync
   - npm run cache     → Update cache-busting timestamps
   - npm run target    → Show resolved paths

   Env flags:
   - GV_AUTOPREFIX=0 → disable autoprefixer entirely
   - GV_APWARN=0 → hide autoprefixer warnings
──────────────────────────────────────────────────────────── */
