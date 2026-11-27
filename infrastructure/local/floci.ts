import { join } from 'node:path';
import { LocalBackend, TerraformStack } from 'cdktn';
import { AwsProvider, AwsProviderConfig, AwsProviderEndpoints } from '@cdktn/provider-aws/lib/provider';

// The only floci-aware code. floci needs an endpoint for every service the config touches.
const FLOCI_SERVICES = [
  'apigatewayv2',
  'cloudfront',
  'ec2',
  'ecr',
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

const STATE_DIR = join(__dirname, '.state');

export function flociProvider(stack: TerraformStack, region: string, endpoint: string, defaultTags: AwsProviderConfig['defaultTags']) {
  return new AwsProvider(stack, 'aws', {
    region,
    accessKey: 'test',
    secretKey: 'test',
    skipCredentialsValidation: true,
    skipMetadataApiCheck: 'true',
    skipRequestingAccountId: true,
    s3UsePathStyle: true,
    endpoints: [Object.fromEntries(FLOCI_SERVICES.map((service) => [service, endpoint]))],
    defaultTags
  });
}

export function flociBackend(stack: TerraformStack, stateName: string): LocalBackend {
  // Relative paths resolve from cdktn.out/stacks/<stack>, so anchor state to this folder.
  return new LocalBackend(stack, { path: join(STATE_DIR, `${stateName}.tfstate`) });
}
