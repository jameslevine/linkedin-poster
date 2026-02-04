/**
 * Secrets Manager utility for retrieving and updating LinkedIn credentials
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  UpdateSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import { LinkedInCredentials } from '../types';

const client = new SecretsManagerClient({});

export async function getLinkedInCredentials(): Promise<LinkedInCredentials> {
  const secretArn = process.env.SECRETS_ARN;

  if (!secretArn) {
    throw new Error('SECRETS_ARN environment variable not set');
  }

  const response = await client.send(
    new GetSecretValueCommand({
      SecretId: secretArn,
    }),
  );

  if (!response.SecretString) {
    throw new Error('No secret value found');
  }

  return JSON.parse(response.SecretString) as LinkedInCredentials;
}

export async function updateLinkedInCredentials(
  credentials: LinkedInCredentials,
): Promise<void> {
  const secretArn = process.env.SECRETS_ARN;

  if (!secretArn) {
    throw new Error('SECRETS_ARN environment variable not set');
  }

  await client.send(
    new UpdateSecretCommand({
      SecretId: secretArn,
      SecretString: JSON.stringify(credentials),
    }),
  );
}
