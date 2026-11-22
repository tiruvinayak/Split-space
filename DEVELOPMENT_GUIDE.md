# Development guide

Use `npm run dev` for a local server, `npm run test` for financial unit tests, `npm run lint` for static checks, and `npm run build` for the production bundle.

Financial amounts are stored as integer paise. Keep new financial logic in `src/utils` and test it in `src/tests`. The reset option in Settings clears only the `splitspace-data-v1` Local Storage key and restores the bundled sample data.
