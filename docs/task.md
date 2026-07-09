# Code Challenge — Original Task (verbatim)

> Source: recruitment brief received by email. This document is the ground truth
> for all requirements; every FR in the PRD traces back to a bullet below.

---

As discussed I am sending you the text "code challenge".

## GitHub repositories and users autocomplete component

Your task is to create a reusable and self-contained autocomplete component,
which can fetch matching users and repositories for a given string of characters.

### Requirements:

- Don't use an existing autocomplete library (even if in real life this would be preferred).
- Minimal chars number to initialize search: 3.
- Result items are combined and displayed alphabetically using repository and profile name as ordering keys.
- Number of result items should be limited to 50 per request.
- The component should give visual feedback for when the data is being fetched, the results are empty, or the request resulted in an error.
- The component supports keyboard strokes (up and down arrows to browse the results, enter to open a new tab with the repository/user page).
- The solution should also display a meaningful snippet of your ability to test the code.

**Techstack:** React, TypeScript.

**Code challenge artifact:** Url to a publicly accessible git repository.
