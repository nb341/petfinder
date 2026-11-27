import { join } from 'node:path';
import { Construct } from 'constructs';
import { LocalBackend, TerraformStack } from 'cdktn';
import { flociBackend } from '../local/floci';
import { PrivateBucket } from '../modules/s3';
import { awsProvider } from '../stacks/provider';
import { EnvironmentConfig } from '../variables';

/**
 * The S3 state bucket every stack's backend uses, one per account. Deployed on its own before
 * anything else, so its own state stays in a local file (git-ignored; back it up).
 */
export class BootstrapStack extends TerraformStack {
  constructor(scope: Construct, id: string, config: EnvironmentConfig) {
    super(scope, id);
    awsProvider(this, config, 'shared', 'bootstrap');

    if (config.target.kind === 'floci') {
      flociBackend(this, id);
    } else {
      new LocalBackend(this, { path: join(__dirname, '.state', 'terraform.tfstate') });
    }

    new PrivateBucket(this, 'state', {
      name: config.stateBucket,
      versioned: true,
      preventDestroy: config.target.kind === 'aws'
    });
  }
}
