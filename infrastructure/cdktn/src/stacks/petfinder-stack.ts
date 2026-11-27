import { join } from 'node:path';
import { Construct } from 'constructs';
import { LocalBackend, TerraformStack } from 'cdktn';
import { AwsProvider } from '@cdktn/provider-aws/lib/provider';
import { EnvConfig } from '../config';

export class PetfinderStack extends TerraformStack {
  constructor(scope: Construct, config: EnvConfig) {
    super(scope, `petfinder-${config.name}`);

    new AwsProvider(this, 'aws', { region: config.region });
    // The prebuilt bindings pin the exact version they were generated from; floci requires the ~> 6.0 range.
    this.addOverride('terraform.required_providers.aws.version', '~> 6.0');

    // Relative paths resolve from cdktn.out/stacks/<stack>, so anchor state to the project root.
    // dev/prod switch to the S3 backend in #8.
    new LocalBackend(this, { path: join(__dirname, '../../.state', `${config.name}.tfstate`) });
  }
}
