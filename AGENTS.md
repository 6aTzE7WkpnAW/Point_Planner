# Repository Guidelines

## Project Structure & Module Organization
- `point_planner.py` is the current entry point and primary module.
- `web/` is reserved for any web-related assets or experiments.
- `README.md` contains the high-level project description.
- `.claude/` contains local tooling metadata; avoid editing unless needed for automation.

## Build, Test, and Development Commands
There is no formal build system yet. Use these as needed:
- `python point_planner.py` — run the main module.
- `python -m pytest` — run tests if/when they are added.

## Coding Style & Naming Conventions
- Language: Python.
- Indentation: 4 spaces, no tabs.
- Naming: `snake_case` for functions/variables, `PascalCase` for classes, `UPPER_SNAKE_CASE` for constants.
- Prefer small, focused functions and explicit types where clarity helps.

## Testing Guidelines
- No test suite exists yet.
- If adding tests, use `pytest` with files named `test_*.py` under a `tests/` directory.
- Keep tests deterministic and avoid network calls unless explicitly required.

## Commit & Pull Request Guidelines
- Current history shows mixed English/Japanese short messages (e.g., “first commit”, “参考用Pythonファイル追加”), so there is no enforced convention.
- Recommended: concise, imperative messages in either English or Japanese, e.g., `Add planner CLI`.
- PRs should include:
  - A brief summary of changes.
  - Any relevant commands run (e.g., `python -m pytest`).
  - Screenshots or logs if behavior changes are user-visible.

## Configuration & Safety Notes
- Keep repository secrets out of the codebase.
- If adding configuration files, document defaults and provide safe sample values.
