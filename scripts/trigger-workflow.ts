/**
 * Trigger Workflow Script
 * Manually triggers the Step Functions workflow
 * Run: npm run trigger
 */

import {
  SFNClient,
  StartExecutionCommand,
  DescribeExecutionCommand,
} from '@aws-sdk/client-sfn';
import {
  CloudFormationClient,
  DescribeStacksCommand,
} from '@aws-sdk/client-cloudformation';

const REGION = process.env.AWS_REGION || 'us-east-1';
const STACK_NAME = process.env.STACK_NAME || 'linkedin-automation-dev';

const sfnClient = new SFNClient({ region: REGION });
const cfnClient = new CloudFormationClient({ region: REGION });

async function getStateMachineArn(): Promise<string> {
  const response = await cfnClient.send(
    new DescribeStacksCommand({
      StackName: STACK_NAME,
    }),
  );

  const stack = response.Stacks?.[0];
  if (!stack) {
    throw new Error(`Stack ${STACK_NAME} not found`);
  }

  const output = stack.Outputs?.find((o) => o.OutputKey === 'StateMachineArn');

  if (!output?.OutputValue) {
    throw new Error('StateMachineArn output not found in stack');
  }

  return output.OutputValue;
}

async function waitForExecution(
  executionArn: string,
  timeoutMs: number = 300000,
): Promise<void> {
  const startTime = Date.now();
  const pollInterval = 5000;

  console.log('\n⏳ Waiting for execution to complete...\n');

  while (Date.now() - startTime < timeoutMs) {
    const response = await sfnClient.send(
      new DescribeExecutionCommand({
        executionArn,
      }),
    );

    const status = response.status;
    console.log(`   Status: ${status}`);

    if (status === 'SUCCEEDED') {
      console.log('\n✅ Execution completed successfully!\n');

      if (response.output) {
        const output = JSON.parse(response.output);
        console.log('Output:');
        console.log(JSON.stringify(output, null, 2));
      }
      return;
    }

    if (status === 'FAILED' || status === 'TIMED_OUT' || status === 'ABORTED') {
      console.log(`\n❌ Execution ${status}\n`);

      if (response.error) {
        console.log('Error:', response.error);
      }
      if (response.cause) {
        console.log('Cause:', response.cause);
      }
      throw new Error(`Execution ${status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('Execution timed out');
}

async function main(): Promise<void> {
  console.log('\n🚀 LinkedIn Automation - Manual Trigger\n');

  try {
    // Get state machine ARN from CloudFormation
    console.log('⏳ Getting state machine ARN...');
    const stateMachineArn = await getStateMachineArn();
    console.log(`   ARN: ${stateMachineArn}\n`);

    // Start execution
    console.log('⏳ Starting execution...');
    const executionName = `manual-${Date.now()}`;

    const startResponse = await sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn,
        name: executionName,
        input: JSON.stringify({
          triggerTime: new Date().toISOString(),
          manual: true,
        }),
      }),
    );

    console.log(`   Execution ARN: ${startResponse.executionArn}`);
    console.log(`   Started at: ${startResponse.startDate?.toISOString()}`);

    // Wait for completion
    if (startResponse.executionArn) {
      await waitForExecution(startResponse.executionArn);
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
