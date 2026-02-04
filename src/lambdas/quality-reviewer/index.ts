/**
 * Quality Reviewer Lambda
 * Reviews and validates multiple generated drafts, selects the best one
 */

import { Handler } from 'aws-lambda';
import { getBrandProfile } from '../../utils/dynamodb';
import { generateWithRetry, parseJsonFromResponse } from '../../utils/bedrock';
import { BrandProfile, ResearchResult } from '../../types';

interface Draft {
  postId: string;
  content: string;
  topic: string;
  hashtags: string[];
  sourceArticles: Array<{
    title: string;
    url: string;
    source: string;
  }>;
}

interface QualityReviewerInput {
  drafts: Draft[];
  research: ResearchResult;
}

interface ReviewedDraft {
  postId: string;
  content: string;
  topic: string;
  hashtags: string[];
  qualityScore: number;
  qualityFeedback: string;
  sourceArticles: Array<{
    title: string;
    url: string;
    source: string;
  }>;
}

interface QualityReviewerOutput {
  approved: boolean;
  finalPost: string;
  qualityScore: number;
  feedback: string;
  selectedDraftId: string;
  hashtags: string[];
  topic: string;
  drafts: ReviewedDraft[]; // All reviewed drafts for email notification
}

interface SingleReviewResult {
  qualityScore: number;
  feedback: string;
  improvedContent?: string;
}

function buildReviewPrompt(
  draft: Draft,
  research: ResearchResult,
  brandProfile: BrandProfile,
): string {
  return `You are a senior technical content reviewer ensuring LinkedIn posts meet high standards for technical depth and professionalism.

## CRITICAL QUALITY RULES
1. **NO EMOJIS ALLOWED** - Any post containing emojis should be penalized heavily (-30 points minimum)
2. **CODE REQUIRED** - Posts without code snippets, commands, or technical examples should score lower
3. **TECHNICAL DEPTH** - Surface-level content should score below 70

## Brand Profile
Name: ${brandProfile.name}
Title: ${brandProfile.title}
Brand Pillars: ${brandProfile.brandPillars.join(', ')}
Tone: ${brandProfile.tone.primary}
Target Audience: ${brandProfile.targetAudience.join(', ')}
${brandProfile.avoidTopics ? `Topics to Avoid: ${brandProfile.avoidTopics.join(', ')}` : ''}

## Original Research
Topic: ${research.topic}
Brand Pillar Match: ${research.brandPillarMatch}
Suggested Angle: ${research.suggestedAngle}

## Draft to Review:
${draft.content}

## Proposed Hashtags:
${draft.hashtags.join(' ')}

## Technical Quality Criteria (Score 0-100)

### AUTOMATIC PENALTIES
- Contains ANY emojis: -30 points (check for all Unicode emoji ranges)
- No code snippets or technical examples: -20 points
- Generic/surface-level content: -15 points

### POSITIVE SCORING
1. **Technical Depth (25 points)**: Does it explain HOW something works, not just WHAT it is?
2. **Code Quality (25 points)**: Are there working, runnable code examples? Are they well-formatted?
3. **Practical Value (20 points)**: Can engineers immediately apply this knowledge?
4. **Clarity (15 points)**: Is the technical explanation clear and well-structured?
5. **Professional Tone (15 points)**: Is it written like a senior engineer, not a marketer?

### ADDITIONAL CHECKS
- Brand Alignment: Does it match the brand voice and pillars?
- Hook: Is the opening a strong technical statement?
- CTA: Does it end with a technical question for discussion?
- No typos or grammatical errors

## Task
Review the content and provide your assessment. Score from 0-100.

IMPORTANT: If the post contains ANY emojis, you MUST:
1. Deduct at least 30 points
2. Provide an improved version with all emojis removed

Respond with a JSON object:
{
  "qualityScore": 0-100,
  "feedback": "Detailed technical feedback explaining the score",
  "improvedContent": "Required if score < 80 OR if emojis were found - provide improved version with NO EMOJIS and added code examples if missing"
}`;
}

const SYSTEM_PROMPT = `You are a senior software engineer reviewing technical LinkedIn content. You have extremely high standards for technical depth and absolutely zero tolerance for emojis or marketing-speak. You believe the best technical posts include working code that readers can actually run. You penalize heavily for emojis, lack of code examples, and surface-level content. Always respond with valid JSON.`;

export const handler: Handler<
  QualityReviewerInput,
  QualityReviewerOutput
> = async (event) => {
  console.log('Quality Reviewer starting...', JSON.stringify(event));

  try {
    const { drafts, research } = event;

    if (!drafts || drafts.length === 0) {
      throw new Error('Drafts array is required');
    }

    if (!research) {
      throw new Error('Research data is required');
    }

    // Get brand profile
    const brandProfile = await getBrandProfile();

    if (!brandProfile) {
      throw new Error('Brand profile not configured');
    }

    console.log(`Reviewing ${drafts.length} drafts...`);

    // Review each draft and track the best one
    let bestDraft: Draft | null = null;
    let bestScore = 0;
    let bestFeedback = '';
    let bestContent = '';
    const reviewedDrafts: ReviewedDraft[] = [];

    for (const draft of drafts) {
      console.log(`Reviewing draft ${draft.postId}...`);

      const userPrompt = buildReviewPrompt(draft, research, brandProfile);
      const response = await generateWithRetry(SYSTEM_PROMPT, userPrompt);

      const reviewResult = parseJsonFromResponse<SingleReviewResult>(response);

      // Use improved content if provided and score was low
      const finalContent =
        reviewResult.improvedContent && reviewResult.qualityScore < 80
          ? reviewResult.improvedContent
          : draft.content;

      console.log(
        `Draft ${draft.postId} reviewed: score=${reviewResult.qualityScore}`,
      );

      // Add to reviewed drafts array for email notification
      reviewedDrafts.push({
        postId: draft.postId,
        content: finalContent,
        topic: draft.topic,
        hashtags: draft.hashtags,
        qualityScore: reviewResult.qualityScore,
        qualityFeedback: reviewResult.feedback,
        sourceArticles: draft.sourceArticles,
      });

      // Track the best draft
      if (reviewResult.qualityScore > bestScore) {
        bestScore = reviewResult.qualityScore;
        bestDraft = draft;
        bestFeedback = reviewResult.feedback;
        bestContent = finalContent;
      }
    }

    if (!bestDraft) {
      throw new Error('No drafts were reviewed successfully');
    }

    // Approve if score is above threshold
    const approved = bestScore >= 70;

    console.log(
      `Review complete: best score=${bestScore}, approved=${approved}`,
    );

    return {
      approved,
      finalPost: bestContent,
      qualityScore: bestScore,
      feedback: bestFeedback,
      selectedDraftId: bestDraft.postId,
      hashtags: bestDraft.hashtags,
      topic: bestDraft.topic,
      drafts: reviewedDrafts,
    };
  } catch (error) {
    console.error('Quality Reviewer error:', error);
    throw error;
  }
};
