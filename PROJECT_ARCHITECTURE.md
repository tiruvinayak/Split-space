# Architecture

`src/data` contains the seeded demo workspace. `src/services/store.js` safely reads and writes the Local Storage document. `src/utils/splitEngine.js` is independent of React and owns the paise-based financial logic. React pages compose reusable interface elements from `src/components`; CSS is divided into variables, global rules, layout, component rules and responsive rules.

Routes are browser-only and represented in `src/App.jsx`. There is deliberately no server, API client, external database, or payment integration.
