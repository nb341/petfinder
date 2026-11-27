import { TerraformStack } from 'cdktn';
import { AwsProvider } from '@cdktn/provider-aws/lib/provider';
import { flociProvider } from '../local/floci';
import { EnvironmentConfig } from '../variables';

/** The AWS provider with the account guard and standard tags. Shared by BaseStack and the bootstrap stack. */
export function awsProvider(stack: TerraformStack, config: EnvironmentConfig, environment: string, component: string): AwsProvider {
  const defaultTags = [
    {
      tags: {
        Project: config.project,
        Environment: environment,
        Component: component,
        ManagedBy: 'cdktn',
        Owner: config.owner
      }
    }
  ];
  // The prebuilt bindings pin the exact version they were generated from; widen to the supported range.
  stack.addOverride('terraform.required_providers.aws.version', '~> 6.0');

  if (config.target.kind === 'floci') {
    return flociProvider(stack, config.region, config.target.endpoint, defaultTags);
  }
  return new AwsProvider(stack, 'aws', {
    region: config.region,
    profile: config.target.profile,
    allowedAccountIds: [config.accountId],
    defaultTags
  });
}
