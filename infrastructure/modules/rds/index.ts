import { Construct } from 'constructs';
import { DbInstance } from '@cdktn/provider-aws/lib/db-instance';
import { DbSubnetGroup } from '@cdktn/provider-aws/lib/db-subnet-group';

export interface RdsModuleProps {
  /** Instance identifier and subnet group name, e.g. `petfinder-dev-db`. */
  readonly identifier: string;
  readonly engineVersion: string;
  readonly instanceClass: string;
  readonly allocatedStorage: number;
  readonly storageType: string;
  readonly multiAz: boolean;
  readonly databaseName: string;
  readonly masterUsername: string;
  readonly port: number;
  readonly backupRetentionDays: number;
  /** Also keeps a final snapshot on destroy and defers changes to the maintenance window. */
  readonly deletionProtection: boolean;
  readonly subnetIds: string[];
  readonly securityGroupIds: string[];
}

/** Private, encrypted RDS Postgres whose master password RDS generates and keeps in Secrets Manager. */
export class RdsModule extends Construct {
  readonly arn: string;
  readonly endpoint: string;
  readonly port: number;
  /** Secrets Manager secret holding {"username","password"}. */
  readonly secretArn: string;

  constructor(scope: Construct, id: string, props: RdsModuleProps) {
    super(scope, id);

    const subnetGroup = new DbSubnetGroup(this, 'subnets', {
      name: props.identifier,
      subnetIds: props.subnetIds,
      tags: { Name: props.identifier }
    });

    const instance = new DbInstance(this, 'postgres', {
      identifier: props.identifier,
      engine: 'postgres',
      engineVersion: props.engineVersion,
      instanceClass: props.instanceClass,
      allocatedStorage: props.allocatedStorage,
      storageType: props.storageType,
      storageEncrypted: true,
      multiAz: props.multiAz,
      dbName: props.databaseName,
      username: props.masterUsername,
      port: props.port,
      // RDS generates the password and keeps it in Secrets Manager, so it never reaches code or state.
      manageMasterUserPassword: true,
      dbSubnetGroupName: subnetGroup.name,
      vpcSecurityGroupIds: props.securityGroupIds,
      publiclyAccessible: false,
      backupRetentionPeriod: props.backupRetentionDays,
      deletionProtection: props.deletionProtection,
      skipFinalSnapshot: !props.deletionProtection,
      finalSnapshotIdentifier: props.deletionProtection ? `${props.identifier}-final` : undefined,
      autoMinorVersionUpgrade: true,
      applyImmediately: !props.deletionProtection,
      tags: { Name: props.identifier }
    });

    this.arn = instance.arn;
    this.endpoint = instance.address;
    this.port = instance.port;
    this.secretArn = instance.masterUserSecret.get(0).secretArn;
  }
}
