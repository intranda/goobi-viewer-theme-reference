const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const theme = path.resolve(__dirname, '..');
const roots = {
    theme: path.join(theme, 'WebContent/resources/themes/reference/css/less'),
    core: path.resolve(theme, '../goobi-viewer-core/src/main/resources/META-INF/resources/resources/css/less'),
};
const files = {};
for (const [origin, root] of Object.entries(roots)) {
    const paths = execFileSync('rg', ['--files', '-g', '*.less'], { cwd: root, encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter((file) => file && !file.startsWith('admin/'));
    for (const file of paths) {
        const source = fs.readFileSync(path.join(root, file), 'utf8');
        const clean = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
        const references = [];
        const expressions = [];
        clean.split('\n').forEach((line, index) => {
            if (line.trim().startsWith('//')) return;
            for (const match of line.matchAll(/var\(\s*(--[\w-]+)/g)) {
                references.push({ line: index + 1, token: match[1] });
            }
            const declaration = /^\s*([\w-]+)\s*:\s*(.+)/.exec(line);
            if (
                declaration &&
                /^(?:color|fill|stroke|background|border|outline|box-shadow|text-shadow|caret-color|accent-color|scrollbar-color)(?:-|$)/.test(
                    declaration[1]
                ) &&
                /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|color-mix)\(/i.test(declaration[2])
            ) {
                expressions.push({ line: index + 1, property: declaration[1], value: declaration[2].trim() });
            }
        });
        (files[file] ??= {})[origin] = { references, expressions };
    }
}

const records = Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, data]) => ({ file, ...data }));
const directBrand = (references = []) =>
    references.filter(({ token }) =>
        ['--brand', '--bg-brand', '--bg-brand-hover', '--fg-on-brand', '--color-brand', '--color-brand-dark'].includes(
            token
        )
    );
const canonicalRoles = new Set([
    '--bg-content-box',
    '--bg-subtle',
    '--fg-content-box',
    '--fg-secondary',
    '--border-input',
    '--border-default',
    '--bg-hover',
    '--bg-selected',
    '--fg-link',
    '--outline-focus',
    '--fg-heading-content-box',
    '--fg-hover',
    '--fg-selected',
]);
const rows = records.map((record) => {
    const refs = record.theme?.references ?? [];
    const shared = refs.filter(({ token }) => canonicalRoles.has(token));
    return `| ${record.file} | ${record.theme ? 'ja' : 'fehlt'} | ${record.core ? 'ja' : 'nein'} | ${shared.length} | ${directBrand(refs).length} | ${record.theme?.expressions.length ?? 0} |`;
});
const output = path.join(theme, 'doc/architecture');
fs.writeFileSync(
    path.join(output, 'color-usage.json'),
    JSON.stringify(
        {
            method: 'Static LESS references and candidate expressions with source line numbers. Excludes core admin directory. Not CSS cascade analysis or runtime coverage; frontend admin controls still need review. Inherited core references are retained separately.',
            records,
        },
        null,
        2
    ) + '\n'
);
fs.writeFileSync(
    path.join(output, 'color-usage.md'),
    [
        '# Farbverwendung im gesamten LESS-Inventar',
        '',
        'Erzeugt mit `node scripts/audit-color-usage.cjs`. Vollständige Referenzen einschließlich Quelldatei, Herkunft und Zeilennummer stehen in [color-usage.json](color-usage.json).',
        '',
        'Statische Fundstellen sind Prüfkandidaten, keine automatisch bestätigten Fehler. Ein direktes Markentoken kann fachlich richtig sein. Null gezählte gemeinsame Rollen bedeutet keine fehlende Gestaltung: geerbte Core-Regeln stehen separat im Register. Zahlen zählen Vorkommen, nicht Komponenten oder geprüfte Zustände. Gerüstdateien bleiben erhalten.',
        '',
        'Das Core-Verzeichnis `admin/` ist ausgeschlossen. CMS-Pfade können ebenfalls Editor-Helfer enthalten und müssen nach tatsächlichem Einsatz klassifiziert werden. Das ist keine Laufzeitprüfung der Admin-Abgrenzung; Frontend-Admin-Controls und eingebettete Vorschauen bleiben gesondert zu prüfen. Die Prüfung umfasst auch Crowdsourcing, CMS, Layout, Widgets und besondere Ansichten.',
        '',
        '| Relativer LESS-Pfad | Theme-Datei | Core-Datei | Gemeinsame Rollenreferenzen im Theme | Direkte Markenrollen im Theme | Lokale Farbausdrücke im Theme |',
        '|---|---|---|---:|---:|---:|',
        ...rows,
        '',
    ].join('\n')
);
console.log(
    JSON.stringify({
        files: records.length,
        themeFiles: records.filter((r) => r.theme).length,
        coreFiles: records.filter((r) => r.core).length,
        themeFilesWithDirectBrandReferences: records.filter((r) => directBrand(r.theme?.references).length).length,
        themeFilesWithColorExpressions: records.filter((r) => r.theme?.expressions.length).length,
    })
);
