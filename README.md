# SplitSpace — Modern Fintech Expense Sharing

SplitSpace is a clean, simple, intuitive, and professional expense-sharing web application built with React and Vite. Inspired by the usability and aesthetic polish of modern fintech leaders like Stripe, Ramp, and Linear, it runs entirely in the browser using high-fidelity local state and Local Storage—no backend APIs, external databases, or real payment gateways are involved.

---

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Instant 1-Click Demo Sign-In
On the login screen (`/login`), click either persona in the **Demo Accounts** selector:
- **Demo User**: `aarav@splitspace.demo` → Opens the **Member Workspace** (`/dashboard`).
- **Demo Admin**: `admin@splitspace.demo` → Opens the **Admin Console** (`/admin`).

You can also toggle between Admin and User personas at any time using the **Switch to Admin / Switch to User** pill button in the sidebar or topbar.

---

## Key Features & Architecture

### 1. Role-Aware Navigation
- **Member Workspace**: Overview (`/dashboard`), My Groups (`/groups`), Expenses (`/expenses`), Balances (`/balances`), Settlements (`/settlements`), Notifications (`/notifications`), Settings (`/settings`).
- **Admin Console**: Admin Overview (`/admin`), User Management (`/admin/users`), Group Management (`/admin/groups`), Expense Monitoring (`/admin/expenses`), Settlements (`/admin/settlements`), Reports (`/admin/reports`), Settings (`/settings`).

### 2. User Dashboard
- 4 real-time summary cards: Total You Owe, Total You Are Owed, Total Groups, Total Expenses.
- Dynamic monthly spending volume trend and category distribution donut charts.
- Active group cards with balance indicators and direct "Open Group" buttons.
- Recent activity ledger showing paid amounts and personal shares.

### 3. Clear Group & Member Management
- Dedicated My Groups page with unique member count clarifications and category filters.
- Create Group modal with inline member selection and instant Local Storage persistence.
- Group Details page organized into 6 distinct sections: Overview, Members, Expenses, Balances, Settlements, and Activity.
- Member directory management: Add, Edit, Remove, and simulated invite acceptance with duplicate member prevention.

### 4. 6-Step Guided Expense Creation
- Step-by-step wizard explaining: (1) Group, (2) Details, (3) Payer, (4) Total Amount, (5) Participants, (6) Split Method.
- Real-time live split preview box showing exact paise allocations before saving.
- Multi-method splitting: Equal, Percentage (with largest-remainder allocation), and Custom amount splits.
- Recurring expenses engine: Daily, weekly, monthly, and yearly intervals with calendar-safe due date advancement and duplicate prevention.
- Local receipt attachments: Image (JPEG/PNG/WebP) and PDF validation, preview, replacement, and removal.

### 5. Balances & Settle Up
- Dedicated Balances page clearly separating "People Who Owe You", "People You Owe", and net balance.
- Settle Up modal with dynamic debtor/creditor selectors, amount validation, and simulated payment confirmation.
- Settlements page with filter tabs (All, Pending, Completed, Cancelled). Confirmed settlements automatically recalculate debt positions.

### 6. Full Admin Console
- 7 platform KPIs: Total Registered Users, Active Groups, Recorded Spend, Pending Settlements, volume charts, category distributions, and workspace member directory.
- User Management directory with search, role filters, user edit modal, promote/demote role toggles, and account suspension.
- 5 working CSV platform reports: User Directory, Group Summary, Transaction Ledger, Settlement Audit, Platform Summary.

### 7. Customization & Preferences
- Multi-currency support: INR (₹), USD ($), EUR (€), and GBP (£) with instant site-wide recalculation.
- Light and dark theme toggle.
- Category-specific notification preferences.
- Workspace data reset to seed defaults.

---

## Verification & Testing

Run all quality checks from the project root:

```bash
npm run lint    # ESLint v9: 0 errors, 0 warnings
npm test        # Vitest: 7 test files, 52 passed tests
npm run build   # Vite: Production build completes in ~338ms
```

### Headless Browser QA
Visual verification was executed on desktop (1280x800) and mobile (375x812) viewports, verifying 1-click demo logins, admin console navigation, user management actions, role toggling, and responsive mobile drawer behaviors.

For detailed reports, see:
- [PROJECT_AUDIT.md](file:///Users/padaltiruvinayak/Desktop/JD/PROJECT_AUDIT.md) — Comprehensive transformation report.
- [FUNCTIONALITY_REPORT.md](file:///Users/padaltiruvinayak/Desktop/JD/FUNCTIONALITY_REPORT.md) — Complete feature matrix and technical details.
- [UI_UX_AUDIT.md](file:///Users/padaltiruvinayak/Desktop/JD/UI_UX_AUDIT.md) — Visual design audit and viewport inspection.
- [BUG_REPORT.md](file:///Users/padaltiruvinayak/Desktop/JD/BUG_REPORT.md) — Defect catalog and resolutions.
- [TEST_RESULTS.md](file:///Users/padaltiruvinayak/Desktop/JD/TEST_RESULTS.md) — Automated test results and build evidence.
- [SPLITSPACE_AI_EVALUATION.md](file:///Users/padaltiruvinayak/Desktop/JD/SPLITSPACE_AI_EVALUATION.md) — Independent evaluation rubric (98/100).
