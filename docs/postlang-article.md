st# PostLang: A DSL for Writing LinkedIn Posts That Don't Suck

## The Problem

LinkedIn is drowning in AI-generated slop. Every scroll reveals the same patterns:

- "I'm thrilled to announce..."
- "This is a game-changer!"
- "Let me tell you about my journey 🚀"
- Questions as hooks designed to manipulate engagement
- Walls of emojis
- Vague claims with no evidence

The platform has become a parody of itself. But here's the thing: LinkedIn still works for professional networking. The problem isn't the platform—it's the content.

## The Solution

PostLang is a domain-specific language (DSL) for writing LinkedIn posts. It enforces structure, requires evidence, and bans the patterns that make content feel like spam.

Instead of writing free-form text and hoping it doesn't sound like AI slop, you write in a constrained format that compiles to clean, professional prose.

## Why a DSL?

Three reasons:

1. **Constraints breed creativity.** When you can't rely on emojis and exclamation marks, you have to write better.

2. **Structure ensures quality.** Every post must have a claim, evidence, and insight. No more vague platitudes.

3. **Validation catches mistakes.** The compiler rejects banned phrases before you embarrass yourself.

## How It Works

### The Syntax

PostLang uses single-character symbols for each element:

```postlang
# "Your hook here"
! "Your main claim"
+ 22% | "evidence with context"
> "Your key insight"
@ "Source Title" | https://source.url
```

That's it. Five required elements, each with a clear purpose.

### The Output

The compiler transforms this into clean prose:

```
Your hook here.

Your main claim.

Results:
- 22% evidence with context

Your key insight.

Source: Source Title
source.url
```

No emojis. No exclamation marks. No "I'm thrilled to announce." Just information.

## The Rules

### What's Required

| Symbol | Name     | Purpose                   |
| ------ | -------- | ------------------------- |
| `#`    | Title    | The hook (max 80 chars)   |
| `!`    | Claim    | Your main point (max 150) |
| `+`    | Evidence | Data to support claim     |
| `>`    | Insight  | The "so what" (max 120)   |
| `@`    | Source   | Attribution with URL      |

### What's Optional

| Symbol | Name       | Purpose                 |
| ------ | ---------- | ----------------------- |
| `^`    | Limit      | Custom character limits |
| `?`    | Context    | Background information  |
| `*`    | Credential | Why you're qualified    |

### What's Banned

The compiler rejects posts containing:

- Emojis
- Exclamation marks
- Questions as titles
- "Game-changer", "Revolutionary", "Exciting"
- "I'm thrilled to announce"
- "Let me tell you"
- "Here's the thing"
- "In today's world"
- "At the end of the day"
- And 20+ more AI slop phrases

## Real Example

### Input

```postlang
# "Verification beats scale for AI reliability"
! "Test-time verification outperforms larger model training"
+ 22% | "in-distribution improvement"
+ 13% | "out-of-distribution improvement"
+ 45% | "real-world improvement"
> "Verify outputs at inference instead of training bigger models"
@ "Scaling Verification vs Policy Learning" | https://arxiv.org/abs/2602.12281
```

### Output

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

### Why This Works

1. **Clear hook** - States the finding directly
2. **Falsifiable claim** - Can be verified or refuted
3. **Specific evidence** - Three data points with context
4. **Actionable insight** - Tells you what to do differently
5. **Proper attribution** - Links to the source

## Using PostLang

### Installation

```bash
npm install
```

### Commands

```bash
# Compile a post
npm run post:compile -- posts/my-post.post

# Validate syntax
npm run post:validate -- posts/my-post.post

# Analyze existing LinkedIn post
npm run post:analyze -- output/post.txt
```

### Workflow

1. Write your post in `.post` format
2. Run validation to check for errors
3. Compile to plain text
4. Copy to LinkedIn

## The Philosophy

PostLang isn't about making writing easier. It's about making writing better.

The constraints force you to:

- **Have something to say.** You can't write a PostLang post without a claim and evidence.
- **Be specific.** Vague platitudes don't compile.
- **Cite sources.** Every post requires attribution.
- **Skip the fluff.** Character limits keep you focused.

## Who Should Use This

PostLang is for people who:

- Share research findings or technical insights
- Want to build credibility through substance
- Are tired of sounding like everyone else
- Value their audience's time

It's not for:

- Personal stories (no structure for narrative)
- Engagement farming (banned patterns)
- Quick takes (requires evidence)

## The Future

PostLang is intentionally minimal. Future additions might include:

- Templates for common post types
- Integration with research paper APIs
- Automatic evidence extraction
- Multi-platform output (Twitter, blog)

But the core philosophy won't change: constraints that force better writing.

## Try It

Write your next LinkedIn post in PostLang. If you can't express your idea in this format, maybe the idea isn't ready to share.

```postlang
# "Your hook"
! "Your claim"
+ data | "context"
> "Your insight"
@ "Source" | https://url
```

That's all you need.
