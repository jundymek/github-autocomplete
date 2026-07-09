---
title: github-autocomplete
status: final
created: 2026-07-09
updated: 2026-07-09
---

# PRD: github-autocomplete

## 0. Document Purpose

This PRD defines the requirements for **github-autocomplete**, a recruitment code challenge deliverable: a reusable, self-contained autocomplete component in React + TypeScript that searches GitHub users and repositories. The ground-truth requirements source is the recruitment brief at `docs/task.md`; every bullet in that brief traces to at least one FR below. The audience is the downstream planning chain (architecture, epics, stories) and the implementing engineer. Technology *how* (hook/component decomposition, tooling) lives in `architecture.md`; this document captures capabilities, constraints, and quality bars. Pre-made product decisions are recorded in `.decision-log.md` alongside this file.

## 1. Vision

A hiring evaluator types three characters into a search box and watches the component do everything right: it waits out their keystrokes, fetches GitHub users and repositories in parallel, merges them into a single alphabetical list of at most 50 items, and communicates every intermediate state — loading, empty, error, rate-limited — clearly. Arrow keys walk the list; Enter opens the selected user or repository in a new tab. Nothing external styles it; nothing external breaks it.

The product's real value is not the widget but the signal it sends. The component is *genuinely* reusable — it works with any data source and inside any host app, proven in the demo by a second instance wired to a different data source — and it is *demonstrably* tested, with a test pyramid the brief explicitly asks for. Scope is deliberately small; quality per line is the differentiator.

Success looks like an evaluator cloning a public repository, running the demo and the tests in minutes, and finding every brief requirement met without caveats.

## 2. Target User

### 2.1 Jobs To Be Done

- **Evaluator (primary):** assess the candidate's engineering quality quickly — clone, run, read, verify each brief requirement, inspect the tests.
- **End user (demo persona):** find a GitHub user or repository by name fragment and jump to its page without leaving the keyboard.
- **Integrating developer (reusability persona):** drop the autocomplete into an arbitrary React app with an arbitrary data source, restyle it via documented theme tokens, and trust it not to leak styles or fetch logic.

### 2.2 Key User Journeys

- **UJ-1. Marta searches and opens a repository by keyboard alone.** Marta, reviewing the challenge, runs the demo and clicks into the search input. She types "rea" — after a brief pause a dropdown appears listing users and repositories interleaved alphabetically, capped at 50. She presses ArrowDown three times, sees the highlighted item change, presses Enter, and the repository's GitHub page opens in a new tab; the demo page stays put. **Edge case:** she types "re", deletes back to two characters — no request fires and the dropdown closes.
- **UJ-2. Marta hits the rate limit and understands why.** After many rapid searches without a token, a query fails with GitHub's 403 rate-limit response. Instead of a generic error, the dropdown shows a readable rate-limit message indicating the search is temporarily throttled and when retrying makes sense. She sets the optional token and continues.
- **UJ-3. Tomek reuses the component with his own data.** Tomek, an integrating developer, reads the demo page and sees a second autocomplete instance backed by a non-GitHub data source, styled differently via CSS custom-property overrides. He copies the pattern: supplies his own suggestion-fetching function and item rendering, and gets debounce, threshold, states, and keyboard behavior for free.

## 3. Glossary

- **Autocomplete component** — the generic, reusable UI unit: a text input with an attached Dropdown of Suggestions, agnostic of any particular data source.
- **GitHub adapter** — the thin layer that specializes the Autocomplete component for GitHub: fetching, merging, sorting, and rendering GitHub Result items. Not part of the generic component.
- **Data source** — a host-supplied asynchronous function that, given a Query, returns Suggestions; supports cancellation of in-flight work.
- **Query** — the current text in the input, the string Suggestions are fetched for.
- **Suggestion** — one entry offered in the Dropdown. In the GitHub adapter, a Suggestion is a Result item.
- **Result item** — a GitHub user or repository returned by the GitHub Search API, carrying at minimum an ordering key (profile name or repository name) and the URL of its GitHub page.
- **Dropdown** — the popup list of Suggestions attached to the input (listbox), including its loading, empty, and error states. Not a modal.
- **Highlighted item** — the single Suggestion currently targeted by keyboard navigation; Enter acts on it.
- **Search threshold** — the minimum Query length (3 characters) below which no fetch occurs and the Dropdown stays closed.
- **Debounce interval** — the quiet period (~300 ms) after the last keystroke before a fetch fires.
- **Theme tokens** — the component's documented CSS custom properties (`--ac-*`, each with a fallback) through which a host app restyles it.
- **Rate limit state** — the dedicated error presentation for GitHub's 403 rate-limit response, distinct from the generic error state.
- **Demo app** — the sandbox application that hosts two Autocomplete instances (GitHub adapter + a second Data source) for evaluation; not part of the reusable deliverable.

