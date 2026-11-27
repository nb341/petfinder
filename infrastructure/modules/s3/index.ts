import { Construct } from 'constructs';
import { S3Bucket } from '@cdktn/provider-aws/lib/s3-bucket';
import { S3BucketPolicy } from '@cdktn/provider-aws/lib/s3-bucket-policy';
import { S3BucketPublicAccessBlock } from '@cdktn/provider-aws/lib/s3-bucket-public-access-block';
import { S3BucketServerSideEncryptionConfigurationA } from '@cdktn/provider-aws/lib/s3-bucket-server-side-encryption-configuration';
import { S3BucketVersioningA } from '@cdktn/provider-aws/lib/s3-bucket-versioning';

export interface PrivateBucketProps {
  readonly name: string;
  readonly versioned?: boolean;
  readonly preventDestroy?: boolean;
}

/** A bucket with SSE, a full public access block and a TLS-only policy. */
export class PrivateBucket extends Construct {
  readonly bucket: S3Bucket;

  constructor(scope: Construct, id: string, props: PrivateBucketProps) {
    super(scope, id);

    this.bucket = new S3Bucket(this, 'bucket', {
      bucket: props.name,
      lifecycle: props.preventDestroy ? { preventDestroy: true } : undefined
    });

    if (props.versioned) {
      new S3BucketVersioningA(this, 'versioning', {
        bucket: this.bucket.id,
        versioningConfiguration: { status: 'Enabled' }
      });
    }

    new S3BucketServerSideEncryptionConfigurationA(this, 'encryption', {
      bucket: this.bucket.id,
      rule: [{ applyServerSideEncryptionByDefault: { sseAlgorithm: 'AES256' } }]
    });

    new S3BucketPublicAccessBlock(this, 'public-access', {
      bucket: this.bucket.id,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true
    });

    new S3BucketPolicy(this, 'tls-only', {
      bucket: this.bucket.id,
      policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'DenyInsecureTransport',
            Effect: 'Deny',
            Principal: '*',
            Action: 's3:*',
            Resource: [this.bucket.arn, `${this.bucket.arn}/*`],
            Condition: { Bool: { 'aws:SecureTransport': 'false' } }
          }
        ]
      })
    });
  }
}
