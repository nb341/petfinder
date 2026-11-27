import { Construct } from 'constructs';
import { TerraformOutput } from 'cdktn';
import { EcsClusterModule, FargateService } from '../modules/ecs';
import { LoadBalancerModule } from '../modules/load-balancer';
import { NetworkModule } from '../modules/networking';
import { RdsModule } from '../modules/rds';
import { BaseStack, StackEnvironment } from './base-stack';

// Baked into the api image (see the root Dockerfile); RDS certificates chain to Amazon's own roots.
const RDS_CA_BUNDLE = '/etc/ssl/certs/rds-global-bundle.pem';

/** The application: network, load balancer, database, and the api and ui on ECS Fargate. */
export class ApplicationStack extends BaseStack {
  constructor(scope: Construct, environment: StackEnvironment) {
    super(scope, environment, 'application');
    const { networking, rds, services, loadBalancer, ecs } = this.config;

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

    const cluster = new EcsClusterModule(this, 'cluster', { name: this.resourceName() });
    const image = (app: string) =>
      `${this.config.accountId}.dkr.ecr.${this.config.region}.amazonaws.com/${this.config.project}/${app}:${ecs.imageTag}`;
    const common = {
      clusterArn: cluster.arn,
      region: this.config.region,
      subnetIds: network.publicSubnetIds,
      logRetentionDays: ecs.logRetentionDays,
      dependsOn: alb.routing
    };

    const api = new FargateService(this, 'api', {
      ...common,
      name: this.resourceName('api'),
      image: image('api'),
      cpu: services.api.cpu,
      memory: services.api.memory,
      desiredCount: services.api.desiredCount,
      containerPort: services.api.port,
      securityGroupIds: [network.appSecurityGroupId],
      targetGroupArn: alb.apiTargetGroupArn,
      environment: {
        NODE_ENV: 'production',
        PORT: String(services.api.port),
        DB_HOST: database.endpoint,
        DB_PORT: String(rds.port),
        DB_NAME: rds.databaseName,
        DB_SSL: 'true',
        DB_SSL_CA: RDS_CA_BUNDLE,
        DB_RUN_MIGRATIONS: String(ecs.runMigrations)
      },
      secrets: [
        { name: 'DB_USERNAME', valueFrom: `${database.secretArn}:username::`, secretArn: database.secretArn },
        { name: 'DB_PASSWORD', valueFrom: `${database.secretArn}:password::`, secretArn: database.secretArn }
      ]
    });

    const ui = new FargateService(this, 'ui', {
      ...common,
      name: this.resourceName('ui'),
      image: image('ui'),
      cpu: services.ui.cpu,
      memory: services.ui.memory,
      desiredCount: services.ui.desiredCount,
      containerPort: services.ui.port,
      securityGroupIds: [network.uiSecurityGroupId],
      targetGroupArn: alb.uiTargetGroupArn,
      environment: {}
    });

    new TerraformOutput(this, 'vpc_id', { value: network.vpcId });
    new TerraformOutput(this, 'public_subnet_ids', { value: network.publicSubnetIds });
    new TerraformOutput(this, 'private_subnet_ids', { value: network.privateSubnetIds });
    new TerraformOutput(this, 'app_security_group_id', { value: network.appSecurityGroupId });
    new TerraformOutput(this, 'db_security_group_id', { value: network.databaseSecurityGroupId });
    new TerraformOutput(this, 'alb_security_group_id', { value: network.albSecurityGroupId });
    new TerraformOutput(this, 'ui_security_group_id', { value: network.uiSecurityGroupId });
    new TerraformOutput(this, 'alb_dns_name', { value: alb.dnsName });
    new TerraformOutput(this, 'app_url', { value: `http://${alb.dnsName}` });
    new TerraformOutput(this, 'ecs_cluster_name', { value: cluster.name });
    new TerraformOutput(this, 'api_service_name', { value: api.serviceName });
    new TerraformOutput(this, 'ui_service_name', { value: ui.serviceName });
    new TerraformOutput(this, 'api_target_group_arn', { value: alb.apiTargetGroupArn });
    new TerraformOutput(this, 'ui_target_group_arn', { value: alb.uiTargetGroupArn });
    new TerraformOutput(this, 'db_endpoint', { value: database.endpoint });
    new TerraformOutput(this, 'db_port', { value: database.port });
    new TerraformOutput(this, 'db_name', { value: rds.databaseName });
    new TerraformOutput(this, 'db_secret_arn', { value: database.secretArn });
  }
}