## 4. Features

### 4.1 Query Input and Fetch Lifecycle

**Description:** The user types into the input; the component decides when a search is warranted and manages the life of each request. Queries shorter than the Search threshold never trigger a fetch and keep the Dropdown closed (realizes UJ-1 edge case). Typing is debounced so a fetch fires only after the Debounce interval of inactivity. When the Query changes while a request is in flight, the stale request is cancelled so late responses can never overwrite newer results.

**Functional Requirements:**

#### FR-1: Minimum query threshold
The component fetches Suggestions only when the Query is at least 3 characters long. *(Traces: brief "Minimal chars number to initialize search: 3.")*

**Consequences (testable):**
- With a 2-character Query, no request is issued and the Dropdown is closed/idle.
- Deleting from 3 to 2 characters closes the Dropdown and cancels any in-flight request.

#### FR-2: Debounced fetching
The component waits ~300 ms after the last keystroke before issuing a request; intermediate keystrokes within the interval produce no requests. Realizes UJ-1.

**Consequences (testable):**
- Typing "react" quickly issues one request (for "react"), not five.

#### FR-3: Stale-request cancellation
When the Query changes (or drops below the Search threshold) while a request is in flight, that request is cancelled; its response, if it arrives, is discarded.

**Consequences (testable):**
- A slow response for an old Query never replaces results for a newer Query.

### 4.2 Combined Results and Presentation

**Description:** For a valid Query, the GitHub adapter searches users and repositories, combines them into one list, orders it alphabetically, caps it at 50, and presents it in a Dropdown attached to the input. The Dropdown works inside constrained host layouts (e.g. `overflow: hidden` containers) — a requirement on the generic component, since reusability includes rendering correctly wherever it is embedded.

> **Documented interpretation of "limited to 50 per request":** the brief's cap is read as *per API request* — each of the two GitHub Search API calls (users, repositories) requests at most 50 items (`per_page=50`), and the combined, alphabetically sorted list shown to the user is also trimmed to at most 50 items. This interpretation of an ambiguous requirement was confirmed by the product owner (Łukasz, 2026-07-09 — see §9 Resolved Questions and `.decision-log.md`, D2/U1).

**Functional Requirements:**

#### FR-4: Dual-domain search
For a qualifying Query, the GitHub adapter retrieves both matching GitHub users and matching GitHub repositories (two parallel searches). *(Traces: brief title and task statement "fetch matching users and repositories".)*

**Consequences (testable):**
- One user-typed Query results in exactly one users search and one repositories search.
- A partial failure (one search fails, one succeeds) is surfaced as the error state (FR-8), never as partial results — a partial list would break the combined alphabetical ordering guarantee (FR-5) and add states; predictability and testability win. (Decided by Łukasz, 2026-07-09.)

#### FR-5: Alphabetical combined ordering
Users and repositories are merged into a single list ordered alphabetically, case-insensitively, using the profile name (users) and repository name (repositories) as ordering keys. *(Traces: brief "Result items are combined and displayed alphabetically using repository and profile name as ordering keys.")*

**Consequences (testable):**
- Given mixed users and repositories, the rendered order is a single case-insensitive alphabetical sequence across both kinds (locale-aware comparison).
- The ordering key for a repository is its bare repository name (not the `owner/name` path), per the brief's literal "repository and profile name as ordering keys"; the rendered item may display `owner/name`, but sorting uses the bare name. (Decided by Łukasz, 2026-07-09.)

#### FR-6: Result cap of 50
Each underlying search requests at most 50 items, and the combined displayed list contains at most 50 Result items. *(Traces: brief "Number of result items should be limited to 50 per request." — see interpretation note above.)*

