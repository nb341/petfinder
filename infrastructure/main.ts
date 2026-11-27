import { App } from 'cdktn';
import { BootstrapStack } from './bootstrap';
import { localConfig } from './local/config';
import { ApplicationStack } from './stacks/application-stack';
import { StackEnvironment } from './stacks/base-stack';
import { bootstrapEnvironment, ENVIRONMENTS, isEnvironment, validateEnvironments, variables } from './variables';

// INFRA_ENV narrows synthesis to one environment, so `local` works without an AWS account ID.
const selected = process.env['INFRA_ENV'];
if (selected && selected !== 'local' && !isEnvironment(selected)) {
  throw new Error(`Unknown INFRA_ENV "${selected}". Use one of: ${[...ENVIRONMENTS, 'local'].join(', ')}`);
}
const environments: StackEnvironment[] = selected ? [selected as StackEnvironment] : [...ENVIRONMENTS, 'local'];

validateEnvironments(variables);

const app = new App();
for (const environment of environments) {
  new ApplicationStack(app, environment);
}
if (environments.some(isEnvironment)) new BootstrapStack(app, 'bootstrap', variables[bootstrapEnvironment]);
if (environments.includes('local')) new BootstrapStack(app, 'local-bootstrap', localConfig);
app.synth();
