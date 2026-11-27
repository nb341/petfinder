import { Construct } from 'constructs';
import { TerraformStack } from 'cdktn';
import { S3Bucket } from '@cdktn/provider-aws/lib/s3-bucket';
import { S3BucketPolicy } from '@cdktn/provider-aws/lib/s3-bucket-policy';
import { S3BucketPublicAccessBlock } from '@cdktn/provider-aws/lib/s3-bucket-public-access-block';
import { S3BucketServerSideEncryptionConfigurationA } from '@cdktn/provider-aws/lib/s3-bucket-server-side-encryption-configuration';
import { S3BucketVersioningA } from '@cdktn/provider-aws/lib/s3-bucket-versioning';
import { EnvConfig } from '../config';
import { awsProvider, localBackend } from '../provider';

/** Creates the S3 state bucket. One per account, so every AWS env shares it. */
export class BootstrapStack extends TerraformStack {
  constructor(scope: Construct, config: EnvConfig) {
    super(scope, 'petfinder-bootstrap');

    awsProvider(this, config);
    // The bucket can't hold its own state, so bootstrap state stays local (git-ignored).
    localBackend(this, `bootstrap-${config.target}`);

    const bucket = new S3Bucket(this, 'state', {
      bucket: config.stateBucket,
      lifecycle: config.target === 'aws' ? { preventDestroy: true } : undefined
    });

    new S3BucketVersioningA(this, 'state-versioning', {
      bucket: bucket.id,
      versioningConfiguration: { status: 'Enabled' }
    });

    new S3BucketServerSideEncryptionConfigurationA(this, 'state-encryption', {
      bucket: bucket.id,
      rule: [{ applyServerSideEncryptionByDefault: { sseAlgorithm: 'AES256' } }]
    });

    new S3BucketPublicAccessBlock(this, 'state-public-access', {
      bucket: bucket.id,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true
    });

    new S3BucketPolicy(this, 'state-tls-only', {
      bucket: bucket.id,
      policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'DenyInsecureTransport',
            Effect: 'Deny',
            Principal: '*',
            Action: 's3:*',
            Resource: [bucket.arn, `${bucket.arn}/*`],
            Condition: { Bool: { 'aws:SecureTransport': 'false' } }
          }
        ]
      })
    });
  }
}
