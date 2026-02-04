import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { Post, DraftSummary } from '../../types';

const sesClient = new SESClient({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const POSTS_TABLE = process.env.POSTS_TABLE!;
const NOTIFICATION_EMAIL =
  process.env.NOTIFICATION_EMAIL || 'imjamesl@amazon.co.uk';
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'imjamesl@amazon.co.uk';
const API_BASE_URL =
  process.env.API_BASE_URL ||
  'https://nezhj4rzy6.execute-api.eu-west-2.amazonaws.com/dev';
const FRONTEND_URL =
  process.env.FRONTEND_URL || 'https://d21867san5nvx1.cloudfront.net';

interface DraftNotifierInput {
  batchId: string;
  drafts: Array<{
    postId: string;
    content: string;
    topic: string;
    hashtags: string[];
    qualityScore: number;
    qualityFeedback: string;
    sourceArticles: Array<{
      title: string;
      url: string;
      source: string;
    }>;
  }>;
}

export const handler = async (
  event: DraftNotifierInput,
): Promise<{ success: boolean; message: string }> => {
  console.log('Draft Notifier invoked:', JSON.stringify(event, null, 2));

  const { batchId, drafts } = event;

  try {
    // Save drafts to DynamoDB with PENDING_APPROVAL status and approval tokens
    const savedDrafts: DraftSummary[] = [];

    for (const draft of drafts) {
      const approvalToken = randomUUID();
      const now = new Date().toISOString();

      const post: Post = {
        postId: draft.postId,
        batchId,
        status: 'PENDING_APPROVAL',
        content: draft.content,
        topic: draft.topic,
        sourceArticles: draft.sourceArticles.map((s) => ({
          title: s.title,
          url: s.url,
          source: s.source,
          publishedAt: now,
        })),
        qualityScore: draft.qualityScore,
        qualityFeedback: draft.qualityFeedback,
        hashtags: draft.hashtags,
        createdAt: now,
        updatedAt: now,
        approvalToken,
        regenerationCount: 0,
      };

      // Save to DynamoDB
      await docClient.send(
        new PutCommand({
          TableName: POSTS_TABLE,
          Item: {
            pk: `POST#${draft.postId}`,
            sk: 'METADATA',
            gsi1pk: 'STATUS#PENDING_APPROVAL',
            gsi1sk: `${now}#${draft.postId}`,
            ...post,
          },
        }),
      );

      // Create draft summary for email (with full content)
      savedDrafts.push({
        postId: draft.postId,
        topic: draft.topic,
        contentPreview: draft.content, // Show full content, not truncated
        qualityScore: draft.qualityScore,
        approveUrl: `${API_BASE_URL}/drafts/${draft.postId}/approve?token=${approvalToken}`,
        editUrl: `${FRONTEND_URL}?postId=${draft.postId}&token=${approvalToken}`,
        rejectUrl: `${API_BASE_URL}/drafts/${draft.postId}/reject?token=${approvalToken}`,
      });
    }

    // Send email notification
    const emailHtml = generateEmailHtml(batchId, savedDrafts);
    const emailText = generateEmailText(batchId, savedDrafts);

    await sesClient.send(
      new SendEmailCommand({
        Source: SENDER_EMAIL,
        Destination: {
          ToAddresses: [NOTIFICATION_EMAIL],
        },
        Message: {
          Subject: {
            Data: `📝 ${drafts.length} LinkedIn Drafts Ready for Review`,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: emailHtml,
              Charset: 'UTF-8',
            },
            Text: {
              Data: emailText,
              Charset: 'UTF-8',
            },
          },
        },
      }),
    );

    console.log(
      `Email sent to ${NOTIFICATION_EMAIL} with ${drafts.length} drafts`,
    );

    return {
      success: true,
      message: `Notification sent for ${drafts.length} drafts`,
    };
  } catch (error) {
    console.error('Error in draft notifier:', error);
    throw error;
  }
};

function generateEmailHtml(batchId: string, drafts: DraftSummary[]): string {
  const draftCards = drafts
    .map(
      (draft, index) => `
    <div style="background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0; color: #0077b5;">Draft ${index + 1}: ${escapeHtml(draft.topic)}</h3>
        <span style="background: ${getScoreColor(draft.qualityScore)}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 14px;">
          ⭐ ${draft.qualityScore}/100
        </span>
      </div>
      
      <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 15px; font-family: Georgia, serif; line-height: 1.6;">
        ${escapeHtml(draft.contentPreview)}
      </div>
      
      <div style="display: flex; gap: 10px;">
        <a href="${draft.approveUrl}" style="background: #28a745; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          ✅ Approve & Publish
        </a>
        <a href="${draft.editUrl}" style="background: #0077b5; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          ✏️ Edit
        </a>
        <a href="${draft.rejectUrl}" style="background: #dc3545; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          ❌ Reject
        </a>
      </div>
    </div>
  `,
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; margin: 0;">
      <div style="max-width: 700px; margin: 0 auto;">
        <div style="background: #0077b5; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0;">📝 LinkedIn Drafts Ready</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">${drafts.length} posts generated and awaiting your review</p>
        </div>
        
        <div style="background: #ffffff; padding: 20px; border-radius: 0 0 8px 8px;">
          <p style="color: #666; margin-bottom: 20px;">
            The AI has generated ${drafts.length} LinkedIn post drafts based on trending topics in your areas of interest. 
            Review each draft below and choose to approve, edit, or reject.
          </p>
          
          ${draftCards}
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-top: 20px;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              <strong>💡 Tips:</strong><br>
              • Click "Approve & Publish" to immediately post to LinkedIn<br>
              • Click "Edit" to modify the content or provide feedback for regeneration<br>
              • Click "Reject" to discard and optionally regenerate with feedback
            </p>
          </div>
        </div>
        
        <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
          Batch ID: ${batchId}<br>
          Generated by LinkedIn Automation Tool
        </p>
      </div>
    </body>
    </html>
  `;
}

function generateEmailText(batchId: string, drafts: DraftSummary[]): string {
  const draftTexts = drafts
    .map(
      (draft, index) => `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DRAFT ${index + 1}: ${draft.topic}
Quality Score: ${draft.qualityScore}/100

${draft.contentPreview}

Actions:
✅ Approve: ${draft.approveUrl}
✏️ Edit: ${draft.editUrl}
❌ Reject: ${draft.rejectUrl}
`,
    )
    .join('\n');

  return `
📝 LINKEDIN DRAFTS READY FOR REVIEW
${drafts.length} posts generated and awaiting your review

${draftTexts}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Batch ID: ${batchId}
Generated by LinkedIn Automation Tool
`;
}

function getScoreColor(score: number): string {
  if (score >= 90) return '#28a745';
  if (score >= 80) return '#17a2b8';
  if (score >= 70) return '#ffc107';
  return '#dc3545';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}
