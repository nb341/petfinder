export const AWS_ENVS = ['dev', 'uat', 'staging', 'prod'] as const;
export const ENVS = ['local', ...AWS_ENVS] as const;

export type AwsEnvName = (typeof AWS_ENVS)[number];
export type EnvName = (typeof ENVS)[number];

interface BaseConfig {
  readonly region: string;
  readonly accountId: string;
  readonly stateBucket: string;
}

export interface FlociConfig extends BaseConfig {
  readonly name: 'local';
  readonly target: 'floci';
  readonly endpoint: string;
}

export interface AwsConfig extends BaseConfig {
  readonly name: AwsEnvName;
  readonly target: 'aws';
  readonly profile: string;
}

export type EnvConfig = FlociConfig | AwsConfig;

const REGION = 'us-east-1';
const FLOCI_ACCOUNT_ID = '000000000000';

const stateBucketFor = (accountId: string) => `petfinder-tfstate-${accountId}`;

export function envConfig(name: string | undefined, vars: NodeJS.ProcessEnv = process.env): EnvConfig {
  if (name === 'local') {
    return {
      name,
      target: 'floci',
      region: REGION,
      accountId: FLOCI_ACCOUNT_ID,
      stateBucket: stateBucketFor(FLOCI_ACCOUNT_ID),
      endpoint: 'http://localhost:4566'
    };
  }
  if (!AWS_ENVS.includes(name as AwsEnvName)) {
    throw new Error(`Unknown INFRA_ENV "${name}". Use one of: ${ENVS.join(', ')}`);
  }
  const accountId = vars['INFRA_AWS_ACCOUNT_ID'];
  if (!accountId) {
    throw new Error(`INFRA_AWS_ACCOUNT_ID is required for "${name}". Set it in the root .env file.`);
  }
  return {
    name: name as AwsEnvName,
    target: 'aws',
    region: REGION,
    accountId,
    stateBucket: vars['INFRA_STATE_BUCKET'] || stateBucketFor(accountId),
    profile: `petfinder-${name}`
  };
}
