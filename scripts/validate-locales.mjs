import { readFileSync, existsSync } from 'node:fs';
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

if (!codes.has(manifest.defaultLocale)) fail('defaultLocale must exist in locales');
if (!codes.has(manifest.fallbackLocale)) fail('fallbackLocale must exist in locales');
if (!manifest.locales.some(locale => locale.code === 'en' && locale.status === 'published')) {
  fail('English must remain a published fallback');
}

if (!process.exitCode) console.log(`Locale manifest valid: ${manifest.locales.length} locale(s), default ${manifest.defaultLocale}.`);
