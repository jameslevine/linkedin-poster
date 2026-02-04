/**
 * Setup script to store LinkedIn credentials in AWS Secrets Manager
 * Run this once after deployment: npm run setup:secrets
 *
 * This script will prompt for credentials interactively - they are NEVER stored in files
 */

import {
  SecretsManagerClient,
  CreateSecretCommand,
  UpdateSecretCommand,
  GetSecretValueCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-secrets-manager';
import * as readline from 'readline';

const REGION = process.env.AWS_REGION || 'eu-west-2';
const SECRET_NAME = 'linkedin-automation/credentials';

const client = new SecretsManagerClient({ region: REGION });

interface LinkedInCredentials {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  personUrn?: string;
}

function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function prompt(
  rl: readline.Interface,
  question: string,
): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function promptPassword(
  _rl: readline.Interface,
  question: string,
): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);

    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;

    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }

    let password = '';

    const onData = (char: Buffer): void => {
      const c = char.toString('utf8');

      switch (c) {
        case '\n':
        case '\r':
        case '\u0004':
          if (stdin.isTTY) {
            stdin.setRawMode(wasRaw ?? false);
          }
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003':
          process.exit();
          break;
        case '\u007F':
          password = password.slice(0, -1);
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(question + '*'.repeat(password.length));
          break;
        default:
          password += c;
          process.stdout.write('*');
          break;
      }
    };

    stdin.on('data', onData);
  });
}

async function secretExists(): Promise<boolean> {
  try {
    await client.send(
      new GetSecretValueCommand({
        SecretId: SECRET_NAME,
      }),
    );
    return true;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      return false;
    }
    throw error;
  }
}

async function getExistingSecret(): Promise<LinkedInCredentials | null> {
  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: SECRET_NAME,
      }),
    );
    if (response.SecretString) {
      return JSON.parse(response.SecretString) as LinkedInCredentials;
    }
    return null;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      return null;
    }
    throw error;
  }
}

async function createOrUpdateSecret(
  credentials: LinkedInCredentials,
): Promise<void> {
  const secretString = JSON.stringify(credentials);

  const exists = await secretExists();

  if (exists) {
    await client.send(
      new UpdateSecretCommand({
        SecretId: SECRET_NAME,
        SecretString: secretString,
      }),
    );
    console.log(`✅ Secret updated: ${SECRET_NAME}`);
  } else {
    await client.send(
      new CreateSecretCommand({
        Name: SECRET_NAME,
        SecretString: secretString,
        Description: 'LinkedIn API credentials for automation tool',
      }),
    );
    console.log(`✅ Secret created: ${SECRET_NAME}`);
  }
}

async function main(): Promise<void> {
  console.log('\n🔐 LinkedIn Automation - Secrets Setup\n');
  console.log(
    'This script will store your LinkedIn credentials in AWS Secrets Manager.',
  );
  console.log('Credentials are NEVER stored in local files.\n');
  console.log(`Region: ${REGION}`);
  console.log(`Secret Name: ${SECRET_NAME}\n`);

  const rl = createReadlineInterface();

  try {
    // Check for existing credentials
    const existing = await getExistingSecret();

    if (existing) {
      console.log('⚠️  Existing credentials found in Secrets Manager.');
      const overwrite = await prompt(rl, 'Do you want to update them? (y/N): ');

      if (overwrite.toLowerCase() !== 'y') {
        console.log('Aborted. Existing credentials unchanged.');
        rl.close();
        return;
      }
    }

    // Collect credentials
    console.log('\nEnter your LinkedIn API credentials:\n');

    const clientId = await prompt(rl, 'Client ID: ');
    if (!clientId) {
      console.error('❌ Client ID is required');
      rl.close();
      process.exit(1);
    }

    const clientSecret = await promptPassword(rl, 'Client Secret: ');
    if (!clientSecret) {
      console.error('❌ Client Secret is required');
      rl.close();
      process.exit(1);
    }

    // Optional: Person URN if they have it
    console.log(
      '\nOptional: Enter your LinkedIn Person URN (format: urn:li:person:XXXXXXXX)',
    );
    console.log(
      'You can get this by running: npm run setup:oauth after this setup\n',
    );
    const personUrn = await prompt(rl, 'Person URN (press Enter to skip): ');

    const credentials: LinkedInCredentials = {
      clientId,
      clientSecret,
    };

    if (personUrn) {
      credentials.personUrn = personUrn;
    }

    // Preserve existing tokens if updating
    if (existing?.accessToken) {
      credentials.accessToken = existing.accessToken;
      credentials.refreshToken = existing.refreshToken;
      credentials.expiresAt = existing.expiresAt;
      console.log('\n📝 Preserving existing OAuth tokens.');
    }

    // Store in Secrets Manager
    console.log('\n⏳ Storing credentials in AWS Secrets Manager...');
    await createOrUpdateSecret(credentials);

    console.log('\n✅ Setup complete!');
    console.log('\nNext steps:');
    console.log('1. Run "npm run setup:oauth" to complete OAuth authorization');
    console.log('2. Deploy the infrastructure with "npm run deploy"');
    console.log('');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
