import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseURL = process.env.PREVIEW_URL || 'http://127.0.0.1:8787';
const browser = await chromium.launch({ headless: true });

async function makePage(country) {
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36' });
  await context.addInitScript(() => {
    window.__tcfListener = null;
    window.__emitTcData = (tcData, success = true) => {
      if (window.__tcfListener) window.__tcfListener(tcData, success);
    };
    window.__tcfapi = (command, version, callback) => {
      if (command === 'addEventListener' && version === 2.2) {
        window.__tcfListener = callback;
      }
    };
  });
  const page = await context.newPage();
  await page.route('**/locale-country**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ country })
  }));
  await page.route('https://pagead2.googlesyndication.com/**', route => route.fulfill({
    status: 200, contentType: 'application/javascript', body: 'window.__mockAdsLoaded = true;'
  }));
  await page.route('https://www.googletagmanager.com/**', route => route.fulfill({
    status: 200, contentType: 'application/javascript', body: 'window.__mockAnalyticsLoaded = true;'
  }));
  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  const countryRequests = [];
  page.on('request', request => { if (request.url().includes('locale-country')) countryRequests.push(request.url()); });
  const countryResponses = [];
  page.on('response', response => {
    if (response.url().includes('/locale-country')) countryResponses.push({ status: response.status(), url: response.url() });
  });
  await page.goto(baseURL + '/', { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => window.adsbygoogle && typeof window.adsbygoogle.pauseAdRequests === 'number', { timeout: 10000 });
  } catch (error) {
    throw new Error(`Consent initialization did not complete for ${country}. URL=${page.url()} countryRequests=${JSON.stringify(countryRequests)} countryResponses=${JSON.stringify(countryResponses)} pageErrors=${JSON.stringify(pageErrors)} consoleErrors=${JSON.stringify(consoleErrors)} failedRequests=${JSON.stringify(failedRequests)} adsTag=${await page.locator('#tezz-ads').count()} body=${(await page.locator('body').innerText()).slice(0, 300)}; ${error.message}`);
  }
  return { context, page };
}

try {
  // India: local choices control advertising and analytics opt-in.
  {
    const { context, page } = await makePage('IN');
    await page.waitForSelector('#tezz-cookie-panel');
    assert.equal(await page.evaluate(() => window.adsbygoogle.pauseAdRequests), 1,
      'India: ad requests must start paused');
    await page.locator('[data-action="reject"]').click();
    assert.equal(await page.evaluate(() => window.adsbygoogle.pauseAdRequests), 1,
      'India: rejecting optional cookies must keep ads paused');
    await page.locator('#tezz-cookie-reopen').click();
    await page.waitForSelector('#tezz-cookie-panel [data-action="accept"]');
    await page.locator('#tezz-cookie-panel [data-action="accept"]').click();
    await page.waitForFunction(() => window.adsbygoogle.pauseAdRequests === 0);
    await page.waitForFunction(() => !!document.getElementById('tezz-ga'));
    assert.equal(await page.evaluate(() => window.dataLayer.some(
      item => item && item[0] === 'consent' && item[1] === 'update' &&
        item[2] && item[2].analytics_storage === 'granted' && item[2].ad_storage === 'granted'
    )), true, 'India: accept must update analytics and advertising consent');
    await context.close();
    console.log('PASS India: reject and accept control ad requests; analytics loads only after opt-in');
  }

  // EEA: the site's generic banner is hidden; the CMP TCF Purpose 1 signal is authoritative.
  {
    const { context, page } = await makePage('DE');
    await page.waitForFunction(() => !!document.getElementById('tezz-ads'));
    assert.equal(await page.evaluate(() => window.adsbygoogle.pauseAdRequests), 1,
      'EEA: ad requests must remain paused before a TCF decision');
    assert.equal(await page.locator('#tezz-cookie-panel').count(), 0,
      'EEA: local cookie panel must not replace the Google CMP');
    await page.waitForFunction(() => window.googlefc && Array.isArray(window.googlefc.callbackQueue));
    await page.evaluate(() => {
      const entry = window.googlefc.callbackQueue.find(item => item && item.CONSENT_API_READY);
      if (!entry) throw new Error('Google CMP consent-ready callback was not queued');
      entry.CONSENT_API_READY();
    });
    await page.waitForFunction(() => typeof window.__tcfListener === 'function');
    await page.evaluate(() => window.__emitTcData({
      eventStatus: 'tcloaded',
      purpose: { consents: { 1: false } }
    }));
    assert.equal(await page.evaluate(() => window.adsbygoogle.pauseAdRequests), 1,
      'EEA: Purpose 1 denied must keep ad requests paused');
    await page.evaluate(() => window.__emitTcData({
      eventStatus: 'useractioncomplete',
      purpose: { consents: { 1: true } }
    }));
    await page.waitForFunction(() => window.adsbygoogle.pauseAdRequests === 0);
    await page.evaluate(() => window.__emitTcData({
      eventStatus: 'useractioncomplete',
      purpose: { consents: { 1: false } }
    }));
    await page.waitForFunction(() => window.adsbygoogle.pauseAdRequests === 1);
    await context.close();
    console.log('PASS EEA: TCF Purpose 1 gates ad requests; withdrawal pauses them again');
  }

  // Unknown country: fail closed and do not expose the site's local consent UI.
  {
    const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36' });
    const page = await context.newPage();
    await page.route('**/locale-country', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ country: '??' })
    }));
    await page.route('https://pagead2.googlesyndication.com/**', route => route.fulfill({
      status: 200, contentType: 'application/javascript', body: ''
    }));
    await page.goto(baseURL + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.adsbygoogle && typeof window.adsbygoogle.pauseAdRequests === 'number');
    assert.equal(await page.evaluate(() => window.adsbygoogle.pauseAdRequests), 1,
      'Unknown country: ad requests must remain paused');
    assert.equal(await page.locator('#tezz-cookie-panel').count(), 0,
      'Unknown country: local consent UI must remain hidden');
    await context.close();
    console.log('PASS unknown country: fail-closed ad requests');
  }
} finally {
  await browser.close();
}
