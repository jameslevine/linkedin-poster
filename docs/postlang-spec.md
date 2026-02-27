la# PostLang Language Specification v1.0

## Overview

PostLang is a domain-specific language for writing structured LinkedIn posts. This document defines the complete syntax, semantics, and validation rules.

## File Format

- **Extension:** `.post`
- **Encoding:** UTF-8
- **Line endings:** LF or CRLF

## Lexical Structure

### Comments

Lines starting with `//` are comments and ignored by the compiler.

```postlang
// This is a comment
# "Title"
```

### Whitespace

- Leading and trailing whitespace on lines is ignored
- Empty lines are ignored
- Whitespace within quoted strings is preserved

### Strings

Strings are enclosed in double quotes (`"`). Escape sequences are not supported.

```postlang
# "This is a valid string"
```

## Syntax

### Grammar (EBNF)

```ebnf
post        = { line } ;
line        = limit | title | claim | evidence | insight | context | credential | source | comment ;
limit       = "^" , identifier , number ;
title       = "#" , string ;
claim       = "!" , string ;
evidence    = "+" , value , "|" , string ;
insight     = ">" , string ;
context     = "?" , string ;
credential  = "*" , string ;
source      = "@" , string , "|" , url ;
comment     = "//" , { any } ;
string      = '"' , { char } , '"' ;
value       = { char - "|" } ;
url         = { char - whitespace } ;
identifier  = letter , { letter | digit } ;
number      = digit , { digit } ;
```

### Symbols

| Symbol | Name       | Required | Multiple  |
| ------ | ---------- | -------- | --------- |
| `^`    | Limit      | No       | Yes       |
| `#`    | Title      | Yes      | No        |
| `!`    | Claim      | Yes      | No        |
| `+`    | Evidence   | Yes      | Yes (1-5) |
| `>`    | Insight    | Yes      | No        |
| `?`    | Context    | No       | No        |
| `*`    | Credential | No       | No        |
| `@`    | Source     | Yes      | No        |

## Element Specifications

### Limit (`^`)

Sets custom character limits for elements.

**Syntax:**

```postlang
^ <element> <number>
```

**Valid elements:**

- `title` - Maximum characters for title (default: 80)
- `claim` - Maximum characters for claim (default: 150)
- `evidence` - Maximum characters per evidence item (default: 60)
- `insight` - Maximum characters for insight (default: 120)
- `context` - Maximum characters for context (default: 100)
- `total` - Maximum characters for compiled output (default: 700)

**Example:**

```postlang
^ total 500
^ title 60
```

### Title (`#`)

The hook or headline of the post.

**Syntax:**

```postlang
# "<text>"
```

**Constraints:**

- Maximum 80 characters (configurable)
- Cannot end with `?`
- Cannot contain `!`
- Cannot contain emojis
- Cannot contain banned phrases

**Example:**

```postlang
# "Verification beats scale for AI reliability"
```

### Claim (`!`)

The main assertion or point of the post.

**Syntax:**

```postlang
! "<text>"
```

**Constraints:**

- Maximum 150 characters (configurable)
- Should be falsifiable
- Cannot contain emojis
- Cannot contain banned phrases

**Example:**

```postlang
! "Test-time verification outperforms larger model training"
```

### Evidence (`+`)

Data points supporting the claim.

**Syntax:**

```postlang
+ <value> | "<context>"
```

**Constraints:**

- Minimum 1, maximum 5 items
- Value should contain numbers (%, x, decimals)
- Context maximum 60 characters (configurable)
- Cannot contain emojis
- Cannot contain banned phrases

**Example:**

```postlang
+ 22% | "in-distribution improvement"
+ 13% | "out-of-distribution improvement"
```

### Insight (`>`)

The key takeaway or "so what" of the post.

**Syntax:**

```postlang
> "<text>"
```

**Constraints:**

- Maximum 120 characters (configurable)
- Should be actionable or memorable
- Cannot contain emojis
- Cannot contain banned phrases

**Example:**

```postlang
> "Verify outputs at inference instead of training bigger models"
```

### Context (`?`)

Optional background information.

**Syntax:**

```postlang
? "<text>"
```

**Constraints:**

- Maximum 100 characters (configurable)
- Cannot contain emojis
- Cannot contain banned phrases

**Example:**

```postlang
? "Based on experiments across 5 benchmark datasets"
```

### Credential (`*`)

Optional statement of qualification.

**Syntax:**

```postlang
* "<text>"
```

**Constraints:**

