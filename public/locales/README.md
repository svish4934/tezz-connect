# TEZZ CONNECT locale system

## Adding a language

The website language picker is driven by `/locales/manifest.json`. It is intentionally not limited to a fixed four-language list.

1. Use a valid BCP 47 language tag (for example `es`, `pt-BR`, `zh-Hant`, `ar` or `ur`).
2. Create its static JSON bundle under `public/locales/<locale>/common.json` (copy `_template/common.json` as a starting point), then add the locale and bundle path to the manifest only when the required translations are ready for users.
3. Set `nativeName` to the language's own name and set `direction` to `rtl` for right-to-left scripts.
4. Keep English as the source and fallback locale. Missing translations must never create blank UI.
5. Translate interface text, article content, interactive states, form labels, accessibility text, metadata and structured data—not only navigation labels. The current legacy runtime translates matching text nodes; attributes, metadata and complex interactive strings need explicit keyed integration before those areas can be considered localized.
6. Mark a locale as `published` only after terminology, technical accuracy and native-language quality review. Use `coverage: "starter"` while the existing legacy dictionary is still being expanded; do not describe it as a complete translation.

## Manifest contract

Each locale entry has:
- `code`: BCP 47 language tag
- `name`: English language name
- `nativeName`: language name displayed to the visitor
- `direction`: `ltr` or `rtl`
- `status`: `published` (only published locales appear in the picker)
- `coverage`: translation completeness marker

Locale bundles are UTF-8 JSON objects mapping the exact English source string to its reviewed translation. Keep `_meta` for locale, source locale, bundle version and review status; metadata is ignored by the text replacement logic. The runtime loads a bundle only when that language is selected and caches it for the current page session. Use stable keys in HTML with `data-i18n="common.some_key"` for plain-text elements. For supported attributes, use `data-i18n-aria-label`, `data-i18n-aria-description`, `data-i18n-placeholder`, `data-i18n-title` or `data-i18n-alt`. Dynamic scripts can call `window.TEZZLanguage.t('common.some_key')` and listen for the `tezz-language-change` event to refresh generated text. The original exact-text dictionary remains as a compatibility layer for existing pages. Do not mark an element with `data-i18n` if it contains nested markup; key the leaf text elements instead.

The manifest and reviewed locale bundles remain static JSON assets, served through the independent read-only `/language-api/v1/` interface. The API exposes `GET /language-api/v1/manifest` and `GET /language-api/v1/bundles/{locale}` (with `HEAD` support), validates requested locales against the manifest, and never generates machine translations or calls an external provider. This keeps translation content separate from operational speed-test and network APIs. The API has its own Worker module and route prefix; it does not use the speed-test database or transfer endpoints. Run `npm run test:locales` to validate the manifest and registered bundle files.

## Globalization requirements

- Preserve UTF-8 throughout.
- Use `Intl.NumberFormat`, `Intl.DateTimeFormat` and `Intl.PluralRules` for locale-sensitive formatting.
- Keep technical units and protocol names accurate; localize explanations, not standards.
- Test keyboard navigation, screen-reader labels, text expansion, mobile layouts and RTL layout.
- For search discoverability, provide indexable locale-specific URLs and correct canonical/`hreflang` metadata when each localized page is ready. Client-side text replacement alone is not a multilingual SEO implementation.
