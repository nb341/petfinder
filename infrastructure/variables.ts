import { existsSync } from 'node:fs';
import { join } from 'node:path';

// The AWS account ID and an optional state bucket override live in the repo's root .env, not in git.
const rootEnv = join(__dirname, '../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export const ENVIRONMENTS = ['dev', 'uat', 'staging', 'prod'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

/** Where a config deploys: real AWS through a named profile, or floci on this machine. */
export type DeployTarget = { kind: 'aws'; profile: string } | { kind: 'floci'; endpoint: string };

export interface NetworkingConfig {
  cidr: string;
  /** Number of AZs to spread subnets across, taken in order (a, b, c). */
  availabilityZones: number;
  /** Provisions one NAT gateway so private subnets get outbound internet (about $33/month). */
  singleNatGateway: boolean;
}

export interface RdsConfig {
  engineVersion: string;
  instanceClass: string;
  allocatedStorage: number;
  storageType: string;
  multiAz: boolean;
  databaseName: string;
  masterUsername: string;
  port: number;
  backupRetentionDays: number;
  /** Also keeps a final snapshot on destroy. */
  deletionProtection: boolean;
}

/** A container the load balancer routes to. */
export interface ServiceConfig {
  /** Container port; 1024+ because the images run as non-root. */
  port: number;
  /** Path the load balancer polls; it must answer 200. */
  healthCheckPath: string;
}

export interface ServicesConfig {
  api: ServiceConfig;
  ui: ServiceConfig;
}

export interface LoadBalancerConfig {
  deletionProtection: boolean;
}

export interface EnvironmentConfig {
  project: string;
  owner: string;
  region: string;
  accountId: string;
  stateBucket: string;
  target: DeployTarget;
  networking: NetworkingConfig;
  rds: RdsConfig;
  services: ServicesConfig;
  loadBalancer: LoadBalancerConfig;
}

const accountId = process.env['INFRA_AWS_ACCOUNT_ID'] ?? '';
const stateBucket = process.env['INFRA_STATE_BUCKET'] || `petfinder-tfstate-${accountId}`;

const defaults = {
  project: 'petfinder',
  owner: 'platform',
  region: 'us-east-1',
  accountId,
  stateBucket,
  networking: {
    availabilityZones: 2,
    singleNatGateway: false
  },
  rds: {
    engineVersion: '17',
    instanceClass: 'db.t4g.micro',
    allocatedStorage: 20,
    storageType: 'gp3',
    multiAz: false,
    databaseName: 'petfinder',
    masterUsername: 'petfinder',
    port: 5432,
    backupRetentionDays: 1,
    deletionProtection: false
  },
  services: {
    api: { port: 3000, healthCheckPath: '/api' },
    ui: { port: 8080, healthCheckPath: '/healthz' }
  },
  loadBalancer: {
    deletionProtection: false
  }
} satisfies Omit<EnvironmentConfig, 'target' | 'networking'> & { networking: Omit<NetworkingConfig, 'cidr'> };

const awsProfile = (environment: Environment): DeployTarget => ({ kind: 'aws', profile: `petfinder-${environment}` });

// Spreads are shallow, so every nested section spreads its defaults explicitly.
export const variables: Record<Environment, EnvironmentConfig> = {
  dev: {
    ...defaults,
    target: awsProfile('dev'),
    networking: { ...defaults.networking, cidr: '10.10.0.0/16' },
    rds: { ...defaults.rds },
    services: { ...defaults.services },
    loadBalancer: { ...defaults.loadBalancer }
  },
  uat: {
    ...defaults,
    target: awsProfile('uat'),
    networking: { ...defaults.networking, cidr: '10.20.0.0/16' },
    rds: { ...defaults.rds },
    services: { ...defaults.services },
    loadBalancer: { ...defaults.loadBalancer }
  },
  staging: {
    ...defaults,
    target: awsProfile('staging'),
    networking: { ...defaults.networking, cidr: '10.30.0.0/16' },
    rds: { ...defaults.rds, instanceClass: 'db.t4g.small', backupRetentionDays: 7 },
    services: { ...defaults.services },
    loadBalancer: { ...defaults.loadBalancer }
  },
  prod: {
    ...defaults,
    target: awsProfile('prod'),
    networking: { ...defaults.networking, cidr: '10.40.0.0/16' },
    rds: { ...defaults.rds, instanceClass: 'db.t4g.small', backupRetentionDays: 7, deletionProtection: true },
    services: { ...defaults.services },
    loadBalancer: { ...defaults.loadBalancer, deletionProtection: true }
  }
};

export interface RegistryConfig {
  /** One ECR repository per app image, named `<project>/<name>`. */
  repositories: string[];
  /** Tagged images kept per repository; older ones expire. */
  keepImages: number;
  /** Lets destroy delete repositories that still hold images. */
  forceDelete: boolean;
}

// Shared by every environment: an image is built once and the same tag is promoted dev → prod.
export const registry: RegistryConfig = {
  repositories: ['api', 'ui'],
  keepImages: 30,
  forceDelete: false
};

/** Its profile creates the account's shared stacks: the state bucket and the registry. */
export const bootstrapEnvironment: Environment = 'dev';

export function isEnvironment(value: string): value is Environment {
  return (ENVIRONMENTS as readonly string[]).includes(value);
}

const CIDR = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/;

/** Returns [first, last] addresses of a CIDR as integers, or undefined if it isn't valid IPv4. */
export function cidrRange(cidr: string): [number, number] | undefined {
  const match = CIDR.exec(cidr);
  if (!match) return undefined;
  const octets = match.slice(1, 5).map(Number);
  const prefix = Number(match[5]);
  if (octets.some((o) => o > 255) || prefix > 32) return undefined;
  const address = octets.reduce((acc, o) => acc * 256 + o, 0);
  const size = 2 ** (32 - prefix);
  if (address % size !== 0) return undefined;
  return [address, address + size - 1];
}

/** Throws one error listing every problem, so a bad config fails before synthesis. */
export function validateConfig(environment: string, config: EnvironmentConfig): void {
  const errors: string[] = [];
  const { networking, rds, services } = config;

  if (!/^\d{12}$/.test(config.accountId)) {
    errors.push('accountId must be a 12-digit AWS account ID: set INFRA_AWS_ACCOUNT_ID in the root .env');
  }
  if (!config.stateBucket || config.stateBucket.endsWith('-')) errors.push('stateBucket is required');

  const prefix = Number(networking.cidr.split('/')[1]);
  if (!cidrRange(networking.cidr)) {
    errors.push(`networking.cidr "${networking.cidr}" is not a valid IPv4 CIDR block`);
  } else if (prefix < 16 || prefix > 20) {
    // Subnets are carved as /prefix+8 with netnums up to 11, which needs a /16–/20 VPC.
    errors.push(`networking.cidr must be a /16 to /20, got /${prefix}`);
  }
  if (!Number.isInteger(networking.availabilityZones) || networking.availabilityZones < 2 || networking.availabilityZones > 3) {
    errors.push('networking.availabilityZones must be 2 or 3 (RDS needs subnets in at least 2 AZs)');
  }

  if (!/^\d+(\.\d+)?$/.test(rds.engineVersion)) errors.push(`rds.engineVersion "${rds.engineVersion}" must look like "17" or "17.2"`);
  if (!Number.isInteger(rds.allocatedStorage) || rds.allocatedStorage < 20) errors.push('rds.allocatedStorage must be at least 20 GB');
  if (!Number.isInteger(rds.backupRetentionDays) || rds.backupRetentionDays < 0 || rds.backupRetentionDays > 35) {
    errors.push('rds.backupRetentionDays must be between 0 and 35');
  }
  if (!Number.isInteger(rds.port) || rds.port < 1150 || rds.port > 65535) errors.push('rds.port must be between 1150 and 65535');

  for (const name of ['api', 'ui'] as const) {
    const service = services[name];
    if (!Number.isInteger(service.port) || service.port < 1024 || service.port > 65535) {
      errors.push(`services.${name}.port must be between 1024 and 65535 (the containers run as non-root)`);
    }
    if (!service.healthCheckPath.startsWith('/')) errors.push(`services.${name}.healthCheckPath must start with "/"`);
  }
  if (services.api.port === services.ui.port) errors.push('services.api.port and services.ui.port must differ');

  if (environment === 'prod') {
    if (!rds.deletionProtection) errors.push('prod requires rds.deletionProtection');
    if (rds.backupRetentionDays < 7) errors.push('prod requires rds.backupRetentionDays of at least 7');
    if (!config.loadBalancer.deletionProtection) errors.push('prod requires loadBalancer.deletionProtection');
  }

  if (errors.length) {
    throw new Error(`Invalid configuration for "${environment}":\n  - ${errors.join('\n  - ')}`);
  }
}

/** Checks rules that span environments, such as non-overlapping VPC ranges for future peering. */
export function validateEnvironments(configs: Record<string, EnvironmentConfig>): void {
  const ranges = Object.entries(configs).map(([name, config]) => ({ name, range: cidrRange(config.networking.cidr) }));
  for (const [i, a] of ranges.entries()) {
    for (const b of ranges.slice(i + 1)) {
      if (a.range && b.range && a.range[0] <= b.range[1] && b.range[0] <= a.range[1]) {
        throw new Error(`networking.cidr of "${a.name}" overlaps "${b.name}"`);
      }
    }
  }
}

export function validateRegistry(config: RegistryConfig): void {
  const errors: string[] = [];
  if (!config.repositories.length) errors.push('registry needs at least one repository');
  config.repositories.forEach((name, i) => {
    if (config.repositories.indexOf(name) !== i) errors.push(`registry repository "${name}" is listed twice`);
    if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(name)) {
      errors.push(`registry repository "${name}" must be lowercase letters, digits and . _ - separators`);
    }
  });
  if (!Number.isInteger(config.keepImages) || config.keepImages < 1) errors.push('registry.keepImages must be a positive integer');

  if (errors.length) throw new Error(`Invalid registry configuration:\n  - ${errors.join('\n  - ')}`);
}
