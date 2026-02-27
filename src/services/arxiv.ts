/**
 * arXiv API Integration
 * API Docs: https://info.arxiv.org/help/api/index.html
 *
 * Free to use, no API key required
 * Rate limit: Be respectful, ~1 request per 3 seconds recommended
 */

import axios from 'axios';
import { Paper, SearchOptions, PaperSearchResult } from '../types';

const BASE_URL = 'http://export.arxiv.org/api/query';

// arXiv category mappings for common fields
export const ARXIV_CATEGORIES = {
  'computer-science': 'cs.*',
  'machine-learning': 'cs.LG',
  'artificial-intelligence': 'cs.AI',
  'computer-vision': 'cs.CV',
  'natural-language-processing': 'cs.CL',
  robotics: 'cs.RO',
  physics: 'physics.*',
  mathematics: 'math.*',
  statistics: 'stat.*',
  'quantitative-biology': 'q-bio.*',
  'quantitative-finance': 'q-fin.*',
  economics: 'econ.*',
} as const;

interface ArxivEntry {
  id: string[];
  title: string[];
  summary: string[];
  author: Array<{ name: string[] }>;
  published: string[];
  updated: string[];
  link: Array<{ $: { href: string; type?: string; title?: string } }>;
  'arxiv:primary_category'?: Array<{ $: { term: string } }>;
  category?: Array<{ $: { term: string } }>;
}

interface ArxivResponse {
  feed: {
    entry?: ArxivEntry[];
    'opensearch:totalResults': string[];
    'opensearch:startIndex': string[];
    'opensearch:itemsPerPage': string[];
  };
}

export class ArxivService {
  /**
   * Search for papers on arXiv
   */
  async searchPapers(options: SearchOptions): Promise<PaperSearchResult> {
    const { query, limit = 20, offset = 0, sortBy = 'relevance' } = options;

    if (!query) {
      throw new Error('Query is required for search');
    }

    // Build arXiv query
    const searchQuery = this.buildQuery(query, options.topics);

    // Map sort options to arXiv sort parameters
    const sortByMap: Record<string, string> = {
      relevance: 'relevance',
      date: 'submittedDate',
      citations: 'relevance', // arXiv doesn't support citation sorting
    };

    const params = {
      search_query: searchQuery,
      start: offset,
      max_results: limit,
      sortBy: sortByMap[sortBy] || 'relevance',
      sortOrder: 'descending',
    };

    const response = await axios.get(BASE_URL, { params });

    // Parse XML response
    const parsed = await this.parseXmlResponse(response.data);

    const entries = parsed.feed.entry || [];
    const total = parseInt(parsed.feed['opensearch:totalResults'][0], 10);

    return {
      papers: entries.map((entry) => this.transformEntry(entry)),
      total,
      offset,
      hasMore: offset + entries.length < total,
    };
  }

  /**
   * Get recent papers from specific arXiv categories
   */
  async getRecentPapers(
    category: keyof typeof ARXIV_CATEGORIES,
    limit: number = 20,
  ): Promise<Paper[]> {
    const categoryCode =
      ARXIV_CATEGORIES[category] || ARXIV_CATEGORIES['machine-learning'];

    const params = {
      search_query: `cat:${categoryCode}`,
      start: 0,
      max_results: limit,
      sortBy: 'submittedDate',
      sortOrder: 'descending',
    };

    const response = await axios.get(BASE_URL, { params });
    const parsed = await this.parseXmlResponse(response.data);

    const entries = parsed.feed.entry || [];
    return entries.map((entry) => this.transformEntry(entry));
  }

  /**
   * Get paper by arXiv ID
   */
  async getPaper(arxivId: string): Promise<Paper | null> {
    // Clean the ID (remove version if present for search)
    const cleanId = arxivId.replace(/v\d+$/, '');

    const params = {
      id_list: cleanId,
    };

    const response = await axios.get(BASE_URL, { params });
    const parsed = await this.parseXmlResponse(response.data);

    const entries = parsed.feed.entry || [];
    if (entries.length === 0) {
      return null;
    }

    return this.transformEntry(entries[0]);
  }

