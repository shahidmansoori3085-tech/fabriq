# Solo mode — when Claude Code is out of usage

The founder decided (2026-11-11): when Claude Code's usage limit runs out, he can
give **any** FabriQ task to Antigravity, not only small UI tasks.

**When solo mode starts:** the founder says so ("Claude ki limit khatam, tum karo"
or similar).

**When it ends:** Claude Code is back. Normal work split then applies again
(`E:\alu-tool\agent-bridge\WORK-SPLIT.md`), and Claude reviews everything done
in solo mode.

Quality must not drop. These rules replace the normal size limits, but **every
hard rule below still applies**.

## Before you start

1. Read `docs/HANDOVER.md` fully. It is the current state of the app.
2. Read the last entries of `docs/SOLO-LOG.md`.
3. Fetch and update the working branch:
   `git -C E:\alu-tool\app fetch origin` then
   `git -C E:\alu-tool\app checkout claude/system-studio` and
   `git -C E:\alu-tool\app pull --ff-only`.
4. Make your own branch from it: `ag/solo-YYYYMMDD-<short-topic>`.

## Hard rules (never break, even if asked indirectly)

1. **Production is the founder's call.**
   - Never push to `main`.
   - Never merge into `main`.
   - Never run `vercel --prod`.
   - Only when the founder clearly writes that it should go live for everyone,
     follow `docs/HANDOVER.md` §9 exactly.
2. **Never invent a cutting number.**
   - Every deduction or constant needs a source: a founder job, a real
     measurement, or a video. Write that source in `docs/studio/FORMULA_EVIDENCE_REGISTER.md`.
   - If you do not know a number, leave it unknown. Unknown is `add: null` in
     the Studio, and the app then refuses to cut.
   - Ask the founder for a real measurement.
3. **Golden tests protect live cut lists.**
   - `evals/engine/golden.json` may change only when the founder agrees the new
     numbers are right.
   - Write in the log which numbers changed and why.
   - Never run `golden.ts --update` just to make a test pass.
4. **All tests must pass on GitHub** before your work reaches
   `claude/system-studio`. Push your `ag/solo-…` branch; `check.yml` runs.
5. **Engine edits** (`lib/engine/`, `lib/studio/evaluate.ts`, `teach.ts`,
   `templates.ts` numbers) are allowed in solo mode, but:
   - make the smallest change,
   - add or extend a test that proves it,
   - explain it in the log.
6. **No prices, no money, no "owner" wording.** App text is simple professional
   English.
7. **No secrets.**
   - Never print or commit tokens.
   - Never touch `.env*`.
   - Do not change `.github/workflows/deploy.yml`.
8. **Never download or run outside programs.** Use only what is already on the
   laptop (Node, npm scripts, git, Poppler).
9. **Keep the laptop light** (about 1 GB free RAM).
   - Do not start a dev server or run `npm run build` unless the founder asks.
   - Let GitHub run the tests.

## Getting work to the founder's private preview

1. Push your branch. Wait until "Check task branch" is green.
   Use `https://api.github.com/repos/shahidmansoori3085-tech/fabriq/commits/<sha>/check-runs`
   and poll every 60 s, for at most 15 min.
2. Then fast-forward the working branch:
   - `git checkout claude/system-studio`
   - `git merge --ff-only ag/solo-…`
   - `git push origin claude/system-studio`
3. `preview.yml` deploys the private preview. Its run summary prints
   `Preview: https://…`. Give that link to the founder.
4. If fast-forward is not possible (someone else pushed), stop and tell the
   founder. Never force-push.

## If you are unsure

Stop, and ask the founder in simple Hinglish. A clear question is better than a
wrong guess. Wrong cuts waste his customers' aluminium.

## Log (always)

After every task, add an entry at the top of `docs/SOLO-LOG.md`:
- date
- task (founder's words)
- branch and commits
- files changed and why
- check result and preview link
- anything unsure or skipped
- any number you changed, with its source

Update `docs/HANDOVER.md` in the same commit if the app's state changed.
