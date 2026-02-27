/**
 * Research Paper Tracker
 *
 * A tool to discover and track trending research papers
 * from multiple sources for content creation.
 */

// Types
export * from './types';

// Services
export {
  SemanticScholarService,
  semanticScholar,
} from './services/semantic-scholar';
export { ArxivService, arxiv, ARXIV_CATEGORIES } from './services/arxiv';
export {
  PapersWithCodeService,
  papersWithCode,
} from './services/papers-with-code';
export {
  PaperAggregatorService,
  aggregator,
  AggregatedPaper,
  TrendingPapersOptions,
} from './services/aggregator';
