# Contributing

AILore Sift is early-stage. Contributions should preserve the distinction between source facts and AI interpretation.

## Development checks

Before opening a pull request:

```bash
pnpm format:check
pnpm check
pnpm test
```

## Adding a source

A source contribution should include:

- A `SourceDefinition`
- A `SourceAdapter`
- Fixture-based parser tests
- Publication-time behavior
- Canonical URL behavior
- Copyright and full-text policy
- Failure behavior and a reasonable fetch interval

Do not put source-specific parsing rules in the ingestion pipeline.

## Pull request scope

Keep pull requests focused. Schema changes must include a migration and explain data compatibility. Changes to ranking or AI analysis must document evidence, model, prompt version, and fallback behavior.
