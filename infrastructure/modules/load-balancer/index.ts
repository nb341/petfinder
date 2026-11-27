import { Construct } from 'constructs';
import { ITerraformDependable } from 'cdktn';
import { Lb } from '@cdktn/provider-aws/lib/lb';
import { LbListener } from '@cdktn/provider-aws/lib/lb-listener';
import { LbListenerRule } from '@cdktn/provider-aws/lib/lb-listener-rule';
import { LbTargetGroup } from '@cdktn/provider-aws/lib/lb-target-group';

export interface LoadBalancedService {
  readonly port: number;
  readonly healthCheckPath: string;
}

export interface LoadBalancerModuleProps {
  /** `<project>-<environment>`; ALB and target groups are named from it. */
  readonly namePrefix: string;
  readonly vpcId: string;
  readonly subnetIds: string[];
  readonly securityGroupIds: string[];
  readonly deletionProtection: boolean;
  readonly api: LoadBalancedService;
  readonly ui: LoadBalancedService;
}

/** Internet-facing ALB on HTTP :80. `/api` and `/api/*` go to the api, everything else to the ui. */
export class LoadBalancerModule extends Construct {
  readonly dnsName: string;
  readonly apiTargetGroupArn: string;
  readonly uiTargetGroupArn: string;
  /** Listener and rules; ECS services depend on them because a target group must be attached first. */
  readonly routing: ITerraformDependable[];

  constructor(scope: Construct, id: string, props: LoadBalancerModuleProps) {
    super(scope, id);
    const prefix = props.namePrefix;

    const alb = new Lb(this, 'alb', {
      name: prefix,
      loadBalancerType: 'application',
      internal: false,
      subnets: props.subnetIds,
      securityGroups: props.securityGroupIds,
      dropInvalidHeaderFields: true,
      enableDeletionProtection: props.deletionProtection,
      tags: { Name: prefix }
    });

    const targetGroup = (name: 'api' | 'ui', service: LoadBalancedService) =>
      new LbTargetGroup(this, `${name}-tg`, {
        name: `${prefix}-${name}`,
        // Fargate tasks register by IP (awsvpc networking), not by instance.
        targetType: 'ip',
        protocol: 'HTTP',
        port: service.port,
        vpcId: props.vpcId,
        deregistrationDelay: '30',
        healthCheck: {
          path: service.healthCheckPath,
          matcher: '200',
          interval: 15,
          healthyThreshold: 2,
          unhealthyThreshold: 3
        },
        tags: { Name: `${prefix}-${name}` }
      });

    const api = targetGroup('api', props.api);
    const ui = targetGroup('ui', props.ui);

    const http = new LbListener(this, 'http', {
      loadBalancerArn: alb.arn,
      port: 80,
      protocol: 'HTTP',
      defaultAction: [{ type: 'forward', targetGroupArn: ui.arn }]
    });

    const apiRoute = new LbListenerRule(this, 'api-route', {
      listenerArn: http.arn,
      priority: 10,
      condition: [{ pathPattern: { values: ['/api', '/api/*'] } }],
      action: [{ type: 'forward', targetGroupArn: api.arn }]
    });

    this.dnsName = alb.dnsName;
    this.apiTargetGroupArn = api.arn;
    this.uiTargetGroupArn = ui.arn;
    this.routing = [http, apiRoute];
  }
}
