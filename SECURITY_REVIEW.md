# Security Review Before Deploy or GitHub Upload

This project has a local security reviewer that checks for common accidental leaks before commit or push.

## Commands

Run a full review:

```powershell
npm run security:review
```

Run a staged-file review:

```powershell
npm run security:staged
```

## Git Hooks

The repository uses `.githooks`:

- `pre-commit` checks staged files.
- `pre-push` checks tracked files before upload.

Enable hooks after cloning:

```powershell
git config core.hooksPath .githooks
```

## What It Blocks

- `.env` and environment variants
- private keys such as `.pem`, `.key`, `id_rsa`, `id_ed25519`
- credential files such as `credentials.json`
- obvious password, token, API key, bearer token, GitHub token, Google API key, AWS access key, and private key patterns

## Rules

- Put real secrets in `.env`, not source files.
- Keep `.env.example` as placeholders only.
- Do not commit generated build output or dependencies.
- Treat false positives carefully. Prefer changing the text to a placeholder instead of bypassing the check.
