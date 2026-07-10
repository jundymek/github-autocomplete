# Manual testing — 1.6 User match context

## Prerequisites

`pnpm dev`, open the 3.1 demo, use the **GitHub** instance (left). Open the Network panel to confirm
no extra requests fire. Results depend on live GitHub data, so exact rows vary; the behaviors below
are stable.

## Steps and expected results

1. **"matches profile" hint for a non-login match.**
   Type `jun`.
   *Expected:* users whose login does **not** contain "jun" (e.g. `Beomi`, `bluele`) show a small
   muted **"matches profile"** line under the login — the match is on a hidden profile field. Users
   whose login **does** contain "jun" (e.g. `csjunxu`) show the "jun" substring highlighted (`<mark>`)
   and **no** hint. Only two `/search/*` requests fire (users + repos) — no per-user requests.

2. **Organizations read `org`, not `user`.**
   Type `react`.
   *Expected:* organization accounts (e.g. `reactjs`, `react-native-community`) show `org` in the
   right-hand KIND column; individual people show `user`; repositories show `repo`.

3. **Repos unchanged.**
   In the same `react` results, repository rows still show the mono `owner/repo` path and their
   description, exactly as before. No hint line on repos.

4. **No extra network cost.**
   Watch the Network panel across steps 1–2: each search fires exactly the two combined
   `api.github.com/search/*` requests; the hint and org label add none.

## Accessibility checks

- The "matches profile" hint is real text in the row (not a color-only or tooltip-only signal), so
  screen readers announce it and it works on touch devices.
- KIND labels (`user`/`org`/`repo`) remain text, distinguishable without color, alongside the
  avatar-circle vs `{ }`-tile icon.
