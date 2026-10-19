export type DemoId =
  | 'rollout'
  | 'schedule'
  | 'cascade'
  | 'variants'
  | 'no-flicker'
  | 'access'
  | 'acl-explain'
  | 'acl-diff'
  | 'access-api'
  | 'data'
  | 'widget-validate';

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

/**
 * One section of a product page. It leads with the benefit: `why` is the
 * problem, `how` is what the library does about it. A scene with a `demo`
 * shows it as proof under the prose; a scene without one links to the docs
 * page that holds the demo.
 */
export interface SceneDefinition {
  id: string;
  title: string;
  lede: string;
  why: string;
  how: string;
  /** What the reader gets, shown in a callout; set only where there is something to call out. */
  differs?: string;
  demo?: { id: DemoId; caption: string };
  howItWorks: Link;
  /** A second link into the docs, shown beside `howItWorks`. */
  more?: Link;
  /** A tested code region shown under the prose, read at build time. */
  sample?: { file: string; region: string };
  /** Rows of the security register, shown as a table. A test holds each to `libs/acl/SECURITY.md`. */
  entries?: RegisterEntry[];
}

/** One row of a published register: what the library is held against and how it answers. */
export interface RegisterEntry {
  id: string;
  attack: string;
  cwe: string;
  handled: string;
}

export interface FaqEntry {
  q: string;
  a: string;
}

export interface Closing {
  title: string;
  text: string;
  actions: Link[];
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
  hero: {
    promise: string;
    line: string;
    /** A second supporting line under `line`. */
    sub?: string;
    /** The command shown beside the actions. */
    install: string;
    demo: DemoId;
    actions: Link[];
  };
  /** What the library is and is not, shown right under the hero. */
  facts: Fact[];
  scenes: SceneDefinition[];
  /** What the library does not do, shown after the scenes. Set only when the page has at least two items. */
  limits?: { title: string; items: Fact[] };
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
  faq: FaqEntry[];
  closing: Closing;
}
