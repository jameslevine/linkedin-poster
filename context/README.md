# Context Folder

This folder contains your personal context for customizing paper searches.

## Files

### skills.json

Configure your skills, interests, and search queries here. The `fetch-papers-by-skills.ts` script uses this file to search for relevant papers.

**Structure:**

```json
{
  "profile": {
    "name": "Your Name",
    "role": "Your Role",
    "summary": "Brief professional summary"
  },
  "skills": {
    "primary": ["skill1", "skill2"], // Main skills to search for
    "technical": ["tech1", "tech2"], // Technical skills (for reference)
    "domains": ["domain1", "domain2"] // Domain expertise
  },
  "interests": ["interest1", "interest2"], // Research interests
  "searchQueries": [
    // Custom search queries
    "specific topic 1",
    "specific topic 2"
  ]
}
```

### Your CV (Optional)

You can add your CV here for reference:

- `cv.pdf` - Your CV in PDF format
- `cv.txt` - Plain text version for easier parsing

## Customizing Searches

1. Edit `skills.json` with your actual skills and interests
2. Add specific search queries that match your expertise
3. Run `npm run papers:skills` to search based on your profile

## Example Skills Configuration

For a Software Engineer focused on AI/ML:

```json
{
  "profile": {
    "name": "James Levine",
    "role": "Software Engineer",
    "summary": "Building AI-powered applications with cloud infrastructure"
  },
  "skills": {
    "primary": [
      "machine learning",
      "artificial intelligence",
      "cloud computing"
    ],
    "technical": ["TypeScript", "Python", "AWS", "Serverless"],
    "domains": ["software engineering", "distributed systems"]
  },
  "interests": ["large language models", "generative AI", "MLOps"],
  "searchQueries": [
    "LLM applications in software engineering",
    "serverless machine learning deployment",
    "AI-assisted code generation"
  ]
}
```
