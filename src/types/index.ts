/**
 * Research Paper Types
 */

export interface Paper {
  id: string;
  title: string;
  abstract?: string;
  authors: Author[];
  publishedDate?: string;
  source: PaperSource;
  url: string;
  pdfUrl?: string;
  citationCount?: number;
  influentialCitationCount?: number;
  venue?: string;
  topics?: string[];
  codeAvailable?: boolean;
  codeUrl?: string;
  metrics?: PaperMetrics;
}

export interface Author {
  name: string;
  authorId?: string;
  affiliations?: string[];
  hIndex?: number;
}

export interface PaperMetrics {
  citationVelocity?: number; // Citations per month/year
  altmetricScore?: number;
  downloadCount?: number;
  viewCount?: number;
  trendingScore?: number;
}

export type PaperSource =
  | 'semantic-scholar'
  | 'arxiv'
  | 'papers-with-code'
  | 'huggingface';

export interface SearchOptions {
  query?: string;
  topics?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'citations' | 'date' | 'trending';
  dateFrom?: string;
  dateTo?: string;
  fieldsOfStudy?: string[];
}

export interface TrendingOptions {
  source: PaperSource;
  limit?: number;
  category?: string;
  timeRange?: 'day' | 'week' | 'month';
}

export interface PaperSearchResult {
  papers: Paper[];
  total: number;
  offset: number;
  hasMore: boolean;
}
