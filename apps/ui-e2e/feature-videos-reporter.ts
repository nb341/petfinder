import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const slug = (s: string) =>
  s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

// Copies videos to <outputDir>/<feature>/<scenario> [<browser>].webm
export default class FeatureVideosReporter implements Reporter {
  private readonly outDir: string;

  constructor(options: { outputDir?: string } = {}) {
    this.outDir = options.outputDir ?? join(__dirname, '../../dist/feature-videos');
  }

  onBegin() {
    rmSync(this.outDir, { recursive: true, force: true });
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const video = result.attachments.find((a) => a.name === 'video' && a.path);
    if (!video?.path) return;

    // titlePath: ['', project, file, feature, (rule,) scenario]
    const [, project, , feature = 'unknown', ...rest] = test.titlePath();
    const scenario = rest.join(' - ') || test.title;
    const status = result.status === 'passed' ? '' : ` (${result.status})`;

    const dir = join(this.outDir, slug(feature));
    mkdirSync(dir, { recursive: true });
    copyFileSync(video.path, join(dir, `${slug(scenario)} [${project}]${status}.webm`));
  }

  onEnd() {
    console.log(`\nFeature videos: ${this.outDir}`);
  }
}
