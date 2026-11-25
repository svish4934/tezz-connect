(function () {
  'use strict';
  if (window.__tezzContentAdsInitialized) return;
  window.__tezzContentAdsInitialized = true;

  var PUBLISHER = 'ca-pub-3893813894265886';
  var KEY = 'tezz_cookie_consent_v1';
  var regulated = new Set([
    'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE',
    'IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE',
    'GB','CH'
  ]);
  var prefs = null;
  try { prefs = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    analytics_storage: 'denied', ad_storage: 'denied',
    ad_user_data: 'denied', ad_personalization: 'denied',
    functionality_storage: 'granted', security_storage: 'granted'
  });
  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.pauseAdRequests = 1;

  function loadAdSense() {
    if (document.getElementById('tezz-content-adsense')) return;
    var tag = document.createElement('script');
    tag.id = 'tezz-content-adsense';
    tag.async = true;
    tag.crossOrigin = 'anonymous';
    tag.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + PUBLISHER;
    document.head.appendChild(tag);
  }

  function setChoice(ads) {
    prefs = { necessary: true, analytics: !!(prefs && prefs.analytics), ads: !!ads, updatedAt: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (_) {}
    if (ads) {
      window.adsbygoogle.pauseAdRequests = 0;
      window.gtag('consent', 'update', {
        ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted'
      });
      loadAdSense();
    } else {
      window.adsbygoogle.pauseAdRequests = 1;
      window.gtag('consent', 'update', {
        ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'
      });
    }
    render(false);
  }

  function render(show) {
    var old = document.getElementById('tezz-content-cookie-panel');
    if (old) old.remove();
    if (!show) return;
    var panel = document.createElement('section');
    panel.id = 'tezz-content-cookie-panel';
    panel.setAttribute('aria-label', 'Cookie preferences');
    panel.innerHTML = '<div class="tezz-content-cookie-card"><p><strong>Optional advertising</strong><br>TEZZ CONNECT uses advertising cookies only according to your consent choices. <a href="/privacy-policy/">Privacy Policy</a></p><div><button type="button" data-choice="reject">Reject</button><button type="button" data-choice="accept">Accept advertising</button></div></div>';
    panel.querySelector('[data-choice="reject"]').onclick = function () { setChoice(false); };
    panel.querySelector('[data-choice="accept"]').onclick = function () { setChoice(true); };
    document.body.appendChild(panel);
  }

  var style = document.createElement('style');
  style.textContent = '#tezz-content-cookie-panel{position:fixed;z-index:99999;left:8px;right:8px;bottom:8px;font:13px/1.45 system-ui,sans-serif;color:#18181b}#tezz-content-cookie-panel .tezz-content-cookie-card{max-width:1000px;margin:auto;padding:12px 14px;border:1px solid #d4d4d8;border-radius:14px;background:rgba(250,250,250,.98);box-shadow:0 5px 24px #0002;display:flex;align-items:center;justify-content:space-between;gap:12px}#tezz-content-cookie-panel p{margin:0;color:#52525b}#tezz-content-cookie-panel strong{color:#18181b}#tezz-content-cookie-panel a{color:#dc4545;text-decoration:underline}#tezz-content-cookie-panel button{border:1px solid #18181b;border-radius:999px;padding:9px 12px;background:#fff;color:#18181b;font-weight:700;margin-left:6px;white-space:nowrap}#tezz-content-cookie-panel button[data-choice=accept]{background:#ef4444;border-color:#ef4444;color:#fff}@media(max-width:600px){#tezz-content-cookie-panel .tezz-content-cookie-card{display:block}#tezz-content-cookie-panel .tezz-content-cookie-card>div{display:flex;margin-top:9px}#tezz-content-cookie-panel button{flex:1;margin:0 4px 0 0}}';
  document.head.appendChild(style);

  function ready() {
    fetch('/locale-country', { cache: 'no-store', credentials: 'same-origin' })
      .then(function (response) { if (!response.ok) throw new Error('country lookup'); return response.json(); })
      .then(function (data) {
        var country = typeof data.country === 'string' ? data.country.toUpperCase() : '';
        if (!/^[A-Z]{2}$/.test(country)) throw new Error('invalid country');
        if (regulated.has(country)) {
          window.googlefc = window.googlefc || {};
          window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
          window.googlefc.callbackQueue.push({
            CONSENT_API_READY: function () {
              if (typeof window.__tcfapi !== 'function') return;
              window.__tcfapi('addEventListener', 2.2, function (tcData, success) {
                var ready = success && tcData &&
                  (tcData.eventStatus === 'tcloaded' || tcData.eventStatus === 'useractioncomplete');
                var allowed = !!(ready && tcData.purpose && tcData.purpose.consents && tcData.purpose.consents[1] === true);
                window.adsbygoogle.pauseAdRequests = allowed ? 0 : 1;
              });
            }
          });
          loadAdSense();
          return;
        }
        if (prefs && prefs.necessary === true) {
          if (prefs.ads === true) {
            window.adsbygoogle.pauseAdRequests = 0;
            window.gtag('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' });
            loadAdSense();
          }
        } else {
          render(true);
        }
      })
      .catch(function () {
        // Unknown location is fail-closed: no advertising script is loaded.
      });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();