**Consequences (testable):**
- With 50 users + 50 repositories available, exactly 50 combined items render, and they are the alphabetically first 50 of the merged set.

#### FR-7: Dropdown presentation in any host layout
Suggestions render in a Dropdown (popup list attached to the input), not a modal; the Dropdown displays correctly even when the component is embedded in clipping containers, and long lists scroll within a bounded height. Realizes UJ-1, UJ-3.

**Consequences (testable):**
- Inside an `overflow: hidden` ancestor, the open Dropdown is fully visible.
- With 50 items, the Dropdown is height-bounded and scrollable; no pagination controls exist.

### 4.3 State Feedback

**Description:** The component always tells the user what is happening. Every state the brief names — fetching, empty, error — has a distinct visual presentation, plus a dedicated Rate limit state because unauthenticated GitHub search throttles quickly and a generic "something went wrong" would mislead the evaluator (realizes UJ-2).

**Functional Requirements:**

#### FR-8: Loading, empty, and error feedback
The component shows distinct visual feedback while data is being fetched, when results are empty, and when the request resulted in an error. *(Traces: brief "visual feedback for when the data is being fetched, the results are empty, or the request resulted in an error.")*

**Consequences (testable):**
- During an in-flight fetch, a loading indicator is visible.
- A successful response with zero Result items shows an explicit empty-state message.
- A failed request shows an error state with human-readable text.

#### FR-9: Dedicated rate-limit state
A GitHub 403 rate-limit response produces a distinct, readable Rate limit state explaining that the API limit was hit and indicating when a retry is sensible (using retry-after/reset information when available). Realizes UJ-2.

**Consequences (testable):**
- A mocked 403 rate-limit response renders the Rate limit state, visually and textually distinct from the generic error state.

### 4.4 Keyboard Interaction

**Description:** The component is fully operable by keyboard. Arrow keys move the Highlighted item through the Dropdown; Enter opens the highlighted user's or repository's GitHub page in a new tab. Escape closes the Dropdown. Keyboard behavior belongs to the generic component; *what Enter opens* is supplied by the adapter via selection handling. Realizes UJ-1.

**Functional Requirements:**

#### FR-10: Arrow-key navigation
Up and down arrow keys move the Highlighted item through the visible Suggestions, with the highlight visually evident and kept scrolled into view. *(Traces: brief "up and down arrows to browse the results".)*

**Consequences (testable):**
- ArrowDown from the input highlights the first Suggestion; subsequent presses advance; ArrowUp moves back.
- The Highlighted item is scrolled into view within the bounded Dropdown.

#### FR-11: Enter opens the target in a new tab
Pressing Enter on a Highlighted item opens that user's or repository's GitHub page in a new browser tab; the host page retains its state. *(Traces: brief "enter to open a new tab with the repository/user page".)*

**Consequences (testable):**
- Enter on a highlighted repository opens its GitHub URL in a new tab (verifiable in e2e via a new-page event).
- Mouse selection of a Suggestion behaves the same as Enter. [ASSUMPTION: click-to-open matches Enter; the brief specifies only keyboard.]

#### FR-12: Escape closes the Dropdown
Pressing Escape closes the Dropdown without clearing focus from the input. [ASSUMPTION: Escape support is an addition beyond the brief, included as standard combobox behavior.]

**Consequences (testable):**
- With the Dropdown open, Escape closes it; the Query text remains; focus stays on the input.

### 4.5 Reusability and Public Surface

**Description:** Reusability and self-containment are first-class requirements, not implementation niceties: the brief's opening sentence asks for "a reusable and self-contained autocomplete component," and it forbids using an existing autocomplete library. The generic Autocomplete component must work with *any* Data source and inside *any* host app; the GitHub behavior is one adapter over it. Theming happens exclusively through documented Theme tokens — the host never needs to pierce the component's styles. [ASSUMPTION: "self-contained" is read as style + logic isolation from the host app, not as "zero runtime dependencies."] Realizes UJ-3.

**Functional Requirements:**

#### FR-13: Built from scratch, no autocomplete library
The autocomplete behavior (input handling, dropdown, states, keyboard navigation) is implemented in this codebase; no existing autocomplete/combobox library or component library is used. *(Traces: brief "Don't use an existing autocomplete library.")*

**Consequences (testable):**
- Dependency manifest contains no autocomplete/combobox/component-library packages.

