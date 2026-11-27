import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { localConfig, localRegistry } from '../local/config';
import { EnvironmentConfig, ENVIRONMENTS, registry, RegistryConfig, validateConfig, validateEnvironments, validateRegistry, variables } from '../variables';

const valid = (overrides: Partial<EnvironmentConfig> = {}): EnvironmentConfig => ({
  ...variables.dev,
  accountId: '123456789012',
  stateBucket: 'petfinder-tfstate-123456789012',
  ...overrides
});

const errorFor = (environment: string, config: EnvironmentConfig): string => {
  try {
    validateConfig(environment, config);
  } catch (error) {
    return (error as Error).message;
  }
  return '';
};

describe('defaults', () => {
  it('every environment shares the project conventions', () => {
    for (const environment of ENVIRONMENTS) {
      const config = variables[environment];
      assert.equal(config.project, 'petfinder');
      assert.equal(config.owner, 'platform');
      assert.equal(config.region, 'us-east-1');
      assert.equal(config.rds.engineVersion, '17');
      assert.equal(config.rds.port, 5432);
      assert.equal(config.networking.singleNatGateway, false);
    }
  });

  it('every AWS environment deploys with its own profile', () => {
    for (const environment of ENVIRONMENTS) {
      assert.deepEqual(variables[environment].target, { kind: 'aws', profile: `petfinder-${environment}` });
    }
  });

  it('nested overrides keep the remaining defaults', () => {
    assert.equal(variables.staging.rds.instanceClass, 'db.t4g.small');
    assert.equal(variables.staging.rds.storageType, 'gp3');
    assert.equal(variables.staging.networking.availabilityZones, 2);
  });
});

describe('environment overrides', () => {
  it('gives each environment its own VPC range', () => {
    assert.deepEqual(
      ENVIRONMENTS.map((environment) => variables[environment].networking.cidr),
      ['10.10.0.0/16', '10.20.0.0/16', '10.30.0.0/16', '10.40.0.0/16']
    );
  });

  it('protects prod', () => {
    assert.equal(variables.prod.rds.deletionProtection, true);
    assert.ok(variables.prod.rds.backupRetentionDays >= 7);
  });

  it('points local at floci', () => {
    assert.deepEqual(localConfig.target, { kind: 'floci', endpoint: 'http://localhost:4566' });
    assert.equal(localConfig.accountId, '000000000000');
  });
});

describe('validateConfig', () => {
  it('accepts every defined environment', () => {
    for (const environment of ENVIRONMENTS) {
      assert.doesNotThrow(() => validateConfig(environment, valid({ ...variables[environment], accountId: '123456789012', stateBucket: 'b' })));
    }
    assert.doesNotThrow(() => validateConfig('local', localConfig));
  });

  it('requires the account ID from .env', () => {
    assert.match(errorFor('dev', valid({ accountId: '' })), /INFRA_AWS_ACCOUNT_ID/);
  });

  it('rejects an invalid or wrongly sized CIDR', () => {
    const networking = (cidr: string) => valid({ networking: { ...variables.dev.networking, cidr } });
    assert.match(errorFor('dev', networking('10.10.0.0')), /not a valid IPv4 CIDR/);
    assert.match(errorFor('dev', networking('10.10.0.1/16')), /not a valid IPv4 CIDR/);
    assert.match(errorFor('dev', networking('10.0.0.0/24')), /\/16 to \/20/);
  });

  it('requires at least two availability zones', () => {
    assert.match(errorFor('dev', valid({ networking: { ...variables.dev.networking, availabilityZones: 1 } })), /availabilityZones/);
  });

  it('rejects impossible database settings', () => {
    const message = errorFor('dev', valid({ rds: { ...variables.dev.rds, allocatedStorage: 5, backupRetentionDays: 40, port: 80 } }));
    assert.match(message, /allocatedStorage/);
    assert.match(message, /backupRetentionDays/);
    assert.match(message, /rds\.port/);
  });

  it('refuses an unprotected prod', () => {
    const message = errorFor('prod', valid({ rds: { ...variables.prod.rds, deletionProtection: false, backupRetentionDays: 1 } }));
    assert.match(message, /prod requires rds\.deletionProtection/);
    assert.match(message, /at least 7/);
  });
});

describe('validateEnvironments', () => {
  it('accepts the defined environments', () => {
    assert.doesNotThrow(() => validateEnvironments(variables));
  });

  it('rejects overlapping VPC ranges', () => {
    const overlapping = { ...variables, uat: { ...variables.uat, networking: { ...variables.uat.networking, cidr: '10.10.0.0/20' } } };
    assert.throws(() => validateEnvironments(overlapping), /"dev" overlaps "uat"/);
  });
});

describe('registry', () => {
  const registryErrorFor = (config: RegistryConfig): string => {
    try {
      validateRegistry(config);
    } catch (error) {
      return (error as Error).message;
    }
    return '';
  };

  it('holds one repository per app image, shared by every environment', () => {
    assert.deepEqual(registry.repositories, ['api', 'ui']);
    assert.equal(registry.forceDelete, false);
    assert.ok(registry.keepImages > 0);
  });

  it('lets local repositories be destroyed with their images', () => {
    assert.equal(localRegistry.forceDelete, true);
    assert.deepEqual(localRegistry.repositories, registry.repositories);
  });

  it('accepts the defined registries', () => {
    assert.doesNotThrow(() => validateRegistry(registry));
    assert.doesNotThrow(() => validateRegistry(localRegistry));
  });

  it('rejects an empty, duplicated or invalid repository list', () => {
    assert.match(registryErrorFor({ ...registry, repositories: [] }), /at least one repository/);
    assert.match(registryErrorFor({ ...registry, repositories: ['api', 'api'] }), /"api" is listed twice/);
    assert.match(registryErrorFor({ ...registry, repositories: ['Api'] }), /"Api" must be lowercase/);
  });

  it('requires a positive number of images to keep', () => {
    assert.match(registryErrorFor({ ...registry, keepImages: 0 }), /keepImages/);
    assert.match(registryErrorFor({ ...registry, keepImages: 1.5 }), /keepImages/);
  });
});
