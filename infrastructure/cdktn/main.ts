import { App } from 'cdktn';
import { envConfig } from './src/config';
import { BootstrapStack } from './src/stacks/bootstrap-stack';
import { PetfinderStack } from './src/stacks/petfinder-stack';

const app = new App();
const config = envConfig(process.env['INFRA_ENV']);
new PetfinderStack(app, config);
new BootstrapStack(app, config);
app.synth();
