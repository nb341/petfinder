import { EnvironmentConfig, variables } from '../variables';

const FLOCI_ACCOUNT_ID = '000000000000';

/** Settings for the `local` target: dev's shape, pointed at floci. */
export const localConfig: EnvironmentConfig = {
  ...variables.dev,
  accountId: FLOCI_ACCOUNT_ID,
  stateBucket: `petfinder-tfstate-${FLOCI_ACCOUNT_ID}`,
  target: { kind: 'floci', endpoint: 'http://localhost:4566' },
  networking: { ...variables.dev.networking, cidr: '10.0.0.0/16' },
  rds: { ...variables.dev.rds, backupRetentionDays: 0 }
};
