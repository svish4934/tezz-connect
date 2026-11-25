import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';

const pageHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sharedConsent = fs.readFileSync(new URL('../public/ads/tezz-consent.js', import.meta.url), 'utf8');
// The shared consent manager executes synchronously from the head before the
// page's static AdSense tag, so validate the effective execution order.
const html = sharedConsent + '\\n' + pageHtml;
const defaults = html.indexOf("gtag('consent', 'default'");
const adsUrl = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
const adsTag = html.indexOf(adsUrl);
const regionFetch = html.indexOf("fetch('/locale-country'");
const regulatedCountries = html.indexOf("var REGULATED_COUNTRIES = new Set");
const regulatedGuard = html.indexOf('if (!regionResolved || isRegulatedRegion) return;');
const pauseBeforeTag = html.indexOf('window.adsbygoogle.pauseAdRequests = 1;');
const staticAdsTag = html.indexOf('<script async id="tezz-ads"');
const dynamicAdsLoader = html.indexOf("function ensureAdSenseTag()");
const adsLoadOnOptIn = html.indexOf("if (prefs.ads) {");
const adsTagCreation = html.indexOf("ads.id = 'tezz-ads'");
const adsScriptAppend = html.indexOf("document.head.appendChild(ads)");
const regulatedAdsBootstrap = html.indexOf("ensureAdSenseTag();", html.indexOf("if (isRegulatedRegion) {"));
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
assert.equal(staticAdsTag, -1, 'No static AdSense tag may load before the region and consent decision');
assert.notEqual(dynamicAdsLoader, -1, 'AdSense must be loaded through the shared consent manager');
assert.notEqual(adsTag, -1, 'The AdSense loader URL must exist only in the dynamic consent-gated loader');
assert.notEqual(adsLoadOnOptIn, -1, 'Non-regulated AdSense loading must be inside the explicit ads opt-in branch');
assert.notEqual(adsTagCreation, -1, 'The dynamic AdSense script must use the shared tezz-ads identifier');
assert.notEqual(adsScriptAppend, -1, 'The dynamic AdSense script must be appended only by the consent manager');
assert.notEqual(regulatedAdsBootstrap, -1, 'Regulated regions must load the Google CMP bootstrap after country detection');
assert.ok(defaults < regionFetch && regionFetch < dynamicAdsLoader, 'Consent defaults and country lookup must precede any AdSense loading');
assert.ok(cmpCallback < regulatedAdsBootstrap, 'The TCF listener must be registered before the regulated CMP bootstrap');
assert.ok(html.includes("window.__tcfapi('addEventListener', 2.2"), 'Regulated regions must subscribe to the Google CMP TCF API');
assert.ok(html.includes("tcData.eventStatus === 'tcloaded'"), 'Stored TCF decisions must be recognized before resuming AdSense');
assert.ok(html.includes("tcData.eventStatus === 'useractioncomplete'"), 'New TCF decisions must be recognized before resuming AdSense');
assert.ok(html.includes("tcData.purpose.consents[1] === true"), 'European AdSense requests must require explicit TCF Purpose 1 consent');
assert.ok(html.includes('decisionReady && purposeOneAllowed ? 0 : 1'), 'European AdSense requests must remain paused unless the completed TCF decision grants Purpose 1');
assert.ok(v.includes('window.adsbygoogle.pauseAdRequests = 1;'), 'Ad requests must be paused before any regulated CMP bootstrap');
assert.equal(html.split(adsUrl).length - 1, 1, 'AdSense loader URL must appear exactly once in the dynamic loader');
assert.notEqual(regulatedGuard, -1, 'Local preferences must not update Google signals in regulated regions');
assert.ok(html.includes("'CONSENT_API_READY': function() {"), 'European privacy settings must wait for Google CMP consent API readiness');
assert.ok(html.includes('window.googlefc.showRevocationMessage();'), 'European privacy settings must call the documented Google CMP revocation method');
assert.ok(loadScripts < regulatedGuard && regulatedGuard < analyticsGate, 'Regional guard must run before local Google consent updates and analytics loading');
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
