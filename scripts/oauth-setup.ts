/**
 * OAuth Setup Script for LinkedIn API
 * Run this after setup-secrets to complete OAuth authorization: npm run setup:oauth
 *
 * This script will:
 * 1. Start a local server to handle OAuth callback
 * 2. Open browser for LinkedIn authorization
 * 3. Exchange authorization code for access token
 * 4. Get your LinkedIn Person URN
 * 5. Store tokens in AWS Secrets Manager
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  UpdateSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import * as http from 'http';
import * as https from 'https';
import { URL, URLSearchParams } from 'url';
import { exec } from 'child_process';

const REGION = process.env.AWS_REGION || 'us-east-1';
const SECRET_NAME = 'linkedin-automation/credentials';
const REDIRECT_URI = 'http://localhost:3000/callback';
const PORT = 3000;

// LinkedIn OAuth scopes needed for posting
const SCOPES = ['openid', 'profile', 'w_member_social'].join(' ');

const secretsClient = new SecretsManagerClient({ region: REGION });

interface LinkedInCredentials {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  personUrn?: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface ProfileResponse {
  sub: string;
  name: string;
  email?: string;
}

async function getCredentials(): Promise<LinkedInCredentials> {
  const response = await secretsClient.send(
    new GetSecretValueCommand({
      SecretId: SECRET_NAME,
    }),
  );

  if (!response.SecretString) {
    throw new Error('No credentials found in Secrets Manager');
  }

  return JSON.parse(response.SecretString) as LinkedInCredentials;
}

async function updateCredentials(
  credentials: LinkedInCredentials,
): Promise<void> {
  await secretsClient.send(
    new UpdateSecretCommand({
      SecretId: SECRET_NAME,
      SecretString: JSON.stringify(credentials),
    }),
  );
}

function openBrowser(url: string): void {
  const platform = process.platform;
  let command: string;

  switch (platform) {
    case 'darwin':
      command = `open "${url}"`;
      break;
    case 'win32':
      command = `start "${url}"`;
      break;
    default:
      command = `xdg-open "${url}"`;
  }

  exec(command, (error) => {
    if (error) {
      console.log('\n⚠️  Could not open browser automatically.');
      console.log('Please open this URL manually:\n');
      console.log(url);
    }
  });
}

function httpsRequest(
  url: string,
  options: https.RequestOptions,
  postData?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

async function exchangeCodeForToken(
  code: string,
  credentials: LinkedInCredentials,
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
  });

  const response = await httpsRequest(
    'https://www.linkedin.com/oauth/v2/accessToken',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
    params.toString(),
  );

  return JSON.parse(response) as TokenResponse;
}

async function getProfile(accessToken: string): Promise<ProfileResponse> {
  const response = await httpsRequest('https://api.linkedin.com/v2/userinfo', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return JSON.parse(response) as ProfileResponse;
}

async function startOAuthFlow(credentials: LinkedInCredentials): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '', `http://localhost:${PORT}`);

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: sans-serif; padding: 40px;">
                <h1>❌ Authorization Failed</h1>
                <p><strong>Error:</strong> ${error}</p>
                <p><strong>Description:</strong> ${errorDescription}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error(`OAuth error: ${error} - ${errorDescription}`));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: sans-serif; padding: 40px;">
                <h1>❌ No Authorization Code</h1>
                <p>No authorization code received.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error('No authorization code received'));
          return;
        }

        try {
          console.log('\n⏳ Exchanging authorization code for access token...');
          const tokenResponse = await exchangeCodeForToken(code, credentials);

          console.log('⏳ Fetching LinkedIn profile...');
          const profile = await getProfile(tokenResponse.access_token);

          // Update credentials with tokens
          const updatedCredentials: LinkedInCredentials = {
            ...credentials,
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            expiresAt: Date.now() + tokenResponse.expires_in * 1000,
            personUrn: `urn:li:person:${profile.sub}`,
          };

          console.log('⏳ Storing tokens in Secrets Manager...');
          await updateCredentials(updatedCredentials);

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: sans-serif; padding: 40px;">
                <h1>✅ Authorization Successful!</h1>
                <p><strong>Name:</strong> ${profile.name}</p>
                <p><strong>Person URN:</strong> urn:li:person:${profile.sub}</p>
                <p>Tokens have been stored in AWS Secrets Manager.</p>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `);

          console.log('\n✅ Authorization successful!');
          console.log(`   Name: ${profile.name}`);
          console.log(`   Person URN: urn:li:person:${profile.sub}`);
          console.log(
            `   Token expires: ${new Date(updatedCredentials.expiresAt!).toISOString()}`,
          );

          server.close();
          resolve();
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: sans-serif; padding: 40px;">
                <h1>❌ Error</h1>
                <p>${err instanceof Error ? err.message : 'Unknown error'}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(err);
        }
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(PORT, () => {
      const authUrl = new URL(
        'https://www.linkedin.com/oauth/v2/authorization',
      );
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', credentials.clientId);
      authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.set('scope', SCOPES);
      authUrl.searchParams.set(
        'state',
        Math.random().toString(36).substring(7),
      );

      console.log('\n🌐 Opening browser for LinkedIn authorization...');
      console.log('   If the browser does not open, visit this URL:\n');
      console.log(`   ${authUrl.toString()}\n`);

      openBrowser(authUrl.toString());
    });

    server.on('error', (err) => {
      reject(err);
    });
  });
}

async function main(): Promise<void> {
  console.log('\n🔐 LinkedIn OAuth Setup\n');
  console.log(
    'This script will authorize your LinkedIn account and store tokens.',
  );
  console.log('Make sure you have run "npm run setup:secrets" first.\n');

  try {
    console.log('⏳ Fetching credentials from Secrets Manager...');
    const credentials = await getCredentials();

    if (!credentials.clientId || !credentials.clientSecret) {
      console.error('❌ Client ID and Secret not found in Secrets Manager.');
      console.error('   Please run "npm run setup:secrets" first.');
      process.exit(1);
    }

    console.log('✅ Credentials found.');

    if (credentials.accessToken && credentials.expiresAt) {
      const expiresAt = new Date(credentials.expiresAt);
      const now = new Date();

      if (expiresAt > now) {
        console.log(
          `\n⚠️  Existing valid token found (expires: ${expiresAt.toISOString()})`,
        );
        console.log(
          '   Do you want to re-authorize? (This will replace the existing token)',
        );

        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question('   Continue? (y/N): ', resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== 'y') {
          console.log('\nAborted. Existing token unchanged.');
          return;
        }
      }
    }

    console.log('\n📋 Required LinkedIn App Settings:');
    console.log('   1. Go to https://www.linkedin.com/developers/apps');
    console.log('   2. Select your app');
    console.log('   3. Go to "Auth" tab');
    console.log(`   4. Add this redirect URL: ${REDIRECT_URI}`);
    console.log('   5. Ensure these scopes are enabled:');
    console.log('      - openid');
    console.log('      - profile');
    console.log('      - w_member_social');
    console.log('\nPress Enter when ready...');

    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    await new Promise<void>((resolve) => {
      rl.question('', () => {
        rl.close();
        resolve();
      });
    });

    await startOAuthFlow(credentials);

    console.log('\n✅ OAuth setup complete!');
    console.log('\nNext steps:');
    console.log('1. Deploy the infrastructure: npm run deploy');
    console.log('');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
