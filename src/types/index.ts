// LinkedIn API Types
export interface LinkedInCredentials {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  personUrn?: string;
}

// Post Types
export type PostStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'PUBLISHED'
  | 'FAILED'
  | 'REGENERATING';

export interface Post {
  postId: string;
  batchId: string;
  status: PostStatus;
  content: string;
  topic: string;
  sourceArticles: SourceArticle[];
  qualityScore: number;
  qualityFeedback?: string;
  hashtags: string[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  linkedInPostId?: string;
  linkedInPostUrl?: string;
  userFeedback?: string;
  regenerationCount?: number;
  approvalToken?: string;
}

// Alias for backward compatibility
export type PostRecord = Post;

export interface SourceArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary?: string;
  relevanceScore?: number;
}

// Alias for backward compatibility
export type ResearchSource = SourceArticle;

// Brand Profile Types
export interface BrandProfile {
  name: string;
  title: string;
  brandPillars: string[];
  contentThemes: string[];
  tone: {
    primary: string;
    secondary: string[];
  };
  targetAudience: string[];
  hashtags: string[];
  avoidTopics: string[];
}

// RSS Feed Types
export interface RSSFeed {
  name: string;
  url: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
}

export interface RSSFeedConfig {
  feeds: RSSFeed[];
  settings: {
    maxArticlesPerFeed: number;
    maxTotalArticles: number;
    lookbackHours: number;
    preferredCategories: string[];
  };
}

// Config Record for DynamoDB
export interface ConfigRecord {
  pk: string;
  sk: string;
  data: BrandProfile | RSSFeedConfig;
  updatedAt: string;
}

// Research Agent Types
export interface ResearchResult {
  topic: string;
  topics?: TopicSuggestion[];
  articles?: SourceArticle[];
  sources: SourceArticle[];
  keyPoints: string[];
  brandPillarMatch: string;
  suggestedAngle: string;
  relevanceScore?: number;
  timestamp?: string;
}

export interface TopicSuggestion {
  topic: string;
  relevanceScore: number;
  trendingScore: number;
  sourceArticles: SourceArticle[];
  suggestedAngle: string;
  brandPillarMatch?: string;
  keyPoints?: string[];
}

// Content Generation Types
export interface ContentGeneratorInput {
  research: ResearchResult;
  brandProfile: BrandProfile;
  draftCount?: number;
}

export interface GeneratedContent {
  content: string;
  hashtags: string[];
  topic: string;
}

export interface GeneratedDraft {
  postId: string;
  content: string;
  topic: string;
  hashtags: string[];
  sourceArticles: SourceArticle[];
}

export interface ContentGenerationResult {
  batchId: string;
  drafts: GeneratedDraft[];
  timestamp: string;
}

// Quality Review Types
export interface QualityReviewerInput {
  generatedContent: GeneratedContent;
  research: ResearchResult;
  brandProfile: BrandProfile;
}

export interface QualityReviewResult {
  postId: string;
  score: number;
  qualityScore: number;
  passed: boolean;
  approved: boolean;
  feedback: string;
  suggestions: string[];
  issues: QualityIssue[] | string[];
}

export interface QualityIssue {
  type:
    | 'grammar'
    | 'tone'
    | 'length'
    | 'relevance'
    | 'engagement'
    | 'brand_alignment';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion?: string;
}

export interface BatchReviewResult {
  batchId: string;
  reviews: QualityReviewResult[];
  timestamp: string;
}

// LinkedIn Publisher Types
export interface LinkedInPublisherInput {
  content: GeneratedContent;
  qualityReview: QualityReviewResult;
  postId?: string;
}

export interface PublishResult {
  success: boolean;
  postId?: string;
  linkedInPostId?: string;
  linkedInPostUrl?: string;
  error?: string;
}

// Approval Types
export interface ApprovalAction {
  action: 'approve' | 'reject' | 'edit' | 'regenerate';
  postId: string;
  feedback?: string;
  editedContent?: string;
}

export interface ApprovalResult {
  postId: string;
  action: string;
  success: boolean;
  message: string;
  linkedInPostUrl?: string;
}

// Email Notification Types
export interface DraftNotification {
  batchId: string;
  drafts: DraftSummary[];
  approvalBaseUrl: string;
  timestamp: string;
}

export interface DraftSummary {
  postId: string;
  topic: string;
  contentPreview: string;
  qualityScore: number;
  approveUrl: string;
  editUrl: string;
  rejectUrl: string;
}

// Step Functions Event Types
export interface WorkflowInput {
  triggeredBy: 'schedule' | 'manual';
  timestamp: string;
  draftCount?: number;
}

export interface WorkflowState {
  batchId: string;
  research?: ResearchResult;
  drafts?: GeneratedDraft[];
  reviews?: QualityReviewResult[];
  approvedPostId?: string;
  publishResult?: {
    postId: string;
    linkedInPostUrl: string;
  };
}

// DynamoDB Types
export interface DynamoDBPost extends Post {
  pk: string;
  sk: string;
  gsi1pk: string;
  gsi1sk: string;
}

export interface DynamoDBConfig {
  pk: string;
  sk: string;
  data: BrandProfile | RSSFeedConfig;
  updatedAt: string;
}

// API Response Types
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
