// Runtime color audit. Loads public pages in light, dark and system-dark, reads the computed colors of
// every visible element and reports: colors outside the theme palette, neutral colors that do not
// change between light and dark, and differences between the dark class and the system preference.
// Needs a running viewer and playwright: `npm i -D playwright && npx playwright install chromium`.
const fs = require('node:fs');
const path = require('node:path');

const base = process.env.VIEWER_BASE || 'http://localhost:8080/viewer';
const pages = (
    process.env.VIEWER_PAGES ||
    [
        '/',
        '/search/',
        '/search/-/Vermerk/1/-/-/',
        '/search/-/Vermerk/1/-/-/?view=grid',
        '/searchadvanced/',
        '/searchcalendar/',
        '/browse/',
        '/tags/',
        '/timematrix/',
        '/statistics/',
        '/sitelinks/',
        '/privacy/',
        '/feedback/',
        '/bookmarks/',
        '/archives/',
        '/image/lit29507/1/',
        '/toc/lit29507/1/',
        '/metadata/lit29507/1/',
        '/fulltext/lit29507/1/',
        '/thumbs/lit29507/1/',
        '/immersive/lit29507/1/',
    ].join(',')
).split(',');
const out = path.resolve(__dirname, '../doc/architecture/runtime-colors');

// Runs inside the page: palette from every :root custom property, then every visible element's colors.
function collect() {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;opacity:0;pointer-events:none';
    document.body.appendChild(probe);
    const names = new Set();
    const walk = (rules) => {
        for (const rule of rules) {
            if (rule.style) for (const prop of rule.style) if (prop.startsWith('--')) names.add(prop);
            if (rule.cssRules) walk(rule.cssRules);
        }
    };
    for (const sheet of document.styleSheets) {
        try {
            walk(sheet.cssRules);
        } catch {
            /* cross-origin sheet */
        }
    }
    const norm = (c) => {
        const m = /^(?:rgb|color\(srgb)a?\(?\s*([\d.]+)[, ]\s*([\d.]+)[, ]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\)?$/.exec(
            c || ''
        );
        if (!m)
            return c === 'rgba(0, 0, 0, 0)' || c === 'transparent' ? { rgb: 'transparent', a: 0 } : { rgb: c, a: 1 };
        return { rgb: `${m[1]},${m[2]},${m[3]}`, a: m[4] === undefined ? 1 : Number(m[4]) };
    };
    const allowed = {};
    for (const name of names) {
        probe.style.color = '';
        probe.style.color = `var(${name})`;
        const v = norm(getComputedStyle(probe).color);
        if (v.a > 0 && v.rgb !== 'transparent') (allowed[v.rgb] ||= []).push(name);
    }
    probe.remove();
    const neutrals = Object.entries(allowed)
        .filter(([, ns]) => ns.some((n) => /^--color-neutral-(50|100|200|400|500|600|700|800|900|950)$/.test(n)))
        .map(([rgb]) => rgb);
    const describe = (el) => {
        const parts = [];
        for (let e = el; e && e.nodeType === 1 && parts.length < 4; e = e.parentElement) {
            let s = e.tagName.toLowerCase();
            if (e.id) s += `#${e.id}`;
            else if (e.classList.length) s += `.${[...e.classList].slice(0, 2).join('.')}`;
            parts.unshift(s);
        }
        return parts.join(' > ');
    };
    const elements = [];
    for (const el of document.querySelectorAll('body *')) {
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
        const props = { color: cs.color, bg: cs.backgroundColor };
        if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') props.border = cs.borderTopColor;
        if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) props.outline = cs.outlineColor;
        const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        elements.push({ path: describe(el), hasText, props });
    }
    return { allowed, neutrals, elements };
}

