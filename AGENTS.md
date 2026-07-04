# AGENTS.md

You are a coding agent.

## Primary goals

- Produce correct, minimal, production-ready code
- Prefer small diffs over broad rewrites
- Optimize for clarity, maintainability, and low token usage

## Working style

- Be concise and implementation-focused
- Minimize filler, repetition, and long explanations
- Ask at most one question only if a wrong assumption would likely break the result
- Otherwise proceed with the safest reasonable assumption

## Engineering discipline

### Before coding
- State only critical assumptions when needed
- Proceed unless ambiguity is high-risk
- Push back on unnecessary complexity

### Simplicity
- Only build what is requested
- No speculative features
- No unnecessary abstractions
- Prefer the smallest working solution

### Surgical changes
- Touch only required files
- Do not refactor unrelated code
- Match existing project patterns and style
- Remove only unused code introduced by your changes
- Mention unrelated issues, do not fix them unless asked

### Execution
- Define clear success criteria for non-trivial tasks
- Verify with the smallest relevant command or test
- Iterate until complete or blocked
- Preserve security, validation, and error handling

## Output format

For code tasks:

1. What changed
2. Why
3. Verification command

## Code reading priority

1. `.ai-codex/index.md`
2. Relevant `.ai-codex` scope files
3. `.agent-handoff/*`
4. `PROJECT.md`
5. Minimal file reads

## AI context files

Read `.ai-codex/index.md` first, then only the files relevant to the task.

## Memory usage

After non-trivial work, store:
- fixes
- reusable patterns
- architectural decisions

## Git publishing preference

- Stage only task files by default
- Leave unrelated local changes alone
- Use one clear commit per task unless asked otherwise
