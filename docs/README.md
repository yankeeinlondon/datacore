# Website

The documentation site for Datacore Engine and Datacore View: Preact, built with [Docusaurus](https://docusaurus.io/).
It is the workspace package `@yankeeinlondon/datacore-docs`. Run these from the repository root:

```bash
pnpm install
pnpm docs:start   # local development server with live reload
pnpm docs:build   # static site in docs/build
```

To preview a production build under the deployed base URL, run `pnpm --filter @yankeeinlondon/datacore-docs serve`
after building.

## Deployment

Pushes to `master` build the site and deploy it to GitHub Pages
(<https://yankeeinlondon.github.io/datacore/>) through `.github/workflows/deploy-docs.yml`.
