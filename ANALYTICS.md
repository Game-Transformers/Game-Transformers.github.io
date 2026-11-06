# Website audience measurement

This site uses the registered GA4 stream `G-WH32NXZK3Z` (property `511214009`, stream `16287264352`). The existing application is unchanged apart from a deferred `/analytics.js` loader.

The loader runs only on HTTPS `game-transformers.github.io`, requests consent before loading Google Analytics, remembers the choice when browser storage is available, and provides an Analytics settings button to change it. Advertising features are disabled. Query strings, fragments and full referrer paths are excluded from the initial page-view configuration.

Run the consent, hostname, duplicate-initialization and application-preservation checks with:

```sh
node --test analytics.test.mjs
```

GitHub Pages publishes the root of `main`. A successful deployment verifies that the tag is installed; confirming received events additionally requires an accepted visit and the GA4 Realtime report. Historical traffic before installation cannot be recovered from this tag.
