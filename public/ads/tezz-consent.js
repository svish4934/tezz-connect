window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('consent', 'default', {
        analytics_storage: 'denied', ad_storage: 'denied',
        ad_user_data: 'denied', ad_personalization: 'denied',
        functionality_storage: 'granted', security_storage: 'granted'
      });
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.pauseAdRequests = 1;
      window.googlefc = window.googlefc || {};
      window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
      var regionReadyResolve;
      var regionReady = new Promise(function(resolve) { regionReadyResolve = resolve; });
      var isRegulatedRegion = false;
      function ensureAdSenseTag() {
        if (document.getElementById('tezz-ads')) return;
        var ads = document.createElement('script');
        ads.id = 'tezz-ads';
        ads.async = true;
        ads.crossOrigin = 'anonymous';
        ads.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3893813894265886';
        document.head.appendChild(ads);
      }
      window.googlefc.callbackQueue.push({
        'CONSENT_API_READY': function() {
          regionReady.then(function() {
            if (!isRegulatedRegion || typeof window.__tcfapi !== 'function') return;
            window.__tcfapi('addEventListener', 2.2, function(tcData, success) {
              if (!success || !tcData) {
                window.adsbygoogle.pauseAdRequests = 1;
                return;
              }
              var decisionReady = tcData.eventStatus === 'tcloaded' ||
                tcData.eventStatus === 'useractioncomplete';
              var purposeOneAllowed = !!(tcData.purpose && tcData.purpose.consents &&
                tcData.purpose.consents[1] === true);
              window.adsbygoogle.pauseAdRequests = decisionReady && purposeOneAllowed ? 0 : 1;
            });
          });
        }
      });
      (function () {
        var KEY = 'tezz_cookie_consent_v1';
        var current = null;
        var regionResolved = false;
        var REGULATED_COUNTRIES = new Set([
          'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE',
          'IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE',
          'GB','CH'
        ]);
        try { current = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
        function loadScripts(prefs) {
          // European choices come only from Google's CMP; never translate the site's generic checkbox into Google signals.
          if (!regionResolved || isRegulatedRegion) return;
          // Do not load the advertising library until this visitor opts in.
          window.adsbygoogle = window.adsbygoogle || [];
          window.adsbygoogle.pauseAdRequests = 1;
          if (prefs.ads) {
            window.adsbygoogle.pauseAdRequests = 0;
            ensureAdSenseTag();
          }
          gtag('consent', 'update', {
            analytics_storage: prefs.analytics ? 'granted' : 'denied',
            ad_storage: prefs.ads ? 'granted' : 'denied',
            ad_user_data: prefs.ads ? 'granted' : 'denied',
            ad_personalization: prefs.ads ? 'granted' : 'denied'
          });
          if (prefs.analytics && !document.getElementById('tezz-ga')) {
            gtag('js', new Date());
            gtag('config', 'G-SL6RDF7GHX');
            var ga = document.createElement('script');
            ga.id = 'tezz-ga'; ga.async = true;
            ga.src = 'https://www.googletagmanager.com/gtag/js?id=G-SL6RDF7GHX';
            document.head.appendChild(ga);
          }
          // The AdSense library is inserted only after an explicit local ads opt-in.
        }
        function save(prefs) {
          prefs = { necessary: true, analytics: !!prefs.analytics, ads: !!prefs.ads, updatedAt: new Date().toISOString() };
          try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (_) {}
          var withdrawingAds = !!(current && current.ads) && !prefs.ads;
          current = prefs;
          loadScripts(prefs);
          render(false);
          // Reload to tear down an AdSense runtime after advertising consent is withdrawn.
          if (withdrawingAds) window.location.reload();
        }
        function render(show) {
          var old = document.getElementById('tezz-cookie-panel');
          if (old) old.remove();
          if (!show) return;
          var panel = document.createElement('section');
          panel.id = 'tezz-cookie-panel';
          panel.setAttribute('aria-label', 'Cookie preferences');
          panel.innerHTML = '<div class="tezz-cookie-card"><span class="tezz-cookie-icon" aria-hidden="true">◉</span><div class="tezz-cookie-copy"><strong>Cookies</strong><span> Essential cookies keep TEZZ CONNECT working. Optional analytics and ads need your permission.</span> <a href="/cookie-policy/">Learn more</a></div><div class="tezz-cookie-actions"><button type="button" data-action="manage">Manage</button><button type="button" data-action="reject">Reject optional</button><button type="button" data-action="accept">Accept all</button></div></div>';
          document.body.appendChild(panel);
          panel.querySelector('[data-action="reject"]').onclick = function(){ save({analytics:false,ads:false}); };
          panel.querySelector('[data-action="accept"]').onclick = function(){ save({analytics:true,ads:true}); };
          panel.querySelector('[data-action="manage"]').onclick = function(){
            var oldPrefs = current || {analytics:false,ads:false};
            var settings = document.createElement('div');
            settings.className = 'tezz-cookie-settings';
            settings.innerHTML = '<h3>Manage optional cookies</h3><label><input type="checkbox" checked disabled> Necessary storage <small>Always active</small></label><label><input id="tezz-analytics-choice" type="checkbox"> Analytics</label><label><input id="tezz-ads-choice" type="checkbox"> Advertising</label><div><button type="button" data-save>Save choices</button><button type="button" data-cancel>Cancel</button></div>';
            panel.querySelector('.tezz-cookie-card').appendChild(settings);
            settings.querySelector('#tezz-analytics-choice').checked = !!oldPrefs.analytics;
            settings.querySelector('#tezz-ads-choice').checked = !!oldPrefs.ads;
            settings.querySelector('[data-save]').onclick = function(){ save({analytics:settings.querySelector('#tezz-analytics-choice').checked,ads:settings.querySelector('#tezz-ads-choice').checked}); };
            settings.querySelector('[data-cancel]').onclick = function(){ settings.remove(); };
          };
        }
        var style = document.createElement('style');
        style.textContent = '#tezz-cookie-panel{position:fixed;z-index:99999;left:10px;right:10px;bottom:8px;font:12px/1.45 \'Plus Jakarta Sans\',system-ui,sans-serif;color:#18181B}#tezz-cookie-panel .tezz-cookie-card{max-width:1200px;margin:auto;background:rgba(250,250,250,.97);backdrop-filter:blur(12px);border:1.5px solid #18181B;border-radius:18px;box-shadow:0 8px 28px rgba(24,24,27,.13);padding:11px 14px;display:flex;gap:12px;align-items:center;justify-content:space-between}#tezz-cookie-panel .tezz-cookie-icon{font-size:22px;color:#18181B;flex:0 0 auto}#tezz-cookie-panel .tezz-cookie-copy{flex:1;min-width:0;color:#52525B}#tezz-cookie-panel .tezz-cookie-copy strong{font-size:13px;margin-right:5px;color:#18181B}#tezz-cookie-panel .tezz-cookie-copy a{color:#EF4444;white-space:nowrap;margin-left:5px}#tezz-cookie-panel button{border:1.5px solid #18181B;background:#fff;color:#18181B;border-radius:999px;padding:9px 14px;font:700 12px \'Plus Jakarta Sans\',sans-serif;white-space:nowrap;cursor:pointer}#tezz-cookie-panel button[data-action=accept],#tezz-cookie-panel [data-save]{background:#EF4444;color:#fff;border-color:#EF4444}#tezz-cookie-panel button[data-action=accept]:hover,#tezz-cookie-panel [data-save]:hover{background:#DC2626}.tezz-cookie-actions{display:flex;gap:7px;flex:0 0 auto}.tezz-cookie-settings{border-top:1px solid #E4E4E7;margin-top:9px;padding-top:9px;flex-basis:100%;color:#18181B}.tezz-cookie-settings label{display:inline-block;margin:5px 14px 5px 0}.tezz-cookie-settings small{color:#52525B;margin-left:5px}.tezz-cookie-settings button{margin:6px 7px 0 0}#tezz-cookie-panel .tezz-cookie-card:has(.tezz-cookie-settings){flex-wrap:wrap}@media(max-width:650px){#tezz-cookie-panel{left:6px;right:6px;bottom:6px}#tezz-cookie-panel .tezz-cookie-card{padding:10px;gap:8px;border-radius:16px;flex-wrap:wrap}#tezz-cookie-panel .tezz-cookie-icon{font-size:18px}#tezz-cookie-panel .tezz-cookie-copy{font-size:11px;flex:1 1 calc(100% - 32px)}#tezz-cookie-panel .tezz-cookie-copy strong{font-size:12px}#tezz-cookie-panel .tezz-cookie-actions{width:100%;gap:6px}#tezz-cookie-panel button{padding:9px 8px;font-size:11px;flex:1}.tezz-cookie-settings{font-size:12px}}';;
        document.head.appendChild(style);
        var manage = document.createElement('button');
        manage.type = 'button'; manage.id = 'tezz-cookie-reopen'; manage.textContent = 'Cookie settings';
        manage.textContent = '◉ Cookie settings';
        manage.setAttribute('aria-label', 'Open cookie settings');
        manage.style.cssText = 'position:fixed;z-index:9998;left:8px;bottom:8px;padding:6px 9px;border:1px solid #47617f;border-radius:999px;background:rgba(10,25,48,.94);color:#f4f7ff;font:11px system-ui;cursor:pointer;box-shadow:0 3px 12px #0003';
        manage.onclick = function(){ render(true); };
        document.addEventListener('DOMContentLoaded', function(){ document.body.appendChild(manage); });
        // Resolve Cloudflare country before selecting the consent interface or loading AdSense.
        // A failed lookup is treated as unknown and remains fail-closed.
        fetch('/locale-country', { cache: 'no-store', credentials: 'same-origin' })
          .then(function(response) {
            if (!response.ok) throw new Error('Country lookup failed');
            return response.json();
          })
          .then(function(data) {
            var country = typeof data.country === 'string' ? data.country.toUpperCase() : '';
            if (!/^[A-Z]{2}$/.test(country)) throw new Error('Invalid country code');
            regionResolved = true;
            isRegulatedRegion = REGULATED_COUNTRIES.has(country);
            regionReadyResolve();
            if (isRegulatedRegion) {
              // Load AdSense only to bootstrap Google's configured certified CMP.
              // Ad requests remain paused until the CMP supplies a completed TCF decision.
              ensureAdSenseTag();
              // Google's CMP owns European consent; the pre-registered TCF listener
              // becomes active once both the CMP API and country lookup are ready.
              render(false);
              manage.textContent = '◉ Privacy settings';
              manage.setAttribute('aria-label', 'Open Google privacy and consent settings');
              manage.onclick = function() {
                window.googlefc = window.googlefc || {};
                window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
                // Google documents callbackQueue as the supported invocation path.
                // CONSENT_API_READY callbacks added after readiness execute synchronously.
                window.googlefc.callbackQueue.push({
                  'CONSENT_API_READY': function() {
                    if (typeof window.googlefc.showRevocationMessage === 'function') {
                      window.googlefc.showRevocationMessage();
                    }
                  }
                });
              };
              return;
            }
            if (current && current.necessary === true) loadScripts(current);
            else document.addEventListener('DOMContentLoaded', function(){ render(true); });
          })
          .catch(function() {
            // Unknown region: do not let a generic local choice grant Google consent.
            regionResolved = true;
            isRegulatedRegion = true;
            regionReadyResolve();
            render(false);
            manage.style.display = 'none';
          });
      })();