- No character limit
- Cannot contain emojis
- Cannot contain banned phrases

**Example:**

```postlang
* "10 years building AI systems at AWS"
```

### Source (`@`)

Attribution for the content.

**Syntax:**

```postlang
@ "<title>" | <url>
```

**Constraints:**

- Title is required
- URL must be valid (http:// or https://)
- Cannot contain emojis

**Example:**

```postlang
@ "Scaling Verification vs Policy Learning" | https://arxiv.org/abs/2602.12281
```

## Validation Rules

### Required Elements

The following elements must be present:

1. Title (`#`)
2. Claim (`!`)
3. At least one Evidence (`+`)
4. Insight (`>`)
5. Source (`@`)

### Banned Phrases

The compiler rejects content containing:

```
game-changer
game changer
revolutionary
groundbreaking
exciting
thrilled
delighted
proud to announce
thrilled to announce
excited to share
let me tell you
here's the thing
in today's world
in this day and age
at the end of the day
it goes without saying
needless to say
leverage
synergy
paradigm shift
disruptive
innovative solution
cutting-edge
state-of-the-art
best-in-class
world-class
next-level
deep dive
unpack
circle back
move the needle
```

### Banned Patterns

- Emojis (Unicode ranges U+1F600-U+1F64F, U+1F300-U+1F5FF, etc.)
- Exclamation marks in any text
- Questions as titles (ending with `?`)

## Output Format

### Structure

```
<title>.

[<context>]

<claim>.

Results:
- <evidence_1>
- <evidence_2>
...

<insight>.

[<credential>]

Source: <source_title>
<source_url_without_protocol>
```

### Formatting Rules

1. Title ends with period
2. Context appears after title (if present)
3. Claim ends with period
4. Evidence items prefixed with `- `
5. Insight ends with period
6. Credential in square brackets (if present)
7. Source URL has protocol stripped
8. Blank lines separate sections

## Error Handling

### Parse Errors

Returned when syntax is invalid:

- `Line N: Invalid title. Use # "Your title"`
- `Line N: Invalid claim. Use ! "Your claim"`
- `Line N: Invalid evidence. Use + value | "context"`
- `Line N: Invalid insight. Use > "Your insight"`
- `Line N: Invalid source. Use @ "Title" | url`

### Validation Errors

Returned when content violates rules:

- `Missing # (title)`
- `Missing ! (claim)`
- `Missing + (evidence)`
- `Missing > (insight)`
- `Missing @ (source)`
- `# exceeds N chars (has M)`
- `# cannot be a question`
- `# cannot contain exclamation marks`
- `Banned phrase: "phrase"`
- `Emojis are not allowed`
- `Exclamation marks not allowed`
- `Output exceeds N chars (has M)`

### Warnings

Non-fatal issues:

- `? exceeds N chars (has M)`

## CLI Interface

### Commands

```bash
# Compile to stdout
postlang compile <input.post>

# Compile to file
postlang compile <input.post> <output.txt>

# Validate only
postlang validate <input.post>

# Analyze plain text
postlang analyze <input.txt>

# Read from stdin
cat file.post | postlang compile --stdin
```

### Exit Codes

- `0` - Success
- `1` - Compilation/validation failed

## Examples

### Minimal Valid Post

```postlang
# "Title"
! "Claim"
+ 10% | "improvement"
> "Insight"
@ "Source" | https://example.com
```

### Full Featured Post

```postlang
// Custom limits
^ total 600
^ title 100

// Content
# "Verification beats scale for AI reliability"
? "New research from DeepMind"
! "Test-time verification outperforms larger model training"
+ 22% | "in-distribution improvement"
+ 13% | "out-of-distribution improvement"
+ 45% | "real-world improvement"
> "Verify outputs at inference instead of training bigger models"
* "10 years building AI systems at AWS"
@ "Scaling Verification vs Policy Learning" | https://arxiv.org/abs/2602.12281
```

### Output

```
Verification beats scale for AI reliability.

New research from DeepMind

Test-time verification outperforms larger model training.

Results:
- 22% in-distribution improvement
- 13% out-of-distribution improvement
- 45% real-world improvement

Verify outputs at inference instead of training bigger models.

[10 years building AI systems at AWS]

Source: Scaling Verification vs Policy Learning
arxiv.org/abs/2602.12281
```

## Version History

- **v1.0** - Initial release
  - Core syntax with 8 symbols
  - Banned phrase detection
  - Character limit validation
  - CLI compiler and analyzer
