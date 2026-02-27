/**
 * Semantic Scholar API Integration
 * API Docs: https://api.semanticscholar.org/api-docs/
 *
 * Free tier: 100 requests per 5 minutes
 */

import axios, { AxiosInstance } from 'axios';
import { Paper, SearchOptions, PaperSearchResult } from '../types';

const BASE_URL = 'https://api.semanticscholar.org/graph/v1';

// Fields to request from the API
const PAPER_FIELDS = [
  'paperId',
  'title',
  'abstract',
  'authors',
  'year',
  'publicationDate',
  'venue',
  'citationCount',
  'influentialCitationCount',
  'isOpenAccess',
  'openAccessPdf',
  'fieldsOfStudy',
  'url',
].join(',');

interface SemanticScholarPaper {
  paperId: string;
  title: string;
  abstract?: string;
  authors: Array<{ authorId: string; name: string }>;
  year?: number;
  publicationDate?: string;
  venue?: string;
  citationCount?: number;
  influentialCitationCount?: number;
  isOpenAccess?: boolean;
  openAccessPdf?: { url: string };
  fieldsOfStudy?: string[];
  url?: string;
}

interface SearchResponse {
  total: number;
  offset: number;
  data: SemanticScholarPaper[];
}

interface RecommendationsResponse {
  recommendedPapers: SemanticScholarPaper[];
}

export class SemanticScholarService {
  private client: AxiosInstance;

  constructor(apiKey?: string) {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        ...(apiKey && { 'x-api-key': apiKey }),
      },
    });
  }

  /**
   * Search for papers by query
   */
  async searchPapers(options: SearchOptions): Promise<PaperSearchResult> {
    const { query, limit = 20, offset = 0, fieldsOfStudy } = options;

    if (!query) {
      throw new Error('Query is required for search');
    }

    const params: Record<string, string | number> = {
      query,
      limit,
      offset,
      fields: PAPER_FIELDS,
    };

    if (fieldsOfStudy && fieldsOfStudy.length > 0) {
      params.fieldsOfStudy = fieldsOfStudy.join(',');
    }

    const response = await this.client.get<SearchResponse>('/paper/search', {
      params,
    });

    return {
      papers: response.data.data.map((p) => this.transformPaper(p)),
      total: response.data.total,
      offset: response.data.offset,
      hasMore:
        response.data.offset + response.data.data.length < response.data.total,
    };
  }

  /**
   * Get paper details by ID (Semantic Scholar ID, DOI, arXiv ID, etc.)
   */
  async getPaper(paperId: string): Promise<Paper> {
    const response = await this.client.get<SemanticScholarPaper>(
      `/paper/${paperId}`,
      {
        params: { fields: PAPER_FIELDS },
      },
    );

    return this.transformPaper(response.data);
  }

  /**
   * Get recommended papers based on a paper ID
   */
  async getRecommendations(
    paperId: string,
    limit: number = 10,
  ): Promise<Paper[]> {
    const response = await this.client.get<RecommendationsResponse>(
      `/recommendations/v1/papers/forpaper/${paperId}`,
      {
        params: { fields: PAPER_FIELDS, limit },
      },
    );

    return response.data.recommendedPapers.map((p) => this.transformPaper(p));
  }

  /**
   * Search for highly cited papers in a field (useful for finding influential papers)
   */
  async getHighlyCitedPapers(
    query: string,
    minCitations: number = 100,
    limit: number = 20,
  ): Promise<Paper[]> {
    const result = await this.searchPapers({
      query,
      limit: limit * 3, // Fetch more to filter
    });

    return result.papers
      .filter((p) => (p.citationCount || 0) >= minCitations)
      .sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0))
      .slice(0, limit);
  }

  /**
   * Get recent papers with high influential citations (trending indicator)
   */
  async getTrendingPapers(
    query: string,
    options: { limit?: number; minInfluentialCitations?: number } = {},
  ): Promise<Paper[]> {
    const { limit = 20, minInfluentialCitations = 5 } = options;

    const result = await this.searchPapers({
      query,
      limit: limit * 3,
    });

    // Sort by influential citation count (better indicator of impact than raw citations)
    return result.papers
      .filter(
        (p) => (p.influentialCitationCount || 0) >= minInfluentialCitations,
      )
      .sort(
        (a, b) =>
          (b.influentialCitationCount || 0) - (a.influentialCitationCount || 0),
      )
      .slice(0, limit);
  }

  /**
   * Transform Semantic Scholar paper to our Paper type
   */
  private transformPaper(paper: SemanticScholarPaper): Paper {
    return {
      id: paper.paperId,
      title: paper.title,
      abstract: paper.abstract,
      authors: paper.authors.map((a) => ({
        name: a.name,
        authorId: a.authorId,
      })),
      publishedDate: paper.publicationDate,
      source: 'semantic-scholar',
      url:
        paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
      pdfUrl: paper.openAccessPdf?.url,
      citationCount: paper.citationCount,
      influentialCitationCount: paper.influentialCitationCount,
      venue: paper.venue,
      topics: paper.fieldsOfStudy,
    };
  }
}

// Export singleton instance for convenience
export const semanticScholar = new SemanticScholarService();
