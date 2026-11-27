import { Construct } from 'constructs';
import { Fn } from 'cdktn';
import { DefaultSecurityGroup } from '@cdktn/provider-aws/lib/default-security-group';
import { Eip } from '@cdktn/provider-aws/lib/eip';
import { InternetGateway } from '@cdktn/provider-aws/lib/internet-gateway';
import { NatGateway } from '@cdktn/provider-aws/lib/nat-gateway';
import { Route } from '@cdktn/provider-aws/lib/route';
import { RouteTable } from '@cdktn/provider-aws/lib/route-table';
import { RouteTableAssociation } from '@cdktn/provider-aws/lib/route-table-association';
import { SecurityGroup } from '@cdktn/provider-aws/lib/security-group';
import { Subnet } from '@cdktn/provider-aws/lib/subnet';
import { Vpc } from '@cdktn/provider-aws/lib/vpc';
import { VpcSecurityGroupEgressRule } from '@cdktn/provider-aws/lib/vpc-security-group-egress-rule';
import { VpcSecurityGroupIngressRule } from '@cdktn/provider-aws/lib/vpc-security-group-ingress-rule';

export interface NetworkModuleProps {
  /** `<project>-<environment>`; resources are named `<namePrefix>-<role>`. */
  readonly namePrefix: string;
  readonly cidr: string;
  readonly availabilityZones: readonly string[];
  /** One NAT gateway shared by all private subnets, for outbound internet. */
  readonly singleNatGateway: boolean;
  /** Port the database security group accepts from the app security group. */
  readonly databasePort: number;
  /** Ports the load balancer may reach on the api (app SG) and ui tasks. */
  readonly apiPort: number;
  readonly uiPort: number;
}

const PUBLIC_NETNUM = 0;
const PRIVATE_NETNUM = 10;

/** VPC with public and private subnets per AZ, routing, and the alb/app/ui/db security groups. */
export class NetworkModule extends Construct {
  readonly vpcId: string;
  readonly publicSubnetIds: string[];
  readonly privateSubnetIds: string[];
  readonly appSecurityGroupId: string;
  readonly uiSecurityGroupId: string;
  readonly albSecurityGroupId: string;
  readonly databaseSecurityGroupId: string;

