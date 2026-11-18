# Snack Counter Automation

Take-home assignment for Framsikt (Product Engineer).

The business rules live in `src/core` as plain TypeScript with no UI or framework code.
The chat tool and HR system are simulated in `src/adapters`.

## Run

```bash
npm install
npm test        # automated tests for the business rules
npm run dev     # demo screen at http://localhost:5173
```

The demo screen (`src/App.tsx`) drives the real `RefillService` with the fake chat tool,
fake HR system and a fake clock. Use "Report empty", accept/decline, upload a receipt,
approve claims as HR, and move time forward (+1 hour / +1 day) to watch timeouts,
reassignment, HR retries and the monthly report.

## Structure

| Path | Purpose |
|---|---|
| `src/core/types.ts` | Domain types: offices, volunteers, refills, refill states, money |
| `src/core/money.ts` | Money in minor units, currency conversion with a fixed rate table |
| `src/core/clock.ts` | Injectable clock so tests can move time forward |
| `src/core/presence.ts` | Where each volunteer is today (office, home, holiday) |
| `src/core/volunteerSelector.ts` | Fair choice of who buys |
| `src/core/budget.ts` | Remaining budget per office and the monthly management report |
| `src/core/refillService.ts` | The refill lifecycle from "empty" to "reimbursed" |
| `src/App.tsx`, `src/demo/demoSetup.ts` | Optional demo screen and its sample data (no business rules) |
| `src/adapters/chatTool.ts` | Chat interface + fake that records messages |
| `src/adapters/hrSystem.ts` | HR interface + fake where tests approve or reject claims |
| `tests/` | Automated tests for the important rules |

## Refill lifecycle

```
reportEmpty -> OFFERED -> ACCEPTED -> PURCHASED -> CLAIM_SUBMITTED -> REIMBURSED
                  |           |            \-> NEEDS_APPROVAL (over budget) -> PURCHASED
                  |           |                                  CLAIM_SUBMITTED -> CLAIM_REJECTED
                  +-----------+-- timeout / decline -> offered to next volunteer
                                  nobody left       -> UNASSIGNED (office channel asked, retried)
```

## Assumptions

- 2 hours to accept an offer, 24 hours to buy after accepting.
- A purchase counts against the budget of the office where it was bought, and the
  claim is sent in that office's currency; HR converts it to the buyer's payroll currency.
- The management report uses a fixed monthly exchange rate supplied by finance.
- Months are counted in each office's local time zone.
- A rejected HR claim does not count as spend.
