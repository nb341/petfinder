import { spawnSync, SpawnSyncReturns } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { defineFeature, loadFeature } from 'jest-cucumber';

const projectRoot = join(__dirname, '..');
const cdktn = join(projectRoot, '../../node_modules/.bin/cdktn');
const feature = loadFeature(join(projectRoot, 'features/infra-project.feature'));

defineFeature(feature, (test) => {
  test('Synthesize the infrastructure', ({ when, then, and }) => {
    const outDir = mkdtempSync(join(tmpdir(), 'cdktn-out-'));
    let stackJson: string;

    when(/^I synthesize the "(.*)" environment$/, (env: string) => {
      const result = spawnSync(cdktn, ['synth', '--output', outDir], {
        cwd: projectRoot,
        env: { ...process.env, INFRA_ENV: env },
        encoding: 'utf8'
      });
      expect(result.stderr).not.toMatch(/error/i);
      expect(result.status).toBe(0);
    });

    then(/^Terraform JSON is generated for the stack "(.*)"$/, (stack: string) => {
      stackJson = join(outDir, 'stacks', stack, 'cdk.tf.json');
      expect(existsSync(stackJson)).toBe(true);
    });

    and(/^it targets the "(.*)" provider version "(.*)"$/, (source: string, version: string) => {
      const tf = JSON.parse(readFileSync(stackJson, 'utf8'));
      expect(tf.terraform.required_providers.aws).toEqual({ source, version });
    });
  }, 120_000);

  test('Missing OpenTofu is reported clearly', ({ given, when, then }) => {
    let path: string;
    let result: SpawnSyncReturns<string>;

    given('OpenTofu is not installed', () => {
      // Keep only the directory holding `sh`, so the script runs but `tofu` can't be found.
      path = dirname(spawnSync('sh', ['-c', 'command -v sh'], { encoding: 'utf8' }).stdout.trim());
    });

    when('I run the OpenTofu preflight check', () => {
      result = spawnSync(join(projectRoot, 'scripts/require-tofu.sh'), { env: { PATH: path }, encoding: 'utf8' });
    });

    then('the command fails with a message to install OpenTofu', () => {
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('brew install opentofu');
    });
  });
});
