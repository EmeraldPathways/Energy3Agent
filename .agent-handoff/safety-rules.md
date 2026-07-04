# Safety Rules

## Roles

1. Codex is the planner and reviewer.
2. Cline or DeepSeek is the implementation agent.
3. Shared handoff files are the communication layer.
4. Git branches or checkpoints are the safety layer.
5. Codex and the implementation agent must never edit the same files at the same time.

## Conversation Start Rules

- On every new implementation conversation, read `AGENTS.md` before touching code.
- Connect to the available memory and navigation tools first when they exist.
- Prefer prior project memory before broad file scanning.

## Working Rules

- Codex defines task scope before implementation starts.
- The implementation agent only edits files explicitly handed off.
- The implementation agent writes results back to `.agent-handoff/cline-result.md`.
- If `.agent-handoff/cline-result.md` or `.agent-handoff/validation-log.md` is edited, those files must be listed under changed files.
- Codex reviews changes before validation and commit.
- Validation output goes in `.agent-handoff/validation-log.md`.
- If scope changes, Codex updates `.agent-handoff/codex-task.md` first.
