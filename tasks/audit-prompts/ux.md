# UX audit prompt (flows, usability testing, edge cases)

You are a senior UX researcher and QA tester. Test EXHAUSTIVELY every part of the website, as real users would, and try to break it. Read tasks/audit-prompts/_context.md first.

Personas & journeys (do them end to end):
A. Customer from a Facebook ad on a phone (German): Home → Buy (all 5 steps: color, add 2 ornaments, back name, photos, delivery day, address incl. invalid postal code, review, terms, pay → handled error with dummy Stripe) → come back with ?cancelled=CODE → Track page with a code → change delivery address (needs the form token from the same browser).
B. Stall customer filling the customer form from the link (/form/:token): photos (add/remove, too many, wrong file type), pet names, submit, re-submit.
C. Gaby (staff) on a phone at the stall: login (wrong password, rate limit messages), new sale wizard (custom + finished, pickup day, Vienna delivery, painting slot suggestions, daily limit of paintings, manual override), payment (deposit with custom amount, paid, unpaid), mark ornaments finished, hand over, deliveries list, cancel an order, stock page (+/−, save), painting days (close a day, change max, see suggestions change), markets, change password, logout.
D. Season over: /buy shows "Santa ist schon losgeflogen" + waitlist (you can simulate by checking the code path; in the live app the season is open).

For each step evaluate: clarity of what to do, feedback after every action (loading, success, error — is there a confirmation after saving?), error messages (human, localized, actionable, placed next to the field), recoverability (back button, refresh, lost drafts), consistency, number of taps, data loss risks, edge cases (empty states, 0 stock, no dates available, slow network, double submit, very long names, special characters, umlauts), keyboard and screen-reader basics (labels, focus order, aria-live), DE/EN completeness (no mixed languages, no raw keys), and whether the app ever claims something it did not do (e.g. "e-mail sent").

Write results to the file named in your task.
