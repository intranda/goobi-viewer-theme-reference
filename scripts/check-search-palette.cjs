// Stress test: the theme must survive a customer palette. The real palette, mode symmetry and
// source discipline are checked by the core (gulp/tokenCheck.js, rules R1-R16).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const less = require('less');
const postcss = require('postcss');
const stressPalettes = require('./fixtures/ui-palettes.json');

const theme = path.resolve(__dirname, '..');
const source = path.join(theme, 'WebContent/resources/themes/reference/css/less');
const coreCss = path.resolve(
    theme,
    '../goobi-viewer-core/src/main/resources/META-INF/resources/resources/css/dist/viewer.min.css'
);
const entries = [
    'constructor.less',
    'subthemes/subtheme1/subThemeConstructor.less',
    'subthemes/subtheme2/subThemeConstructor.less',
];

function rootTokens(css, mode, tokens) {
    postcss.parse(css).walkRules((rule) => {
        if (![':root', `.color-theme-${mode}`].includes(rule.selector)) return;
        for (let parent = rule.parent; parent; parent = parent.parent) {
            if (parent.type !== 'atrule') continue;
            if (parent.name === 'media' && !(mode === 'dark' && parent.params === '(prefers-color-scheme: dark)'))
                return;
        }
        rule.nodes
            .filter((node) => node.type === 'decl' && node.prop.startsWith('--'))
            .forEach((node) => {
                tokens[node.prop] = node.value;
            });
    });
    return tokens;
}

function resolve(value, tokens, seen = []) {
    return value.replace(/var\((--[\w-]+)\)/g, (_, name) => {
        assert.ok(tokens[name], `Missing token: ${name}`);
        assert.ok(!seen.includes(name), `Cyclic token: ${[...seen, name].join(' → ')}`);
        return resolve(tokens[name], tokens, [...seen, name]);
    });
}

function splitTopLevel(text) {
    const parts = [];
    let depth = 0;
    let current = '';
    for (const char of text) {
        if (char === '(') depth++;
        if (char === ')') depth--;
        if (char === ',' && depth === 0) {
            parts.push(current.trim());
            current = '';
        } else current += char;
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
}

// Hex colors and (nested) `color-mix(in srgb, A p%, B)` with opaque inputs.
function channels(value) {
    const text = value.trim();
    const short = /^#([\da-f])([\da-f])([\da-f])$/i.exec(text);
    if (short) return channels(`#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`);
    const hex = /^#([\da-f]{6})$/i.exec(text);
    if (hex) return [0, 2, 4].map((offset) => parseInt(hex[1].slice(offset, offset + 2), 16) / 255);
    if (text.startsWith('color-mix(') && text.endsWith(')')) {
        const [space, first, second] = splitTopLevel(text.slice('color-mix('.length, -1));
        assert.equal(space, 'in srgb', `Only srgb mixes are checked: ${value}`);
        const part = (entry) => {
            const m = /^(.*?)\s+([\d.]+)%$/.exec(entry);
            return m ? { color: m[1].trim(), weight: Number(m[2]) / 100 } : { color: entry, weight: null };
        };
        const a = part(first);
        const b = part(second);
        if (a.weight === null && b.weight === null) a.weight = b.weight = 0.5;
        else if (a.weight === null) a.weight = 1 - b.weight;
        else if (b.weight === null) b.weight = 1 - a.weight;
        const ca = channels(a.color);
        const cb = channels(b.color);
        return ca.map((channel, i) => channel * a.weight + cb[i] * b.weight);
    }
    assert.fail(`Unsupported color expression; extend the checker explicitly: ${value}`);
}

function luminance(rgb) {
    return rgb
        .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
        .reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0);
}

const { CONTRAST_PAIRS: pairs } = require('../../goobi-viewer-core/gulp/tokenCheck');

// Every role must resolve to a theme color: no core gray/slate may leak through.
function normalizeHex(value) {
    return value.toLowerCase().replace(/#([\da-f])([\da-f])([\da-f])\b/g, '#$1$1$2$2$3$3');
}

function coverage(entry, mode, tokens, coreTokens) {
    const themeColors = new Set(
        Object.entries(tokens)
            .filter(
                ([name]) => name.startsWith('--color-') && !(name in coreTokens && tokens[name] === coreTokens[name])
            )
            .map(([, value]) => normalizeHex(resolve(value, tokens)))
    );
    const coreNeutrals = Object.entries(coreTokens)
        .filter(([name]) => /^--color-(gray|slate)-/.test(name))
        .map(([, value]) => normalizeHex(resolve(value, coreTokens)))
        .filter((value) => !themeColors.has(value));
    const leaks = [];
    for (const [name, value] of Object.entries(tokens)) {
        if (name.startsWith('--color-')) continue;
        const resolved = normalizeHex(resolve(value, tokens));
        const hit = coreNeutrals.find((hex) => resolved.includes(hex));
        if (hit) leaks.push(`${entry} ${mode}: ${name} resolves to core neutral ${hit}`);
    }
    return leaks;
}

async function main() {
    const core = fs.readFileSync(coreCss, 'utf8');
    let checks = 0;
    const failures = [];
    for (const entry of entries) {
        const filename = path.join(source, entry);
        const result = await less.render(fs.readFileSync(filename, 'utf8'), {
            filename,
            paths: [source, path.join(source, 'crowdsourcing'), path.dirname(filename)],
            compress: true,
        });
        const variants = [['default', {}]];
        if (entry === 'constructor.less') variants.push(...Object.entries(stressPalettes));
        for (const [paletteName, overrides] of variants) {
            assert.ok(Object.keys(overrides).every((name) => name.startsWith('--color-')));
            const overrideCss = `:root {${Object.entries(overrides)
                .map(([name, value]) => `${name}: ${value};`)
                .join('')}}`;
            const css = result.css + overrideCss;
            for (const mode of ['light', 'dark']) {
                const coreTokens = rootTokens(core, mode, {});
                const tokens = rootTokens(css, mode, { ...coreTokens });
                if (paletteName === 'default') {
                    failures.push(...coverage(entry, mode, tokens, coreTokens));
                    continue;
                }
                let minimum = Infinity;
                for (const [label, foreground, background, threshold] of pairs) {
                    const a = luminance(channels(resolve(`var(${foreground})`, tokens)));
                    const b = luminance(channels(resolve(`var(${background})`, tokens)));
                    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
                    minimum = Math.min(minimum, ratio);
                    checks++;
                    if (ratio < threshold)
                        failures.push(`${entry} ${paletteName} ${mode}: ${label} ${ratio.toFixed(2)} < ${threshold}`);
                }
                console.log(
                    `${entry} ${paletteName} ${mode}: ${pairs.length} pairs, lowest contrast ${minimum.toFixed(2)}:1`
                );
            }
        }
    }
    assert.equal(failures.length, 0, failures.join('\n'));
    console.log(
        `${checks} contrast checks against swapped customer palettes passed. The shipped palette is checked by the core token check (R14).`
    );
}

if (require.main === module)
    main().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });

module.exports = { rootTokens, resolve, channels, luminance, coverage };
