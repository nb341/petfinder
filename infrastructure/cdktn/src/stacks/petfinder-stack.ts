import { Construct } from 'constructs';
import { TerraformStack } from 'cdktn';
import { EnvConfig } from '../config';
import { awsProvider, stateBackend } from '../provider';

export class PetfinderStack extends TerraformStack {
  constructor(scope: Construct, config: EnvConfig) {
    super(scope, `petfinder-${config.name}`);

    awsProvider(this, config);
    stateBackend(this, config);
  }
}
