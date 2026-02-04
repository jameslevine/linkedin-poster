/**
 * DynamoDB utility for posts and config management
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  PostRecord,
  ConfigRecord,
  BrandProfile,
  RSSFeedConfig,
} from '../types';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Posts Table Operations
export async function savePost(
  post: PostRecord | Record<string, unknown>,
): Promise<void> {
  const tableName = process.env.POSTS_TABLE;

  if (!tableName) {
    throw new Error('POSTS_TABLE environment variable not set');
  }

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: post,
    }),
  );
}

export async function getPost(
  postId: string,
  timestamp: string,
): Promise<PostRecord | null> {
  const tableName = process.env.POSTS_TABLE;

  if (!tableName) {
    throw new Error('POSTS_TABLE environment variable not set');
  }

  const response = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `POST#${postId}`,
        sk: timestamp,
      },
    }),
  );

  return (response.Item as PostRecord) || null;
}

export async function getRecentPosts(
  limit: number = 10,
): Promise<PostRecord[]> {
  const tableName = process.env.POSTS_TABLE;

  if (!tableName) {
    throw new Error('POSTS_TABLE environment variable not set');
  }

  const response = await docClient.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :status',
      ExpressionAttributeValues: {
        ':status': 'STATUS#published',
      },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );

  return (response.Items as PostRecord[]) || [];
}

export async function updatePostStatus(
  postId: string,
  timestamp: string,
  status: PostRecord['status'],
  additionalFields?: Partial<PostRecord>,
): Promise<void> {
  const tableName = process.env.POSTS_TABLE;

  if (!tableName) {
    throw new Error('POSTS_TABLE environment variable not set');
  }

  const updateExpressions: string[] = ['#status = :status', 'gsi1pk = :gsi1pk'];
  const expressionAttributeNames: Record<string, string> = {
    '#status': 'status',
  };
  const expressionAttributeValues: Record<string, unknown> = {
    ':status': status,
    ':gsi1pk': `STATUS#${status}`,
  };

  if (additionalFields) {
    Object.entries(additionalFields).forEach(([key, value]) => {
      if (value !== undefined && key !== 'pk' && key !== 'sk') {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    });
  }

  await docClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        pk: `POST#${postId}`,
        sk: timestamp,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    }),
  );
}

// Config Table Operations
export async function getConfig<T extends BrandProfile | RSSFeedConfig>(
  configType: string,
): Promise<T | null> {
  const tableName = process.env.CONFIG_TABLE;

  if (!tableName) {
    throw new Error('CONFIG_TABLE environment variable not set');
  }

  const response = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: 'CONFIG',
        sk: configType,
      },
    }),
  );

  if (!response.Item) {
    return null;
  }

  return (response.Item as ConfigRecord).data as T;
}

export async function saveConfig<T extends BrandProfile | RSSFeedConfig>(
  configType: string,
  data: T,
): Promise<void> {
  const tableName = process.env.CONFIG_TABLE;

  if (!tableName) {
    throw new Error('CONFIG_TABLE environment variable not set');
  }

  const record: ConfigRecord = {
    pk: 'CONFIG',
    sk: configType,
    data,
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: record,
    }),
  );
}

export async function getBrandProfile(): Promise<BrandProfile | null> {
  return getConfig<BrandProfile>('BRAND_PROFILE');
}

export async function getRSSFeeds(): Promise<RSSFeedConfig | null> {
  return getConfig<RSSFeedConfig>('RSS_FEEDS');
}