#### FR-14: Data-source-agnostic component
The generic Autocomplete component accepts its Data source, item rendering, item identity, and selection handling from the host; it contains no GitHub-specific knowledge. *(Traces: brief "reusable ... component".)*

**Consequences (testable):**
- The component functions, in the Demo app, against a second non-GitHub Data source with different item rendering and selection behavior, with no changes to the component itself.

#### FR-15: Self-contained styling with themeable tokens
The component ships its own styles, scoped so they neither leak into nor depend on the host app, and exposes its appearance for customization solely through documented Theme tokens with sensible fallbacks. *(Traces: brief "self-contained".)*

**Consequences (testable):**
- Rendering the component in an unstyled host yields a fully styled component (fallback values apply).
- Overriding a documented Theme token from the host changes the corresponding visual property; no host-side selector overrides are required.

### 4.6 GitHub Access

**Description:** The GitHub Search API is called directly from the browser, unauthenticated by default so the evaluator needs zero setup. An optional access token can be supplied (never committed) to raise rate limits during heavy use.

**Functional Requirements:**

#### FR-16: Zero-config GitHub search with optional token
The GitHub adapter works unauthenticated out of the box; when an optional token is provided, requests are authenticated to raise rate limits. The token is supplied by configuration, never hardcoded or committed.

**Consequences (testable):**
- With no token configured, searches succeed against the public API.
- With a token configured, requests carry authentication.

### 4.7 Demonstration and Verification

**Description:** The brief explicitly asks the solution to "display a meaningful snippet of your ability to test the code" — testing is a deliverable, not just process. The Demo app is the evaluator's entry point: it showcases the GitHub autocomplete and the second-data-source instance, and the repository must run and verify with standard commands.

**Functional Requirements:**

#### FR-17: Demo application proving both usage modes
A runnable Demo app presents the GitHub autocomplete and a second Autocomplete instance backed by a different Data source, demonstrating reuse (FR-14) and theming (FR-15). Realizes UJ-1, UJ-3.

**Consequences (testable):**
- A single documented command starts the Demo app locally; both instances are usable.

#### FR-18: Meaningful automated test suite
The repository ships automated tests spanning three layers: unit tests for pure logic (merge/sort/limit, response mapping), integration tests for component behavior against mocked HTTP (Search threshold, Debounce interval, keyboard navigation, all visual states including Rate limit state, stale-request cancellation), and a thin end-to-end layer for browser-real behavior (new-tab opening, focus, automated accessibility scan) with the API mocked. *(Traces: brief "display a meaningful snippet of your ability to test the code.")*

**Consequences (testable):**
- Documented commands run each layer; all pass on a clean clone.
- Every FR-1..FR-12 behavior above is exercised by at least one automated test.

#### FR-19: Continuous integration and public delivery
The deliverable is a publicly accessible git repository with CI that runs the test suite on every push, and a README enabling an evaluator to install, run, and test without prior context. *(Traces: brief "Url to a publicly accessible git repository.")*

**Consequences (testable):**
- CI status is green on the default branch; the README's commands work verbatim.

## 5. Non-Goals (Explicit)

- **Not a product launch.** This is a quality demonstration; no analytics, monetization, user accounts, or growth features.
- **Not a general search client.** Only name-fragment search of users and repositories; no filters, sorting options, or advanced GitHub query syntax exposed to the user.
- **Not a published npm package (v1).** Reusability is proven architecturally and in the Demo app, not via package distribution.
- **No pagination or infinite scroll — deliberate.** The brief's "limited to 50 per request" is read as a cap, not a paging feature; paging would break "combined and displayed alphabetically," since full alphabetical order across both domains requires the whole result set up front (GitHub sorts by relevance score). A bounded, scrollable list of ≤50 items needs no paging or virtualization. (Decision D5.)
- **No server component.** All GitHub access is client-side; no proxy, no SSR.

## 6. MVP Scope

### 6.1 In Scope

- Generic, reusable, self-contained Autocomplete component (data-source-agnostic, themeable, keyboard-operable, all feedback states).
- GitHub adapter: dual-domain search, merge + alphabetical sort, 50-item cap, open-in-new-tab, Rate limit state, optional token.
- Demo app with the GitHub instance and a second-data-source instance.
- Three-layer automated test suite and CI; public repository with evaluator-ready README.
- Accessibility per §7 NFRs.

