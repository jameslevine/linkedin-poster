/**
 * Configuration Setup Script
 * Sets up brand profile and RSS feeds in DynamoDB
 * Run after deployment: npm run setup:config
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const REGION = process.env.AWS_REGION || 'us-east-1';
const CONFIG_TABLE =
  process.env.CONFIG_TABLE || 'linkedin-automation-config-dev';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

interface BrandProfile {
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
  avoidTopics?: string[];
}

interface RSSFeed {
  name: string;
  url: string;
  category: string;
  priority?: number;
}

interface RSSFeedConfig {
  feeds: RSSFeed[];
}

async function loadJsonFile<T>(filePath: string): Promise<T> {
  const fullPath = path.resolve(process.cwd(), filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(content) as T;
}

async function saveConfig(configType: string, data: unknown): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: CONFIG_TABLE,
      Item: {
        pk: 'CONFIG',
        sk: configType,
        data,
        updatedAt: new Date().toISOString(),
      },
    }),
  );
}

async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main(): Promise<void> {
  console.log('\n📝 LinkedIn Automation Configuration Setup\n');
  console.log(`Using table: ${CONFIG_TABLE}`);
  console.log(`Region: ${REGION}\n`);

  try {
    // Check for config files
    const brandProfilePath = 'config/brand-profile.json';
    const rssFeedsPath = 'config/rss-feeds.json';

    const brandProfileExists = fs.existsSync(brandProfilePath);
    const rssFeedsExists = fs.existsSync(rssFeedsPath);

    if (!brandProfileExists || !rssFeedsExists) {
      console.log('⚠️  Configuration files not found.');
      console.log('   Please create the following files:\n');

      if (!brandProfileExists) {
        console.log(`   - ${brandProfilePath}`);
      }
      if (!rssFeedsExists) {
        console.log(`   - ${rssFeedsPath}`);
      }

      console.log(
        '\n   See config/brand-profile.example.json and config/rss-feeds.example.json for templates.\n',
      );
      process.exit(1);
    }

    // Load and validate brand profile
    console.log('📖 Loading brand profile...');
    const brandProfile = await loadJsonFile<BrandProfile>(brandProfilePath);

    if (
      !brandProfile.name ||
      !brandProfile.brandPillars ||
      brandProfile.brandPillars.length === 0
    ) {
      throw new Error(
        'Brand profile must have name and at least one brand pillar',
      );
    }

    console.log(`   Name: ${brandProfile.name}`);
    console.log(`   Title: ${brandProfile.title}`);
    console.log(`   Brand Pillars: ${brandProfile.brandPillars.join(', ')}`);
    console.log(`   Content Themes: ${brandProfile.contentThemes.join(', ')}`);

    // Load and validate RSS feeds
    console.log('\n📖 Loading RSS feeds...');
    const rssConfig = await loadJsonFile<RSSFeedConfig>(rssFeedsPath);

    if (!rssConfig.feeds || rssConfig.feeds.length === 0) {
      throw new Error('RSS config must have at least one feed');
    }

    console.log(`   Found ${rssConfig.feeds.length} feeds:`);
    rssConfig.feeds.forEach((feed) => {
      console.log(`   - ${feed.name} (${feed.category})`);
    });

    // Confirm upload
    const confirm = await promptUser(
      '\nUpload configuration to DynamoDB? (y/N): ',
    );

    if (confirm.toLowerCase() !== 'y') {
      console.log('\nAborted.');
      return;
    }

    // Upload brand profile
    console.log('\n⏳ Uploading brand profile...');
    await saveConfig('BRAND_PROFILE', brandProfile);
    console.log('✅ Brand profile uploaded');

    // Upload RSS feeds
    console.log('⏳ Uploading RSS feeds...');
    await saveConfig('RSS_FEEDS', rssConfig);
    console.log('✅ RSS feeds uploaded');

    console.log('\n✅ Configuration setup complete!\n');
    console.log('Next steps:');
    console.log('1. Run the workflow manually: npm run trigger');
    console.log('2. Or wait for the scheduled trigger\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
