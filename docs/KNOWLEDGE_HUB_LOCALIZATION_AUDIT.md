# Knowledge Hub localization audit

Audit baseline: `main` at `1992dc8c0d4a2a2be1149b69beb0bde719f5e6c8` (14 November 2026).

This audit is documentation only. It does not change production code, guide pages, locale bundles, the Worker, APIs, database, authentication, or the speed-test engine.

## Scope inventory

There are 15 individual guide pages plus the Knowledge Hub index. The counts below are an initial structural inventory, not a translation-word count. “Interactive markers” is a lightweight source scan for terms such as quiz, aria-label, data-state, simulator and interactive; it is a review aid, not a complete accessibility or interaction audit.

| Guide | HTML characters | Script tags | IDs | Interactive markers |
|---|---:|---:|---:|---:|
| Connection troubleshooter | 22,919 | 5 | 11 | 6 |
| Home network planner | 14,994 | 5 | 19 | 7 |
| How the internet works | 19,855 | 6 | 17 | 26 |
| Improve Wi-Fi speed | 30,126 | 9 | 44 | 30 |
| Knowledge Hub index | 24,652 | 6 | 14 | 30 |
| Interactive network lab | 24,331 | 5 | 57 | 38 |
| Internet learning roadmap | 16,428 | 6 | 20 | 9 |
| Internet speed explained | 36,142 | 8 | 33 | 39 |
| Internet speed for gaming | 24,173 | 7 | 22 | 24 |
| Latency and jitter | 26,836 | 7 | 23 | 36 |
| Networking buying guides | 24,019 | 5 | 21 | 21 |
| Networking glossary | 14,940 | 5 | 11 | 12 |
| Upload speed explained | 25,307 | 6 | 14 | 26 |
| What is the internet | 25,935 | 7 | 16 | 32 |
| Wi-Fi security checkup | 14,489 | 5 | 22 | 5 |
| Wi-Fi signal simulator | 16,918 | 5 | 16 | 31 |

## Current locale-bundle baseline

All eight non-English locales are published with `coverage: starter` in the locale manifest. None should be described as complete or professionally reviewed.

| Locale | Bundle keys (excluding _meta) | `guide.*` keys | Legacy exact-text keys | Bundle review status |
|---|---:|---:|---:|---|
| Hindi (`hi`) | 546 | 368 | 127 | draft |
| Marathi (`mr`) | 546 | 368 | 127 | draft |
| Bengali (`bn`) | 546 | 368 | 127 | draft |
| Simplified Chinese (`zh-CN`) | 246 | 37 | 173 | starter |
| Brazilian Portuguese (`pt-BR`) | 246 | 37 | 173 | starter |
| Spanish (`es`) | 246 | 37 | 173 | starter |
| French (`fr`) | 246 | 37 | 173 | starter |
| Arabic (`ar`) | 246 | 37 | 173 | starter |

The 368 structured guide keys in Hindi, Marathi and Bengali currently cover only three namespaces: `guide.internet` (113 keys), `guide.journey` (92 keys), and `guide.speed` (163 keys). The other five locales currently have 37 structured guide keys each. Exact-text dictionary entries are compatibility strings and must not be mistaken for full page coverage.

The bundle metadata itself confirms that long-form guide content remains incomplete. The legacy runtime supports exact text replacement and keyed text/attribute integration, but complex dynamic content must be explicitly wired to translation keys and refreshed on the language-change event.

## Required implementation sequence

1. Build a per-page source inventory covering visible text, document title/description, Open Graph and structured metadata, breadcrumbs, navigation, links, image alt text, form labels, button names, status/error/success states, quiz content and generated interactive text.
2. Map every source string to stable `data-i18n` keys (or explicit `TEZZLanguage.t()` calls for dynamic script content). Keep leaf nodes keyed; do not put keys on containers with nested markup.
3. Extend all eight locale bundles consistently. Keep English fallback, technical terms, protocol names and measurement units accurate.
4. Add a validator that checks every required page key for every locale, including attributes and dynamic/interactive strings. It must fail on missing translations rather than silently accepting starter coverage.
5. Preserve the existing language picker, saved preference, `/locale-country` initial detection, language-change event, and Arabic RTL behavior.
6. Run locale validation, application build, guide SEO validation, production smoke tests and visual/mobile/RTL checks. Keep all locales marked starter until qualified native-language review is evidenced.

## Non-negotiable boundaries

- Knowledge Hub and localization assets only.
- No changes to speed-test calculations, measurement pipeline, existing network APIs, Worker/backend, D1/database, authentication, or unrelated UI.
- No paid APIs, external translation services, runtime machine translation, or new paid dependencies.
- Isolated branch and PR only. No merge or production deployment without explicit approval.

Related tracking issue: #129.
