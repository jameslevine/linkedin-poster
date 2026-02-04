import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import axios from 'axios';
import { Post, LinkedInCredentials } from '../../types';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION,
});

const POSTS_TABLE = process.env.POSTS_TABLE!;
const SECRETS_ARN = process.env.SECRETS_ARN!;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  console.log('Draft Approval handler:', JSON.stringify(event, null, 2));

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const path = event.path;
    const method = event.httpMethod;

    // Route: GET /drafts - List pending drafts
    if (path === '/drafts' && method === 'GET') {
      return await listPendingDrafts();
    }

    // Route: GET /drafts/{postId} - Get single draft
    const getDraftMatch = path.match(/^\/drafts\/([^\/]+)$/);
    if (getDraftMatch && method === 'GET') {
      const postId = getDraftMatch[1];
      const token = event.queryStringParameters?.token;
      return await getDraft(postId, token);
    }

    // Route: POST /drafts/{postId}/approve - Approve and publish
    const approveMatch = path.match(/^\/drafts\/([^\/]+)\/approve$/);
    if (approveMatch && method === 'POST') {
      const postId = approveMatch[1];
      const token = event.queryStringParameters?.token;
      return await approveDraft(postId, token);
    }

    // Route: POST /drafts/{postId}/reject - Reject draft
    const rejectMatch = path.match(/^\/drafts\/([^\/]+)\/reject$/);
    if (rejectMatch && method === 'POST') {
      const postId = rejectMatch[1];
      const token = event.queryStringParameters?.token;
      const body = event.body ? JSON.parse(event.body) : {};
      return await rejectDraft(postId, token, body.feedback);
    }

    // Route: PUT /drafts/{postId} - Update draft content
    const updateMatch = path.match(/^\/drafts\/([^\/]+)$/);
    if (updateMatch && method === 'PUT') {
      const postId = updateMatch[1];
      const token = event.queryStringParameters?.token;
      const body = event.body ? JSON.parse(event.body) : {};
      return await updateDraft(postId, token, body.content);
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

async function listPendingDrafts(): Promise<APIGatewayProxyResult> {
  // Query for pending drafts using GSI
  const result = await docClient.send(
    new QueryCommand({
      TableName: POSTS_TABLE,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :status',
      ExpressionAttributeValues: {
        ':status': 'STATUS#PENDING_APPROVAL',
      },
    }),
  );

  const drafts = (result.Items || []).map((item) => ({
    postId: item.postId,
    content: item.content,
    topic: item.topic,
    hashtags: item.hashtags,
    qualityScore: item.qualityScore,
    createdAt: item.createdAt,
    approvalToken: item.approvalToken,
  }));

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ drafts }),
  };
}

async function getDraft(
  postId: string,
  token?: string,
): Promise<APIGatewayProxyResult> {
  const result = await docClient.send(
    new GetCommand({
      TableName: POSTS_TABLE,
      Key: { pk: `POST#${postId}`, sk: 'METADATA' },
    }),
  );

  if (!result.Item) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Draft not found' }),
    };
  }

  const post = result.Item as Post;

  // Validate token if provided
  if (token && post.approvalToken !== token) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid approval token' }),
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ draft: post }),
  };
}

