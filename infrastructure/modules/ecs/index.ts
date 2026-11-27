import { Construct } from 'constructs';
import { Fn, ITerraformDependable } from 'cdktn';
import { CloudwatchLogGroup } from '@cdktn/provider-aws/lib/cloudwatch-log-group';
import { EcsCluster } from '@cdktn/provider-aws/lib/ecs-cluster';
import { EcsService } from '@cdktn/provider-aws/lib/ecs-service';
import { EcsTaskDefinition } from '@cdktn/provider-aws/lib/ecs-task-definition';
import { IamRole } from '@cdktn/provider-aws/lib/iam-role';
import { IamRolePolicy } from '@cdktn/provider-aws/lib/iam-role-policy';
import { IamRolePolicyAttachment } from '@cdktn/provider-aws/lib/iam-role-policy-attachment';

const TASKS_ASSUME_ROLE = JSON.stringify({
  Version: '2012-10-17',
  Statement: [{ Effect: 'Allow', Principal: { Service: 'ecs-tasks.amazonaws.com' }, Action: 'sts:AssumeRole' }]
});

/** An ECS cluster for Fargate services. */
export class EcsClusterModule extends Construct {
  readonly arn: string;
  readonly name: string;

  constructor(scope: Construct, id: string, props: { readonly name: string }) {
    super(scope, id);
    // Container Insights is billed per metric, so it stays off until there's a need for it.
    const cluster = new EcsCluster(this, 'cluster', {
      name: props.name,
      setting: [{ name: 'containerInsights', value: 'disabled' }],
      tags: { Name: props.name }
    });
    this.arn = cluster.arn;
    this.name = cluster.name;
  }
}

export interface ContainerSecret {
  /** Environment variable the container sees. */
  readonly name: string;
  /** Secrets Manager ARN, optionally with `:<json key>::` to pick one field. */
  readonly valueFrom: string;
  /** The secret's ARN, which the execution role is allowed to read. */
  readonly secretArn: string;
}

export interface FargateServiceProps {
  /** For example `petfinder-dev-api`: names the service, task family, roles and log group. */
  readonly name: string;
  readonly clusterArn: string;
  readonly region: string;
  readonly image: string;
  readonly cpu: number;
  readonly memory: number;
  readonly desiredCount: number;
  readonly containerPort: number;
  readonly environment: Record<string, string>;
  readonly secrets?: ContainerSecret[];
  readonly subnetIds: string[];
  readonly securityGroupIds: string[];
  readonly targetGroupArn: string;
  readonly logRetentionDays: number;
  /** The listener (and rules) that forward to the target group; ECS can't register into an unattached group. */
  readonly dependsOn: ITerraformDependable[];
}

/**
 * One container on Fargate (ARM64) behind a target group, with its own log group, an execution
 * role that can pull the image, write logs and read only its secrets, and an empty task role.
 */
export class FargateService extends Construct {
  readonly serviceName: string;

  constructor(scope: Construct, id: string, props: FargateServiceProps) {
    super(scope, id);
    const secrets = props.secrets ?? [];

    const logGroup = new CloudwatchLogGroup(this, 'logs', {
      name: `/ecs/${props.name}`,
      retentionInDays: props.logRetentionDays
    });

    const executionRole = new IamRole(this, 'execution-role', {
      name: `${props.name}-execution`,
      assumeRolePolicy: TASKS_ASSUME_ROLE
    });
    new IamRolePolicyAttachment(this, 'execution-policy', {
      role: executionRole.name,
      policyArn: 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'
    });
    if (secrets.length) {
      new IamRolePolicy(this, 'read-secrets', {
        role: executionRole.id,
        policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Action: 'secretsmanager:GetSecretValue',
              Resource: [...new Set(secrets.map((secret) => secret.secretArn))]
            }
          ]
        })
      });
    }

    // What the app itself may call in AWS: nothing yet.
    const taskRole = new IamRole(this, 'task-role', {
      name: `${props.name}-task`,
      assumeRolePolicy: TASKS_ASSUME_ROLE
    });

    const taskDefinition = new EcsTaskDefinition(this, 'task', {
      family: props.name,
      requiresCompatibilities: ['FARGATE'],
      networkMode: 'awsvpc',
      cpu: String(props.cpu),
      memory: String(props.memory),
      runtimePlatform: { operatingSystemFamily: 'LINUX', cpuArchitecture: 'ARM64' },
      executionRoleArn: executionRole.arn,
      taskRoleArn: taskRole.arn,
      containerDefinitions: Fn.jsonencode([
        {
          name: props.name,
          image: props.image,
          essential: true,
          portMappings: [{ containerPort: props.containerPort, protocol: 'tcp' }],
          environment: Object.entries(props.environment).map(([name, value]) => ({ name, value })),
          secrets: secrets.map(({ name, valueFrom }) => ({ name, valueFrom })),
          logConfiguration: {
            logDriver: 'awslogs',
            options: {
              'awslogs-group': logGroup.name,
              'awslogs-region': props.region,
              'awslogs-stream-prefix': 'ecs'
            }
          }
        }
      ])
    });

    const service = new EcsService(this, 'service', {
      name: props.name,
      cluster: props.clusterArn,
      taskDefinition: taskDefinition.arn,
      desiredCount: props.desiredCount,
      launchType: 'FARGATE',
      // No NAT: tasks reach ECR, Secrets Manager and CloudWatch through a public IP. Their SGs only admit the ALB.
      networkConfiguration: {
        subnets: props.subnetIds,
        securityGroups: props.securityGroupIds,
        assignPublicIp: true
      },
      loadBalancer: [{ targetGroupArn: props.targetGroupArn, containerName: props.name, containerPort: props.containerPort }],
      healthCheckGracePeriodSeconds: 60,
      deploymentCircuitBreaker: { enable: true, rollback: true },
      propagateTags: 'SERVICE',
      dependsOn: props.dependsOn
    });

    this.serviceName = service.name;
  }
}
