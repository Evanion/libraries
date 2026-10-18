export type DemoId =
  'rollout' | 'schedule' | 'cascade' | 'variants' | 'no-flicker';

export interface Link {
  label: string;
  href: string;
}

/** One plain statement of what the library is or is not, optionally with a link into the docs. */
export interface Fact {
  title: string;
  text: string;
  link?: Link;
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
  /** The label of the frontpage link to the lead package's docs, shown beside the product page links. */
  docsLink: string;
  /**
   * Where an adapter package lands on this page: package name to the id of the
   * section that covers it. The lead package needs no entry, it links the top.
   */
  anchors?: Record<string, string>;
  metadata: { title: string; description: string };
  hero: { promise: string; line: string; demo: DemoId; actions: Link[] };
  /** What the library is and is not, shown right under the hero. */
  facts: Fact[];
  scenes: SceneDefinition[];
  codeSample: {
    /** The section's `id`, the target of an anchor. */
    id: string;
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
