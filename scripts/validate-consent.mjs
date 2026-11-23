import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const defaults = html.indexOf("gtag('consent', 'default'");
const adsUrl = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
const adsTag = html.indexOf(adsUrl);
const pauseBeforeTag = html.indexOf('window.adsbygoogle.pauseAdRequests = 1;');
const consentPauseGate = html.indexOf('window.adsbygoogle.pauseAdRequests = prefs.ads ? 0 : 1;');
const loadScripts = html.indexOf('function loadScripts(prefs)');
const analyticsGate = html.indexOf("if (prefs.analytics && !document.getElementById('tezz-ga'))");
const save = html.indexOf('function save(prefs)');
const withdrawal = html.indexOf('if (withdrawingAds) window.location.reload();');
const reject = html.indexOf('save({analytics:false,ads:false})');

assert.notEqual(defaults, -1, 'Google consent defaults must be present');
assert.notEqual(adsTag, -1, 'AdSense tag must be present for Google CMP detection');
assert.ok(defaults < pauseBeforeTag && pauseBeforeTag < adsTag, 'Consent defaults and paused requests must be set before AdSense tag insertion');
assert.notEqual(consentPauseGate, -1, 'Ad requests must remain paused unless advertising consent is true');
assert.ok(adsTag < consentPauseGate, 'Consent-based resume must follow AdSense tag setup');
assert.equal(html.split(adsUrl).length - 1, 1, 'AdSense loader URL must appear exactly once');
assert.notEqual(loadScripts, -1, 'Consent update function must exist');
assert.notEqual(analyticsGate, -1, 'Analytics opt-in gate must exist');
assert.ok(loadScripts < analyticsGate, 'Analytics opt-in gate must follow loadScripts declaration');
assert.notEqual(save, -1, 'Consent save function must exist');
assert.ok(save < withdrawal, 'Advertising withdrawal handling must be inside save');
assert.notEqual(reject, -1, 'Reject optional action must save both optional categories as false');

for (const signal of ['analytics_storage', 'ad_storage', 'ad_user_data', 'ad_personalization']) {
  assert.ok(html.includes(signal + ": 'denied'"), signal + ' must default to denied');
}
console.log('Consent source checks passed. These checks do not verify live network requests, browser storage, or regional CMP behaviour.');
