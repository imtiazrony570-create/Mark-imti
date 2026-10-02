# MARK-IMTI

MARK-IMTI is a lightweight, static single-page AI/productivity workspace built around the supplied dark UI references.

## Included

- IMTI, MARK, and BROWSER modes in one persistent shell
- Local chat data with demo/local assistant responses
- Projects, Library, Schedule, Skills, pinned chats/projects
- Integrated browser-style tabs, navigation controls, URL/search input, and safe external fallback
- In-app Settings drawer with Profile, Appearance, and additional settings categories
- Local persistence through `localStorage`
- Responsive desktop/tablet/mobile behavior
- Accessible labels, focus states, Escape-to-close settings, and keyboard-friendly controls
- SPA-friendly hash navigation and Cloudflare Pages fallback
- No frontend API secrets

## Run locally

This is a static application. Serve the repository root with any static server.

Examples:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/`.

## Cloudflare Pages

Create a Cloudflare Pages project connected to this GitHub repository.

- Framework preset: none / static HTML
- Build command: none
- Output directory: repository root
- The included `_redirects` file keeps SPA routes from becoming 404s.

## Vercel / other static hosts

The project also remains compatible with static hosting. The existing `vercel.json` can be used for Vercel deployment.

## Persistence

Application data is stored locally in the browser. It is not a shared backend database.

## AI and browser services

The default chat response is explicitly local/demo behavior. No provider is claimed to be connected. Real AI, search, or browser automation should be implemented behind a backend/service boundary; never place private API keys in frontend JavaScript.

## Known limitations

- External websites can refuse iframe embedding. The browser workspace therefore keeps the Mark-Imti shell intact and offers an external-open fallback.
- Scheduled tasks are local browser data and do not execute server-side.
- No external AI provider is enabled by default.
