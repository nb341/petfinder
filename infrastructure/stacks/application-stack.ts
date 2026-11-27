import { Construct } from 'constructs';
import { TerraformOutput } from 'cdktn';
import { LoadBalancerModule } from '../modules/load-balancer';
import { NetworkModule } from '../modules/networking';
import { RdsModule } from '../modules/rds';
import { BaseStack, StackEnvironment } from './base-stack';

/** The application's network, load balancer and database. ECS services (#13) join here. */
export class ApplicationStack extends BaseStack {
  constructor(scope: Construct, environment: StackEnvironment) {
    super(scope, environment, 'application');
    const { networking, rds, services, loadBalancer } = this.config;

    const network = new NetworkModule(this, 'network', {
      namePrefix: this.resourceName(),
      cidr: networking.cidr,
      availabilityZones: this.availabilityZoneNames(),
      singleNatGateway: networking.singleNatGateway,
      databasePort: rds.port,
      apiPort: services.api.port,
      uiPort: services.ui.port
    });

    const alb = new LoadBalancerModule(this, 'load-balancer', {
      namePrefix: this.resourceName(),
      vpcId: network.vpcId,
      subnetIds: network.publicSubnetIds,
      securityGroupIds: [network.albSecurityGroupId],
      deletionProtection: loadBalancer.deletionProtection,
      api: services.api,
      ui: services.ui
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
    new TerraformOutput(this, 'alb_security_group_id', { value: network.albSecurityGroupId });
    new TerraformOutput(this, 'ui_security_group_id', { value: network.uiSecurityGroupId });
    new TerraformOutput(this, 'alb_dns_name', { value: alb.dnsName });
    new TerraformOutput(this, 'api_target_group_arn', { value: alb.apiTargetGroupArn });
    new TerraformOutput(this, 'ui_target_group_arn', { value: alb.uiTargetGroupArn });
    new TerraformOutput(this, 'db_endpoint', { value: database.endpoint });
    new TerraformOutput(this, 'db_port', { value: database.port });
    new TerraformOutput(this, 'db_name', { value: rds.databaseName });
    new TerraformOutput(this, 'db_secret_arn', { value: database.secretArn });
  }
}