function analyze(page, light, dark, system) {
    const norm = (c) => {
        const m = /^(?:rgba?|color\(srgb)\(?\s*([\d.]+)[, ]\s*([\d.]+)[, ]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\)?$/.exec(
            (c || '').trim()
        );
        if (!m) return { rgb: c, a: c === 'transparent' || c === 'rgba(0, 0, 0, 0)' ? 0 : 1 };
        return { rgb: `${m[1]},${m[2]},${m[3]}`, a: m[4] === undefined ? 1 : Number(m[4]) };
    };
    const foreign = {};
    for (const [mode, data] of [
        ['light', light],
        ['dark', dark],
    ]) {
        for (const el of data.elements) {
            for (const [prop, value] of Object.entries(el.props)) {
                const v = norm(value);
                if (v.a === 0 || v.rgb === 'transparent' || data.allowed[v.rgb]) continue;
                if (prop === 'color' && !el.hasText) continue;
                const key = `${mode} ${prop} ${value} @ ${el.path}`;
                foreign[key] = (foreign[key] || 0) + 1;
            }
        }
    }
    const byToken = (data) =>
        Object.fromEntries(Object.entries(data.allowed).flatMap(([rgb, names]) => names.map((n) => [n, rgb])));
    const lightTokens = byToken(light),
        darkTokens = byToken(dark);
    const fixedNeutrals = new Set(
        Object.keys(lightTokens)
            .filter((n) => !n.startsWith('--color-') && lightTokens[n] === darkTokens[n])
            .map((n) => lightTokens[n])
    );
    const stuck = {};
    light.elements.forEach((el, i) => {
        const d = dark.elements[i];
        if (!d || d.path !== el.path) return;
        for (const prop of ['color', 'bg', 'border']) {
            if (!el.props[prop] || el.props[prop] !== d.props[prop]) continue;
            if (prop === 'color' && !el.hasText) continue;
            const v = norm(el.props[prop]);
            if (v.a === 0 || !light.neutrals.includes(v.rgb) || fixedNeutrals.has(v.rgb)) continue;
            const key = `${prop} ${el.props[prop]} @ ${el.path}`;
            stuck[key] = (stuck[key] || 0) + 1;
        }
    });
    const systemDiff = {};
    dark.elements.forEach((el, i) => {
        const s = system.elements[i];
        if (!s || s.path !== el.path) return;
        for (const prop of Object.keys(el.props)) {
            if (el.props[prop] === s.props[prop]) continue;
            const key = `${prop} class=${el.props[prop]} system=${s.props[prop]} @ ${el.path}`;
            systemDiff[key] = (systemDiff[key] || 0) + 1;
        }
    });
    return { page, elements: light.elements.length, foreign, stuck, systemDiff };
}

async function main() {
    let playwright;
    try {
        playwright = require('playwright');
    } catch {
        console.error('playwright is not installed: npm i -D playwright && npx playwright install chromium');
        process.exit(2);
    }
    const browser = await playwright.chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    const results = [];
    for (const route of pages) {
        await page.emulateMedia({ colorScheme: 'light' });
        await page.goto(base + route, { waitUntil: 'load', timeout: 60000 });
        await page.addStyleTag({
            content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
        });
        await page.waitForTimeout(800);
        const setMode = (cls) =>
            page.evaluate((c) => {
                document.documentElement.classList.remove('color-theme-light', 'color-theme-dark');
                if (c) document.documentElement.classList.add(c);
            }, cls);
        await setMode('color-theme-light');
        const light = await page.evaluate(collect);
        await setMode('color-theme-dark');
        const dark = await page.evaluate(collect);
        await setMode(null);
        await page.emulateMedia({ colorScheme: 'dark' });
        const system = await page.evaluate(collect);
        results.push(analyze(route, light, dark, system));
    }
    await browser.close();
    fs.writeFileSync(`${out}.json`, JSON.stringify(results, null, 1));
    const lines = [
        '# Laufzeit-Farbprüfung',
        '',
        `Stand: ${new Date().toISOString().slice(0, 10)}. Basis: ${base}. Erzeugt von \`scripts/audit-runtime-colors.cjs\`.`,
        '',
    ];
    for (const r of results) {
        const count = (o) => Object.keys(o).length;
        lines.push(
            `## ${r.page}`,
            '',
            `${r.elements} Elemente; fremde Farben: ${count(r.foreign)}, unveränderte Neutraltöne: ${count(r.stuck)}, Klasse ≠ System: ${count(r.systemDiff)}`,
            ''
        );
        for (const [title, o] of [
            ['Fremde Farben', r.foreign],
            ['Neutraltöne ohne Moduswechsel', r.stuck],
            ['Dark-Klasse ≠ Systemmodus', r.systemDiff],
        ]) {
            if (!count(o)) continue;
            lines.push(`### ${title}`, '');
            Object.entries(o)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 40)
                .forEach(([k, n]) => lines.push(`- ${n}× ${k}`));
            lines.push('');
        }
    }
    fs.writeFileSync(`${out}.md`, lines.join('\n'));
    console.log(
        results
            .map(
                (r) =>
                    `${r.page}: ${r.elements} elements, ${Object.keys(r.foreign).length} foreign, ${Object.keys(r.stuck).length} stuck, ${Object.keys(r.systemDiff).length} system diffs`
            )
            .join('\n')
    );
}

if (require.main === module)
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
module.exports = { collect, analyze };
