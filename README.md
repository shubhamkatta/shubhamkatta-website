# Shubham Katta Personal Site

A React + Vite site designed as a personal internet space rather than a conventional portfolio.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown by Vite.

## Build for production

```bash
npm run build
```

The production files will be generated in `dist/`.

## Publish to GitHub + Cloudflare Pages

1. Push this project to a GitHub repo.
2. In Cloudflare Pages, connect that repo.
3. Use:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Add your custom domain in Cloudflare.

## What to edit

- `src/content/posts.js` → writing archive
- `src/content/caseStudies.js` → case-study pages
- `src/content/site.js` → homepage chips, findings, work highlights
- `src/pages/AboutPage.jsx` → personal narrative
- `src/styles.css` → theme and layout styling

## Avatar / Bitmoji

Replace the emoji block in `src/pages/HomePage.jsx` with:
- an exported Bitmoji image
- a custom illustration
- or a local asset inside `public/`

## Notes

The content in this starter project adapts and restructures material from the existing site into the new theme, while leaving enough room for further editing and new writing.
