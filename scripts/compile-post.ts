#!/usr/bin/env ts-node
/**
 * PostLang CLI Compiler
 *
 * Usage:
 *   npx ts-node scripts/compile-post.ts <input.post> [output.txt]
 *   npx ts-node scripts/compile-post.ts --stdin
 */

import * as fs from 'fs';
import { postlang } from '../src/postlang/compiler';
import { analyzer } from '../src/postlang/analyzer';

function printUsage(): void {
  console.log(`
PostLang Compiler - Write concise LinkedIn posts

Usage:
  npx ts-node scripts/compile-post.ts <input.post> [output.txt]
  npx ts-node scripts/compile-post.ts --stdin
  npx ts-node scripts/compile-post.ts --validate <input.post>
  npx ts-node scripts/compile-post.ts --analyze <linkedin-post.txt>

Options:
  --stdin       Read from stdin instead of file
  --validate    Check PostLang syntax only
  --analyze     Check if plain text follows PostLang rules
  --help, -h    Show this help

Example:
  npx ts-node scripts/compile-post.ts posts/my-post.post
  npx ts-node scripts/compile-post.ts posts/my-post.post output/post.txt
  npx ts-node scripts/compile-post.ts --validate posts/my-post.post
  npx ts-node scripts/compile-post.ts --analyze output/linkedin-post.txt
  cat posts/my-post.post | npx ts-node scripts/compile-post.ts --stdin
`);
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });
}

function validate(source: string): void {
  const result = postlang.compile(source);

  console.log('PostLang Validation Report');
  console.log('==========================\n');

  // Count elements
  const { ast } = (postlang as any).parse(source);
  console.log('Structure:');
  console.log(`  # Title:      ${ast.title ? '✓' : '✗'}`);
  console.log(`  ! Claim:      ${ast.claim ? '✓' : '✗'}`);
  console.log(`  + Evidence:   ${ast.evidence?.length || 0} items`);
  console.log(`  > Insight:    ${ast.insight ? '✓' : '✗'}`);
  console.log(`  ? Context:    ${ast.context ? '✓' : '—'}`);
  console.log(`  * Credential: ${ast.credential ? '✓' : '—'}`);
  console.log(`  @ Source:     ${ast.source ? '✓' : '✗'}`);
  console.log('');

  // Character counts
  if (ast.title || ast.claim || ast.insight) {
    console.log('Character Counts:');
    if (ast.title) console.log(`  # Title:    ${ast.title.length} chars`);
    if (ast.claim) console.log(`  ! Claim:    ${ast.claim.length} chars`);
    if (ast.insight) console.log(`  > Insight:  ${ast.insight.length} chars`);
    if (ast.context) console.log(`  ? Context:  ${ast.context.length} chars`);
    if (result.output)
      console.log(`  Total:      ${result.output.length} chars`);
    console.log('');
  }

  // Warnings
  if (result.warnings.length > 0) {
    console.log('Warnings:');
    result.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
    console.log('');
  }

  // Errors
  if (result.errors.length > 0) {
    console.log('Errors:');
    result.errors.forEach((e) => console.log(`  ✗ ${e}`));
    console.log('');
    console.log('Status: INVALID');
    process.exit(1);
  }

  console.log('Status: VALID');
}

function analyzePost(text: string): void {
  const result = analyzer.analyze(text);

  console.log('LinkedIn Post Analysis');
  console.log('======================\n');

  // Score
  const scoreEmoji = result.score >= 80 ? '✓' : result.score >= 60 ? '⚠' : '✗';
  console.log(`Score: ${result.score}/100 ${scoreEmoji}\n`);

  // Structure
  console.log('Structure:');
  console.log(`  Title:      ${result.structure.hasTitle ? '✓' : '✗'}`);
  console.log(`  Claim:      ${result.structure.hasClaim ? '✓' : '✗'}`);
  console.log(
    `  Evidence:   ${result.structure.evidenceCount} items ${result.structure.hasEvidence ? '✓' : '✗'}`,
  );
  console.log(`  Insight:    ${result.structure.hasInsight ? '✓' : '✗'}`);
  console.log(`  Source:     ${result.structure.hasSource ? '✓' : '✗'}`);
  console.log('');

  // Issues
  if (result.issues.length > 0) {
    console.log('Issues:');
    result.issues.forEach((i) => console.log(`  ✗ ${i}`));
    console.log('');
  }

  // Warnings
  if (result.warnings.length > 0) {
    console.log('Warnings:');
    result.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
    console.log('');
  }

  // Suggestions
  if (result.suggestions.length > 0) {
    console.log('Suggestions:');
    result.suggestions.forEach((s) => console.log(`  → ${s}`));
    console.log('');
  }

  // Final status
  if (result.valid) {
    console.log('Status: VALID PostLang structure');
  } else {
    console.log('Status: Does NOT follow PostLang rules');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const validateMode = args.includes('--validate');
  const analyzeMode = args.includes('--analyze');
  const stdinMode = args.includes('--stdin');

  let source: string;
  let outputFile: string | null = null;

  if (stdinMode) {
    source = await readStdin();
  } else {
    // Find the input file (skip flags)
    const inputFile = args.find((a) => !a.startsWith('--'));
    if (!inputFile) {
      console.error('Error: No input file specified');
      process.exit(1);
    }

    // Find output file (second non-flag argument)
    const nonFlagArgs = args.filter((a) => !a.startsWith('--'));
    outputFile = nonFlagArgs[1] || null;

    if (!fs.existsSync(inputFile)) {
      console.error(`Error: File not found: ${inputFile}`);
      process.exit(1);
    }

    source = fs.readFileSync(inputFile, 'utf-8');
  }

  // Validate mode
  if (validateMode) {
    validate(source);
    return;
  }

  // Analyze mode
  if (analyzeMode) {
    analyzePost(source);
    return;
  }

  // Compile mode
  const result = postlang.compile(source);

  // Output warnings
  if (result.warnings.length > 0) {
    console.error('Warnings:');
    result.warnings.forEach((w) => console.error(`  - ${w}`));
    console.error('');
  }

  // Handle errors
  if (!result.success) {
    console.error('Compilation failed:');
    result.errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  // Output result
  if (outputFile) {
    fs.writeFileSync(outputFile, result.output!);
    console.log(`Compiled to: ${outputFile}`);
  } else {
    console.log(result.output);
  }
}

main();
