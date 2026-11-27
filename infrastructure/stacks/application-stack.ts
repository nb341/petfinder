import { Construct } from 'constructs';
import { TerraformOutput } from 'cdktn';
import { NetworkModule } from '../modules/networking';
import { RdsModule } from '../modules/rds';
import { BaseStack, StackEnvironment } from './base-stack';

/** The application's network and database. Compute (#13) joins here. */
export class ApplicationStack extends BaseStack {
  constructor(scope: Construct, environment: StackEnvironment) {
    super(scope, environment, 'application');
    const { networking, rds } = this.config;

    const network = new NetworkModule(this, 'network', {
      namePrefix: this.resourceName(),
      cidr: networking.cidr,
      availabilityZones: this.availabilityZoneNames(),
      singleNatGateway: networking.singleNatGateway,
      databasePort: rds.port
    });

    const database = new RdsModule(this, 'database', {
      ...rds,
      identifier: this.resourceName('db'),
      subnetIds: network.privateSubnetIds,
      securityGroupIds: [network.databaseSecurityGroupId]
    });

    new TerraformOutput(this, 'vpc_id', { value: network.vpcId });
    new TerraformOutput(this, 'public_subnet_ids', { value: network.publicSubnetIds });
    new TerraformOutput(this, 'private_subnet_ids', { value: network.privateSubnetIds });
    new TerraformOutput(this, 'app_security_group_id', { value: network.appSecurityGroupId });
    new TerraformOutput(this, 'db_security_group_id', { value: network.databaseSecurityGroupId });
    new TerraformOutput(this, 'db_endpoint', { value: database.endpoint });
    new TerraformOutput(this, 'db_port', { value: database.port });
    new TerraformOutput(this, 'db_name', { value: rds.databaseName });
    new TerraformOutput(this, 'db_secret_arn', { value: database.secretArn });
  }
}