  /**
   * Build arXiv search query
   */
  private buildQuery(query: string, topics?: string[]): string {
    let searchQuery = `all:${query}`;

    if (topics && topics.length > 0) {
      const categoryQueries = topics
        .map((topic) => {
          const category =
            ARXIV_CATEGORIES[topic as keyof typeof ARXIV_CATEGORIES];
          return category ? `cat:${category}` : null;
        })
        .filter(Boolean);

      if (categoryQueries.length > 0) {
        searchQuery = `(${searchQuery}) AND (${categoryQueries.join(' OR ')})`;
      }
    }

    return searchQuery;
  }

  /**
   * Parse XML response from arXiv API
   */
  private async parseXmlResponse(xmlData: string): Promise<ArxivResponse> {
    // Simple XML parsing using regex (avoiding heavy XML parser dependency)
    // For production, consider using a proper XML parser like fast-xml-parser

    const entries: ArxivEntry[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xmlData)) !== null) {
      const entryXml = match[1];
      entries.push(this.parseEntry(entryXml));
    }

    // Extract total results
    const totalMatch = xmlData.match(
      /<opensearch:totalResults[^>]*>(\d+)<\/opensearch:totalResults>/,
    );
    const total = totalMatch ? totalMatch[1] : '0';

    const startMatch = xmlData.match(
      /<opensearch:startIndex[^>]*>(\d+)<\/opensearch:startIndex>/,
    );
    const start = startMatch ? startMatch[1] : '0';

    return {
      feed: {
        entry: entries,
        'opensearch:totalResults': [total],
        'opensearch:startIndex': [start],
        'opensearch:itemsPerPage': [String(entries.length)],
      },
    };
  }

  /**
   * Parse a single entry from XML
   */
  private parseEntry(entryXml: string): ArxivEntry {
    const getValue = (tag: string): string[] => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g');
      const matches: string[] = [];
      let m;
      while ((m = regex.exec(entryXml)) !== null) {
        matches.push(m[1].trim());
      }
      return matches.length > 0 ? matches : [''];
    };

    const getAuthors = (): Array<{ name: string[] }> => {
      const authorRegex =
        /<author>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<\/author>/g;
      const authors: Array<{ name: string[] }> = [];
      let m;
      while ((m = authorRegex.exec(entryXml)) !== null) {
        authors.push({ name: [m[1].trim()] });
      }
      return authors;
    };

    const getLinks = (): Array<{
      $: { href: string; type?: string; title?: string };
    }> => {
      const linkRegex = /<link([^>]+)\/>/g;
      const links: Array<{
        $: { href: string; type?: string; title?: string };
      }> = [];
      let m;
      while ((m = linkRegex.exec(entryXml)) !== null) {
        const attrs = m[1];
        const hrefMatch = attrs.match(/href="([^"]+)"/);
        const typeMatch = attrs.match(/type="([^"]+)"/);
        const titleMatch = attrs.match(/title="([^"]+)"/);
        if (hrefMatch) {
          links.push({
            $: {
              href: hrefMatch[1],
              type: typeMatch?.[1],
              title: titleMatch?.[1],
            },
          });
        }
      }
      return links;
    };

    const getCategories = (): Array<{ $: { term: string } }> => {
      const catRegex = /<category[^>]*term="([^"]+)"[^>]*\/>/g;
      const categories: Array<{ $: { term: string } }> = [];
      let m;
      while ((m = catRegex.exec(entryXml)) !== null) {
        categories.push({ $: { term: m[1] } });
      }
      return categories;
    };

    return {
      id: getValue('id'),
      title: getValue('title').map((t) => t.replace(/\s+/g, ' ')),
      summary: getValue('summary').map((s) => s.replace(/\s+/g, ' ')),
      author: getAuthors(),
      published: getValue('published'),
      updated: getValue('updated'),
      link: getLinks(),
      category: getCategories(),
    };
  }

  /**
   * Transform arXiv entry to our Paper type
   */
  private transformEntry(entry: ArxivEntry): Paper {
    const id = entry.id[0].split('/abs/').pop() || entry.id[0];

    // Find PDF link
    const pdfLink = entry.link.find((l) => l.$.title === 'pdf');

    // Get categories/topics
    const topics = entry.category?.map((c) => c.$.term) || [];

    return {
      id: `arxiv:${id}`,
      title: entry.title[0],
      abstract: entry.summary[0],
      authors: entry.author.map((a) => ({ name: a.name[0] })),
      publishedDate: entry.published[0],
      source: 'arxiv',
      url: entry.id[0],
      pdfUrl: pdfLink?.$.href,
      topics,
    };
  }
}

// Export singleton instance
export const arxiv = new ArxivService();
