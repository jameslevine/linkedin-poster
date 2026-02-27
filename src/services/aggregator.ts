/**
 * Paper Aggregation Service
 * Combines results from multiple sources and provides unified ranking
 */

import { Paper, PaperSource, SearchOptions } from '../types';
import { semanticScholar } from './semantic-scholar';
import { arxiv, ARXIV_CATEGORIES } from './arxiv';
import { papersWithCode } from './papers-with-code';
import dayjs from 'dayjs';

export interface AggregatedPaper extends Paper {
  score: number;
  scoreBreakdown: {
    citationScore: number;
    recencyScore: number;
    codeScore: number;
    influenceScore: number;
  };
}

export interface TrendingPapersOptions {
  query?: string;
  sources?: PaperSource[];
  limit?: number;
  category?: string;
  minCitations?: number;
  requireCode?: boolean;
}

export class PaperAggregatorService {
  /**
   * Get trending papers from multiple sources
   */
  async getTrendingPapers(
    options: TrendingPapersOptions = {},
  ): Promise<AggregatedPaper[]> {
    const {
      query = 'machine learning',
      sources = ['semantic-scholar', 'arxiv', 'papers-with-code'],
      limit = 20,
      minCitations = 0,
      requireCode = false,
    } = options;

    const allPapers: Paper[] = [];

    // Fetch from each source in parallel
    const fetchPromises: Promise<Paper[]>[] = [];

    if (sources.includes('semantic-scholar')) {
      fetchPromises.push(
        semanticScholar
          .getTrendingPapers(query, { limit: limit * 2 })
          .catch((err) => {
            console.error('Semantic Scholar fetch failed:', err.message);
            return [];
          }),
      );
    }

    if (sources.includes('arxiv')) {
      fetchPromises.push(
        arxiv
          .searchPapers({ query, limit: limit * 2, sortBy: 'date' })
          .then((r) => r.papers)
          .catch((err) => {
            console.error('arXiv fetch failed:', err.message);
            return [];
          }),
      );
    }

    if (sources.includes('papers-with-code')) {
      fetchPromises.push(
        papersWithCode.getTrendingPapers(limit * 2).catch((err) => {
          console.error('Papers With Code fetch failed:', err.message);
          return [];
        }),
      );
    }

    const results = await Promise.all(fetchPromises);
    results.forEach((papers) => allPapers.push(...papers));

    // Deduplicate papers by title similarity
    const uniquePapers = this.deduplicatePapers(allPapers);

    // Filter papers
    let filteredPapers = uniquePapers;

    if (minCitations > 0) {
      filteredPapers = filteredPapers.filter(
        (p) => (p.citationCount || 0) >= minCitations,
      );
    }

    if (requireCode) {
      filteredPapers = filteredPapers.filter((p) => p.codeAvailable);
    }

    // Score and rank papers
    const scoredPapers = filteredPapers.map((p) => this.scorePaper(p));

    // Sort by score and return top results
    return scoredPapers.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Search papers across all sources
   */
  async searchPapers(options: SearchOptions): Promise<AggregatedPaper[]> {
    const { query, limit = 20 } = options;

    if (!query) {
      throw new Error('Query is required');
    }

    const allPapers: Paper[] = [];

    // Fetch from all sources in parallel
    const [semanticResults, arxivResults, pwcResults] = await Promise.all([
      semanticScholar
        .searchPapers({ ...options, limit: limit * 2 })
        .then((r) => r.papers)
        .catch(() => []),
      arxiv
        .searchPapers({ ...options, limit: limit * 2 })
        .then((r) => r.papers)
        .catch(() => []),
      papersWithCode
        .searchPapers(query, { limit: limit * 2 })
        .then((r) => r.papers)
        .catch(() => []),
    ]);

    allPapers.push(...semanticResults, ...arxivResults, ...pwcResults);

    // Deduplicate and score
    const uniquePapers = this.deduplicatePapers(allPapers);
    const scoredPapers = uniquePapers.map((p) => this.scorePaper(p));

    return scoredPapers.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Get recent papers from arXiv in a specific category
   */
  async getRecentPapers(
    category: keyof typeof ARXIV_CATEGORIES,
    limit: number = 20,
  ): Promise<AggregatedPaper[]> {
    const papers = await arxiv.getRecentPapers(category, limit * 2);
    const scoredPapers = papers.map((p) => this.scorePaper(p));
    return scoredPapers.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Score a paper based on multiple factors
   */
  private scorePaper(paper: Paper): AggregatedPaper {
    const citationScore = this.calculateCitationScore(paper);
    const recencyScore = this.calculateRecencyScore(paper);
    const codeScore = paper.codeAvailable ? 20 : 0;
    const influenceScore = this.calculateInfluenceScore(paper);

    const score = citationScore + recencyScore + codeScore + influenceScore;

    return {
      ...paper,
      score,
      scoreBreakdown: {
        citationScore,
        recencyScore,
        codeScore,
        influenceScore,
      },
    };
  }

  /**
   * Calculate citation score (0-30 points)
   */
  private calculateCitationScore(paper: Paper): number {
    const citations = paper.citationCount || 0;

    if (citations >= 1000) return 30;
    if (citations >= 500) return 25;
    if (citations >= 100) return 20;
    if (citations >= 50) return 15;
    if (citations >= 10) return 10;
    if (citations >= 1) return 5;
    return 0;
  }

  /**
   * Calculate recency score (0-30 points)
   * More recent papers get higher scores
   */
  private calculateRecencyScore(paper: Paper): number {
    if (!paper.publishedDate) return 10; // Default score if no date

    const publishedDate = dayjs(paper.publishedDate);
    const now = dayjs();
    const monthsAgo = now.diff(publishedDate, 'month');

    if (monthsAgo <= 1) return 30;
    if (monthsAgo <= 3) return 25;
    if (monthsAgo <= 6) return 20;
    if (monthsAgo <= 12) return 15;
    if (monthsAgo <= 24) return 10;
    return 5;
  }

  /**
   * Calculate influence score based on influential citations (0-20 points)
   */
  private calculateInfluenceScore(paper: Paper): number {
    const influential = paper.influentialCitationCount || 0;

    if (influential >= 50) return 20;
    if (influential >= 20) return 15;
    if (influential >= 10) return 10;
    if (influential >= 5) return 5;
    return 0;
  }

  /**
   * Deduplicate papers by title similarity
   */
  private deduplicatePapers(papers: Paper[]): Paper[] {
    const seen = new Map<string, Paper>();

    for (const paper of papers) {
      const normalizedTitle = this.normalizeTitle(paper.title);

      if (!seen.has(normalizedTitle)) {
        seen.set(normalizedTitle, paper);
      } else {
        // Keep the paper with more metadata
        const existing = seen.get(normalizedTitle)!;
        if (this.hasMoreMetadata(paper, existing)) {
          seen.set(normalizedTitle, paper);
        }
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Normalize title for comparison
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Check if paper A has more metadata than paper B
   */
  private hasMoreMetadata(a: Paper, b: Paper): boolean {
    let scoreA = 0;
    let scoreB = 0;

    if (a.abstract) scoreA += 1;
    if (b.abstract) scoreB += 1;
    if (a.citationCount) scoreA += 1;
    if (b.citationCount) scoreB += 1;
    if (a.codeAvailable) scoreA += 1;
    if (b.codeAvailable) scoreB += 1;
    if (a.pdfUrl) scoreA += 1;
    if (b.pdfUrl) scoreB += 1;

    return scoreA > scoreB;
  }
}

// Export singleton instance
export const aggregator = new PaperAggregatorService();
