import { App } from 'cdktn';
import { envConfig } from './src/config';
import { PetfinderStack } from './src/stacks/petfinder-stack';

const app = new App();
new PetfinderStack(app, envConfig(process.env['INFRA_ENV']));
app.synth();
