import { Construct } from 'constructs';
import { EcrLifecyclePolicy } from '@cdktn/provider-aws/lib/ecr-lifecycle-policy';
import { EcrRepository } from '@cdktn/provider-aws/lib/ecr-repository';

export interface ContainerRepositoryProps {
  /** For example `petfinder/api`. */
  readonly name: string;
  /** Tagged images kept; older ones expire. */
  readonly keepImages: number;
  /** Lets destroy delete the repository while it still holds images. */
  readonly forceDelete: boolean;
}

/** An ECR repository with immutable tags, scan on push, encryption and image expiry. */
export class ContainerRepository extends Construct {
  readonly arn: string;
  readonly url: string;

  constructor(scope: Construct, id: string, props: ContainerRepositoryProps) {
    super(scope, id);

    // Immutable tags mean a tag always names the same image, so promoting a tag between environments is safe.
    const repository = new EcrRepository(this, 'repository', {
      name: props.name,
      imageTagMutability: 'IMMUTABLE',
      imageScanningConfiguration: { scanOnPush: true },
      encryptionConfiguration: [{ encryptionType: 'AES256' }],
      forceDelete: props.forceDelete,
      tags: { Name: props.name }
    });

    new EcrLifecyclePolicy(this, 'lifecycle', {
      repository: repository.name,
      // ECR requires the `any` rule to have the highest priority number.
      policy: JSON.stringify({
        rules: [
          {
            rulePriority: 1,
            description: 'Expire untagged images after 1 day',
            selection: { tagStatus: 'untagged', countType: 'sinceImagePushed', countUnit: 'days', countNumber: 1 },
            action: { type: 'expire' }
          },
          {
            rulePriority: 2,
            description: `Keep the last ${props.keepImages} images`,
            selection: { tagStatus: 'any', countType: 'imageCountMoreThan', countNumber: props.keepImages },
            action: { type: 'expire' }
          }
        ]
      })
    });

    this.arn = repository.arn;
    this.url = repository.repositoryUrl;
  }
}
