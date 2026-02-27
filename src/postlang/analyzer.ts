/**
 * PostLang Analyzer
 * Validates if a plain text LinkedIn post follows PostLang structure
 */

export interface AnalysisResult {
  valid: boolean;
  score: number; // 0-100
  structure: {
    hasTitle: boolean;
    hasClaim: boolean;
    hasEvidence: boolean;
    evidenceCount: number;
    hasInsight: boolean;
    hasSource: boolean;
  };
  issues: string[];
  warnings: string[];
  suggestions: string[];
}

// Re-export for use in analyzer
export const BANNED = [
  'game-changer',
  'game changer',
  'revolutionary',
  'groundbreaking',
  'exciting',
  'thrilled',
  'delighted',
  'proud to announce',
  'thrilled to announce',
  'excited to share',
  'let me tell you',
  "here's the thing",
  "in today's world",
  'in this day and age',
  'at the end of the day',
  'it goes without saying',
  'needless to say',
  'leverage',
  'synergy',
  'paradigm shift',
  'disruptive',
  'innovative solution',
  'cutting-edge',
  'state-of-the-art',
  'best-in-class',
  'world-class',
  'next-level',
  'deep dive',
  'unpack',
  'circle back',
  'move the needle',
];

const EMOJI_RE =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

export class PostLangAnalyzer {
  /**
   * Analyze a plain text LinkedIn post
   */
  analyze(text: string): AnalysisResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    const lines = text.split('\n').filter((l) => l.trim());
    const lowerText = text.toLowerCase();

    // Structure detection
    const structure = {
      hasTitle: false,
      hasClaim: false,
      hasEvidence: false,
      evidenceCount: 0,
      hasInsight: false,
      hasSource: false,
    };

    // Detect title (first non-empty line, should be short)
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      if (firstLine.length > 0 && firstLine.length <= 100) {
        structure.hasTitle = true;
      } else if (firstLine.length > 100) {
        issues.push('First line too long for a title (>100 chars)');
        score -= 10;
      }
    } else {
      issues.push('No title detected');
      score -= 15;
    }

    // Detect evidence (lines with numbers/percentages)
    const evidencePattern = /\d+%|\d+x|\d+\.\d+/;
    const bulletPattern = /^[-•*]\s/;
    for (const line of lines) {
      if (evidencePattern.test(line) || bulletPattern.test(line.trim())) {
        structure.hasEvidence = true;
        structure.evidenceCount++;
      }
    }

    if (!structure.hasEvidence) {
      issues.push('No evidence/data points detected');
      suggestions.push('Add specific numbers or percentages to support claims');
      score -= 20;
    } else if (structure.evidenceCount < 2) {
      warnings.push('Only 1 evidence point - consider adding more');
      score -= 5;
    }

    // Detect source (URL or "Source:" pattern)
    const urlPattern = /https?:\/\/|arxiv\.org|github\.com|Source:/i;
    structure.hasSource = urlPattern.test(text);
    if (!structure.hasSource) {
      issues.push('No source/attribution detected');
      suggestions.push('Add a source URL or citation');
      score -= 15;
    }

    // Check for claim (statement in first few lines)
    if (lines.length >= 2) {
      structure.hasClaim = true;
    } else {
      issues.push('Post too short - no clear claim detected');
      score -= 10;
    }

    // Check for insight (concluding statement before source/tags)
    const nonTagLines = lines.filter(
      (l) => !l.startsWith('#') && !urlPattern.test(l),
    );
    if (nonTagLines.length >= 3) {
      structure.hasInsight = true;
    } else {
      warnings.push('No clear insight/takeaway detected');
      suggestions.push('Add a concluding insight before the source');
      score -= 5;
    }

    // Check for banned phrases
    for (const phrase of BANNED) {
      if (lowerText.includes(phrase)) {
        issues.push(`Contains banned phrase: "${phrase}"`);
        score -= 10;
      }
    }

    // Check for emojis
    if (EMOJI_RE.test(text)) {
      issues.push('Contains emojis');
      score -= 10;
    }

    // Check for exclamation marks
    const exclamationCount = (text.match(/!/g) || []).length;
    if (exclamationCount > 0) {
      issues.push(`Contains ${exclamationCount} exclamation mark(s)`);
      score -= exclamationCount * 5;
    }

    // Check for questions as hooks
    if (lines[0]?.trim().endsWith('?')) {
      issues.push('Title is a question (avoid clickbait)');
      score -= 10;
    }

    // Character count check
    if (text.length > 1300) {
      warnings.push(`Post is long (${text.length} chars) - consider trimming`);
      score -= 5;
    }

    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));

    return {
      valid: issues.length === 0,
      score,
      structure,
      issues,
      warnings,
      suggestions,
    };
  }
}

export const analyzer = new PostLangAnalyzer();
