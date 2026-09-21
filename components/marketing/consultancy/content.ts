// Consultancy site content. Pure data — every section renders from here, so
// copy changes never touch layout code. Keep claims honest: no invented
// client counts, no filing-readiness claims, BigLaw is experimental and says so.

import {
  Compass,
  FileText,
  GitBranch,
  Hammer,
  Lock,
  Ruler,
  Scale,
  Search,
  ServerCog,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

export const GITHUB_ORG = 'https://github.com/discover-legal';
export const BIGLAW_REPO = 'https://github.com/discover-legal/BigLaw';

export type Service = {
  key: 'buy' | 'build' | 'msp' | 'advisory';
  name: string;
  headline: string;
  body: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  deliverables: readonly string[];
  /** Longer form for /services. */
  engagement: string;
};

export const SERVICES: readonly Service[] = [
  {
    key: 'buy',
    name: 'Buy',
    headline: 'Choose the right tools, on your terms.',
    body: 'Independent selection for firms buying legal technology: what you actually need, which vendors deliver it, and what the contract should say about your data.',
    icon: Search,
    iconBg: 'bg-brand-tint',
    iconColor: 'text-brand',
    deliverables: [
      'Needs assessment across practice groups',
      'Market scan and shortlist',
      'Scripted vendor demos on your matters',
      'Contract, data and AI-terms review',
      'Rollout and change plan',
    ],
    engagement:
      'A fixed-scope engagement that ends with a written recommendation you can act on. We take no vendor referral fees, so the shortlist is yours, not ours.',
  },
  {
    key: 'build',
    name: 'Build',
    headline: 'Build what the market does not sell.',
    body: 'Custom intake, document automation, AI-assisted workflows with verification gates, and the integrations that tie them to the systems your firm already runs.',
    icon: Hammer,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    deliverables: [
      'Client intake and interview flows',
      'Document assembly from structured facts',
      'AI workflows with human review gates',
      'Practice-management, DMS and e-signature integration',
      'Source code delivered to you',
    ],
    engagement:
      'We build the way we build our own products: code owns the workflow and the rules, the model supplies judgment and language, and nothing dispositive reaches a page without a check. You own the code.',
  },
  {
    key: 'msp',
    name: 'Run',
    headline: 'Managed services for the systems you rely on.',
    body: 'Hosting, monitoring, updates, backups and support for what we build or what you choose, including open-source platforms like BigLaw, on infrastructure you control.',
    icon: ServerCog,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    deliverables: [
      'Deployment on your cloud or on-premises',
      'Monitoring, patching and backups',
      'Model-provider and cost management',
      'Access control and audit trail',
      'Support desk for your staff',
    ],
    engagement:
      'A monthly service with a defined scope and response times. Your data stays in your environment; we operate it, you keep the keys.',
  },
  {
    key: 'advisory',
    name: 'Advise',
    headline: 'Technical leadership without the headcount.',
    body: 'Strategy, roadmap, AI governance and build-versus-buy decisions for firms and legal teams, on retainer or for a defined project.',
    icon: Compass,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    deliverables: [
      'Technology roadmap and budget',
      'AI use policy and risk review',
      'Build-versus-buy analysis',
      'Vendor negotiation support',
      'Fractional CTO on retainer',
    ],
    engagement:
      'Retained or project-based. Useful when the firm needs someone technical in the room for decisions that will outlast any single vendor.',
  },
] as const;

export type FreeSolution = {
  key: string;
  name: string;
  href: string;
  status: string;
  tagline: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  points: readonly string[];
  cta: string;
};

export const FREE_SOLUTIONS: readonly FreeSolution[] = [
  {
    key: 'documents',
    name: 'discover.legal Documents',
    href: '/tools/affidavits',
    status: 'Free · Beta · Ontario at launch',
    tagline:
      'A guided interview turns a person’s story into organized affidavit and divorce drafts, in the vocabulary their court uses.',
    icon: FileText,
    iconBg: 'bg-brand-tint',
    iconColor: 'text-brand',
    points: [
      'Interview once; every document fills from the same record',
      'Every statement verified against what the person said',
      'Drafts as source material for official court forms',
      'English and Español',
    ],
    cta: 'Explore Documents',
  },
  {
    key: 'biglaw',
    name: 'BigLaw',
    href: '/tools/biglaw',
    status: 'Free · Open source · Experimental',
    tagline:
      'An open-source legal AI platform: research, drafting, redlining, e-signatures, docketing and billing, orchestrated by a bench of agents with a verification protocol between every finding and the page.',
    icon: Scale,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    points: [
      'Apache-2.0, self-hosted, one static Go binary',
      'Runs on local models or your provider of choice',
      'Human gate before low-confidence findings reach synthesis',
      'Built for solos, boutiques and small firms',
    ],
    cta: 'Explore BigLaw',
  },
] as const;

export type Principle = {
  title: string;
  body: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
};

export const PRINCIPLES: readonly Principle[] = [
  {
    title: 'Verification before output',
    body: 'Nothing an AI writes reaches a page without a check against the record. We build it that way, and we buy it that way.',
    icon: ShieldCheck,
    iconBg: 'bg-brand-tint',
    iconColor: 'text-brand',
  },
  {
    title: 'Your data, your infrastructure',
    body: 'Client data stays in an environment you control. Open models and self-hosting are always on the table.',
    icon: Lock,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  {
    title: 'Open source where it counts',
    body: 'Our own platforms are public and free. When we build for you, you own the code.',
    icon: GitBranch,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  {
    title: 'Fixed scope, written outcomes',
    body: 'Engagements end with something you can read and act on: a recommendation, a running system, or a roadmap.',
    icon: Ruler,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
] as const;

export type ResearchProject = {
  key: string;
  title: string;
  question: string;
  status: string;
  summary: string;
  repo: string;
  facts: readonly string[];
  /** A real observation from the pilot run, stated as such. */
  pilotNote?: string;
};

// Facts come from each project's README; keep them in step with it.
export const RESEARCH: readonly ResearchProject[] = [
  {
    key: 'multilingual-reasoning',
    title: 'Does the language a model reasons in change its legal accuracy?',
    question:
      'A factorial experiment over LegalBench: reasoning-language conditions × models × closed-label legal classification tasks.',
    status: 'In progress · pilot validated · no full-scale results yet',
    summary:
      'Nineteen reasoning conditions (fourteen natural languages across nine families, plus formal logic, pseudocode, an emergent notation, a wildcard, and a no-chain-of-thought control) are run against nine LegalBench tasks on a set of low-cost cloud and local models, with the final answer always requested in English.',
    repo: 'https://github.com/hordruma/MultiLingual-Reasoning',
    facts: [
      'Nine closed-label LegalBench tasks: hearsay, personal jurisdiction, contract NLI, unfair terms of service and others',
      'Identical seeded samples across every cell; temperature zero and no output cap where the API allows',
      'Hidden "thinking" switched off wherever possible, and measured and reported where it cannot be',
      'Fifty-six offline tests; a live pilot run completed end to end with zero errors',
    ],
    pilotNote:
      'In the pilot, one model returned hidden reasoning on every sample, and in the Mandarin condition its visible reasoning was mostly Chinese while the hidden channel was mostly not. A model that thinks in a hidden channel is not reasoning in the requested language, which is why the design measures it.',
  },
] as const;

export const CONSULTANCY_FAQS = [
  {
    q: 'Who is this for?',
    a: 'Law firms and in-house legal teams that are choosing, building or running technology, from a solo practice standardising intake to a firm replacing a vendor stack.',
  },
  {
    q: 'Are the free solutions really free?',
    a: 'Yes. discover.legal Documents is free to use and BigLaw is open source under Apache-2.0. Paid work is the consultancy: selection, custom builds, managed services and advisory.',
  },
  {
    q: 'Do you resell software or take referral fees?',
    a: 'No. Selection work is independent. If we recommend a vendor, it is because it fits, and the contract we review is yours.',
  },
  {
    q: 'Can you run BigLaw for my firm?',
    a: 'Yes, as a managed service on your infrastructure. BigLaw is experimental and has not had an independent security audit, so a deployment starts with that review and authentication switched on.',
  },
  {
    q: 'Is any of this legal advice?',
    a: 'No. We are a technology consultancy, not a law firm. Nothing on this site or produced by our tools is legal advice.',
  },
  {
    q: 'How do we start?',
    a: 'Book a consultation. It is a paid session; we use it to understand the problem and come back with a scoped proposal.',
  },
] as const;
