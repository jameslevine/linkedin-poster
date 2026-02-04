/**
 * Token Refresh Lambda
 * Refreshes LinkedIn OAuth tokens before they expire
 */

import { Handler } from 'aws-lambda';
import * as https from 'https';
import { URLSearchParams } from 'url';
import {
  getLinkedInCredentials,
  updateLinkedInCredentials,
} from '../../utils/secrets';
import { LinkedInCredentials } from '../../types';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

async function refreshAccessToken(
  credentials: LinkedInCredentials,
): Promise<TokenResponse> {
  return new Promise((resolve, reject) => {
    if (!credentials.refreshToken) {
      reject(new Error('No refresh token available'));
      return;
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: credentials.refreshToken,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    });

    const options = {
      hostname: 'www.linkedin.com',
      path: '/oauth/v2/accessToken',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(params.toString()),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data) as TokenResponse);
        } else {
          reject(
            new Error(`Token refresh failed: ${res.statusCode} - ${data}`),
          );
        }
      });
    });

    req.on('error', reject);
    req.write(params.toString());
    req.end();
  });
}

export const handler: Handler = async () => {
  console.log('Starting token refresh check...');

  try {
    const credentials = await getLinkedInCredentials();

    if (!credentials.accessToken || !credentials.expiresAt) {
      console.log('No access token found. Please run OAuth setup first.');
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No token to refresh',
          action: 'none',
        }),
      };
    }

    const now = Date.now();
    const expiresAt = credentials.expiresAt;
    const timeUntilExpiry = expiresAt - now;
    const daysUntilExpiry = timeUntilExpiry / (1000 * 60 * 60 * 24);

    console.log(`Token expires in ${daysUntilExpiry.toFixed(1)} days`);

    // Refresh if token expires within 7 days
    if (daysUntilExpiry <= 7) {
      console.log('Token expiring soon, attempting refresh...');

      if (!credentials.refreshToken) {
        console.error(
          'No refresh token available. Manual re-authorization required.',
        );
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: 'Token expiring but no refresh token available',
            action: 'manual_reauth_required',
            expiresAt: new Date(expiresAt).toISOString(),
          }),
        };
      }

      const tokenResponse = await refreshAccessToken(credentials);

      const updatedCredentials: LinkedInCredentials = {
        ...credentials,
        accessToken: tokenResponse.access_token,
        expiresAt: Date.now() + tokenResponse.expires_in * 1000,
      };

      if (tokenResponse.refresh_token) {
        updatedCredentials.refreshToken = tokenResponse.refresh_token;
      }

      await updateLinkedInCredentials(updatedCredentials);

      console.log('Token refreshed successfully');
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Token refreshed successfully',
          action: 'refreshed',
          newExpiresAt: new Date(updatedCredentials.expiresAt!).toISOString(),
        }),
      };
    }

    console.log('Token still valid, no refresh needed');
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Token still valid',
        action: 'none',
        expiresAt: new Date(expiresAt).toISOString(),
        daysUntilExpiry: daysUntilExpiry.toFixed(1),
      }),
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
};
