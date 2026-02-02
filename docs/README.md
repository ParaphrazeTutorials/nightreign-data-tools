# nightreign-data-tools
Data tools created for the Elden Ring: Nightreign community.

## Project workflow
See PROJECT_GUIDE.md for how we track features, bugs, and feedback.

## Development
- Run linting: `npm run lint`
- Format check (Prettier): `npm run format`
- Unit tests (Vitest): `npm test`
- Optional Playwright smoke (requires page host): set `PLAYWRIGHT_BASE_URL` to the served Reliquary URL, then run `npm run test:e2e`
