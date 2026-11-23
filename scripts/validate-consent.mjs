import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const defaults = html.indexOf("gtag('consent', 'default'");
const adsUrl = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
const adsTag = html.indexOf(adsUrl);
const regionFetch = html.indexOf("fetch('/locale-country'");
const regulatedCountries = html.indexOf("var REGULATED_COUNTRIES = new Set");
const regulatedGuard = html.indexOf('if (!regionResolved || isRegulatedRegion) return;');
const staticAdsTag = html.indexOf('<script async id="tezz-ads"');
const cmpCallback = html.indexOf("'CONSENT_API_READY': function() {");
const loadScripts = html.indexOf('function loadScripts(prefs)');
const analyticsGate = html.indexOf("if (prefs.analytics && !document.getElementById('tezz-ga'))");
const save = html.indexOf('function save(prefs)');
const withdrawal = html.indexOf('if (withdrawingAds) window.location.reload();');
const reject = html.indexOf('save({analytics:false,ads:false})');

assert.notEqual(defaults, -1, 'Google consent defaults must be present');
assert.notEqual(regionFetch, -1, 'Cloudflare country lookup must select the consent path');
assert.notEqual(regulatedCountries, -1, 'EEA, UK and Switzerland country list must exist');
assert.ok(defaults < regionFetch, 'Consent defaults must precede region lookup');
assert.ok(!html.includes('pauseAdRequests'), 'Ad requests must not be globally paused; Google CMP/Consent Mode handles consent signals');
assert.notEqual(staticAdsTag, -1, 'AdSense tag must be present in the initial HTML for Google CMP discovery');
assert.notEqual(adsTag, -1, 'AdSense tag must remain available for Google CMP detection');
assert.ok(regionFetch < staticAdsTag, 'Country lookup must start before the static AdSense tag is encountered');
assert.ok(cmpCallback < staticAdsTag, 'Google CMP callback must be registered before the AdSense tag loads');
assert.equal(html.split(adsUrl).length - 1, 1, 'AdSense loader URL must appear exactly once');
assert.ok(html.includes("'CONSENT_API_READY': function() {"), 'European privacy settings must wait for Google CMP consent API readiness');
assert.ok(html.includes('window.googlefc.showRevocationMessage();'), 'European privacy settings must call the documented Google CMP revocation method');
assert.ok(loadScripts < analyticsGate, 'Consent update and analytics loading must remain in the consent handler');
assert.notEqual(save, -1, 'Consent save function must exist');
assert.ok(save < withdrawal, 'Advertising withdrawal handling must be inside save');
assert.notEqual(reject, -1, 'Reject optional action must save both optional categories as false');

for (const signal of ['analytics_storage', 'ad_storage', 'ad_user_data', 'ad_personalization']) {
  assert.ok(html.includes(signal + ": 'denied'"), signal + ' must default to denied');
}

function collectHtmlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectHtmlFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.html') ? [fullPath] : [];
  });
}

const publicHtmlFiles = collectHtmlFiles(path.resolve('public'));
const analyticsPattern = /https:\/\/www\.googletagmanager\.com\/gtag\/js|G-SL6RDF7GHX/;
const analyticsBypassFiles = publicHtmlFiles
  .filter(filePath => analyticsPattern.test(fs.readFileSync(filePath, 'utf8')))
  .map(filePath => filePath);
assert.deepEqual(analyticsBypassFiles, [], 'Static public HTML must not load Google Analytics outside the consent gate');

console.log('Regional consent source checks passed. Live CMP, TCF strings, cookies and network requests still require browser verification.');
