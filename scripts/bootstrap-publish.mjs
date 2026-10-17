#!/usr/bin/env node
/**
 * Registers libraries that have never been published, so release.yml can
 * publish their first real version. RELEASING.md § 2 is the procedure.
 *
 *   node scripts/bootstrap-publish.mjs <otp> <project> [<project> ...]
 *
 * `<project>` is the folder under `libs/`, the same name a commit scope uses.
 *
 * npm accepts a trusted publisher only for a package that exists. For each
 * project this publishes a code-free placeholder at 0.0.0 under the dist-tag
 * `bootstrap`, adds release.yml as the package's trusted publisher, and
 * deprecates the placeholder. The real version then comes from release.yml with
 * provenance, like every version after it.
 *
 * All three steps take the same one-time password, so one code covers a
 * package and usually a few. A step already done is skipped, and a package that
 * fails is listed at the end with the command that retries it.
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const PLACEHOLDER = '0.0.0';
const REPOSITORY = 'Evanion/libraries';
const WORKFLOW = 'release.yml';

const [otp, ...projects] = process.argv.slice(2);

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

if (!otp || projects.length === 0) {
  fail(
    'Usage: node scripts/bootstrap-publish.mjs <otp> <project> [<project> ...]',
  );
}
if (!/^\d{6}$/.test(otp)) fail(`The OTP is six digits; got "${otp}".`);

const npm = (args, cwd = ROOT) =>
  execFileSync('npm', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();

/** Whether `spec` resolves on the registry. Throws on anything but a 404. */
function onRegistry(spec) {
  try {
    return npm(['view', spec, 'version']) !== '';
  } catch (error) {
    if (/E404/.test(String(error.stderr))) return false;
    throw error;
  }
}

/** The package name for `project`, or why it cannot be bootstrapped. */
function packageName(project) {
  const path = join(ROOT, 'libs', project, 'package.json');
  if (!existsSync(path)) {
    return { reason: `libs/${project}/package.json does not exist` };
  }

  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  if (manifest.private) return { reason: `${manifest.name} is private` };

  // release.yml tags `{projectName}@{version}` and the project name is the
  // package name, so a folder that does not match releases under another name.
  if (manifest.name !== `@evanion/${project}`) {
    return {
      reason: `libs/${project} holds ${manifest.name}; the folder and the name must match`,
    };
  }
  return { name: manifest.name };
}

/**
 * Publishes the placeholder from a directory holding only its manifest, and
 * says whether this call published it.
 *
 * `npm view` answers 404 for minutes after a new package's first publish, so a
 * rerun can reach here for a placeholder the registry already holds. npm then
 * refuses the publish with "cannot publish over the previously published
 * versions", and that refusal means the placeholder is there.
 */
function publishPlaceholder(name) {
  const dir = mkdtempSync(join(tmpdir(), 'bootstrap-publish-'));
  try {
    const manifest = {
      name,
      version: PLACEHOLDER,
      description: 'Placeholder. Install a released version.',
      license: 'MIT',
      repository: {
        type: 'git',
        url: `git+https://github.com/${REPOSITORY}.git`,
      },
    };
    writeFileSync(
      join(dir, 'package.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );

    // --no-provenance: provenance needs a CI provider. --otp: npm's browser
    // flow redacts its URL whenever stdout is not a TTY.
    npm(
      [
        'publish',
        '--access',
        'public',
        '--no-provenance',
        '--tag',
        'bootstrap',
        `--otp=${otp}`,
      ],
      dir,
    );
    return true;
  } catch (error) {
    if (
      /cannot publish over the previously published/.test(String(error.stderr))
    ) {
      return false;
    }
    throw error;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Whether release.yml in this repository already publishes `name`. */
function trusted(name) {
  const listed = npm(['trust', 'list', name, `--otp=${otp}`]);
  return listed.includes(REPOSITORY) && listed.includes(WORKFLOW);
}

try {
  console.log(`npm user: ${npm(['whoami'])}`);
} catch {
  fail('npm has no login. Run `npm login` first.');
}

const failed = [];

for (const project of projects) {
  const { name, reason } = packageName(project);
  if (reason) {
    console.error(`\n${project}: ${reason}.`);
    failed.push(project);
    continue;
  }

  console.log(`\n${name}`);
  try {
    if (onRegistry(`${name}@${PLACEHOLDER}`)) {
      console.log(`  ${PLACEHOLDER} is already published`);
    } else if (onRegistry(name)) {
      throw new Error(
        'it has versions on the registry already; release.yml releases it',
      );
    } else if (publishPlaceholder(name)) {
      console.log(`  published ${PLACEHOLDER} under the dist-tag bootstrap`);
    } else {
      console.log(`  ${PLACEHOLDER} is already published`);
    }

    if (trusted(name)) {
      console.log(`  ${WORKFLOW} in ${REPOSITORY} already publishes it`);
    } else {
      npm([
        'trust',
        'github',
        name,
        '--file',
        WORKFLOW,
        '--repository',
        REPOSITORY,
        '--allow-publish',
        `--otp=${otp}`,
        '--yes',
      ]);
      console.log(
        `  added ${WORKFLOW} in ${REPOSITORY} as its trusted publisher`,
      );
    }

    npm([
      'deprecate',
      `${name}@${PLACEHOLDER}`,
      'Bootstrap placeholder. Install a released version.',
      `--otp=${otp}`,
    ]);
    console.log(`  deprecated ${PLACEHOLDER}`);
  } catch (error) {
    const detail = String(error.stderr ?? '').trim() || error.message;
    const lines = detail
      .split('\n')
      .filter((line) => !line.startsWith('npm notice'));
    console.error(`  ${lines.join('\n  ')}`);
    failed.push(project);
  }
}

if (failed.length > 0) {
  console.error(`\nNot done: ${failed.join(' ')}`);
  console.error(
    'A new package can 404 for a few minutes after its publish. Retry with a fresh code:',
  );
  console.error(
    `  node scripts/bootstrap-publish.mjs <otp> ${failed.join(' ')}`,
  );
  process.exit(1);
}

console.log(`
Registered ${projects.join(', ')}. Publish the first real version with the
Release workflow, naming the projects and the version their manifests hold:
  projects: ${projects.join(',')}
  version:  <version>`);
