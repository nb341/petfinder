import { Construct } from 'constructs';
import { TerraformOutput, TerraformStack } from 'cdktn';
import { ContainerRepository } from '../modules/ecr';
import { EnvironmentConfig, RegistryConfig, validateConfig, validateRegistry } from '../variables';
import { awsProvider } from './provider';
import { stateBackend } from './state-backend';

/**
 * The account's container registry, shared by every environment. Images are built once and
 * the same tag is promoted, so this stack isn't per environment.
 */
export class RegistryStack extends TerraformStack {
  constructor(scope: Construct, id: string, config: EnvironmentConfig, registry: RegistryConfig, stateScope: string) {
    super(scope, id);
    validateConfig(stateScope, config);
    validateRegistry(registry);
    awsProvider(this, config, 'shared', 'registry');
    stateBackend(this, config, stateScope, 'registry');

    for (const name of registry.repositories) {
      const repository = new ContainerRepository(this, name, {
        name: `${config.project}/${name}`,
        keepImages: registry.keepImages,
        forceDelete: registry.forceDelete
      });
      new TerraformOutput(this, `${name}_repository_url`, { value: repository.url });
    }
  }
}
