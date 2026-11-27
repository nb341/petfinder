import { Construct } from 'constructs';
import { TerraformStack } from 'cdktn';
import { localConfig } from '../local/config';
import { Environment, EnvironmentConfig, validateConfig, variables } from '../variables';
import { awsProvider } from './provider';
import { stateBackend } from './state-backend';

/** An AWS environment, or `local` for floci. */
export type StackEnvironment = Environment | 'local';

const AZ_SUFFIXES = ['a', 'b', 'c'];

/**
 * Shared conventions for every deployable stack: config, provider, account guard,
 * remote state, tags and naming. Holds no application resources.
 */
export abstract class BaseStack extends TerraformStack {
  protected readonly environment: StackEnvironment;
  protected readonly component: string;
  protected readonly config: EnvironmentConfig;

  constructor(scope: Construct, environment: StackEnvironment, component: string) {
    super(scope, `${environment}-${component}`);
    this.environment = environment;
    this.component = component;
    this.config = environment === 'local' ? localConfig : variables[environment];

    validateConfig(environment, this.config);
    awsProvider(this, this.config, environment, component);
    stateBackend(this, this.config, environment, component);
  }

  /** `<project>-<environment>[-<resource>]`. */
  protected resourceName(resource?: string): string {
    return [this.config.project, this.environment, resource].filter(Boolean).join('-');
  }

  protected availabilityZoneNames(): string[] {
    return AZ_SUFFIXES.slice(0, this.config.networking.availabilityZones).map((suffix) => `${this.config.region}${suffix}`);
  }
}
