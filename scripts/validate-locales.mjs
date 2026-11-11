import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';

const root = process.cwd();
const manifestPath = resolve(root, 'public/locales/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const fail = message => {
  console.error(`Locale validation failed: ${message}`);
  process.exitCode = 1;
};

if (manifest.version !== 1) fail('unsupported manifest version');
if (!Array.isArray(manifest.locales) || manifest.locales.length === 0) fail('locales must be a non-empty array');

const codes = new Set();
for (const locale of manifest.locales || []) {
  if (!locale || typeof locale.code !== 'string') {
    fail('every locale needs a BCP 47 code');
    continue;
  }
  if (codes.has(locale.code)) fail(`duplicate locale code: ${locale.code}`);
  codes.add(locale.code);

  try {
    const parsed = new Intl.Locale(locale.code);
    if (parsed.toString() !== locale.code) fail(`use canonical BCP 47 casing for ${locale.code}`);
  } catch {
    fail(`invalid BCP 47 locale code: ${locale.code}`);
  }

  if (!locale.nativeName || typeof locale.nativeName !== 'string') fail(`${locale.code}: nativeName is required`);
  if (!['ltr', 'rtl'].includes(locale.direction)) fail(`${locale.code}: direction must be ltr or rtl`);
  if (locale.status === 'published' && !['complete', 'starter'].includes(locale.coverage)) {
    fail(`${locale.code}: published locale needs a coverage marker`);
  }

  if (locale.bundle) {
    if (typeof locale.bundle !== 'string' || !locale.bundle.startsWith('/locales/') || locale.bundle.includes('..')) {
      fail(`${locale.code}: bundle must be a safe /locales/ asset path`);
      continue;
    }
    const bundlePath = resolve(root, 'public', locale.bundle.slice(1));
    const rel = relative(resolve(root, 'public'), bundlePath);
    if (rel.startsWith('..') || rel.split(sep).includes('..')) {
      fail(`${locale.code}: bundle path escapes public assets`);
      continue;
    }
    if (!existsSync(bundlePath)) {
      fail(`${locale.code}: missing bundle file ${locale.bundle}`);
      continue;
    }
    try {
      const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
      if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) fail(`${locale.code}: bundle must be a JSON object`);
      for (const [key, value] of Object.entries(bundle)) {
        if (key !== '_meta' && typeof value !== 'string') fail(`${locale.code}: translation for "${key}" must be a string`);
      }
    } catch (error) {
      fail(`${locale.code}: invalid JSON bundle (${error.message})`);
    }
  }
}

// Scan every Knowledge Hub guide (HTML and JavaScript), including inline scripts,
// so dynamically rendered labels cannot silently fall back to English.
const guideRoot = resolve(root, 'public/guides');
const sourceFiles = [];
function collectSources(directory) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) collectSources(path);
    else if (/\\.(?:html?|js|mjs|ts|tsx)$/.test(entry.name)) sourceFiles.push(path);
  }
}
collectSources(guideRoot);

const referencedKeys = new Set();
const dynamicKeys = new Set();
for (const sourcePath of sourceFiles) {
  const source = readFileSync(sourcePath, 'utf8');
  for (const match of source.matchAll(/data-i18n(?:-[\\w-]+)?=["']([^"']+)["']/g)) referencedKeys.add(match[1]);
  // Covers t('key'), window.TEZZLanguage.t('key'), and equivalent literal calls.
  for (const match of source.matchAll(/(?:\\b|\\.)t\\(\\s*["']([^"']+)["']\\s*\\)/g)) {
    referencedKeys.add(match[1]);
    dynamicKeys.add(match[1]);
  }
}

// The English fallback dictionary is the source of truth for dynamically requested keys.
const runtimePath = resolve(root, 'public/language.js');
if (!existsSync(runtimePath)) {
  fail('missing public/language.js English fallback runtime');
} else {
  const runtime = readFileSync(runtimePath, 'utf8');
  const fallbackKeys = new Set([...runtime.matchAll(/^\\s*'([^']+)'\\s*:/gm)].map(match => match[1]));
  const missingFallbacks = [...dynamicKeys].filter(key => !fallbackKeys.has(key));
  if (missingFallbacks.length) fail(`English runtime fallback missing dynamic keys: ${missingFallbacks.join(', ')}`);
}

for (const locale of manifest.locales || []) {
  if (locale.status !== 'published' || !locale.bundle || locale.code === 'en') continue;
  const bundlePath = resolve(root, 'public', locale.bundle.slice(1));
  if (!existsSync(bundlePath)) continue;
  try {
    const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
    const missing = [...referencedKeys].filter(key => typeof bundle[key] !== 'string' || !bundle[key].trim());
    if (missing.length) fail(`${locale.code}: missing guide translation keys: ${missing.join(', ')}`);
  } catch {
    // The bundle parser above reports malformed JSON with the locale-specific path.
  }
}

if (!codes.has(manifest.defaultLocale)) fail('defaultLocale must exist in locales');
if (!codes.has(manifest.fallbackLocale)) fail('fallbackLocale must exist in locales');
if (!manifest.locales.some(locale => locale.code === 'en' && locale.status === 'published')) {
  fail('English must remain a published fallback');
}

if (!process.exitCode) console.log(`Locale manifest valid: ${manifest.locales.length} locale(s), default ${manifest.defaultLocale}.`);
