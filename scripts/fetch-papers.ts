#!/usr/bin/env ts-node
/**
 * CLI Script to fetch trending research papers
 *
 * Usage:
 *   npx ts-node scripts/fetch-papers.ts [command] [options]
 *
 * Commands:
 *   trending    - Get trending papers (default)
 *   search      - Search for papers by query
 *   recent      - Get recent papers from arXiv
 *
 * Options:
 *   --query, -q     Search query (default: "machine learning")
 *   --limit, -l     Number of results (default: 10)
 *   --source, -s    Source: semantic-scholar, arxiv, papers-with-code, all (default: all)
 *   --category, -c  arXiv category for recent papers
 *   --code          Only show papers with code
 *   --json          Output as JSON
 *   --help, -h      Show help
 */

import { aggregator, AggregatedPaper } from '../src/services/aggregator';
import { ARXIV_CATEGORIES } from '../src/services/arxiv';
import { PaperSource } from '../src/types';

// Parse command line arguments
function parseArgs(): {
  command: string;
  query: string;
  limit: number;
  sources: PaperSource[];
  category: string;
  requireCode: boolean;
  jsonOutput: boolean;
} {
  const args = process.argv.slice(2);
  const result = {
    command: 'trending',
    query: 'machine learning',
    limit: 10,
    sources: ['semantic-scholar', 'arxiv', 'papers-with-code'] as PaperSource[],
    category: 'machine-learning',
    requireCode: false,
    jsonOutput: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === 'trending' || arg === 'search' || arg === 'recent') {
      result.command = arg;
      continue;
    }

    if (arg === '--query' || arg === '-q') {
      result.query = args[++i] || result.query;
      continue;
    }

    if (arg === '--limit' || arg === '-l') {
      result.limit = parseInt(args[++i], 10) || result.limit;
      continue;
    }

    if (arg === '--source' || arg === '-s') {
      const source = args[++i];
      if (source === 'all') {
        result.sources = ['semantic-scholar', 'arxiv', 'papers-with-code'];
      } else if (
        ['semantic-scholar', 'arxiv', 'papers-with-code'].includes(source)
      ) {
        result.sources = [source as PaperSource];
      }
      continue;
    }

    if (arg === '--category' || arg === '-c') {
      result.category = args[++i] || result.category;
      continue;
    }

    if (arg === '--code') {
      result.requireCode = true;
      continue;
    }

    if (arg === '--json') {
      result.jsonOutput = true;
      continue;
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
Research Paper Tracker - CLI

Usage:
  npx ts-node scripts/fetch-papers.ts [command] [options]

Commands:
  trending    Get trending papers from multiple sources (default)
  search      Search for papers by query
  recent      Get recent papers from arXiv by category

Options:
  --query, -q <query>       Search query (default: "machine learning")
  --limit, -l <number>      Number of results (default: 10)
  --source, -s <source>     Source: semantic-scholar, arxiv, papers-with-code, all
  --category, -c <category> arXiv category for 'recent' command
  --code                    Only show papers with code implementations
  --json                    Output results as JSON
  --help, -h                Show this help message

Available Categories (for --category):
  ${Object.keys(ARXIV_CATEGORIES).join(', ')}

Examples:
  # Get trending ML papers
  npx ts-node scripts/fetch-papers.ts trending

  # Search for transformer papers
  npx ts-node scripts/fetch-papers.ts search -q "transformer architecture" -l 20

  # Get recent AI papers from arXiv
  npx ts-node scripts/fetch-papers.ts recent -c artificial-intelligence

  # Get papers with code only
  npx ts-node scripts/fetch-papers.ts trending --code

  # Output as JSON for further processing
  npx ts-node scripts/fetch-papers.ts trending --json > papers.json
`);
}

function formatPaper(paper: AggregatedPaper, index: number): string {
  const lines: string[] = [];

  lines.push(`\n${'='.repeat(80)}`);
  lines.push(`#${index + 1} | Score: ${paper.score}/100`);
  lines.push(`${'='.repeat(80)}`);
  lines.push(`📄 ${paper.title}`);
  lines.push(`   Source: ${paper.source}`);

  if (paper.authors.length > 0) {
    const authorNames = paper.authors
      .slice(0, 5)
      .map((a) => a.name)
      .join(', ');
    const moreAuthors =
      paper.authors.length > 5 ? ` (+${paper.authors.length - 5} more)` : '';
    lines.push(`   Authors: ${authorNames}${moreAuthors}`);
  }

  if (paper.publishedDate) {
    lines.push(`   Published: ${paper.publishedDate}`);
  }

  if (paper.citationCount !== undefined) {
    lines.push(`   Citations: ${paper.citationCount}`);
  }

  if (
    paper.influentialCitationCount !== undefined &&
    paper.influentialCitationCount > 0
  ) {
    lines.push(`   Influential Citations: ${paper.influentialCitationCount}`);
  }

  if (paper.codeAvailable) {
    lines.push(`   💻 Code Available: ${paper.codeUrl || 'Yes'}`);
  }

  if (paper.topics && paper.topics.length > 0) {
    lines.push(`   Topics: ${paper.topics.slice(0, 5).join(', ')}`);
  }

  lines.push(`   🔗 ${paper.url}`);

  if (paper.pdfUrl) {
    lines.push(`   📥 PDF: ${paper.pdfUrl}`);
  }

  // Score breakdown
  lines.push(`   Score Breakdown:`);
  lines.push(`     - Citations: ${paper.scoreBreakdown.citationScore}/30`);
  lines.push(`     - Recency: ${paper.scoreBreakdown.recencyScore}/30`);
  lines.push(`     - Code: ${paper.scoreBreakdown.codeScore}/20`);
  lines.push(`     - Influence: ${paper.scoreBreakdown.influenceScore}/20`);

  if (paper.abstract) {
    const truncatedAbstract =
      paper.abstract.length > 300
        ? paper.abstract.substring(0, 300) + '...'
        : paper.abstract;
    lines.push(`\n   Abstract: ${truncatedAbstract}`);
  }

  return lines.join('\n');
}

async function main(): Promise<void> {
  const args = parseArgs();

  // Only show header if not JSON output
  if (!args.jsonOutput) {
    console.log(`\n🔬 Research Paper Tracker`);
    console.log(`${'─'.repeat(40)}`);
  }

  try {
    let papers: AggregatedPaper[] = [];

    switch (args.command) {
      case 'trending':
        if (!args.jsonOutput) {
          console.log(`Fetching trending papers...`);
          console.log(`Query: "${args.query}"`);
          console.log(`Sources: ${args.sources.join(', ')}`);
          if (args.requireCode) console.log(`Filter: Papers with code only`);
          console.log('');
        }

        papers = await aggregator.getTrendingPapers({
          query: args.query,
          sources: args.sources,
          limit: args.limit,
          requireCode: args.requireCode,
        });
        break;

      case 'search':
        if (!args.jsonOutput) {
          console.log(`Searching for papers...`);
          console.log(`Query: "${args.query}"`);
          console.log('');
        }

        papers = await aggregator.searchPapers({
          query: args.query,
          limit: args.limit,
        });
        break;

      case 'recent':
        if (!args.jsonOutput) {
          console.log(`Fetching recent papers from arXiv...`);
          console.log(`Category: ${args.category}`);
          console.log('');
        }

        papers = await aggregator.getRecentPapers(
          args.category as keyof typeof ARXIV_CATEGORIES,
          args.limit,
        );
        break;
    }

    if (args.jsonOutput) {
      console.log(JSON.stringify(papers, null, 2));
      return;
    }

    if (papers.length === 0) {
      console.log('No papers found.');
      return;
    }

    console.log(`Found ${papers.length} papers:\n`);

    papers.forEach((paper, index) => {
      console.log(formatPaper(paper, index));
    });

    console.log(`\n${'='.repeat(80)}`);
    console.log(`Total: ${papers.length} papers`);
    console.log(`${'='.repeat(80)}\n`);
  } catch (error) {
    console.error('Error fetching papers:', error);
    process.exit(1);
  }
}

main();
