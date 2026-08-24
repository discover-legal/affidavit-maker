// Landing-page content. Pure data — every section component renders from
// here, so copy changes never touch layout code. Keep claims honest:
// drafts, not legal advice; seven launch jurisdictions; free to use.

import {
  BookOpen,
  CalendarClock,
  FileStack,
  FileText,
  Gavel,
  Languages,
  Lock,
  MapPin,
  Reply,
  Scale,
  ScanLine,
  Send,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

export const LAUNCH_JURISDICTIONS = ['AZ', 'CA', 'FL', 'IL', 'NY', 'TX', 'UT'] as const;
export const COVERAGE_COUNT = String(LAUNCH_JURISDICTIONS.length);

export type Offering = {
  key: string;
  name: string;
  tagline: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  featured?: boolean;
  features: readonly string[];
  cta: string;
};

export const OFFERINGS: readonly Offering[] = [
  {
    key: 'divorce',
    name: 'Divorce Package',
    tagline: 'Petition and proposed decree drafts, interviewed end-to-end.',
    icon: Scale,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    featured: true,
    features: [
      'Full guided divorce interview',
      'Petition + decree drafts generated together',
      'Children, property, and support modules',
      'Respondent path: answer builder if you were served',
      "Tailored to your state's waiting periods & grounds",
    ],
    cta: 'Start a divorce package',
  },
  {
    key: 'affidavit',
    name: 'General Affidavit',
    tagline: 'A professionally formatted sworn-statement draft.',
    icon: FileText,
    iconBg: 'bg-brand-tint',
    iconColor: 'text-brand',
    features: [
      'AI-guided fact interview',
      'State-specific formatting',
      'Notary block & jurat included',
      'Evidence/exhibit uploads',
      'Verify every statement before download',
    ],
    cta: 'Start an affidavit',
  },
  {
    key: 'support-docs',
    name: 'Supporting court documents',
    tagline: 'The paperwork around the paperwork, filled from your story.',
    icon: FileStack,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    features: [
      'Financial declaration',
      'Child support worksheet (Utah tables)',
      'Court-fee waiver motion',
      'Acceptance & certificate of service',
      'One-click lawyer handoff summary',
    ],
    cta: 'Build your papers',
  },
] as const;

export type JourneyItem = {
  key: string;
  title: string;
  body: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
};

export const JOURNEY: readonly JourneyItem[] = [
  {
    key: 'life-story',
    title: 'Your life story, told once',
    body: 'Everything you share builds a private profile that fills in every document — you never repeat yourself, across sessions or documents.',
    icon: BookOpen,
    iconBg: 'bg-brand-tint',
    iconColor: 'text-brand',
  },
  {
    key: 'ingest',
    title: 'Photograph a court paper',
    body: 'Snap the papers you already have — they read themselves into your timeline, deadlines included.',
    icon: ScanLine,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
  {
    key: 'serve',
    title: 'Serve the papers',
    body: 'A plain-language walkthrough of service of process: who can deliver, how, and what to file to prove it.',
    icon: Send,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  {
    key: 'respond',
    title: 'Respond if you were served',
    body: 'On the receiving end? Build an answer paragraph-by-paragraph — admit, deny, or explain — before your deadline.',
    icon: Reply,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
  },
  {
    key: 'hearing',
    title: 'Your day in court',
    body: 'Hearing preparation with practice questions, what to bring, and how the day usually goes.',
    icon: Gavel,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  {
    key: 'deadlines',
    title: 'Deadlines on your calendar',
    body: 'Waiting periods and response windows become calendar files you can download — no missed dates.',
    icon: CalendarClock,
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
  },
] as const;

export const STEPS = [
  {
    n: '01',
    title: 'Tell us about your matter',
    body: "Pick your state and the document you need. We'll route you through the right interview.",
  },
  {
    n: '02',
    title: 'Chat through the facts',
    body: 'Answer plain-English questions — or photograph court papers you already have and let them fill in your story.',
  },
  {
    n: '03',
    title: 'Verify every statement',
    body: 'A review gate walks you through each statement before anything is generated. These are your words, sworn.',
  },
  {
    n: '04',
    title: 'Download, then keep going',
    body: 'Get organized PDF drafts and a case packet, plus what comes next: serving, responding, and hearing prep.',
  },
] as const;

export const FEATURE_QUADRANT = [
  {
    title: 'Jurisdiction-aware',
    body: 'Tailored interview and captions.',
    icon: MapPin,
    iconBg: 'bg-brand-tint',
    iconColor: 'text-brand',
  },
  {
    title: 'Court-format drafts',
    body: 'Margins, fonts, line numbers.',
    icon: ShieldCheck,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
  {
    title: 'Private by default',
    body: 'Your story is yours — erase it any time.',
    icon: Lock,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  {
    title: 'English & Español',
    body: 'The guided journey is fully bilingual.',
    icon: Languages,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
] as const;

export const FAQS = [
  {
    q: 'Is it really free?',
    a: 'Yes. Every interview, document, and guide on discover.legal is free to use — no subscription, no card required. The project is donation-supported: if it saved your day, you can buy us a coffee.',
  },
  {
    q: 'Is this a substitute for a lawyer?',
    a: "No. discover.legal is a self-help document preparation tool. We don't provide legal advice or represent you. For complex or contested matters, consult a licensed attorney — we can even prepare a one-page case summary to hand them.",
  },
  {
    q: 'Which states are supported?',
    a: 'The launch editor currently supports Arizona, California, Florida, Illinois, New York, Texas, and Utah, with the deepest step-by-step guidance for Utah. Confirm local filing requirements with your court.',
  },
  {
    q: 'What if I was served papers instead of filing them?',
    a: 'The respondent path is built in: photograph what you were served, see your deadline, and build an answer paragraph-by-paragraph — admit, deny, or explain.',
  },
  {
    q: 'How long does it take?',
    a: 'Most affidavits take 10–20 minutes. A divorce interview usually takes 45–90 minutes depending on complexity (children, property, support). Everything auto-saves, so you can stop and resume any time.',
  },
  {
    q: 'Do I still need to file with the court myself?',
    a: 'Yes. We prepare organized drafts and a case packet to work from. Where your state publishes official court forms, you file on those — we link them from your account — using your drafts as source material, or bring everything to a lawyer or your court’s self-help center. The what’s-next roadmap walks you through serving, waiting periods, and hearings.',
  },
  {
    q: 'What happens to my information?',
    a: 'Your life story stays private to your account and is used only to fill in your documents. You can erase it with one click — erasing never touches documents you already downloaded.',
  },
] as const;
