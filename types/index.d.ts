// types/index.d.ts

// User and Authentication Types
export interface User {
  id: number;
  auth0_id: string;
  email: string;
  name: string;
  subscription_status: 'active' | 'inactive' | 'cancelled';
  subscription_tier: 'pay_per_use' | 'family_law_package' | 'all_state_access';
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date;
}

// Document Types
export interface AffidavitData {
  documentId?: string;
  affiantName: string;
  state: 'TX' | 'UT' | 'AZ' | '';
  county?: string;
  caseNumber?: string;
  caseType?: string;
  court?: string;
  documentType?: 'general' | 'divorce' | 'custody' | 'financial' | 'property' | 'identity';
  facts: string[];
  
  // Divorce specific
  marriageDate?: string;
  separationDate?: string;
  spouseName?: string;
  grounds?: string;
  
  // Custody specific
  children?: string[];
  currentCustody?: string;
  
  // Financial specific
  monthlyIncome?: string;
  monthlyExpenses?: string;
}

export interface Document {
  id: string;
  user_id: number;
  content: AffidavitData;
  generated_text?: string;
  file_path?: string;
  template_state: string;
  template_version: string;
  document_type: string;
  validation_results?: ValidationResult;
  generation_metadata?: GenerationMetadata;
  status: 'draft' | 'completed' | 'paid' | 'downloaded';
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  downloaded_at?: Date;
}

// Validation Types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationRequirements {
  venue: boolean;
  countyRequired: boolean;
  notaryCommissionExpiration: boolean;
  perjuryWarning: boolean;
  witnessSignature: boolean;
}

// Template Types
export interface StateTemplate {
  state: string;
  stateName: string;
  requirements: ValidationRequirements;
  formatRules: {
    headerFormat: string;
    venueFormat: string;
    countyFormat: string;
  };
}

export interface DocumentSection {
  header?: string;
  venue?: string;
  caseCaption?: {
    caseNumber: string;
    caseType?: string;
    court?: string;
    formatted: string;
  };
  title?: string;
  introduction?: string;
  competencyStatement?: Fact;
  facts: Fact[];
  conclusion?: string;
  perjuryStatement?: string;
  signatureBlock?: {
    line: string;
    name: string;
    title: string;
    date?: string;
  };
  notaryBlock?: string;
  footer?: {
    disclaimer: string;
    timestamp: string;
    version: string;
  };
}

export interface Fact {
  number: number;
  content: string;
  type: 'competency' | 'fact' | 'document_specific';
}

export interface GeneratedDocument {
  id: string;
  state: string;
  timestamp: Date;
  sections: DocumentSection;
  fullText: string;
  htmlContent: string;
  validation: ValidationResult;
  formatting: any;
}

// Chat Types
export interface Message {
  id: number;
  type: 'user' | 'bot';
  content: string;
  timestamp?: Date;
}

export interface ChatResponse {
  success: boolean;
  response: string;
  extractedData?: Partial<AffidavitData>;
  conversationComplete?: boolean;
  nextSteps?: string[];
  validation?: ValidationResult;
  stateRequirements?: ValidationRequirements;
}

// Payment Types
export interface PaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
  paymentIntentId: string;
}

export interface Payment {
  id: number;
  user_id: number;
  document_id?: number;
  stripe_payment_intent_id: string;
  stripe_charge_id?: string;
  amount_cents: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'pending' | 'refunded';
  payment_type: 'single_document' | 'family_law_package' | 'all_state_access';
  created_at: Date;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DocumentListResponse extends ApiResponse {
  documents: Document[];
  count: number;
}

export interface GenerateAffidavitResponse extends ApiResponse {
  documentId: string;
  content: string;
  htmlContent: string;
  downloadUrl?: string;
  metadata: GenerationMetadata;
  validation: ValidationResult;
}

export interface PreviewResponse extends ApiResponse {
  preview: {
    sections: DocumentSection;
    html: string;
    text: string;
    validation: ValidationResult;
  };
}

// Generation Types
export interface GenerationMetadata {
  strategy: 'simple' | 'detailed' | 'persuasive' | 'legal' | 'template_only' | 'fallback';
  state: string;
  template: string;
  generatedAt: string;
  model?: string;
  wordCount: number;
  fallbackReason?: string;
}

export interface GenerationOptions {
  documentId?: string;
  includeMetadata?: boolean;
  preview?: boolean;
  includeWatermark?: boolean;
}

// State Management Types
export interface AppState {
  user: User | null;
  documents: Document[];
  currentDocument: AffidavitData | null;
  isLoading: boolean;
  error: string | null;
  supportedStates: StateInfo[];
  documentTypes: string[];
}

export interface StateInfo {
  code: string;
  name: string;
  requirements: ValidationRequirements;
}

// Component Props Types
export interface ChatInterfaceProps {
  affidavitData: AffidavitData;
  onDataUpdate: (data: Partial<AffidavitData>) => void;
  onSaveSession: () => Promise<void>;
  documentComplete: boolean;
  onDocumentComplete: (complete: boolean) => void;
  validation: ValidationResult | null;
  onValidationUpdate: (validation: ValidationResult) => void;
}

export interface DocumentPreviewProps {
  preview: any;
  affidavitData: AffidavitData;
  documentComplete: boolean;
  validation: ValidationResult | null;
  onDownload: () => void;
}

export interface ValidationDisplayProps {
  validation: ValidationResult | null;
}

export interface UserDashboardProps {
  onNewDocument: () => void;
  onContinueDocument: (doc: Document) => void;
}

// Session Types
export interface SessionData {
  messages: Message[];
  affidavitData: AffidavitData;
  documentComplete: boolean;
  timestamp: string;
}

// Activity Log Types
export interface ActivityLog {
  id: number;
  user_id: number;
  action: string;
  resource_type: string;
  resource_id?: number;
  ip_address?: string;
  user_agent?: string;
  metadata?: any;
  created_at: Date;
}