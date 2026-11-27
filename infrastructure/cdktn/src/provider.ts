import { join } from 'node:path';
import { LocalBackend, S3Backend, TerraformStack } from 'cdktn';
import { AwsProvider, AwsProviderEndpoints } from '@cdktn/provider-aws/lib/provider';
import { EnvConfig } from './config';

// floci needs an endpoint for every service the config touches, so add new services here first.
const FLOCI_SERVICES = [
  'apigatewayv2',
  'cloudfront',
  'ec2',
  'ecs',
  'elbv2',
  'iam',
  'lambda',
  'logs',
  'rds',
  's3',
  'secretsmanager',
  'sts'
] as const satisfies readonly (keyof AwsProviderEndpoints)[];

const STATE_DIR = join(__dirname, '../.state');

export function awsProvider(stack: TerraformStack, config: EnvConfig): AwsProvider {
  const defaultTags = [{ tags: { project: 'petfinder', env: config.name, 'managed-by': 'cdktn' } }];
  // The prebuilt bindings pin the exact version they were generated from; floci requires the ~> 6.0 range.
  stack.addOverride('terraform.required_providers.aws.version', '~> 6.0');

  if (config.target === 'floci') {
    return new AwsProvider(stack, 'aws', {
      region: config.region,
      accessKey: 'test',
      secretKey: 'test',
      skipCredentialsValidation: true,
      skipMetadataApiCheck: 'true',
      skipRequestingAccountId: true,
      s3UsePathStyle: true,
      endpoints: [Object.fromEntries(FLOCI_SERVICES.map((service) => [service, config.endpoint]))],
      defaultTags
    });
  }

  return new AwsProvider(stack, 'aws', {
    region: config.region,
    profile: config.profile,
    allowedAccountIds: [config.accountId],
    defaultTags
  });
}

export function localBackend(stack: TerraformStack, stateName: string): LocalBackend {
  // Relative paths resolve from cdktn.out/stacks/<stack>, so anchor state to the project root.
  return new LocalBackend(stack, { path: join(STATE_DIR, `${stateName}.tfstate`) });
}

export function stateBackend(stack: TerraformStack, config: EnvConfig): LocalBackend | S3Backend {
  if (config.target === 'floci') {
    return localBackend(stack, config.name);
  }
  return new S3Backend(stack, {
    bucket: config.stateBucket,
    key: `petfinder/${config.name}.tfstate`,
    region: config.region,
    profile: config.profile,
    encrypt: true,
    useLockfile: true
  });
}
