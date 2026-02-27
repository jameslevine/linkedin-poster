# Research Paper Tracker

A tool to discover and track trending research papers for content creation (e.g., LinkedIn posts, blog articles, newsletters).

## Features

- ✅ Aggregate trending papers from multiple sources (Semantic Scholar, arXiv, Papers With Code)
- ✅ Track citation counts and influential citations
- ✅ Filter by topic/domain (AI/ML, Computer Science, etc.)
- ✅ Score and rank papers based on citations, recency, code availability, and influence
- ✅ CLI script for manual execution
- ✅ JSON output for further processing

## Quick Start

```bash
# Install dependencies
npm install

# Get trending ML papers
npm run papers

# Search for specific topics
npm run papers:search -- -q "transformer architecture"

# Get recent AI papers from arXiv
npm run papers:recent -- -c artificial-intelligence
```

## CLI Usage

```bash
# Basic usage
npx ts-node scripts/fetch-papers.ts [command] [options]

# Commands
trending    # Get trending papers from multiple sources (default)
search      # Search for papers by query
recent      # Get recent papers from arXiv by category

# Options
--query, -q <query>       # Search query (default: "machine learning")
--limit, -l <number>      # Number of results (default: 10)
--source, -s <source>     # Source: semantic-scholar, arxiv, papers-with-code, all
--category, -c <category> # arXiv category for 'recent' command
--code                    # Only show papers with code implementations
--json                    # Output results as JSON
--help, -h                # Show help message
```

## Examples

```bash
# Get top 10 trending ML papers
npm run papers

# Search for transformer papers with 20 results
npm run papers:search -- -q "transformer architecture" -l 20

# Get recent AI papers from arXiv
npm run papers:recent -- -c artificial-intelligence

# Get papers with code only
npm run papers -- --code

# Output as JSON for further processing
npm run papers -- --json > papers.json

# Search from a specific source
npm run papers -- -s semantic-scholar -q "large language models"
```

## Available Categories

For the `recent` command, you can use these arXiv categories:

- `computer-science` - All CS papers
- `machine-learning` - Machine Learning (cs.LG)
- `artificial-intelligence` - AI (cs.AI)
- `computer-vision` - Computer Vision (cs.CV)
- `natural-language-processing` - NLP (cs.CL)
- `robotics` - Robotics (cs.RO)
- `physics` - Physics
- `mathematics` - Mathematics
- `statistics` - Statistics

## Paper Scoring

Papers are scored on a 100-point scale based on:

| Factor    | Max Points | Description                |
| --------- | ---------- | -------------------------- |
| Citations | 30         | Raw citation count         |
| Recency   | 30         | How recently published     |
| Code      | 20         | Has code implementation    |
| Influence | 20         | Influential citation count |

## Data Sources

### Primary Sources

- **[Semantic Scholar](https://www.semanticscholar.org/)** - AI-powered research discovery with citation metrics
- **[arXiv](https://arxiv.org/)** - Preprint server for scientific papers
- **[Papers With Code](https://paperswithcode.com/)** - ML papers with code implementations

### Validity Metrics

- Citation count and velocity
- Influential citations (citations from important papers)
- Peer review status
- Code availability/reproducibility
- Author credentials

## Project Structure

```
src/
├── types/
│   └── index.ts          # TypeScript type definitions
├── services/
│   ├── semantic-scholar.ts  # Semantic Scholar API
│   ├── arxiv.ts             # arXiv API
│   ├── papers-with-code.ts  # Papers With Code API
│   └── aggregator.ts        # Paper aggregation & scoring
└── index.ts              # Main exports

scripts/
└── fetch-papers.ts       # CLI script
```

## Programmatic Usage

```typescript
import { aggregator, semanticScholar, arxiv } from './src';

// Get trending papers
const trending = await aggregator.getTrendingPapers({
  query: 'large language models',
  limit: 10,
  requireCode: true,
});

// Search across all sources
const results = await aggregator.searchPapers({
  query: 'transformer attention mechanism',
  limit: 20,
});

// Get recent arXiv papers
const recent = await aggregator.getRecentPapers('machine-learning', 10);

// Use individual services
const paper = await semanticScholar.getPaper('arxiv:2301.00001');
const arxivPapers = await arxiv.getRecentPapers('artificial-intelligence', 20);
```

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run linting
npm run lint

# Format code
npm run format

# Run tests
npm test
```

## License

MIT
