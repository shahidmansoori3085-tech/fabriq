# Login and cloud save — plan

Status (2026-11-14): code built and tested, **off** until the Supabase keys are set.
Founder chose **free login: Continue with Google, then shop name + mobile + address typed once** (no SMS, no DLT). The OTP sections below are kept for later.

## Setup still to do

1. Supabase project  (free plan, Mumbai) — created by Claude after the founder's yes; run .
2. Google login: in Google Cloud console the founder makes an OAuth client (Web) with the Supabase callback address as redirect; he pastes its Client ID and secret into Supabase → Authentication → Providers → Google himself.
3. Supabase → Authentication → URL configuration: add the preview and live addresses.
4.  and  (public values) for the **preview** build only; live only on "sabke liye live".

## Why

Today everything lives in the phone's browser storage (`localStorage`), with no
account:

| Key | What |
|---|---|
| `fabriq_projects` | saved jobs (last 50), full `JobItem[]` |
| `fabriq_shop` | shop name, phone, address, GSTIN, shutter split |
| `fabriq_studio_v1` | Window systems the shop changed, its own sections |
| `fabriq_offcuts`, `fabriq_finish`, `fabriq_brand` | offcuts kept, finish, brand |
| `fabriq.unit`, `fabriq_studio_unit`, `fabriq_demo_seen`, `fabriq.openJob*` | screen preferences |

A lost phone, a new phone or a cleared browser loses all of it. Two people in
one shop cannot see the same jobs. The Indore buyer asked for a login.

## What the shop gets

1. Login with mobile number + OTP (no password).
2. Everything saved online: open the app on any phone or computer, it is all there.
3. A shop team: 2–3 people share the same jobs and Window systems.
4. Deleted jobs and systems kept 30 days, can be brought back.
5. The app keeps working without internet; it saves online when the net is back.
6. Login stays optional at first: nobody is blocked; a banner offers "Save online".

## How (technical)

**Supabase** (Postgres + Auth + row-level security), as in Indian Steels.

### Tables

```
shops          id, name, phone, address, gstin, tagline, settings jsonb, created_at
shop_members   shop_id, user_id, role ('admin' | 'member'), added_at
projects       id, shop_id, title, customer, items jsonb, sqft, scrap_pct, amount,
               created_at, updated_at, deleted_at
studio_systems id, shop_id, data jsonb, updated_at, deleted_at
studio_profiles id, shop_id, data jsonb, updated_at, deleted_at
shop_prefs     shop_id, key, value jsonb, updated_at     -- offcuts, finish, brand
```

Row-level security on every table: a row is visible and writable only to members
of its `shop_id`. The browser uses the anon key only; no service key in the app.
Screen preferences (units, last open job) stay on the device.

### Sync (local first)

- `localStorage` stays the working copy, so the app is as fast as today and works offline.
- Every saved record gets `updated_at` and goes into an outbox; `lib/cloud/sync.ts`
  pushes the outbox and pulls rows changed since the last pull.
- Same record changed on two phones: the newer `updated_at` wins (per record —
  one job, one system), the other version is kept in the 30-day trash.
- Delete = `deleted_at` (tombstone), so a delete reaches every phone and can be undone.
- First login on a phone with data: its jobs, systems and sections are uploaded
  into the new shop (nothing is lost); a second phone then pulls them.
- Jobs keep their frozen system copy (`meta.studio`), so an old job never changes
  when a system is edited later — same as today.

### OTP SMS

Supabase phone login with an SMS provider (MSG91 or Twilio). In India an OTP SMS
needs **DLT registration** of the sender and the message template — done by the
business in its own name; it takes a few days. Until then: test numbers in
Supabase, or email login as a stop-gap.

### OTP fills itself (founder, 2026-11-14)

The shop types the number once; the code fills in and login goes through by itself:

- **Android (Chrome):** Web OTP API (`navigator.credentials.get({ otp })`) reads the
  SMS. Chrome shows one "Allow" sheet; the code fills and the form submits itself.
  The SMS must end with the line `@<app domain> #<code>` — put it in the DLT template.
- **iPhone (Safari):** the code field uses `autocomplete="one-time-code"`; iOS shows the
  code above the keyboard, one tap fills it, and the form submits itself at 6 digits.
- Fully zero-tap needs a Play Store app (SMS Retriever) — not on the web, by the
  phone's own security rule.
- The phone stays logged in (long session), so OTP is only for a new phone.

### Tests

- `evals/cloud/sync.ts`: merge rules (newer wins, tombstones, first-login upload,
  offline outbox) on fake data — no network.
- `scripts/check-rls.ts`: a member of shop A cannot read or write shop B.
- Existing `npm test` must stay green (the engine does not change).

## Phases

| # | Work | Needs from the founder |
|---|---|---|
| 0 | Supabase project, tables, security rules, keys in Vercel **preview** only | OK to create the project on his Supabase account |
| 1 | Login screen (number → OTP), "Save online" banner, logout in Settings | SMS provider account + DLT (or test numbers meanwhile) |
| 2 | Sync engine + tests; jobs, shop details, Window systems, sections online | — |
| 3 | First-login upload of what the phone already has | — |
| 4 | Shop team: add a member by mobile number; admin / member | — |
| 5 | Trash: deleted jobs and systems back within 30 days | — |
| 6 | Check on the private preview, then live only on "sabke liye live" | His go-ahead |

## Not in this plan

Payments / subscription, sharing systems from extruders, an admin dashboard —
later, on top of these accounts.
