/**
 * LinkedIn Publisher Lambda
 * Publishes posts to LinkedIn using the API
 */

import { Handler } from 'aws-lambda';
import * as https from 'https';
import { v4 as uuidv4 } from 'uuid';
import { getLinkedInCredentials } from '../../utils/secrets';
import { savePost } from '../../utils/dynamodb';
import { SourceArticle } from '../../types';

interface LinkedInPublisherInput {
  finalPost: string;
  research?: {
    topic: string;
    sources: SourceArticle[];
  };
}

interface PublishResult {
  postId: string;
  postUrl: string;
  publishedAt: string;
}

interface PostRecord {
  pk: string;
  sk: string;
  gsi1pk: string;
  gsi1sk: string;
  postId: string;
  content: string;
  topic: string;
  sources: SourceArticle[];
  linkedInPostId?: string;
  linkedInPostUrl?: string;
  status: string;
  createdAt: string;
  publishedAt?: string;
  error?: string;
}

interface LinkedInPostResponse {
  id: string;
}

async function publishToLinkedIn(
  accessToken: string,
  personUrn: string,
  postContent: string,
): Promise<LinkedInPostResponse> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: postContent,
          },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    });

    const options = {
      hostname: 'api.linkedin.com',
      path: '/v2/ugcPosts',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          // LinkedIn returns the post ID in the x-restli-id header
          const postId = res.headers['x-restli-id'] as string;
          resolve({ id: postId || data });
        } else {
          reject(new Error(`LinkedIn API error: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

export const handler: Handler<LinkedInPublisherInput> = async (event) => {
  console.log('LinkedIn Publisher starting...', JSON.stringify(event));

  const postId = uuidv4();
  const timestamp = new Date().toISOString();

  try {
    const { finalPost, research } = event;

    if (!finalPost) {
      throw new Error('Final post content is required');
    }

    // Get LinkedIn credentials
    const credentials = await getLinkedInCredentials();

    if (!credentials.accessToken) {
      throw new Error('No access token available. Please run OAuth setup.');
    }

    if (!credentials.personUrn) {
      throw new Error('No person URN available. Please run OAuth setup.');
    }

    // Check if token is expired
    if (credentials.expiresAt && credentials.expiresAt < Date.now()) {
      throw new Error(
        'Access token has expired. Please refresh or re-authorize.',
      );
    }

    console.log('Publishing to LinkedIn...');
    console.log('Post length:', finalPost.length, 'characters');

    // Publish to LinkedIn
    const linkedInResponse = await publishToLinkedIn(
      credentials.accessToken,
      credentials.personUrn,
      finalPost,
    );

    const linkedInPostId = linkedInResponse.id;
    const postUrl = `https://www.linkedin.com/feed/update/${linkedInPostId}`;

    console.log('Published successfully!');
    console.log('Post ID:', linkedInPostId);
    console.log('Post URL:', postUrl);

    // Save post record to DynamoDB
    const postRecord: PostRecord = {
      pk: `POST#${postId}`,
      sk: timestamp,
      gsi1pk: 'STATUS#published',
      gsi1sk: timestamp,
      postId,
      content: finalPost,
      topic: research?.topic || 'Unknown',
      sources: research?.sources || [],
      linkedInPostId,
      linkedInPostUrl: postUrl,
      status: 'published',
      createdAt: timestamp,
      publishedAt: timestamp,
    };

    await savePost(postRecord as unknown as Record<string, unknown>);
    console.log('Post record saved to DynamoDB');

    const result: PublishResult = {
      postId: linkedInPostId,
      postUrl,
      publishedAt: timestamp,
    };

    return result;
  } catch (error) {
    console.error('LinkedIn Publisher error:', error);

    // Save failed post record
    const postRecord: PostRecord = {
      pk: `POST#${postId}`,
      sk: timestamp,
      gsi1pk: 'STATUS#failed',
      gsi1sk: timestamp,
      postId,
      content: event.finalPost || '',
      topic: event.research?.topic || 'Unknown',
      sources: event.research?.sources || [],
      status: 'failed',
      createdAt: timestamp,
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    try {
      await savePost(postRecord as unknown as Record<string, unknown>);
    } catch (saveError) {
      console.error('Failed to save error record:', saveError);
    }

    throw error;
  }
};
