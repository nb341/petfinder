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
import { NetworkConfig } from '../config';

export interface NetworkProps extends NetworkConfig {
  readonly name: string;
}

const PUBLIC_NETNUM = 0;
const PRIVATE_NETNUM = 10;

export class Network extends Construct {
  readonly vpc: Vpc;
  readonly publicSubnets: Subnet[];
  readonly privateSubnets: Subnet[];
  readonly appSecurityGroup: SecurityGroup;
  readonly dbSecurityGroup: SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkProps) {
    super(scope, id);
    const prefix = `petfinder-${props.name}`;
    const tags = (name: string, extra: Record<string, string> = {}) => ({ Name: `${prefix}-${name}`, ...extra });

    this.vpc = new Vpc(this, 'vpc', {
      cidrBlock: props.cidr,
      enableDnsSupport: true,
      enableDnsHostnames: true,
      tags: { Name: prefix }
    });

    // Managing the default SG with no rules strips its allow-all rules, so nothing gets access by accident.
    new DefaultSecurityGroup(this, 'default-sg', { vpcId: this.vpc.id, tags: tags('default-locked') });

    const igw = new InternetGateway(this, 'igw', { vpcId: this.vpc.id, tags: tags('igw') });
    const publicRoutes = new RouteTable(this, 'public-rt', { vpcId: this.vpc.id, tags: tags('public') });
    new Route(this, 'public-internet', {
      routeTableId: publicRoutes.id,
      destinationCidrBlock: '0.0.0.0/0',
      gatewayId: igw.id
    });

    this.publicSubnets = props.azs.map((az, i) => {
      const subnet = new Subnet(this, `public-${az}`, {
        vpcId: this.vpc.id,
        availabilityZone: az,
        cidrBlock: Fn.cidrsubnet(props.cidr, 8, PUBLIC_NETNUM + i),
        mapPublicIpOnLaunch: false,
        tags: tags(`public-${az}`, { tier: 'public' })
      });
      new RouteTableAssociation(this, `public-${az}-rta`, { subnetId: subnet.id, routeTableId: publicRoutes.id });
      return subnet;
    });

    const nat =
      props.nat === 'single'
        ? new NatGateway(this, 'nat', {
            subnetId: this.publicSubnets[0].id,
            allocationId: new Eip(this, 'nat-eip', { domain: 'vpc', tags: tags('nat') }).allocationId,
            tags: tags('nat'),
            dependsOn: [igw]
          })
        : undefined;

    this.privateSubnets = props.azs.map((az, i) => {
      const subnet = new Subnet(this, `private-${az}`, {
        vpcId: this.vpc.id,
        availabilityZone: az,
        cidrBlock: Fn.cidrsubnet(props.cidr, 8, PRIVATE_NETNUM + i),
        mapPublicIpOnLaunch: false,
        tags: tags(`private-${az}`, { tier: 'private' })
      });
      const routes = new RouteTable(this, `private-${az}-rt`, { vpcId: this.vpc.id, tags: tags(`private-${az}`) });
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

    this.appSecurityGroup = new SecurityGroup(this, 'app-sg', {
      name: `${prefix}-app`,
      description: 'API compute. Ingress is added with the compute choice (#13).',
      vpcId: this.vpc.id,
      tags: tags('app')
    });
    new VpcSecurityGroupEgressRule(this, 'app-egress', {
      securityGroupId: this.appSecurityGroup.id,
      ipProtocol: '-1',
      cidrIpv4: '0.0.0.0/0',
      description: 'All outbound'
    });

    this.dbSecurityGroup = new SecurityGroup(this, 'db-sg', {
      name: `${prefix}-db`,
      description: 'Postgres. Only reachable from the app security group.',
      vpcId: this.vpc.id,
      tags: tags('db')
    });
    new VpcSecurityGroupIngressRule(this, 'db-from-app', {
      securityGroupId: this.dbSecurityGroup.id,
      referencedSecurityGroupId: this.appSecurityGroup.id,
      ipProtocol: 'tcp',
      fromPort: 5432,
      toPort: 5432,
      description: 'Postgres from app'
    });
  }
}
