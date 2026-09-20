/** Types for the CommonJS matter registry in ./index.js */

export type MatterFieldSpec = {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
  items?: MatterFieldSpec;
  properties?: Record<string, MatterFieldSpec>;
  required?: string[];
};

export type MatterField = { key: string; target: string; schema: MatterFieldSpec };

export type MatterPhase = {
  id: string;
  displayName: string;
  prompt: string;
  requiredFields: string[];
  optional: boolean;
  skipUnlessAny: string[];
  skipIfAny: string[];
  factCategory: string | null;
};

export type MatterDefinition = {
  code: string;
  practiceArea: 'family' | 'civil';
  displayName: string;
  shortName: string;
  tagline: string;
  sortOrder: number;
  isPackaged: boolean;
  familyProfile: boolean;
  supportedJurisdictions: string[] | null;
  documents: string[];
  documentSelection: { documents: string[]; reasons: Record<string, string> } | null;
  triage: { description: string; keywords: string[]; routingNotes: string[] };
  fields: MatterField[];
  phases: MatterPhase[];
  sourceFile: string;
};

export type MatterLoadError = { file: string; message: string };

export type MatterRegistry = {
  dir: string;
  errors: MatterLoadError[];
  list(): MatterDefinition[];
  get(code: string): MatterDefinition | null;
  has(code: string): boolean;
  codes(): string[];
  familyProfileCodes(): string[];
};

export type MatterOrchestrator = {
  matterTypeCode: string;
  practiceArea: string;
  phaseOrder: string[];
  phases: Record<string, unknown>;
  fieldMap: Record<string, string>;
  tool: unknown;
  processMessage: (...args: unknown[]) => Promise<unknown>;
};

export const BUILTIN_MATTER_CODES: readonly string[];
export function getMatterRegistry(): MatterRegistry;
export function resetMatterRegistry(): void;
export function loadMatterRegistry(dir: string): MatterRegistry;
export function loadMatterDefinitions(opts?: { dir?: string; reservedCodes?: Iterable<string> }): {
  matters: MatterDefinition[];
  errors: MatterLoadError[];
  dir: string;
};
export function defaultMattersDir(): string;
export function validateMatterDefinition(
  raw: unknown,
  sourceFile?: string,
): { ok: true; matter: MatterDefinition } | { ok: false; errors: string[] };
export function createOrchestrator(def: MatterDefinition): MatterOrchestrator;
export function registerDocumentSelection(
  def: MatterDefinition,
  agent: { registerHandler: (state: string, area: string, fn: (data: unknown) => unknown) => void },
): boolean;
