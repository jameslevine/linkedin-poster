/**
 * Papers With Code API Integration
 * API Docs: https://paperswithcode.com/api/v1/docs/
 *
 * Free to use, no API key required
 */

import axios, { AxiosInstance } from 'axios';
import { Paper, PaperSearchResult } from '../types';

const BASE_URL = 'https://paperswithcode.com/api/v1';

interface PwcPaper {
  id: string;
  arxiv_id?: string;
  url_abs?: string;
  url_pdf?: string;
  title: string;
  abstract?: string;
  authors: string[];
  published: string;
  proceeding?: string;
  repository_url?: string;
}

interface PwcSearchResponse {
  count: number;
  next?: string;
  previous?: string;
  results: PwcPaper[];
}

export class PapersWithCodeService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
    });
  }

  /**
   * Search for papers
   */
  async searchPapers(
    query: string,
    options: { limit?: number; page?: number } = {},
  ): Promise<PaperSearchResult> {
    const { limit = 20, page = 1 } = options;

    const response = await this.client.get<PwcSearchResponse>('/papers/', {
      params: {
        q: query,
        items_per_page: limit,
        page,
      },
    });

    return {
      papers: response.data.results.map((p) => this.transformPaper(p)),
      total: response.data.count,
      offset: (page - 1) * limit,
      hasMore: !!response.data.next,
    };
  }

  /**
   * Get trending papers (papers with most GitHub stars recently)
   * This scrapes the trending page since there's no direct API endpoint
   */
  async getTrendingPapers(limit: number = 20): Promise<Paper[]> {
    // Use the papers endpoint sorted by GitHub stars
    // Note: PWC doesn't have a direct "trending" API, so we fetch recent papers with repos
    const response = await this.client.get<PwcSearchResponse>('/papers/', {
      params: {
        items_per_page: limit * 2, // Fetch more to filter those with repos
        ordering: '-published', // Use published date as fallback since github_stars may not work
      },
    });

    const results = response.data?.results || [];
    return results
      .filter((p) => p.repository_url) // Only papers with code
      .slice(0, limit)
      .map((p) => this.transformPaper(p, true));
  }

  /**
   * Get papers by area/task
   */
  async getPapersByArea(
    area: string,
    options: { limit?: number; page?: number } = {},
  ): Promise<PaperSearchResult> {
    const { limit = 20, page = 1 } = options;

    const response = await this.client.get<PwcSearchResponse>(
      `/papers/area/${encodeURIComponent(area)}/`,
      {
        params: {
          items_per_page: limit,
          page,
        },
      },
    );

    return {
      papers: response.data.results.map((p) => this.transformPaper(p)),
      total: response.data.count,
      offset: (page - 1) * limit,
      hasMore: !!response.data.next,
    };
  }

  /**
   * Get paper details by ID
   */
  async getPaper(paperId: string): Promise<Paper | null> {
    try {
      const response = await this.client.get<PwcPaper>(`/papers/${paperId}/`);
      return this.transformPaper(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get papers with code implementations
   */
  async getPapersWithCode(
    options: { limit?: number; page?: number } = {},
  ): Promise<PaperSearchResult> {
    const { limit = 20, page = 1 } = options;

    const response = await this.client.get<PwcSearchResponse>('/papers/', {
      params: {
        items_per_page: limit,
        page,
        has_code: true,
      },
    });

    return {
      papers: response.data.results.map((p) => this.transformPaper(p, true)),
      total: response.data.count,
      offset: (page - 1) * limit,
      hasMore: !!response.data.next,
    };
  }

  /**
   * Get latest papers (most recently published)
   */
  async getLatestPapers(limit: number = 20): Promise<Paper[]> {
    const response = await this.client.get<PwcSearchResponse>('/papers/', {
      params: {
        items_per_page: limit,
        ordering: '-published',
      },
    });

    return response.data.results.map((p) => this.transformPaper(p));
  }

  /**
   * Transform PWC paper to our Paper type
   */
  private transformPaper(paper: PwcPaper, hasCode: boolean = false): Paper {
    return {
      id: paper.arxiv_id ? `arxiv:${paper.arxiv_id}` : `pwc:${paper.id}`,
      title: paper.title,
      abstract: paper.abstract,
      authors: paper.authors.map((name) => ({ name })),
      publishedDate: paper.published,
      source: 'papers-with-code',
      url: paper.url_abs || `https://paperswithcode.com/paper/${paper.id}`,
      pdfUrl: paper.url_pdf,
      venue: paper.proceeding,
      codeAvailable: hasCode || !!paper.repository_url,
      codeUrl: paper.repository_url,
    };
  }
}

// Export singleton instance
export const papersWithCode = new PapersWithCodeService();
