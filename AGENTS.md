## Repository hygiene

- Avoid rewriting published git history (force push, rebase/amend/squash of pushed commits) unless you intend to coordinate with all collaborators.
- Do not commit secret values (API keys, tokens, credentials); use your host or CI secret store instead.
- Prefer small, focused changes that keep the default branch deployable.
