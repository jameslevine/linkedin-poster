# PostLang Specification

A minimal DSL for writing concise LinkedIn posts. No emojis, no fluff, just facts.

## Design Principles

1. **Brevity** - Every word must earn its place
2. **Data-driven** - Claims require evidence
3. **Structure** - Clear sections, predictable format
4. **No AI slop** - Banned phrases and patterns

## Syntax

### Document Structure

```postlang
# "Your hook here"
! "Main assertion"
+ 22% | "improvement in X"
+ 45% | "improvement in Y"
> "Key takeaway"
@ "Paper Title" | https://link.com
```

### Symbols

| Symbol | Name       | Description                              |
| ------ | ---------- | ---------------------------------------- |
| `^`    | Limit      | Set char limit. Format: `^ name value`   |
| `#`    | Title      | The hook. Max 80 chars default.          |
| `!`    | Claim      | Your main point. Max 150 chars default.  |
| `+`    | Evidence   | Data point. Format: `value \| "context"` |
| `>`    | Insight    | The "so what". Max 120 chars default.    |
| `?`    | Context    | Optional background. Max 100 chars.      |
| `*`    | Credential | Why you're qualified. Optional.          |
| `@`    | Source     | Attribution. Format: `"title" \| url`    |

### Character Limits

Set custom limits at the top of your post:

```postlang
^ total 500
^ title 60
^ claim 100
```

**Available limits:**

- `title` - Max chars for title (default: 80)
- `claim` - Max chars for claim (default: 150)
- `evidence` - Max chars per evidence item (default: 60)
- `insight` - Max chars for insight (default: 120)
- `context` - Max chars for context (default: 100)
- `total` - Max chars for entire output (default: 700)

### Rules

**Title (#)**

- Max 80 chars
- No questions
- No exclamation marks

**Claim (!)**

- One sentence
- Must be falsifiable

**Evidence (+)**

- 1-5 items required
- Numbers must include units or %
- Context must be specific

**Insight (>)**

- Max 120 chars
- The "so what" - why this matters

**Context (?)**

- Optional
- Max 100 chars

**Credential (\*)**

- Optional
- Why you're qualified to speak on this

**Source (@)**

- Required
- Format: `"title" | url`

## Banned Patterns

The compiler rejects:

- Emojis
- "Game-changer", "Revolutionary", "Exciting"
- Questions as hooks
- "I'm thrilled to announce"
- "Let me tell you"
- "Here's the thing"
- Exclamation marks

## Output Format

Compiles to plain text with:

- Title on line 1
- Blank line
- Claim
- Blank line
- Evidence as bullet points
- Blank line
- Insight
- Blank line
- Source and URL

## Example

### Input (PostLang)

```postlang
# "Verification beats scale for AI reliability"
! "Test-time verification outperforms larger model training"
+ 22% | "in-distribution improvement"
+ 13% | "out-of-distribution improvement"
+ 45% | "real-world improvement"
> "Verify outputs at inference instead of training bigger models"
@ "Scaling Verification vs Policy Learning" | https://arxiv.org/abs/2602.12281
```

### Output (LinkedIn)

```
Verification beats scale for AI reliability.

Test-time verification outperforms larger model training.

Results:
- 22% in-distribution improvement
- 13% out-of-distribution improvement
- 45% real-world improvement

Verify outputs at inference instead of training bigger models.

Source: Scaling Verification vs Policy Learning
arxiv.org/abs/2602.12281
```
