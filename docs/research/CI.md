# Continuous integration

GitHub Actions runs `.github/workflows/ci.yml` on every push to `main` and on every pull request. A new push to the same ref cancels the run that is already in progress. The workflow installs with `npm ci` on Node 20 (npm cache enabled), then checks the game. It does not deploy and it does not read secrets.

Two jobs run in order. The second job starts only after the first job succeeds, so a browser failure leaves the typecheck and unit-test result visible.

## Build and unit tests

1. `npm ci`
2. `npm run build` — `tsc --noEmit -p tsconfig.json`, then `vite build`
3. `npm test` — `vitest run`
4. `python3 docs/content/check_copy.py`, only when that file is in the checkout

The copy script reads `main:docs/content/copy.json`. A pull request checkout is detached, so the step fetches `main` first when the local ref is missing. If the script is not in the tree, the step is skipped.

## End-to-end tests

This job checks out a fresh tree, runs `npm ci` and `npm run build` again so `vite preview` has a `dist` folder, then installs Playwright's Chromium browser and its system libraries:

```bash
npx playwright install --with-deps chromium
```

`playwright.config.ts` launches `CHROME_PATH`, or `/usr/bin/google-chrome` when that variable is unset. The job sets `CHROME_PATH` to the Chromium binary Playwright just installed, then runs `npm run test:e2e` (`playwright test`, `testDir: ./e2e`). The dev server is `npm run preview` on `http://127.0.0.1:4173`.

If this job fails, the HTML report (`playwright-report/`) and anything under `test-results/` (screenshots, traces, error context) are uploaded as one artifact named `playwright-report`. It is kept for 14 days and sits at the bottom of the run summary. A failure that happens before Playwright writes those folders still fails the job; the upload step finds nothing and does not add a second error.

`e2e/` currently has no tests. `npm run test:e2e` exits with `Error: No tests found` until a spec lands in that directory. That fails the end-to-end job and leaves the build job green.

## Reading a failure

Open the Actions run for the commit. The check names are `CI / Build and unit tests` and `CI / End-to-end tests`.

The failed job's log names the step. `Build` is a typecheck or Vite error. `Unit tests` is Vitest. `Check copy` prints `FAIL` and one line per problem. `Install Playwright Chromium` is the browser download or apt dependencies. `Use installed Playwright Chromium` means the install finished and the `chrome` binary was not where the job looks. `End-to-end tests` is Playwright itself; open the `playwright-report` artifact when it is present.

A cancelled run means a newer push to the same ref replaced it. Look at the newest run for that ref.
