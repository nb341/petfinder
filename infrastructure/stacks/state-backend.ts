import { S3Backend, TerraformStack } from 'cdktn';
import { flociBackend } from '../local/floci';
import { EnvironmentConfig } from '../variables';

/**
 * Remote state for a deployable stack: `<scope>/<component>/terraform.tfstate` in the shared S3 bucket,
 * or a local file for floci. `scope` is the environment, or `shared` for account-wide stacks.
 */
export function stateBackend(stack: TerraformStack, config: EnvironmentConfig, scope: string, component: string): void {
  if (config.target.kind === 'floci') {
    flociBackend(stack, `${scope}-${component}`);
    return;
  }
  new S3Backend(stack, {
    bucket: config.stateBucket,
    key: `${scope}/${component}/terraform.tfstate`,
    region: config.region,
    profile: config.target.profile,
    encrypt: true,
    useLockfile: true
  });
}
