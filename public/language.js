(() => {
  'use strict';
  const KEY = 'tezz-connect-language';
  const languages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'हिन्दी' },
    { code: 'mr', name: 'मराठी' },
    { code: 'bn', name: 'বাংলা' }
  ];
  const copy = {
    hi: {
      'Skip to main content':'मुख्य सामग्री पर जाएँ',
      'Home':'होम',
      'Guides':'गाइड',
      'Knowledge Hub':'ज्ञान केंद्र',
      'Internet Knowledge Hub':'इंटरनेट ज्ञान केंद्र',
      'Explore topics':'विषय देखें',
      'Learning roadmap':'सीखने का रोडमैप',
      'Learning paths':'सीखने के रास्ते',
      'All guides':'सभी गाइड',
      'FAQs':'अक्सर पूछे जाने वाले सवाल',
      'Speed test':'स्पीड टेस्ट',
      'THE TEZZ CONNECT INTERNET KNOWLEDGE HUB':'TEZZ CONNECT इंटरनेट ज्ञान केंद्र'
    },
    mr: {
      'Skip to main content':'मुख्य मजकुराकडे जा',
      'Home':'मुख्यपृष्ठ',
      'Guides':'मार्गदर्शिका',
      'Knowledge Hub':'ज्ञान केंद्र',
      'Internet Knowledge Hub':'इंटरनेट ज्ञान केंद्र',
      'Explore topics':'विषय पाहा',
      'Learning roadmap':'शिकण्याचा मार्ग',
      'Learning paths':'शिकण्याचे मार्ग',
      'All guides':'सर्व मार्गदर्शिका',
      'FAQs':'नेहमीचे प्रश्न',
      'Speed test':'स्पीड टेस्ट',
      'THE TEZZ CONNECT INTERNET KNOWLEDGE HUB':'TEZZ CONNECT इंटरनेट ज्ञान केंद्र'
    },
    bn: {
      'Skip to main content':'মূল বিষয়বস্তুতে যান',
      'Home':'হোম',
      'Guides':'গাইড',
      'Knowledge Hub':'জ্ঞান কেন্দ্র',
      'Internet Knowledge Hub':'ইন্টারনেট জ্ঞান কেন্দ্র',
      'Explore topics':'বিষয় দেখুন',
      'Learning roadmap':'শেখার রোডম্যাপ',
      'Learning paths':'শেখার পথ',
      'All guides':'সব গাইড',
      'FAQs':'সাধারণ প্রশ্ন',
      'Speed test':'স্পিড টেস্ট',
      'THE TEZZ CONNECT INTERNET KNOWLEDGE HUB':'TEZZ CONNECT ইন্টারনেট জ্ঞান কেন্দ্র'
    }
  };
  const rtl = new Set(['ar', 'ur']);
  const supported = new Set(languages.map(item => item.code));
  const readLanguage = () => {
    try {
      const value = localStorage.getItem(KEY) || 'en';
      return supported.has(value) ? value : 'en';
    } catch { return 'en'; }
  };
  let language = readLanguage();
  const originals = new WeakMap();
  function translateText(root) {
    if (language === 'en') {
      root.querySelectorAll?.('*').forEach(element => {
        element.childNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE && originals.has(node)) node.nodeValue = originals.get(node);
        });
      });
      return;
    }
    const dictionary = copy[language];
    if (!dictionary) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|OPTION)$/i.test(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('[data-no-translate],script,style,code,pre')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (!originals.has(node)) originals.set(node, node.nodeValue);
      const original = originals.get(node);
      const trimmed = original.trim();
      if (dictionary[trimmed]) {
        const leading = original.match(/^\s*/)?.[0] || '';
        const trailing = original.match(/\s*$/)?.[0] || '';
        node.nodeValue = leading + dictionary[trimmed] + trailing;
      }
    });
  }
  function addPicker() {
    const host = document.querySelector('.head-inner');
    if (!host || host.querySelector('[data-tezz-language-picker]')) return;
    const label = document.createElement('label');
    label.dataset.tezzLanguagePicker = 'true';
    label.setAttribute('aria-label', 'Choose website language');
    label.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-inline-start:12px;font:600 12px/1.2 system-ui,sans-serif;color:inherit;white-space:nowrap';
    const icon = document.createElement('span');
    icon.textContent = '文';
    icon.setAttribute('aria-hidden', 'true');
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Website language');
    select.style.cssText = 'max-width:132px;padding:8px 26px 8px 9px;border:1px solid #6c8799;border-radius:9px;background:#10283e;color:#fff;font:600 12px system-ui,sans-serif';
    languages.forEach(item => {
      const option = document.createElement('option');
      option.value = item.code;
      option.textContent = item.name;
      select.append(option);
    });
    select.value = language;
    select.addEventListener('change', () => setLanguage(select.value));
    label.append(icon, select);
    host.append(label);
  }
  function setLanguage(next) {
    language = supported.has(next) ? next : 'en';
    try { localStorage.setItem(KEY, language); } catch {}
    document.documentElement.lang = language;
    document.documentElement.dir = rtl.has(language) ? 'rtl' : 'ltr';
    const picker = document.querySelector('[data-tezz-language-picker] select');
    if (picker) picker.value = language;
    translateText(document.body);
    document.dispatchEvent(new CustomEvent('tezz-language-change', { detail: { language } }));
  }
  function init() {
    document.documentElement.lang = language;
    document.documentElement.dir = rtl.has(language) ? 'rtl' : 'ltr';
    addPicker();
    translateText(document.body);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'childList') record.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) translateText(node);
          else if (node.nodeType === Node.TEXT_NODE) translateText(node.parentElement || document.body);
        });
        else if (record.type === 'characterData') translateText(record.target.parentElement || document.body);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('storage', event => {
      if (event.key === KEY) setLanguage(event.newValue || 'en');
    });
    window.TEZZLanguage = { setLanguage, getLanguage: () => language, languages };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();