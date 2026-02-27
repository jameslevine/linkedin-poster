/**
 * PostLang Compiler
 * Compiles .post files to clean, concise LinkedIn posts
 *
 * Symbols:
 *   ^ = Limit
 *   # = Title
 *   ! = Claim
 *   + = Evidence
 *   > = Insight
 *   ? = Context
 *   * = Credential
 *   @ = Source
 */

export interface PostLangLimits {
  title?: number;
  claim?: number;
  evidence?: number;
  insight?: number;
  context?: number;
  total?: number;
}

export interface PostLangAST {
  title: string;
  claim: string;
  evidence: Array<{ value: string; context: string }>;
  insight: string;
  context?: string;
  credential?: string;
  source: { title: string; url: string };
  limits?: PostLangLimits;
}

const DEFAULT_LIMITS: PostLangLimits = {
  title: 80,
  claim: 150,
  evidence: 60,
  insight: 120,
  context: 100,
  total: 700,
};

export interface CompileResult {
  success: boolean;
  output?: string;
  errors: string[];
  warnings: string[];
}

const BANNED_PHRASES = [
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

const EMOJI_REGEX =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

export class PostLangCompiler {
  parse(source: string): { ast: Partial<PostLangAST>; errors: string[] } {
    const errors: string[] = [];
    const ast: Partial<PostLangAST> = {
      evidence: [],
    };

    const lines = source.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('//')) continue;

      const lineNum = i + 1;
      const firstChar = line[0];

      // ^ = Limits
      if (firstChar === '^') {
        const match = line.match(/^\^\s*(\w+)\s*(\d+)/);
        if (match) {
          if (!ast.limits) ast.limits = {};
          const key = match[1].toLowerCase() as keyof PostLangLimits;
          const value = parseInt(match[2], 10);
          if (
            [
              'title',
              'claim',
              'evidence',
              'insight',
              'context',
              'total',
            ].includes(key)
          ) {
            ast.limits[key] = value;
          }
        }
        continue;
      }

      // # = Title
      if (firstChar === '#') {
        const match = line.match(/^#\s*"([^"]+)"/);
        if (match) {
          ast.title = match[1];
        } else {
          errors.push(`Line ${lineNum}: Invalid title. Use # "Your title"`);
        }
        continue;
      }

      // ! = Claim
      if (firstChar === '!') {
        const match = line.match(/^!\s*"([^"]+)"/);
        if (match) {
          ast.claim = match[1];
        } else {
          errors.push(`Line ${lineNum}: Invalid claim. Use ! "Your claim"`);
        }
        continue;
      }

      // + = Evidence
      if (firstChar === '+') {
        const match = line.match(/^\+\s*([^|]+)\|\s*"([^"]+)"/);
        if (match) {
          ast.evidence!.push({
            value: match[1].trim(),
            context: match[2],
          });
        } else {
          errors.push(
            `Line ${lineNum}: Invalid evidence. Use + value | "context"`,
          );
        }
        continue;
      }

      // > = Insight
      if (firstChar === '>') {
        const match = line.match(/^>\s*"([^"]+)"/);
        if (match) {
          ast.insight = match[1];
        } else {
          errors.push(`Line ${lineNum}: Invalid insight. Use > "Your insight"`);
        }
        continue;
      }

      // ? = Context
      if (firstChar === '?') {
        const match = line.match(/^\?\s*"([^"]+)"/);
        if (match) {
          ast.context = match[1];
        }
        continue;
      }

      // * = Credential
      if (firstChar === '*') {
        const match = line.match(/^\*\s*"([^"]+)"/);
        if (match) {
          ast.credential = match[1];
        }
        continue;
      }

      // @ = Source
      if (firstChar === '@') {
        const match = line.match(/^@\s*"([^"]+)"\s*\|\s*(\S+)/);
        if (match) {
          ast.source = {
            title: match[1],
            url: match[2],
          };
        } else {
          errors.push(`Line ${lineNum}: Invalid source. Use @ "Title" | url`);
        }
        continue;
      }
    }

    return { ast, errors };
  }

  validate(ast: Partial<PostLangAST>): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const limits = { ...DEFAULT_LIMITS, ...ast.limits };

    // Required fields
    if (!ast.title) errors.push('Missing # (title)');
    if (!ast.claim) errors.push('Missing ! (claim)');
    if (!ast.evidence || ast.evidence.length === 0)
      errors.push('Missing + (evidence)');
    if (!ast.insight) errors.push('Missing > (insight)');
    if (!ast.source) errors.push('Missing @ (source)');

    // Title validation
    if (ast.title) {
      if (ast.title.length > limits.title!) {
        errors.push(
          `# exceeds ${limits.title} chars (has ${ast.title.length})`,
        );
      }
      if (ast.title.endsWith('?')) {
        errors.push('# cannot be a question');
      }
      if (ast.title.includes('!')) {
        errors.push('# cannot contain exclamation marks');
      }
    }

    // Claim validation
    if (ast.claim && ast.claim.length > limits.claim!) {
      errors.push(`! exceeds ${limits.claim} chars (has ${ast.claim.length})`);
    }

    // Evidence validation
    if (ast.evidence) {
      if (ast.evidence.length > 5) {
        errors.push('+ limited to 5 items maximum');
      }
      for (let i = 0; i < ast.evidence.length; i++) {
        const ev = ast.evidence[i];
        const evText = `${ev.value} ${ev.context}`;
        if (evText.length > limits.evidence!) {
          errors.push(
            `+ item ${i + 1} exceeds ${limits.evidence} chars (has ${evText.length})`,
          );
        }
      }
    }

    // Insight validation
    if (ast.insight && ast.insight.length > limits.insight!) {
      errors.push(
        `> exceeds ${limits.insight} chars (has ${ast.insight.length})`,
      );
    }

    // Context validation
    if (ast.context && ast.context.length > limits.context!) {
      warnings.push(
        `? exceeds ${limits.context} chars (has ${ast.context.length})`,
      );
    }

    // Check all text for banned phrases and emojis
    const allText = [
      ast.title,
      ast.claim,
      ast.insight,
      ast.context,
      ...(ast.evidence?.map((e) => e.context) || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (EMOJI_REGEX.test(allText)) {
      errors.push('Emojis are not allowed');
    }

    for (const phrase of BANNED_PHRASES) {
      if (allText.includes(phrase.toLowerCase())) {
        errors.push(`Banned phrase: "${phrase}"`);
      }
    }

    const exclamationCount = (allText.match(/!/g) || []).length;
    if (exclamationCount > 0) {
      errors.push(`Exclamation marks not allowed (found ${exclamationCount})`);
    }

    return { errors, warnings };
  }

  generate(ast: PostLangAST): string {
    const lines: string[] = [];

    // Title
    lines.push(ast.title + '.');
    lines.push('');

    // Context
    if (ast.context) {
      lines.push(ast.context);
      lines.push('');
    }

    // Claim
    lines.push(ast.claim + '.');
    lines.push('');

    // Evidence
    if (ast.evidence.length > 0) {
      lines.push('Results:');
      for (const ev of ast.evidence) {
        lines.push(`- ${ev.value} ${ev.context}`);
      }
      lines.push('');
    }

    // Insight
    lines.push(ast.insight + '.');
    lines.push('');

    // Credential
    if (ast.credential) {
      lines.push(`[${ast.credential}]`);
      lines.push('');
    }

    // Source
    lines.push(`Source: ${ast.source.title}`);
    const displayUrl = ast.source.url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '');
    lines.push(displayUrl);

    return lines.join('\n');
  }

  compile(source: string): CompileResult {
    const { ast, errors: parseErrors } = this.parse(source);

    if (parseErrors.length > 0) {
      return { success: false, errors: parseErrors, warnings: [] };
    }

    const { errors: validationErrors, warnings } = this.validate(ast);

    if (validationErrors.length > 0) {
      return { success: false, errors: validationErrors, warnings };
    }

    const output = this.generate(ast as PostLangAST);
    const limits = { ...DEFAULT_LIMITS, ...ast.limits };

    if (output.length > limits.total!) {
      return {
        success: false,
        errors: [`Output exceeds ${limits.total} chars (has ${output.length})`],
        warnings,
      };
    }

    return { success: true, output, errors: [], warnings };
  }
}

export const postlang = new PostLangCompiler();
