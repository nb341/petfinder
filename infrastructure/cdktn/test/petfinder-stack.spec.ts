import { setupJest } from 'cdktn/lib/testing/adapters/jest';
import { Testing } from 'cdktn';
import { AwsProvider } from '@cdktn/provider-aws/lib/provider';
import { envConfig } from '../src/config';
import { PetfinderStack } from '../src/stacks/petfinder-stack';

setupJest();

const synth = (env: string) => JSON.parse(Testing.synth(new PetfinderStack(Testing.app(), envConfig(env))));

describe('PetfinderStack', () => {
  it('pins the hashicorp/aws provider to ~> 6.0', () => {
    expect(synth('local').terraform.required_providers.aws.version).toBe('~> 6.0');
  });

  it('configures the AWS provider with the environment region', () => {
    const stack = new PetfinderStack(Testing.app(), envConfig('local'));
    expect(Testing.synth(stack)).toHaveProviderWithProperties(AwsProvider, { region: 'us-east-1' });
  });

  it('keeps local state in a git-ignored file', () => {
    expect(synth('local').terraform.backend.local.path).toMatch(/\.state\/local\.tfstate$/);
  });

  it.each(['local', 'dev', 'uat', 'staging', 'prod'])('synthesizes the %s environment', (env) => {
    expect(new PetfinderStack(Testing.app(), envConfig(env)).node.id).toBe(`petfinder-${env}`);
  });

  it('rejects an unknown environment', () => {
    expect(() => envConfig('qa')).toThrow(/Unknown INFRA_ENV "qa"/);
  });
});
