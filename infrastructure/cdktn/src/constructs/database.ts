import { Construct } from 'constructs';
import { DbInstance } from '@cdktn/provider-aws/lib/db-instance';
import { DbSubnetGroup } from '@cdktn/provider-aws/lib/db-subnet-group';
import { DatabaseConfig } from '../config';

export interface DatabaseProps extends DatabaseConfig {
  readonly name: string;
  readonly subnetIds: string[];
  readonly securityGroupId: string;
}

export const DB_NAME = 'petfinder';

export class Database extends Construct {
  readonly instance: DbInstance;
  /** Secrets Manager secret holding {"username","password"}. */
  readonly secretArn: string;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);
    const identifier = `petfinder-${props.name}`;

    const subnetGroup = new DbSubnetGroup(this, 'subnets', {
      name: identifier,
      subnetIds: props.subnetIds,
      tags: { Name: identifier }
    });

    this.instance = new DbInstance(this, 'postgres', {
      identifier,
      engine: 'postgres',
      engineVersion: '17',
      instanceClass: props.instanceClass,
      allocatedStorage: props.allocatedStorage,
      storageType: 'gp3',
      storageEncrypted: true,
      dbName: DB_NAME,
      username: DB_NAME,
      // RDS generates the password and keeps it in Secrets Manager, so it never reaches code or state.
      manageMasterUserPassword: true,
      dbSubnetGroupName: subnetGroup.name,
      vpcSecurityGroupIds: [props.securityGroupId],
      publiclyAccessible: false,
      backupRetentionPeriod: props.backupRetentionDays,
      deletionProtection: props.deletionProtection,
      skipFinalSnapshot: !props.deletionProtection,
      finalSnapshotIdentifier: props.deletionProtection ? `${identifier}-final` : undefined,
      autoMinorVersionUpgrade: true,
      applyImmediately: !props.deletionProtection,
      tags: { Name: identifier }
    });

    this.secretArn = this.instance.masterUserSecret.get(0).secretArn;
  }
}
