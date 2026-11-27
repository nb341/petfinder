import { Construct } from 'constructs';
import { TerraformOutput, TerraformStack } from 'cdktn';
import { EnvConfig } from '../config';
import { Network } from '../constructs/network';
import { awsProvider, stateBackend } from '../provider';

export class PetfinderStack extends TerraformStack {
  constructor(scope: Construct, config: EnvConfig) {
    super(scope, `petfinder-${config.name}`);

    awsProvider(this, config);
    stateBackend(this, config);

    const network = new Network(this, 'network', { name: config.name, ...config.network });

    new TerraformOutput(this, 'vpc_id', { value: network.vpc.id });
    new TerraformOutput(this, 'public_subnet_ids', { value: network.publicSubnets.map((s) => s.id) });
    new TerraformOutput(this, 'private_subnet_ids', { value: network.privateSubnets.map((s) => s.id) });
    new TerraformOutput(this, 'app_security_group_id', { value: network.appSecurityGroup.id });
    new TerraformOutput(this, 'db_security_group_id', { value: network.dbSecurityGroup.id });
  }
}
