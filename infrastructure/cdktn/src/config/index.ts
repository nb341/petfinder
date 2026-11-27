export const AWS_ENVS = ['dev', 'uat', 'staging', 'prod'] as const;
export const ENVS = ['local', ...AWS_ENVS] as const;

export type AwsEnvName = (typeof AWS_ENVS)[number];
export type EnvName = (typeof ENVS)[number];

export interface NetworkConfig {
  readonly cidr: string;
  readonly azs: readonly [string, string];
  /** `single` adds one NAT gateway so private subnets can reach the internet (about $33/month on AWS). */
  readonly nat: 'none' | 'single';
}

export interface DatabaseConfig {
  readonly instanceClass: string;
  readonly allocatedStorage: number;
  readonly backupRetentionDays: number;
  /** Also keeps a final snapshot on destroy. */
  readonly deletionProtection: boolean;
}

interface BaseConfig {
  readonly region: string;
  readonly accountId: string;
  readonly stateBucket: string;
  readonly network: NetworkConfig;
  readonly database: DatabaseConfig;
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

const AZS = ['us-east-1a', 'us-east-1b'] as const;

// Distinct CIDRs per env so networks can be peered later without overlap.
const NETWORKS: Record<EnvName, NetworkConfig> = {
  local: { cidr: '10.0.0.0/16', azs: AZS, nat: 'none' },
  dev: { cidr: '10.10.0.0/16', azs: AZS, nat: 'none' },
  uat: { cidr: '10.20.0.0/16', azs: AZS, nat: 'none' },
  staging: { cidr: '10.30.0.0/16', azs: AZS, nat: 'none' },
  prod: { cidr: '10.40.0.0/16', azs: AZS, nat: 'none' }
};

const DATABASES: Record<EnvName, DatabaseConfig> = {
  local: { instanceClass: 'db.t4g.micro', allocatedStorage: 20, backupRetentionDays: 0, deletionProtection: false },
  dev: { instanceClass: 'db.t4g.micro', allocatedStorage: 20, backupRetentionDays: 1, deletionProtection: false },
  uat: { instanceClass: 'db.t4g.micro', allocatedStorage: 20, backupRetentionDays: 1, deletionProtection: false },
  staging: { instanceClass: 'db.t4g.small', allocatedStorage: 20, backupRetentionDays: 7, deletionProtection: false },
  prod: { instanceClass: 'db.t4g.small', allocatedStorage: 20, backupRetentionDays: 7, deletionProtection: true }
};

const stateBucketFor = (accountId: string) => `petfinder-tfstate-${accountId}`;

export function envConfig(name: string | undefined, vars: NodeJS.ProcessEnv = process.env): EnvConfig {
  if (name === 'local') {
    return {
      name,
      target: 'floci',
      region: REGION,
      accountId: FLOCI_ACCOUNT_ID,
      stateBucket: stateBucketFor(FLOCI_ACCOUNT_ID),
      network: NETWORKS.local,
      database: DATABASES.local,
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
    network: NETWORKS[name as AwsEnvName],
    database: DATABASES[name as AwsEnvName],
    profile: `petfinder-${name}`
  };
}
