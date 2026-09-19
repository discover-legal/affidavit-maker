/**
 * The v2 engine façade. Routes call this when CORE_ENGINE=v2.
 *
 * It wires the modules together and owns nothing else: no prompts, no
 * rules, no persistence. Persistence (documents, profiles) stays in the
 * route layer, which maps between the stored blob and a CaseFile through
 * core/adapters.
 */

import { getIntelligence } from './intelligence';
import type { Intelligence, Message } from './intelligence/types';
import { createJurisdictionRegistry } from './jurisdictions';
import type { JurisdictionRegistry } from './jurisdictions/types';
import { createInterviewEngine, fromYamlMatter, getDivorceDefinition } from './interview';
import type { InterviewEngine, MatterDefinition, TurnResult } from './interview/types';
import { createTriage } from './triage';
import type { Triage, TriageMatterOption, TriageResult } from './triage/types';
import { createLifeStoryService } from './profile';
import type { LifeStory, LifeStoryService } from './profile/types';
import { createComposer } from './compose';
import type { Composer, DocumentKind, DocumentTree } from './compose/types';
import { createRenderer } from './render';
import type { Renderer } from './render/types';
import type { CaseFile } from './model/types';

export interface EngineDeps {
  intelligence?: Intelligence;
  jurisdictions?: JurisdictionRegistry;
  /** Matter definitions beyond divorce; defaults to every YAML matter in matters/. */
  matters?: MatterDefinition[];
}

export interface Engine {
  jurisdictions: JurisdictionRegistry;
  interview: InterviewEngine;
  triage: Triage;
  lifeStory: LifeStoryService;
  composer: Composer;
  renderer: Renderer;
  /** Matter definitions available to triage and the interview, including divorce. */
  matters: { get(code: string, jurisdiction?: string): MatterDefinition | null; list(): MatterDefinition[] };
  /** One conversational turn: triage until a matter is chosen, then the matter's interview. */
  chat(input: { file: CaseFile; history: Message[]; message: string; story: LifeStory | null }): Promise<ChatResult>;
  /** Compose and verify one document for a case. */
  draft(file: CaseFile, kind: DocumentKind): Promise<DocumentTree>;
}

export type ChatResult =
  | { stage: 'triage'; result: TriageResult; file: CaseFile }
  | { stage: 'interview'; result: TurnResult; file: CaseFile };

export function createEngine(deps: EngineDeps = {}): Engine {
  const intelligence = deps.intelligence ?? getIntelligence();
  const jurisdictions = deps.jurisdictions ?? createJurisdictionRegistry();
  const yamlMatters = deps.matters ?? loadYamlMatters();
  const byCode = new Map(yamlMatters.map((m) => [m.code, m]));

  const matters = {
    get(code: string, jurisdiction?: string): MatterDefinition | null {
      if (code === 'divorce') {
        const profile = jurisdictions.get(jurisdiction || '') ?? jurisdictions.defaultFor('US');
        return profile ? getDivorceDefinition(profile) : null;
      }
      return byCode.get(code) ?? null;
    },
    list(): MatterDefinition[] {
      return [...yamlMatters];
    },
  };

  const interview = createInterviewEngine({
    intelligence,
    jurisdictions,
    matters: { get: (code) => matters.get(code) },
  });
  const triage = createTriage({ intelligence });
  const lifeStory = createLifeStoryService({ intelligence });
  const composer = createComposer({ intelligence });
  const renderer = createRenderer();

  return {
    jurisdictions,
    interview,
    triage,
    lifeStory,
    composer,
    renderer,
    matters,

    async chat({ file, history, message, story }) {
      if (!file.matter) {
        const result = await triage.classify({
          message,
          history,
          country: file.country || jurisdictions.countryOf(file.jurisdiction || '') || 'US',
          language: file.language,
          matters: triageOptions(yamlMatters),
        });
        const next: CaseFile = { ...file };
        if (result.outcome.kind === 'classified') {
          next.matter = result.outcome.matter;
          next.interview = { ...next.interview, triaged: true };
        } else if (result.outcome.kind === 'out_of_scope') {
          next.matter = 'general_affidavit';
          next.interview = { ...next.interview, triaged: true };
        }
        return { stage: 'triage', result, file: next };
      }

      const definition = matters.get(file.matter, file.jurisdiction);
      if (!definition) throw new Error(`core engine: unknown matter "${file.matter}"`);
      const scope = definition.familyProfile ? 'family' : 'general';
      const hydrated = lifeStory.hydrate(story, file, scope);
      const result = await interview.turn({ file: hydrated, history, message });
      const promoted = await lifeStory.promote(result.file, definition);
      return { stage: 'interview', result: { ...result, file: promoted }, file: promoted };
    },

    async draft(file, kind) {
      const jurisdiction = jurisdictions.get(file.jurisdiction || '');
      if (!jurisdiction) throw new Error(`core engine: unknown jurisdiction "${file.jurisdiction}"`);
      const tree = await composer.compose({ file, jurisdiction, kind });
      return composer.verify(tree, file);
    },
  };
}

const DIVORCE_TRIAGE_OPTION: TriageMatterOption = {
  code: 'divorce',
  practiceArea: 'family',
  description: 'Ending a marriage, dividing assets',
  keywords: ['divorce', 'dissolution', 'split up', 'separate from spouse'],
};

/** Triage descriptions come from the YAML `triage:` block when the matter is a YAML matter. */
function triageOptions(matters: MatterDefinition[]): TriageMatterOption[] {
  const yaml = yamlTriageIndex();
  return [
    DIVORCE_TRIAGE_OPTION,
    ...matters.map((m) => {
      const t = yaml.get(m.code);
      return {
        code: m.code,
        practiceArea: m.practiceArea,
        description: t?.description ?? m.displayName,
        keywords: t?.keywords ?? [],
        routingNotes: t?.routingNotes,
      };
    }),
  ];
}

function yamlTriageIndex(): Map<string, { description: string; keywords: string[]; routingNotes: string[] }> {
  try {
    const { getMatterRegistry } = require('@/services/matters') as typeof import('@/services/matters');
    return new Map(getMatterRegistry().list().map((d) => [d.code, d.triage]));
  } catch {
    return new Map();
  }
}

function loadYamlMatters(): MatterDefinition[] {
  const { getMatterRegistry } = require('@/services/matters') as typeof import('@/services/matters');
  return getMatterRegistry().list().map((def) => fromYamlMatter(def));
}
