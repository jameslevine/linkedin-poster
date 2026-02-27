#!/usr/bin/env ts-node
/**
 * CLI Script to fetch research papers based on skills from context/skills.json
 *
 * Usage:
 *   npx ts-node scripts/fetch-papers-by-skills.ts [options]
 *
 * Options:
 *   --limit, -l     Number of results per query (default: 5)
 *   --json          Output as JSON
 *   --output, -o    Output file path
 *   --help, -h      Show help
 */

import * as fs from 'fs';
import * as path from 'path';
import { aggregator, AggregatedPaper } from '../src/services/aggregator';

interface SkillsConfig {
  profile: {
    name: string;
    role: string;
    summary: string;
  };
  skills: {
    primary: string[];
    technical: string[];
    domains: string[];
  };
  interests: string[];
  searchQueries: string[];
}

// Parse command line arguments
function parseArgs(): {
  limit: number;
  jsonOutput: boolean;
  outputFile: string | null;
} {
  const args = process.argv.slice(2);
  const result = {
    limit: 5,
    jsonOutput: false,
    outputFile: null as string | null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--limit' || arg === '-l') {
      result.limit = parseInt(args[++i], 10) || result.limit;
      continue;
    }

    if (arg === '--json') {
      result.jsonOutput = true;
      continue;
    }

    if (arg === '--output' || arg === '-o') {
      result.outputFile = args[++i] || null;
      continue;
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
Research Paper Tracker - Skills-Based Search

Searches for papers based on skills defined in context/skills.json

Usage:
  npx ts-node scripts/fetch-papers-by-skills.ts [options]

Options:
  --limit, -l <number>    Number of results per query (default: 5)
  --json                  Output results as JSON
  --output, -o <file>     Save output to file
  --help, -h              Show this help message

Examples:
  # Search based on skills
  npx ts-node scripts/fetch-papers-by-skills.ts

  # Get more results per query
  npx ts-node scripts/fetch-papers-by-skills.ts -l 10

  # Save to file
  npx ts-node scripts/fetch-papers-by-skills.ts --json -o output/skills-papers.json
`);
}

function loadSkillsConfig(): SkillsConfig {
  const configPath = path.join(process.cwd(), 'context', 'skills.json');

  if (!fs.existsSync(configPath)) {
    console.error('Error: context/skills.json not found');
    console.error('Please create the file with your skills configuration.');
    process.exit(1);
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(content);
}

function formatPaper(paper: AggregatedPaper, index: number): string {
  const lines: string[] = [];

  lines.push(`\n${'─'.repeat(80)}`);
  lines.push(`#${index + 1} | Score: ${paper.score}/100`);
  lines.push(`${'─'.repeat(80)}`);
  lines.push(`📄 ${paper.title}`);
  lines.push(`   Source: ${paper.source}`);

  if (paper.authors.length > 0) {
    const authorNames = paper.authors
      .slice(0, 3)
      .map((a) => a.name)
      .join(', ');
    const moreAuthors =
      paper.authors.length > 3 ? ` (+${paper.authors.length - 3} more)` : '';
    lines.push(`   Authors: ${authorNames}${moreAuthors}`);
  }

  if (paper.publishedDate) {
    lines.push(`   Published: ${paper.publishedDate.split('T')[0]}`);
  }

  if (paper.topics && paper.topics.length > 0) {
    lines.push(`   Topics: ${paper.topics.slice(0, 5).join(', ')}`);
  }

  lines.push(`   🔗 ${paper.url}`);

  if (paper.abstract) {
    const truncatedAbstract =
      paper.abstract.length > 200
        ? paper.abstract.substring(0, 200) + '...'
        : paper.abstract;
    lines.push(`   Abstract: ${truncatedAbstract}`);
  }

  return lines.join('\n');
}

async function main(): Promise<void> {
  const args = parseArgs();
  const config = loadSkillsConfig();

  if (!args.jsonOutput) {
    console.log(`\n🔬 Research Paper Tracker - Skills-Based Search`);
    console.log(`${'═'.repeat(50)}`);
    console.log(`Profile: ${config.profile.name} (${config.profile.role})`);
    console.log(`${'═'.repeat(50)}\n`);
  }

  const allPapers: AggregatedPaper[] = [];
  const papersByQuery: Record<string, AggregatedPaper[]> = {};

  // Search using custom queries first
  const queries = [
    ...config.searchQueries,
    ...config.interests,
    ...config.skills.primary.slice(0, 3),
  ];

  // Remove duplicates
  const uniqueQueries = [...new Set(queries)];

  for (const query of uniqueQueries) {
    if (!args.jsonOutput) {
      console.log(`🔍 Searching: "${query}"...`);
    }

    try {
      const papers = await aggregator.getTrendingPapers({
        query,
        limit: args.limit,
        sources: ['arxiv'], // Use arXiv for reliability
      });

      papersByQuery[query] = papers;
      allPapers.push(...papers);

      if (!args.jsonOutput && papers.length > 0) {
        console.log(`   Found ${papers.length} papers\n`);
      }
    } catch (error) {
      if (!args.jsonOutput) {
        console.log(`   Error searching for "${query}"\n`);
      }
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Deduplicate papers by ID
  const seenIds = new Set<string>();
  const uniquePapers = allPapers.filter((paper) => {
    if (seenIds.has(paper.id)) {
      return false;
    }
    seenIds.add(paper.id);
    return true;
  });

  // Sort by score
  uniquePapers.sort((a, b) => b.score - a.score);

  const output = {
    generatedAt: new Date().toISOString(),
    profile: config.profile,
    queriesUsed: uniqueQueries,
    totalPapers: uniquePapers.length,
    papers: uniquePapers,
    papersByQuery,
  };

  if (args.jsonOutput) {
    const jsonOutput = JSON.stringify(output, null, 2);

    if (args.outputFile) {
      // Ensure output directory exists
      const outputDir = path.dirname(args.outputFile);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(args.outputFile, jsonOutput);
      console.error(`Saved to ${args.outputFile}`);
    } else {
      console.log(jsonOutput);
    }
    return;
  }

  // Display results
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`📊 RESULTS: Found ${uniquePapers.length} unique papers`);
  console.log(`${'═'.repeat(80)}`);

  uniquePapers.slice(0, 20).forEach((paper, index) => {
    console.log(formatPaper(paper, index));
  });

  console.log(`\n${'═'.repeat(80)}`);
  console.log(`Total unique papers: ${uniquePapers.length}`);
  console.log(`Queries searched: ${uniqueQueries.length}`);
  console.log(`${'═'.repeat(80)}\n`);
}

main();