### 6.2 Out of Scope for MVP

- Pagination / infinite scroll / result virtualization — see Non-Goals (rationale recorded).
- SSR / server rendering — the deliverable is a client-side component in a client-side sandbox.
- Internationalization — all UI text in English (matches the evaluation context).
- Persistence (search history, caching across sessions) — adds no signal for the brief's requirements.
- Authentication flows beyond the optional token — no OAuth, no login.
- npm packaging/publishing — deferred; would matter only if the component were adopted beyond the challenge.

## 7. Cross-Cutting NFRs

- **NFR-1 — Accessibility (WCAG 2.1 AA target):** the component implements the WAI-ARIA combobox pattern (input as combobox, popup as listbox, active-item semantics), full keyboard operability (FR-10..12), a visible focus indicator, and AA-level color contrast in its default theme. Verified by the automated accessibility scan in the e2e layer (FR-18).
- **NFR-2 — Responsiveness under typing:** the UI never blocks on network activity; debouncing (FR-2) and cancellation (FR-3) ensure exactly one relevant request per settled Query and no flicker from stale responses.
- **NFR-3 — Resilience to API failure:** any failure mode of the GitHub API (network error, non-2xx, rate limit) degrades to a clear user-facing state (FR-8, FR-9); the component never renders broken/blank on failure and recovers on the next Query.
- **NFR-4 — Type safety and code quality:** TypeScript in strict mode across the codebase; the component's public surface (props, tokens) is fully typed and documented. React + TypeScript is a fixed constraint from the brief.
- **NFR-5 — Isolation:** the reusable component has no dependencies on the host app, no global style side effects, and no GitHub-specific code; the demo/adapter layers may not be required for the component to compile or render.
- **NFR-6 — Secret hygiene:** no token or credential is committed to the repository in any form; token supply is documented and optional.

## 8. Success Metrics

*Stakes-calibrated: a recruitment deliverable has no quantitative product metrics; success is binary evaluator verification.*

**Primary**
- **SM-1**: Requirement coverage — every bullet of `docs/task.md` is verifiably met and traceable to a passing automated test. Validates FR-1..FR-13, FR-18.
- **SM-2**: Evaluator time-to-verify — a clean clone reaches a running Demo app and a green test suite using only README commands, in minutes, with zero configuration (no token needed). Validates FR-16, FR-17, FR-19.

**Secondary**
- **SM-3**: Reuse proof — the second-data-source instance in the Demo app works and is visibly differently themed, without modifying the component. Validates FR-14, FR-15.

**Counter-metrics (do not optimize)**
- **SM-C1**: Feature count / scope breadth — adding capabilities beyond the brief (filters, paging, packaging) dilutes the quality-per-line signal the deliverable is optimized for. Counterbalances SM-1.

## 9. Open Questions

None. All questions raised at creation were resolved by the product owner — see Resolved Questions below.

### Resolved Questions (decided by Łukasz, 2026-07-09)

1. **"50 per request" intent — RESOLVED, interpretation confirmed as-is.** `per_page=50` per API request, max 50 combined displayed (§4.2 note, D2/U1). The README should state the interpretation too.
2. **Partial-failure presentation — RESOLVED: full error state, no partial results.** A partial list would break the "combined and displayed alphabetically" requirement and adds states; predictability and testability win. Folded into FR-4 (U2).
3. **Repository ordering key — RESOLVED: bare repository name, not `owner/name`,** per the brief's literal "repository and profile name as ordering keys". Display may show `owner/name`; sorting uses the bare name. Folded into FR-5 (U3).

## 10. Assumptions Index

*(Former assumptions on FR-4 partial-failure handling and FR-5 repository ordering key were resolved by the product owner on 2026-07-09 and promoted to decided requirements — see §9 Resolved Questions.)*

- §4.4 / FR-11 — mouse click on a Suggestion behaves identically to Enter (brief specifies only keyboard).
- §4.4 / FR-12 — Escape-to-close is included as standard combobox behavior beyond the brief's explicit keys.
- Global — "self-contained" is read as style + logic isolation from the host app (NFR-5, FR-15), not as "no runtime dependencies at all."
- Global — English-only UI and docs, per the evaluation context and project contract.
