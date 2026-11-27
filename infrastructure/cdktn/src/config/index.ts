export type EnvName = 'local' | 'dev' | 'uat' | 'staging' | 'prod';

export interface EnvConfig {
  readonly name: EnvName;
  readonly region: string;
}

const configs: Record<EnvName, EnvConfig> = {
  local: { name: 'local', region: 'us-east-1' },
  dev: { name: 'dev', region: 'us-east-1' },
  uat: { name: 'uat', region: 'us-east-1' },
  staging: { name: 'staging', region: 'us-east-1' },
  prod: { name: 'prod', region: 'us-east-1' }
};

export function envConfig(name: string | undefined): EnvConfig {
  if (!name || !(name in configs)) {
    throw new Error(`Unknown INFRA_ENV "${name}". Use one of: ${Object.keys(configs).join(', ')}`);
  }
  return configs[name as EnvName];
}
