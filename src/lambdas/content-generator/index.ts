/**
 * Content Generator Lambda
 * Generates multiple LinkedIn post drafts using Bedrock based on research
 */

import { Handler } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { getBrandProfile } from '../../utils/dynamodb';
import { generateWithRetry, parseJsonFromResponse } from '../../utils/bedrock';
import { BrandProfile, ResearchResult } from '../../types';

interface ContentGeneratorInput {
  batchId: string;
  research: ResearchResult;
  draftCount?: number;
  feedback?: string;
  regenerate?: boolean;
}

interface GeneratedDraft {
  post: string;
  hashtags: string[];
  hook: string;
  callToAction: string;
}

interface ContentGeneratorOutput {
  batchId: string;
  drafts: Array<{
    postId: string;
    content: string;
    topic: string;
    hashtags: string[];
    sourceArticles: Array<{
      title: string;
      url: string;
      source: string;
    }>;
  }>;
}

function buildContentPrompt(
  research: ResearchResult,
  brandProfile: BrandProfile,
  draftCount: number,
  feedback?: string,
): string {
  const feedbackSection = feedback
    ? `\n## Previous Feedback (address these issues)\n${feedback}\n`
    : '';

  return `You are a senior technical writer creating deeply technical LinkedIn posts for a software engineering thought leader.

## CRITICAL RULES - MUST FOLLOW
1. **ABSOLUTELY NO EMOJIS** - Do not use any emojis anywhere in the post
2. **DEEPLY TECHNICAL** - Every post must explain technical concepts in depth
3. **INCLUDE CODE** - Include working code snippets, commands, or configuration examples where relevant
4. **PROFESSIONAL TONE** - Write like a senior engineer sharing knowledge, not a marketer

## Brand Profile
Name: ${brandProfile.name}
Title: ${brandProfile.title}
Brand Pillars: ${brandProfile.brandPillars.join(', ')}
Tone: ${brandProfile.tone.primary} with elements of ${brandProfile.tone.secondary.join(', ')}
Target Audience: ${brandProfile.targetAudience.join(', ')}
Preferred Hashtags: ${brandProfile.hashtags.join(', ')}

## Research Topic
Topic: ${research.topic}
Brand Pillar Match: ${research.brandPillarMatch}
Suggested Angle: ${research.suggestedAngle}

Key Points:
${research.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Sources:
${research.sources.map((s) => `- ${s.title} (${s.source})`).join('\n')}
${feedbackSection}
## Technical LinkedIn Post Requirements
1. Start with a bold technical statement or insight (no emojis)
2. Explain the "why" behind the technology - what problem does it solve?
3. Include a practical code example, CLI command, or configuration snippet
4. Explain what the code does and how to use it
5. Share a technical insight or lesson learned
6. End with a technical question to spark discussion
7. Use 3-5 relevant technical hashtags
8. Keep it under 2500 characters to allow for code blocks

## Code Formatting
- Use triple backticks with language identifier for code blocks
- Example:
\`\`\`python
def example():
    return "Hello, World!"
\`\`\`

## Task
Create ${draftCount} DIFFERENT deeply technical LinkedIn posts that:
1. Each explores a different technical angle on the topic
2. Includes working code snippets or commands that readers can actually run
3. Explains complex concepts clearly for senior engineers
4. Demonstrates deep technical expertise
5. NO EMOJIS - use plain text formatting only
6. Each post should teach something practical and actionable

Respond with a JSON object containing an array of ${draftCount} posts:
{
  "posts": [
    {
      "post": "The complete LinkedIn post text with code blocks and proper formatting. NO EMOJIS.",
      "hashtags": ["#Hashtag1", "#Hashtag2", "#Hashtag3"],
      "hook": "The opening technical statement",
      "callToAction": "The closing technical question"
    }
  ]
}`;
}

const SYSTEM_PROMPT = `You are a senior software engineer and technical writer who creates deeply technical LinkedIn content. Your posts are known for their technical depth, practical code examples, and clear explanations of complex concepts. You NEVER use emojis - your writing is professional and technical. You always include working code snippets that readers can actually run. Always respond with valid JSON.`;

export const handler: Handler<
  ContentGeneratorInput,
  ContentGeneratorOutput
> = async (event) => {
  console.log('Content Generator starting...', JSON.stringify(event));

  try {
    const { research, draftCount = 3, feedback, regenerate, batchId } = event;

    // Generate a batchId if not provided
    const finalBatchId = batchId || randomUUID();

    if (!research) {
      throw new Error('Research data is required');
    }

    // Get brand profile
    const brandProfile = await getBrandProfile();

    if (!brandProfile) {
      throw new Error('Brand profile not configured');
    }

    console.log(`Generating ${draftCount} drafts for topic: ${research.topic}`);
    if (regenerate) {
      console.log('Regenerating with feedback:', feedback);
    }

    // Generate content using Bedrock
    const userPrompt = buildContentPrompt(
      research,
      brandProfile,
      draftCount,
      feedback,
    );
    const response = await generateWithRetry(SYSTEM_PROMPT, userPrompt);

    const generationResult = parseJsonFromResponse<{
      posts: GeneratedDraft[];
    }>(response);

    // Transform to expected output format
    const drafts = generationResult.posts.map((post) => ({
      postId: randomUUID(),
      content: post.post,
      topic: research.topic,
      hashtags: post.hashtags,
      sourceArticles: research.sources.map((s) => ({
        title: s.title,
        url: s.url,
        source: s.source,
      })),
    }));

    console.log(`Generated ${drafts.length} drafts successfully`);

    return { batchId: finalBatchId, drafts };
  } catch (error) {
    console.error('Content Generator error:', error);
    throw error;
  }
};
