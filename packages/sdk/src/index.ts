/**
 * @discover-legal/sdk
 *
 * Typed client for the discover.legal document marketplace API. Used by the
 * in-repo marketplace UI and published for partner / external integrations.
 *
 * @example
 * import { DiscoverLegalClient } from '@discover-legal/sdk';
 * const client = new DiscoverLegalClient({ baseUrl: 'https://discover.legal' });
 * const { templates } = await client.templates.search({ jurisdiction: 'TX' });
 */
export {
  DiscoverLegalClient,
  TemplatesResource,
  LawyerResource,
  PurchasesResource,
  AdminResource,
} from './client';
export type { DiscoverLegalClientOptions } from './client';
export { MarketplaceApiError, MarketplaceNetworkError } from './errors';
export type {
  AdminStats,
  AdminTemplate,
  AdminTemplateListPage,
  AdminUser,
  AdminUserListPage,
  ApiErrorBody,
  ApiSuccess,
  CheckoutSession,
  CreateTemplateInput,
  DifficultyLevel,
  InterviewQuestion,
  InterviewQuestionType,
  LawyerDashboard,
  LawyerSummary,
  LawyerTemplate,
  LawyerTemplateListPage,
  LawyerTemplateListParams,
  MarketplaceTemplate,
  PracticeArea,
  Purchase,
  PurchaseDetail,
  PurchaseListPage,
  PurchaseStatus,
  TemplateConfig,
  TemplateListPage,
  TemplateSearchParams,
  TemplateSort,
  TemplateStatus,
  UpdateTemplateInput,
  UserRole,
} from './types';

export const SDK_VERSION = '0.1.0';
