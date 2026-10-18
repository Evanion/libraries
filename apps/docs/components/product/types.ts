export type DemoId =
  'rollout' | 'schedule' | 'cascade' | 'variants' | 'no-flicker';

export interface Link {
  label: string;
  href: string;
}

export interface SceneDefinition {
  id: string;
  title: string;
  lede: string;
  demo: DemoId;
  caption: string;
  howItWorks: Link;
}

export interface ProductPage {
  /** URL segment, e.g. 'feature-flags'. */
  slug: string;
  /** Group id in app/navigation.ts, e.g. 'feature'. */
  group: string;
  /** The npm package the page is about, e.g. '@evanion/feature'. */
  packageName: string;
  /** True until the page's copy has been written; a draft page is neither routed nor linked. */
  draft: boolean;
  /** The label of the link to this page on the frontpage's family section. */
  frontpageLink: string;
  metadata: { title: string; description: string };
  hero: { promise: string; line: string; demo: DemoId; actions: Link[] };
  scenes: SceneDefinition[];
  codeSample: {
    title: string;
    lede: string;
    /** The install command this snippet needs, shown above it. */
    install: string;
    file: string;
    region: string;
    link: Link;
  };
  install: { title: string; command: string };
  next: { title: string; links: Link[] };
}
