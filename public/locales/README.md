# TEZZ CONNECT locale system

## Adding a language

The website language picker is driven by `/locales/manifest.json`. It is intentionally not limited to a fixed four-language list.

1. Use a valid BCP 47 language tag (for example `es`, `pt-BR`, `zh-Hant`, `ar` or `ur`).
2. Create its static JSON bundle under `public/locales/<locale>/common.json` (copy `_template/common.json` as a starting point), then add the locale and bundle path to the manifest only when the required translations are ready for users.
3. Set `nativeName` to the language's own name and set `direction` to `rtl` for right-to-left scripts.
4. Keep English as the source and fallback locale. Missing translations must never create blank UI.
5. Translate interface text, article content, interactive states, form labels, accessibility text, metadata and structured data—not only navigation labels.
6. Mark a locale as `published` only after terminology, technical accuracy and native-language quality review. Use `coverage: "starter"` while the existing legacy dictionary is still being expanded; do not describe it as a complete translation.

## Manifest contract

Each locale entry has:
- `code`: BCP 47 language tag
- `name`: English language name
- `nativeName`: language name displayed to the visitor
- `direction`: `ltr` or `rtl`
- `status`: `published` (only published locales appear in the picker)
- `coverage`: translation completeness marker

Locale bundles are UTF-8 JSON objects mapping the exact English source string to its reviewed translation. Keep `_meta` for locale, source locale, bundle version and review status; metadata is ignored by the text replacement logic. The runtime loads a bundle only when that language is selected and caches it for the current page session.\n\nThe manifest and locale bundles are static assets. No translation API, external service, or additional Worker route is required. Existing operational speed-test and network APIs are not involved.

## Globalization requirements

- Preserve UTF-8 throughout.
- Use `Intl.NumberFormat`, `Intl.DateTimeFormat` and `Intl.PluralRules` for locale-sensitive formatting.
- Keep technical units and protocol names accurate; localize explanations, not standards.
- Test keyboard navigation, screen-reader labels, text expansion, mobile layouts and RTL layout.
- For search discoverability, provide indexable locale-specific URLs and correct canonical/`hreflang` metadata when each localized page is ready. Client-side text replacement alone is not a multilingual SEO implementation.