  constructor(scope: Construct, id: string, props: NetworkModuleProps) {
    super(scope, id);
    const prefix = props.namePrefix;
    const tags = (name: string, extra: Record<string, string> = {}) => ({ Name: `${prefix}-${name}`, ...extra });

    const vpc = new Vpc(this, 'vpc', {
      cidrBlock: props.cidr,
      enableDnsSupport: true,
      enableDnsHostnames: true,
      tags: { Name: prefix }
    });

    // Managing the default SG with no rules strips its allow-all rules, so nothing gets access by accident.
    new DefaultSecurityGroup(this, 'default-sg', { vpcId: vpc.id, tags: tags('default-locked') });

    const igw = new InternetGateway(this, 'igw', { vpcId: vpc.id, tags: tags('igw') });
    const publicRoutes = new RouteTable(this, 'public-rt', { vpcId: vpc.id, tags: tags('public') });
    new Route(this, 'public-internet', {
      routeTableId: publicRoutes.id,
      destinationCidrBlock: '0.0.0.0/0',
      gatewayId: igw.id
    });

    const publicSubnets = props.availabilityZones.map((az, i) => {
      const subnet = new Subnet(this, `public-${az}`, {
        vpcId: vpc.id,
        availabilityZone: az,
        cidrBlock: Fn.cidrsubnet(props.cidr, 8, PUBLIC_NETNUM + i),
        mapPublicIpOnLaunch: false,
        tags: tags(`public-${az}`, { tier: 'public' })
      });
      new RouteTableAssociation(this, `public-${az}-rta`, { subnetId: subnet.id, routeTableId: publicRoutes.id });
      return subnet;
    });

    const nat =
      props.singleNatGateway
        ? new NatGateway(this, 'nat', {
            subnetId: publicSubnets[0].id,
            allocationId: new Eip(this, 'nat-eip', { domain: 'vpc', tags: tags('nat') }).allocationId,
            tags: tags('nat'),
            dependsOn: [igw]
          })
        : undefined;

    const privateSubnets = props.availabilityZones.map((az, i) => {
      const subnet = new Subnet(this, `private-${az}`, {
        vpcId: vpc.id,
        availabilityZone: az,
        cidrBlock: Fn.cidrsubnet(props.cidr, 8, PRIVATE_NETNUM + i),
        mapPublicIpOnLaunch: false,
        tags: tags(`private-${az}`, { tier: 'private' })
      });
      const routes = new RouteTable(this, `private-${az}-rt`, { vpcId: vpc.id, tags: tags(`private-${az}`) });
      new RouteTableAssociation(this, `private-${az}-rta`, { subnetId: subnet.id, routeTableId: routes.id });
      if (nat) {
        new Route(this, `private-${az}-nat`, {
          routeTableId: routes.id,
          destinationCidrBlock: '0.0.0.0/0',
          natGatewayId: nat.id
        });
      }
      return subnet;
    });

    // The description is force-new, so it stays as first written to keep this SG and its rules in place.
    const appSecurityGroup = new SecurityGroup(this, 'app-sg', {
      name: `${prefix}-app`,
      description: 'API compute. Ingress is added with the compute choice (#13).',
      vpcId: vpc.id,
      tags: tags('app')
    });
    new VpcSecurityGroupEgressRule(this, 'app-egress', {
      securityGroupId: appSecurityGroup.id,
      ipProtocol: '-1',
      cidrIpv4: '0.0.0.0/0',
      description: 'All outbound'
    });

    const uiSecurityGroup = new SecurityGroup(this, 'ui-sg', {
      name: `${prefix}-ui`,
      description: 'ui tasks. Only reachable from the load balancer.',
      vpcId: vpc.id,
      tags: tags('ui')
    });
    // Tasks pull their image from ECR and ship logs over HTTPS; without NAT they reach AWS through their public IP.
    new VpcSecurityGroupEgressRule(this, 'ui-egress-https', {
      securityGroupId: uiSecurityGroup.id,
      ipProtocol: 'tcp',
      fromPort: 443,
      toPort: 443,
      cidrIpv4: '0.0.0.0/0',
      description: 'HTTPS to AWS APIs and ECR'
    });

    const albSecurityGroup = new SecurityGroup(this, 'alb-sg', {
      name: `${prefix}-alb`,
      description: 'Load balancer. HTTP from the internet, forwards only to the api and ui tasks.',
      vpcId: vpc.id,
      tags: tags('alb')
    });
    new VpcSecurityGroupIngressRule(this, 'alb-http', {
      securityGroupId: albSecurityGroup.id,
      ipProtocol: 'tcp',
      fromPort: 80,
      toPort: 80,
      cidrIpv4: '0.0.0.0/0',
      description: 'HTTP from the internet'
    });
    const albTargets = [
      { id: 'api', group: appSecurityGroup, port: props.apiPort },
      { id: 'ui', group: uiSecurityGroup, port: props.uiPort }
    ];
    for (const target of albTargets) {
      new VpcSecurityGroupEgressRule(this, `alb-to-${target.id}`, {
        securityGroupId: albSecurityGroup.id,
        referencedSecurityGroupId: target.group.id,
        ipProtocol: 'tcp',
        fromPort: target.port,
        toPort: target.port,
        description: `Load balancer to ${target.id}`
      });
      new VpcSecurityGroupIngressRule(this, `${target.id}-from-alb`, {
        securityGroupId: target.group.id,
        referencedSecurityGroupId: albSecurityGroup.id,
        ipProtocol: 'tcp',
        fromPort: target.port,
        toPort: target.port,
        description: `${target.id} from load balancer`
      });
    }

    const dbSecurityGroup = new SecurityGroup(this, 'db-sg', {
      name: `${prefix}-db`,
      description: 'Database. Only reachable from the app security group.',
      vpcId: vpc.id,
      tags: tags('db')
    });
    new VpcSecurityGroupIngressRule(this, 'db-from-app', {
      securityGroupId: dbSecurityGroup.id,
      referencedSecurityGroupId: appSecurityGroup.id,
      ipProtocol: 'tcp',
      fromPort: props.databasePort,
      toPort: props.databasePort,
      description: 'Database from app'
    });

    this.vpcId = vpc.id;
    this.publicSubnetIds = publicSubnets.map((subnet) => subnet.id);
    this.privateSubnetIds = privateSubnets.map((subnet) => subnet.id);
    this.appSecurityGroupId = appSecurityGroup.id;
    this.uiSecurityGroupId = uiSecurityGroup.id;
    this.albSecurityGroupId = albSecurityGroup.id;
    this.databaseSecurityGroupId = dbSecurityGroup.id;
  }
}
