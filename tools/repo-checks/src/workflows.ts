import { workspaceRoot } from '@nx/devkit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

/** A step of a workflow job, with the fields the checks read. */
export interface Step {
  name?: string;
  id?: string;
  if?: string;
  run?: string;
  env?: Record<string, string>;
}

interface Workflow {
  jobs?: Record<string, { steps?: Step[] }>;
}

/** Every step of every job in `.github/workflows/<file>`, in file order. */
export function stepsOf(file: string): Step[] {
  const workflow = parse(
    readFileSync(join(workspaceRoot, '.github', 'workflows', file), 'utf-8'),
  ) as Workflow;

  return Object.values(workflow.jobs ?? {}).flatMap((job) => job.steps ?? []);
}
