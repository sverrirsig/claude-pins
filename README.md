# claude-pins

A Claude Code mod that pins links (Slack threads, PRs, Jira tickets) in a band above the prompt for the rest of the session.

```
💬 UP-8519 thread ×   🐙 app#3443 ×   🎫 UP-8519 ×
```

## Install

```
/plugin install pins --marketplace sverrirsig/claude-pins
```

Answer `y` to add the marketplace, then pick a scope.

## Usage

- `/pin <url> [label]` pins a link; `/pin` alone lists pins.
- `/unpin <number|label|url|all>` removes pins, or click `×` in the band.
- Or just ask Claude: "pin that Slack thread". It calls the `pin` / `unpin` tools.

Icons follow the host: 💬 Slack, 🐙 GitHub, 🎫 Jira, 📌 anything else.

## Develop

```
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```
