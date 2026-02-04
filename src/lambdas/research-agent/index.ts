/**
 * Research Agent Lambda
 * Fetches RSS feeds and analyzes content for relevant topics
 */

import { Handler } from 'aws-lambda';
import Parser from 'rss-parser';
import {
  getBrandProfile,
  getRSSFeeds,
  getRecentPosts,
} from '../../utils/dynamodb';
import { generateWithRetry, parseJsonFromResponse } from '../../utils/bedrock';
import {
  ResearchResult,
  ResearchSource,
  BrandProfile,
  RSSFeed,
} from '../../types';

const parser = new Parser();

interface FeedItem {
  title?: string;
  link?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  creator?: string;
}

interface AnalysisResult {
  selectedTopic: string;
  relevanceScore: number;
  brandPillarMatch: string;
  suggestedAngle: string;
  keyPoints: string[];
  selectedSources: number[];
}

async function fetchRSSFeeds(feeds: RSSFeed[]): Promise<ResearchSource[]> {
  const sources: ResearchSource[] = [];
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  for (const feed of feeds) {
    try {
      console.log(`Fetching feed: ${feed.name}`);
      const feedContent = await parser.parseURL(feed.url);

      for (const item of feedContent.items.slice(0, 5)) {
        const feedItem = item as FeedItem;
        const pubDate = feedItem.pubDate
          ? new Date(feedItem.pubDate).getTime()
          : Date.now();

        // Only include recent items (last 24 hours)
        if (pubDate >= oneDayAgo) {
          sources.push({
            title: feedItem.title || 'Untitled',
            url: feedItem.link || '',
            source: feed.name,
            publishedAt: feedItem.pubDate || new Date().toISOString(),
            summary: (feedItem.contentSnippet || feedItem.content || '').slice(
              0,
              500,
            ),
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching feed ${feed.name}:`, error);
      // Continue with other feeds
    }
  }

  return sources;
}

function buildResearchPrompt(
  sources: ResearchSource[],
  brandProfile: BrandProfile,
  recentTopics: string[],
): string {
  return `You are a senior technical research analyst identifying deeply technical topics for LinkedIn posts.

## CRITICAL REQUIREMENTS
1. **PRIORITIZE TECHNICAL DEPTH** - Select topics that allow for deep technical exploration
2. **CODE-FRIENDLY TOPICS** - Choose topics where code examples, CLI commands, or configurations can be included
3. **IMPLEMENTATION FOCUS** - Prefer topics about "how things work" over announcements or news
4. **ENGINEERING AUDIENCE** - Content must be valuable for senior software engineers

## Brand Profile
Name: ${brandProfile.name}
Title: ${brandProfile.title}
Brand Pillars: ${brandProfile.brandPillars.join(', ')}
Content Themes: ${brandProfile.contentThemes.join(', ')}
Target Audience: ${brandProfile.targetAudience.join(', ')}

## Recent Topics (avoid these to prevent repetition)
${recentTopics.length > 0 ? recentTopics.join('\n') : 'None'}

## Available Sources
${sources
  .map(
    (s, i) => `[${i}] ${s.source}: "${s.title}"
   Summary: ${s.summary}
   URL: ${s.url}`,
  )
  .join('\n\n')}

## Topic Selection Criteria (in order of priority)
1. **Technical Implementation** - Topics about how to build, configure, or implement something
2. **Architecture & Design** - System design, patterns, best practices
3. **Performance & Optimization** - Benchmarks, tuning, efficiency improvements
4. **Security & Reliability** - Security practices, fault tolerance, resilience
5. **New Technologies** - Only if they can be explained with working code examples

## Task
Analyze the available sources and select the BEST topic for a deeply technical LinkedIn post that:
1. Allows for inclusion of working code snippets or commands
2. Explains technical concepts that engineers can apply immediately
3. Aligns with the brand pillars and demonstrates expertise
4. Has not been covered recently
5. Would teach something valuable to senior engineers

Respond with a JSON object:
{
  "selectedTopic": "The main technical topic for the post",
  "relevanceScore": 0.0-1.0 (how relevant and technical this is),
  "brandPillarMatch": "Which brand pillar this aligns with",
  "suggestedAngle": "The specific technical angle - focus on implementation details",
  "keyPoints": ["Technical point 1 with specific detail", "Technical point 2", "Technical point 3"],
  "selectedSources": [0, 2] // indices of the most technically relevant sources
}`;
}

const SYSTEM_PROMPT = `You are a senior technical research analyst who identifies deeply technical topics for software engineering thought leadership. You prioritize topics that allow for code examples, implementation details, and practical technical insights. You understand that the best LinkedIn posts for engineers include working code that readers can actually use. Always respond with valid JSON.`;

export const handler: Handler = async (event) => {
  console.log('Research Agent starting...', JSON.stringify(event));

  try {
    // Get brand profile and RSS feeds from config
    const brandProfile = await getBrandProfile();
    const rssConfig = await getRSSFeeds();

    if (!brandProfile) {
      throw new Error(
        'Brand profile not configured. Please set up brand profile in DynamoDB.',
      );
    }

    if (!rssConfig || rssConfig.feeds.length === 0) {
      throw new Error(
        'RSS feeds not configured. Please set up RSS feeds in DynamoDB.',
      );
    }

    // Get recent posts to avoid topic repetition
    const recentPosts = await getRecentPosts(10);
    const recentTopics = recentPosts.map((p) => p.topic);

    // Fetch RSS feeds
    console.log(`Fetching ${rssConfig.feeds.length} RSS feeds...`);
    const sources = await fetchRSSFeeds(rssConfig.feeds);

    if (sources.length === 0) {
      console.log('No recent sources found');
      return {
        topic: 'No topic available',
        sources: [],
        keyPoints: [],
        relevanceScore: 0,
        brandPillarMatch: '',
        suggestedAngle: '',
      };
    }

    console.log(`Found ${sources.length} recent sources`);

    // Use Bedrock to analyze and select topic
    const userPrompt = buildResearchPrompt(sources, brandProfile, recentTopics);
    const response = await generateWithRetry(SYSTEM_PROMPT, userPrompt);

    const analysis = parseJsonFromResponse<AnalysisResult>(response);

    // Build the result with selected sources
    const selectedSources = analysis.selectedSources
      .filter((i) => i >= 0 && i < sources.length)
      .map((i) => sources[i]);

    const result: ResearchResult = {
      topic: analysis.selectedTopic,
      sources:
        selectedSources.length > 0 ? selectedSources : sources.slice(0, 3),
      keyPoints: analysis.keyPoints,
      relevanceScore: analysis.relevanceScore,
      brandPillarMatch: analysis.brandPillarMatch,
      suggestedAngle: analysis.suggestedAngle,
    };

    console.log('Research complete:', JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    console.error('Research Agent error:', error);
    throw error;
  }
};
