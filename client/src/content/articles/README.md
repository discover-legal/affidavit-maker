# Articles directory

This directory holds the long-form blog content served at
`/resources` and `/resources/:slug` on `discover.legal`. Every `.js`
file exports an `ARTICLES` array; the build pipeline auto-discovers
all of them — there is no central import list to maintain.

A future content-improvement agent reads `manifest.json` to reason
about the corpus (gaps, performance, freshness) and writes new
articles by dropping a new `.js` file in this directory. The
sections below describe the contract that agent must respect.

---

## Per-article schema

Every entry in an `ARTICLES` array uses this shape:

```js
{
  id:           'kebab-case-slug',          // === slug (legacy alias)
  slug:         'kebab-case-slug',          // URL path; immutable once published
  title:        'Sentence-case title',      // ~50–70 chars
  description:  '~150-char SEO meta',       // shown in <meta name="description">
  category:     'Affidavits',               // see "Categories" below
  readTime:     '6 min read',
  publishDate:  'Month DD, YYYY',           // ISO-ish; used for sort
  image:        '📝',                        // single emoji
  featured:     false,                      // surfaces on the resources hero
  tags:         ['custody', 'paternity'],   // OPTIONAL — auto-derived if omitted
  content:      `# Title\n\n**Disclaimer:** …\n\n---\n\n…markdown…`
}
```

### Required fields

`id`, `slug`, `title`, `description`, `category`, `readTime`,
`publishDate`, `image`, `featured`, `content`.

### Optional fields

`tags`: explicit topic tags. When absent, the manifest generator
derives a fallback set from the category (see
`STATE_TAG_MAP` / `CATEGORY_TAG_MAP` in
`client/scripts/generate-articles-manifest.js`).

### Content body conventions

- Always start with the H1 title, then the disclaimer block:

  ```md
  # <title>

  **Disclaimer:** This article provides general educational
  information about <topic> and is not legal advice. Legal
  requirements vary by jurisdiction and situation. For advice about
  your specific legal matter, consult with a licensed attorney in
  your area.

  ---
  ```

- 1000–2000 words, 4–8 `##` sections, lists and `**bold**` for key
  terms.
- Avoid invented specifics. Filing fees, statute numbers, and
  jurisdiction-specific deadlines must be framed as ranges or
  "varies by state".
- End with a CTA section. The `(#cta)` link is rewritten by
  `ArticlePage.js` to a navigation handler:

  ```md
  ## Get Started

  [Create your <doc type> →](#cta)
  ```

- Markdown code fences inside the template literal must escape the
  backticks: ``\`\`\``` instead of ```` ``` ````.
- Apostrophes inside string-typed fields (`title`, `description`,
  …) must use double-quoted strings or `\'`.

---

## Categories

Stable category names used for filtering on the resources page and
for tag derivation. New categories are allowed; document them here
when introduced.

- `Affidavits`
- `Divorce Process`
- `Custody & Support`
- `Civil & Family Matters`
- `Self-Representation`
- `Canada Law`
- `<State> Law` — one per US state with a divorce overview
- `Guides` — legacy; reserved for general explainers

---

## Auto-discovery

`articles.js` uses webpack's `require.context` to load every `.js`
file in this directory at build time. To add an article:

1. Create a new file (any descriptive name): e.g.
   `texas-name-change.js`.
2. Export `ARTICLES = [...]` with one or more article objects.
3. Run `npm run manifest` to refresh `manifest.json`, or
   `npm run build` (which runs the prebuild hook automatically).

Files named `index.js`, `manifest.json`, and `README.md` are skipped
by the discovery glob.

---

## `manifest.json` — the agent's read-only view

`manifest.json` is regenerated on every `npm run build`
(`prebuild` hook) and committed alongside the article files. It
contains one entry per article, **without the body**, so agents can
plan and reason cheaply.

Each manifest entry adds derived signals to the schema:

| field          | source                                             |
| -------------- | -------------------------------------------------- |
| `wordCount`    | parsed from `content`                              |
| `headingCount` | count of `^##\s` lines in `content`                |
| `excerpt`      | first ~280 chars of de-markdownified prose         |
| `tags`         | explicit `tags[]` if set, else category-derived    |
| `sourceFile`   | which batch file the article lives in              |
| `featured`     | as authored                                        |

Top-level manifest fields:

```json
{
  "generatedAt": "2026-04-29T01:00:00.000Z",
  "count": 81,
  "categories": ["Affidavits", "Divorce Process", "..."],
  "articles": [ /* one entry per article, sorted featured > newest */ ]
}
```

### Agent workflow

The intended content-improvement loop:

1. **Read** `manifest.json` to enumerate all articles, their
   categories, tags, word counts, and freshness.
2. **Cross-reference** with analytics (page views, scroll depth,
   conversion-to-document rate) keyed on `slug`. Slugs are stable
   IDs.
3. **Identify** gaps: under-covered tags, low-performing articles
   needing a refresh, missing state-specific overviews.
4. **Read** specific article bodies by `sourceFile` when planning
   an update, only for the articles in scope.
5. **Write** a new file (one or more articles) following the
   schema above. Pick a descriptive filename — kebab-case, no
   collision with existing files.
6. **Run** `node scripts/generate-articles-manifest.js` from
   `client/` to refresh the manifest.
7. **Commit** the new batch file plus the updated manifest.

The agent must not edit `manifest.json` directly; it is fully
derived.

---

## Validation

`npm run manifest` is the cheapest verification: it parses every
batch file and will raise a parse error on broken syntax. For full
verification, `npm run build` runs eslint + Babel on every file and
will catch unescaped apostrophes, raw triple-backticks inside
template literals, and missing required fields.
