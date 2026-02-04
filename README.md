# LinkedIn Post Automation

An AWS-powered agentic workflow for automatically generating and publishing LinkedIn posts. Uses AI (Amazon Bedrock) to research trending topics, generate engaging content, and publish directly to LinkedIn.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│  EventBridge    │────▶│  Step Functions  │────▶│  Research Agent   │
│  (Scheduler)    │     │  (Orchestrator)  │     │  (Lambda)         │
└─────────────────┘     └──────────────────┘     └───────────────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│  LinkedIn API   │◀────│  Publisher       │◀────│  Content Generator│
│                 │     │  (Lambda)        │     │  (Lambda)         │
└─────────────────┘     └──────────────────┘     └───────────────────┘
                                                          │
                                                          ▼
                                                 ┌───────────────────┐
                                                 │  Quality Reviewer │
                                                 │  (Lambda)         │
                                                 └───────────────────┘
```

## Features

- **Agentic Workflow**: Multi-step AI pipeline with research, generation, and review stages
- **Deep Research**: Fetches and analyzes RSS feeds to find trending, relevant topics
- **Brand Alignment**: Generates content aligned with your brand pillars and voice
- **Quality Control**: AI-powered review ensures content meets quality standards
- **Automatic Publishing**: Posts directly to LinkedIn via API
- **Token Management**: Automatic OAuth token refresh
- **Serverless**: Fully serverless architecture using AWS Lambda and Step Functions

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI configured
- AWS SAM CLI installed
- Node.js 20.x or later
- LinkedIn Developer App with OAuth 2.0 credentials

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd linkedin-automation
npm install
```

### 2. Set Up LinkedIn Developer App

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps)
2. Create a new app or select existing
3. Under "Auth" tab, add redirect URL: `http://localhost:3000/callback`
4. Request access to these products:
   - Share on LinkedIn
   - Sign In with LinkedIn using OpenID Connect
5. Note your Client ID and Client Secret

### 3. Configure AWS Secrets

```bash
npm run setup:secrets
```

Follow the prompts to enter your LinkedIn Client ID and Secret.

### 4. Deploy Infrastructure

```bash
npm run deploy
```

This deploys:

- DynamoDB tables (posts, config)
- Lambda functions (5 agents)
- Step Functions state machine
- EventBridge scheduler
- Secrets Manager secret
- IAM roles and policies

### 5. Complete OAuth Authorization

```bash
npm run setup:oauth
```

This opens a browser for LinkedIn authorization and stores the access token.

### 6. Configure Brand Profile and RSS Feeds

1. Copy example configs:

```bash
cp config/brand-profile.example.json config/brand-profile.json
cp config/rss-feeds.example.json config/rss-feeds.json
```

2. Edit `config/brand-profile.json` with your details:

```json
{
  "name": "Your Name",
  "title": "Your Title | Company",
  "brandPillars": ["Your", "Brand", "Pillars"],
  "contentThemes": ["Topics", "You", "Cover"],
  "tone": {
    "primary": "thought-leadership",
    "secondary": ["educational", "conversational"]
  },
  "targetAudience": ["Your", "Target", "Audience"],
  "hashtags": ["#YourHashtags"]
}
```

3. Edit `config/rss-feeds.json` with your preferred news sources

4. Upload configuration:

```bash
npm run setup:config
```

### 7. Test the Workflow

```bash
npm run trigger
```

## Configuration

### Brand Profile

| Field            | Description                                                  |
| ---------------- | ------------------------------------------------------------ |
| `name`           | Your name as it appears on LinkedIn                          |
| `title`          | Your professional title                                      |
| `brandPillars`   | Core topics you're known for                                 |
| `contentThemes`  | Specific themes for content                                  |
| `tone.primary`   | Main voice (thought-leadership, educational, conversational) |
| `tone.secondary` | Supporting tones                                             |
| `targetAudience` | Who you're writing for                                       |
| `hashtags`       | Preferred hashtags                                           |
| `avoidTopics`    | Topics to never cover                                        |

### RSS Feeds

| Field      | Description               |
| ---------- | ------------------------- |
| `name`     | Display name for the feed |
| `url`      | RSS/Atom feed URL         |
| `category` | Category for grouping     |
| `priority` | 1 (highest) to 5 (lowest) |

## Workflow Details

### 1. Research Agent

- Fetches latest articles from configured RSS feeds
- Filters to last 24 hours
- Uses Bedrock to analyze and select best topic
- Scores relevance to brand pillars

### 2. Content Generator

- Takes research output
- Generates LinkedIn post with hook, body, CTA
- Creates 2 alternative variations
- Suggests optimal hashtags

### 3. Quality Reviewer

- Reviews content against brand guidelines
- Scores quality (0-1)
- Selects best variation
- Approves or rejects with feedback

### 4. LinkedIn Publisher

- Posts approved content to LinkedIn
- Saves record to DynamoDB
- Returns post URL

## Scheduling

Default schedule: **9 AM UTC, Monday-Friday**

To modify, update the `PostingSchedule` parameter in `infrastructure/template.yaml`:

```yaml
PostingSchedule:
  Type: String
  Default: 'cron(0 9 ? * MON-FRI *)'
```

## Monitoring

### CloudWatch Logs

Each Lambda function logs to CloudWatch. View logs:

```bash
aws logs tail /aws/lambda/linkedin-automation-research-agent-dev --follow
```

### Step Functions Console

View workflow executions in the AWS Step Functions console.

### DynamoDB

View published posts:

```bash
aws dynamodb scan --table-name linkedin-automation-posts-dev
```

## Troubleshooting

### Token Expired

```bash
npm run setup:oauth
```

### No Posts Generated

1. Check RSS feeds are returning content
2. Verify brand profile is configured
3. Check CloudWatch logs for errors

### Quality Score Too Low

- Adjust brand profile for clearer guidance
- Review quality reviewer feedback in logs

## Cost Estimation

Monthly costs (approximate):

- Lambda: ~$1-5 (depending on frequency)
- DynamoDB: ~$1-2 (on-demand pricing)
- Step Functions: ~$1
- Secrets Manager: ~$0.40
- Bedrock: ~$5-20 (depending on usage)

**Total: ~$10-30/month**

## Security

- LinkedIn credentials stored in AWS Secrets Manager
- IAM roles follow least-privilege principle
- No credentials in code or environment variables
- Automatic token refresh before expiry

## Development

### Local Testing

```bash
npm run build
npm test
```

### Lint

```bash
npm run lint
```

### Type Check

```bash
npm run typecheck
```

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request