async function approveDraft(
  postId: string,
  token?: string,
): Promise<APIGatewayProxyResult> {
  // Get the draft
  const result = await docClient.send(
    new GetCommand({
      TableName: POSTS_TABLE,
      Key: { pk: `POST#${postId}`, sk: 'METADATA' },
    }),
  );

  if (!result.Item) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Draft not found' }),
    };
  }

  const post = result.Item as Post;

  // Validate token
  if (token && post.approvalToken !== token) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid approval token' }),
    };
  }

  // Check status
  if (post.status !== 'PENDING_APPROVAL') {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: `Draft is not pending approval (status: ${post.status})`,
      }),
    };
  }

  try {
    // Publish to LinkedIn
    const linkedInResult = await publishToLinkedIn(post.content);

    // Update status to PUBLISHED
    const now = new Date().toISOString();
    await docClient.send(
      new UpdateCommand({
        TableName: POSTS_TABLE,
        Key: { pk: `POST#${postId}`, sk: 'METADATA' },
        UpdateExpression:
          'SET #status = :status, publishedAt = :publishedAt, linkedInPostId = :linkedInPostId, linkedInPostUrl = :linkedInPostUrl, updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': 'PUBLISHED',
          ':publishedAt': now,
          ':linkedInPostId': linkedInResult.postId,
          ':linkedInPostUrl': linkedInResult.postUrl,
          ':updatedAt': now,
        },
      }),
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Post published to LinkedIn!',
        linkedInPostUrl: linkedInResult.postUrl,
      }),
    };
  } catch (error) {
    console.error('Error publishing to LinkedIn:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to publish to LinkedIn' }),
    };
  }
}

async function rejectDraft(
  postId: string,
  token?: string,
  feedback?: string,
): Promise<APIGatewayProxyResult> {
  // Get the draft
  const result = await docClient.send(
    new GetCommand({
      TableName: POSTS_TABLE,
      Key: { pk: `POST#${postId}`, sk: 'METADATA' },
    }),
  );

  if (!result.Item) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Draft not found' }),
    };
  }

  const post = result.Item as Post;

  // Validate token
  if (token && post.approvalToken !== token) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid approval token' }),
    };
  }

  // Delete the draft
  await docClient.send(
    new DeleteCommand({
      TableName: POSTS_TABLE,
      Key: { pk: `POST#${postId}`, sk: 'METADATA' },
    }),
  );

  // If feedback provided, trigger regeneration (via Step Functions or direct Lambda invoke)
  if (feedback) {
    // Store feedback for learning
    console.log(`Feedback received for rejected draft: ${feedback}`);
    // TODO: Trigger regeneration with feedback
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      success: true,
      message: feedback
        ? 'Draft rejected. Regenerating with feedback...'
        : 'Draft rejected and deleted.',
    }),
  };
}

async function updateDraft(
  postId: string,
  token?: string,
  newContent?: string,
): Promise<APIGatewayProxyResult> {
  if (!newContent) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Content is required' }),
    };
  }

  // Get the draft
  const result = await docClient.send(
    new GetCommand({
      TableName: POSTS_TABLE,
      Key: { pk: `POST#${postId}`, sk: 'METADATA' },
    }),
  );

  if (!result.Item) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Draft not found' }),
    };
  }

  const post = result.Item as Post;

  // Validate token
  if (token && post.approvalToken !== token) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid approval token' }),
    };
  }

  // Update the content
  const now = new Date().toISOString();
  await docClient.send(
    new UpdateCommand({
      TableName: POSTS_TABLE,
      Key: { pk: `POST#${postId}`, sk: 'METADATA' },
      UpdateExpression: 'SET content = :content, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':content': newContent,
        ':updatedAt': now,
      },
    }),
  );

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      success: true,
      message: 'Draft updated successfully',
    }),
  };
}

async function publishToLinkedIn(
  content: string,
): Promise<{ postId: string; postUrl: string }> {
  // Get credentials from Secrets Manager
  const secretResponse = await secretsClient.send(
    new GetSecretValueCommand({
      SecretId: SECRETS_ARN,
    }),
  );

  const credentials: LinkedInCredentials = JSON.parse(
    secretResponse.SecretString || '{}',
  );

  if (!credentials.accessToken || !credentials.personUrn) {
    throw new Error('LinkedIn credentials not configured');
  }

  // Create LinkedIn post
  const response = await axios.post(
    'https://api.linkedin.com/v2/ugcPosts',
    {
      author: credentials.personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: content },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    },
    {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    },
  );

  const postId = response.headers['x-restli-id'] || response.data.id;
  const postUrl = `https://www.linkedin.com/feed/update/${postId}`;

  return { postId, postUrl };
}
