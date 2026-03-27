# Product Requirements Document: Legal Document Marketplace

**Product**: discover.legal Marketplace ("Canva for Legal Docs")
**Version**: 1.0.0-draft
**Date**: 2026-03-26
**Author**: Product Architecture Team
**Status**: DRAFT -- Pending Stakeholder Review
**Branch**: doc-marketplace

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [User Personas](#3-user-personas)
4. [User Stories](#4-user-stories)
5. [Feature Specifications](#5-feature-specifications)
   - 5.1 [Marketplace Discovery](#51-marketplace-discovery)
   - 5.2 [Template Builder](#52-template-builder)
   - 5.3 [AI Prompt Editor](#53-ai-prompt-editor)
   - 5.4 [Client Interview Experience](#54-client-interview-experience)
   - 5.5 [PDF Generation and Customization](#55-pdf-generation-and-customization)
   - 5.6 [Lawyer Dashboard](#56-lawyer-dashboard)
   - 5.7 [Client Dashboard](#57-client-dashboard)
   - 5.8 [Payment System](#58-payment-system)
   - 5.9 [Subscription Management](#59-subscription-management)
   - 5.10 [Affiliate System](#510-affiliate-system)
   - 5.11 [Clio Integration](#511-clio-integration)
   - 5.12 [Review and Rating System](#512-review-and-rating-system)
   - 5.13 [Gamification and Engagement](#513-gamification-and-engagement)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Success Metrics](#7-success-metrics)
8. [Competitive Analysis](#8-competitive-analysis)
9. [Risks and Mitigations](#9-risks-and-mitigations)
10. [Phased Rollout Plan](#10-phased-rollout-plan)
11. [Regulatory Considerations](#11-regulatory-considerations)
12. [Appendices](#12-appendices)

---

## 1. Executive Summary

### 1.1 Vision

Transform the existing discover.legal platform from a first-party legal document generator into a two-sided marketplace where lawyers create, publish, and sell legal document templates, and clients browse, purchase, and complete AI-guided interviews to produce court-ready documents. The analogy is "Canva for legal docs" -- Canva did not make graphic design cheaper; it made it accessible. We do the same for legal documents.

### 1.2 Market Opportunity

The U.S. legal services market is $350B+ annually. An estimated 80% of civil legal needs go unmet because people cannot afford $300-500/hr attorney rates. Self-represented litigants (SRLs) now exceed 75% of family court filers in most jurisdictions. These people need real legal documents, not form-fill PDFs with no guidance.

Simultaneously, solo practitioners and small firms (70% of all U.S. lawyers) struggle to compete with large firms on reputation and referrals. They have deep jurisdictional expertise but no scalable way to monetize it beyond hourly billing. A template they build once can serve thousands of clients, creating a passive income stream that did not previously exist.

The marketplace connects these two sides:
- **Supply**: Lawyers who know the law and want recurring revenue
- **Demand**: Clients who need real legal documents but cannot afford traditional representation

### 1.3 Emotional Design Thesis

The product must provoke STRONG reactions from lawyers. Apathy is the enemy. We want lawyers to simultaneously feel:

**Threatened**: "This platform is giving away what I charge $2,000 for." "Anyone can create templates now." "My clients will find cheaper options." This threat is intentional. It signals that the market is real and moving, with or without them.

**Excited**: "I made $2,000 while sleeping." "200 clients used my template this month." "I'm the number one family law template creator in Texas." "I can reach clients I'd never meet in person." This excitement converts skeptics into evangelists.

Anti-apathy design principles:
- Public leaderboards that create competitive pressure
- Revenue notifications that make passive income tangible ("You just earned $15 from a divorce petition in Harris County")
- Achievement badges that create professional identity ("Top 10 Texas Family Law Creator")
- Weekly competitor alerts ("3 new divorce templates were published in your jurisdiction")
- Social proof that validates early adopters ("Joined before 1,000 lawyers")

The goal is not universal love. The goal is that every lawyer who encounters the product has a strong opinion about it. Strong opinions create word-of-mouth. Word-of-mouth creates growth. Growth creates the marketplace flywheel.

### 1.4 What Exists Today

The platform at `make.discover.legal` already has:
- 110 jurisdiction templates (64 North American + 46 international behind feature flag)
- AI-powered interview engine (`BaseMatterOrchestrator`) that walks users through phase-based document creation
- 16 matter types covering family and civil law
- Auth0 authentication, Stripe payments, PostgreSQL with Row Level Security
- A `document_templates` table already scaffolded with `is_public`, `is_premium`, `price_cents`, `applicable_states[]` columns (migration 000, never used)
- Existing `interview_phase_configs` table (migration 013) that stores phase definitions in the database

The transformation is primarily architectural, not foundational. The interview engine already accepts phase definitions as configuration objects. The main work is moving template definitions from JavaScript files to JSONB in the database, adding the marketplace layer (search, discovery, payments, analytics), and building the lawyer-facing template creation tools.

---

## 2. Problem Statement

### 2.1 What Is Broken for Clients

**Today, a person facing divorce in Harris County, Texas has these options:**

1. **Hire a lawyer** ($3,000-$10,000 for uncontested divorce). Most people in family court cannot afford this -- 76% of family law litigants in Texas are self-represented.

2. **Use a form-fill service** (LegalZoom, $299+). These services provide blank forms with minimal guidance. Users fill in boxes without understanding what the court needs. The documents frequently get rejected because the user did not know about jurisdiction-specific requirements (Texas requires an Original Petition, Waiver of Citation, and Final Decree as a minimum set -- LegalZoom does not tell you this).

3. **Go to the courthouse self-help center**. Wait in line for hours, get a stack of blank forms, go home and try to figure them out alone.

4. **Find templates online**. Download a generic PDF, discover it is for the wrong state, or that it is missing critical provisions required by local court rules.

None of these options combine three things that clients need simultaneously: (a) jurisdiction-specific legal accuracy, (b) guided interview that explains what the court needs and why, and (c) affordable pricing.

### 2.2 What Is Broken for Lawyers

**A solo family law practitioner in Dallas has these problems:**

1. **Revenue ceiling**. There are only so many billable hours in a day. Every dollar earned requires the lawyer's personal time.

2. **Template waste**. Every divorce petition follows the same structure. The lawyer has refined their template over 15 years, but it only benefits clients who walk through their door. The template sits on their hard drive, earning nothing when the lawyer is not actively using it.

3. **No scalable channel**. There is no good way for a solo practitioner to reach the 76% of family court litigants who cannot afford them. The lawyer knows these people need help. They just cannot serve them at $300/hr.

4. **Competitive blindspot**. Document automation companies (LegalZoom, Rocket Lawyer) are eating the low end of the market. Lawyers complain about this but have no counter-strategy. They cannot compete on price. They need a way to compete on quality at scale.

### 2.3 The Gap

No product today lets a lawyer build a guided, AI-powered interview template once and sell it to thousands of clients at $10-50 per document. The marketplace fills this gap by:

- Giving lawyers a visual tool to encode their expertise into reusable templates
- Running each client through an AI-guided interview that asks one question at a time, validates answers, and produces court-ready documents
- Handling all payment processing, with the lawyer earning per-document revenue indefinitely
- Maintaining jurisdiction-specific accuracy because the lawyer -- not a tech company -- defines the legal requirements

---

## 3. User Personas

### 3.1 Persona: "Skeptical Solo" -- Maria Chen, Solo Family Law Practitioner

**Demographics**: 42, licensed 16 years, solo practice in Houston, TX. Handles 30-40 uncontested divorces per year at $2,500 each.

**Current state**: Maria has a refined set of Texas divorce templates she has built over her career. She turns away 3-4 potential clients per week who cannot afford her fees. She suspects document automation is coming for her practice area but does not know how to respond.

**Motivations**:
- Wants passive income but is skeptical of "too good to be true" platforms
- Fiercely protective of her professional reputation
- Values being seen as an expert in her jurisdiction
- Wants to help the clients she turns away, but not for free

**Fears**:
- That her templates will be copied or misused
- That the platform will undercut her hourly practice
- That associating with a "cheap" platform will damage her reputation
- That she will invest time building templates and nobody will buy them

**Trigger to adopt**: Seeing another Houston family law attorney on the leaderboard making $1,500/month. Competitive instinct overrides skepticism.

**Success state**: Maria publishes 4 Texas divorce templates (uncontested no-kids, uncontested with-kids, contested, and military). She earns $1,800/month passively. She raises her hourly rate because she no longer needs volume. She refers her $2,500-too-expensive clients to her own marketplace templates at $29.

### 3.2 Persona: "Passive Income Partner" -- James Wright, Small Firm Partner

**Demographics**: 55, partner at a 6-attorney family law firm in Chicago, IL. The firm handles high-conflict cases. James manages operations and business development.

**Current state**: James has been looking for ways to diversify firm revenue. The firm has standardized templates across all 16 matter types for Illinois. Associates use these templates daily. James sees them as an untapped asset.

**Motivations**:
- Wants to monetize the firm's template library without cannibalizing billable work
- Interested in brand visibility -- being "the Illinois family law firm" on the platform
- Wants analytics on which document types are most in demand (market intelligence)
- Sees the platform as a lead generation funnel for high-conflict cases that need full representation

**Fears**:
- That the firm's brand will be diluted by association with self-help documents
- That malpractice exposure increases
- That it will take too much attorney time to build templates

**Trigger to adopt**: The $3/month custom branding tier. Being able to put the firm's logo on every PDF means every document is a branded advertisement. The analytics tier shows demand for custody modifications is 3x higher than they expected -- valuable market intelligence.

**Success state**: The firm publishes 30+ Illinois templates across all matter types. Revenue is $4,000/month. More importantly, 2-3 clients per month who start with a $29 self-help template realize they need full representation and hire the firm at $350/hr. The templates are a lead funnel.

### 3.3 Persona: "New Graduate" -- Priya Patel, Recently Barred Attorney

**Demographics**: 27, passed the California bar 8 months ago, working part-time at a legal aid clinic while trying to build a solo practice. $180,000 in student debt.

**Current state**: Priya has the legal knowledge but no reputation, no client base, and no marketing budget. She cannot compete with established practitioners on referrals or reviews. She needs a way to build a professional reputation and earn income simultaneously.

**Motivations**:
- Needs income immediately -- student loans are due
- Wants to build a professional brand and reputation
- Values accessibility -- she went to law school because she wanted to help underserved communities
- Willing to invest time in template creation because she has more time than money

**Fears**:
- That established lawyers will dominate the platform and she will be invisible
- That her lack of experience will show in her templates
- That the $1-49/month tiers are still too expensive given her financial situation

**Trigger to adopt**: The free tier. She can start publishing immediately with zero financial risk. The leaderboard is not just "most revenue" -- it also tracks "most helpful" (based on client ratings), which she can win without needing volume.

**Success state**: Priya publishes California family law templates and becomes the highest-rated creator in her jurisdiction within 6 months. She earns $800/month from templates. Her "Top Rated -- California Family Law" badge is on her website and business cards. Clients who find her templates hire her for consultations. She pays off debt faster than projected.

### 3.4 Persona: "Legal Aid Worker" -- Devon Jackson, Paralegal at a Legal Aid Nonprofit

**Demographics**: 35, certified paralegal at a legal aid organization serving low-income families in Atlanta, GA. The organization assists 2,000+ clients per year with 4 staff attorneys.

**Current state**: Devon's organization cannot serve demand. Wait times for an appointment are 6-8 weeks. Many clients need simple documents (name changes, small claims, uncontested divorces) but every client gets the same intake process regardless of complexity. Devon has created internal intake questionnaires but they are paper-based.

**Motivations**:
- Wants to serve more clients with the same resources
- Needs tools that are accessible to clients with limited education and English proficiency
- Values templates that are legally accurate -- their clients cannot afford to have documents rejected
- Wants to redirect attorney time from simple matters to complex cases

**Fears**:
- That the platform will be too expensive for their client population
- That the technology will be inaccessible to their clients
- That the UPL (unauthorized practice of law) implications could jeopardize the organization

**Trigger to adopt**: Learning that the platform fee is $1 per document, not $79. The organization can direct simple-matter clients to the marketplace, freeing attorney time for complex cases. The AI interview is more thorough than their paper questionnaire.

**Success state**: Devon's organization publishes 10 Georgia templates at $0 lawyer price (the client pays only the $1 platform fee + Stripe processing). Simple matters are handled entirely through the platform. Attorney capacity is redirected to complex cases. The waitlist drops from 6 weeks to 2 weeks.

### 3.5 Persona: "Desperate Client" -- Sarah Martinez, Self-Represented Litigant

**Demographics**: 33, two children (ages 5 and 8), filing for divorce in Maricopa County, AZ. Household income $42,000. Cannot afford an attorney.

**Current state**: Sarah's spouse moved out 3 months ago. She needs to file for divorce to establish custody and child support. She went to the courthouse self-help center, was given a stack of 12 blank forms, and left overwhelmed. She tried LegalZoom but the $299 price is two weeks of groceries. She found a "free divorce forms" website but the forms were for California.

**Motivations**:
- Needs court-ready documents that will not get rejected
- Wants someone (or something) to explain what each question means and why it matters
- Needs affordable pricing -- under $50 total
- Wants to feel confident that the documents are correct before she files them

**Fears**:
- That she will make a legal mistake that affects her children's custody
- That the documents will be rejected by the court and she will have to start over
- That she is "doing it wrong" and does not know what she does not know
- That her spouse will hire a lawyer and she will be at a disadvantage

**Trigger to adopt**: Finding a $19 "Arizona Uncontested Divorce with Children" template created by a licensed Arizona family law attorney with 47 five-star reviews. The price is less than the filing fee. The reviews mention "the interview asked me things I didn't even know to worry about."

**Success state**: Sarah completes the AI interview in 45 minutes across 3 sessions. The system asks her about each child's school, healthcare needs, and the proposed parenting schedule. It explains why Arizona requires a 60-day waiting period. She downloads a complete document package (petition, parenting plan, waiver of service). She files at the courthouse. The clerk accepts everything on the first try.

### 3.6 Persona: "Template Shark" -- David Kim, Legal Entrepreneur

**Demographics**: 38, licensed in 3 states (NY, NJ, CT), previously worked at a BigLaw firm, now runs a "legal technology consultancy." Has experience with legal document automation.

**Current state**: David sees the marketplace as a business opportunity, not a practice tool. He wants to publish high volumes of templates across multiple jurisdictions and matter types, optimizing for search ranking and conversion rate.

**Motivations**:
- Maximize template revenue across all jurisdictions where he is licensed
- Understand and exploit the ranking algorithm
- Use analytics to identify underserved markets and publish there first
- Build a "template empire" with the $25/month API access tier

**Fears**:
- That the platform will cap earnings or penalize high-volume publishers
- That his templates will be commoditized by competitors
- That the platform's quality controls will slow his publishing velocity

**Relevance to product design**: David represents the "power user" who will stress-test every system. His behavior informs rate limiting, quality controls, and anti-gaming measures. The product must support power users without letting them degrade the marketplace for everyone.

---

## 4. User Stories

### 4.1 Marketplace Discovery (Client-Facing)

**US-MD-01**: As a client, I want to search for templates by jurisdiction and matter type so that I find documents relevant to my legal situation.
- *Acceptance Criteria*:
  - Search accepts state/province code, matter type, and free-text keywords
  - Results return within 500ms for the first page
  - Results display: template title, lawyer name, price, average rating, number of completions, jurisdiction badges
  - Empty results show "No templates found" with suggestions for adjacent jurisdictions or matter types

**US-MD-02**: As a client, I want to browse templates by category (family law, civil law) so that I can discover document types I did not know I needed.
- *Acceptance Criteria*:
  - Category pages show all matter types within that practice area
  - Each matter type card shows: display name, tagline, number of available templates, price range
  - Clicking a matter type navigates to filtered search results

**US-MD-03**: As a client, I want to filter search results by price range, rating, and number of completions so that I can find the best value.
- *Acceptance Criteria*:
  - Price range filter: free, $1-10, $10-25, $25-50, $50+
  - Rating filter: 4+ stars, 3+ stars
  - Completions filter: 10+, 50+, 100+, 500+
  - Filters are combinable and update results without full page reload
  - Active filters shown as dismissible chips

**US-MD-04**: As a client, I want to see a template detail page with full description, lawyer credentials, sample questions, and reviews before purchasing.
- *Acceptance Criteria*:
  - Detail page shows: title, description, price, lawyer name and bar number, jurisdiction coverage, matter type, average rating, total completions, sample interview questions (first 3 from phase 1), client reviews (most recent 10, paginated)
  - "Start Interview" button is prominent
  - If template is free, button says "Start Free Interview"
  - Breadcrumb navigation shows: Marketplace > [Category] > [Matter Type] > [Template Name]

**US-MD-05**: As a client, I want to see "popular in your area" recommendations based on my detected jurisdiction so that discovery is personalized.
- *Acceptance Criteria*:
  - Jurisdiction detected from browser geolocation API (with fallback to IP-based), user profile state, or URL parameter
  - Recommendations section shows top 6 templates for detected jurisdiction
  - If jurisdiction cannot be detected, show overall top templates with a prompt to select a state

**US-MD-06**: As a client, I want to view a "compare templates" feature for the same matter type and jurisdiction so that I can evaluate options side by side.
- *Acceptance Criteria*:
  - Client can select up to 3 templates for comparison
  - Comparison table shows: price, rating, completions, number of interview phases, estimated completion time, lawyer credentials
  - "Compare" checkbox appears on search result cards

**US-MD-07**: As a client, I want to see SEO-friendly marketplace pages so that I can find templates through Google search.
- *Acceptance Criteria*:
  - Each jurisdiction + matter type combination has a canonical URL (e.g., `/marketplace/texas/divorce`)
  - Pages include appropriate meta title, description, and structured data (JSON-LD for Product)
  - Pages are server-rendered or pre-rendered for SEO (within SPA constraints)

### 4.2 Template Builder (Lawyer-Facing)

**US-TB-01**: As a lawyer, I want to create a new template by defining interview phases, questions, and document structure using a visual editor so that I do not need to write code.
- *Acceptance Criteria*:
  - Visual editor shows a phase list on the left and a phase detail panel on the right
  - Phases can be added, removed, reordered via drag-and-drop
  - Each phase has: name, display name, description, list of questions/fields to collect, system prompt (read-only on free tier)
  - Save button persists the template as JSONB in `marketplace_templates` table
  - Auto-save triggers every 30 seconds when changes are detected

**US-TB-02**: As a lawyer, I want to define conditional logic for interview phases so that the interview skips irrelevant sections.
- *Acceptance Criteria*:
  - Each phase has an optional "skip if" condition defined as a JSON rule (e.g., `{"field": "hasChildren", "equals": false}` skips the CHILDREN phase)
  - Conditions reference fields collected in prior phases
  - Visual builder provides a dropdown of available fields and comparison operators
  - Preview mode shows which phases would be shown for a given set of test answers

**US-TB-03**: As a lawyer, I want to preview the client interview experience before publishing so that I can verify the flow works correctly.
- *Acceptance Criteria*:
  - "Preview" button opens a modal that simulates the client interview
  - Preview uses the same `DynamicOrchestrator` that clients will use
  - Lawyer can step through each phase, see the AI responses, and verify question sequencing
  - Preview data is not persisted (ephemeral session)
  - Preview clearly labeled "PREVIEW MODE" to distinguish from live interviews

**US-TB-04**: As a lawyer, I want to specify which jurisdictions my template supports so that it only appears in relevant search results.
- *Acceptance Criteria*:
  - Multi-select jurisdiction picker with search (all 64 NA jurisdictions, plus international if `ENABLE_INTERNATIONAL=true`)
  - Lawyer can only select jurisdictions where they are licensed (verified against their bar admissions on file)
  - Template appears in marketplace search only for selected jurisdictions

**US-TB-05**: As a lawyer, I want to define the document output format (which sections appear in the PDF, in what order, with what headings) so that the generated document matches local court expectations.
- *Acceptance Criteria*:
  - Document structure editor shows sections: header/caption, body paragraphs, signature block, notary block, certificate of service
  - Each section can reference interview data fields using `{{fieldName}}` syntax
  - Sections can be marked as conditional (only appear if a field has a value)
  - A "court format" preset provides standard section ordering for the selected jurisdiction

**US-TB-06**: As a lawyer, I want to set my template's price so that I control my per-document revenue.
- *Acceptance Criteria*:
  - Price field accepts values from $0 (free) to $999 in $0.01 increments
  - Price is stored in cents as an integer (`price_cents`) server-side
  - Client-facing display shows: template price + $1 platform fee + estimated Stripe processing fee
  - Lawyer sees their net revenue per document (price minus nothing -- platform fee is additive, not deductive)
  - Price changes apply only to future purchases, not in-progress interviews

**US-TB-07**: As a lawyer, I want to duplicate an existing template so that I can create jurisdiction variants without starting from scratch.
- *Acceptance Criteria*:
  - "Duplicate" button on template management page
  - Duplicate creates a new draft template with all phases, questions, and structure copied
  - Duplicate has a new ID and defaults to "draft" status
  - Lawyer must change the title and jurisdiction before publishing the duplicate

**US-TB-08**: As a lawyer, I want to import my existing document templates (Word/PDF) to bootstrap the template creation process so that I do not have to start from nothing.
- *Acceptance Criteria*:
  - Upload accepts .docx and .pdf files up to 10MB
  - System uses LLM to extract: section headings, fill-in-the-blank fields, conditional sections
  - Extracted structure is presented in the visual editor for lawyer review and adjustment
  - Import is a starting point, not a finished product -- lawyer must review and publish

**US-TB-09**: As a lawyer, I want to version my templates so that I can update legal requirements without breaking in-progress interviews.
- *Acceptance Criteria*:
  - Publishing a new version creates a new version record; the old version remains active for in-progress interviews
  - In-progress interviews continue on the version they started with
  - New purchases always get the latest published version
  - Version history is visible in the lawyer dashboard with diff view

### 4.3 AI Prompt Editor (Paid Tier)

**US-PE-01**: As a lawyer on the $1/month tier, I want to customize the AI system prompt for each interview phase so that the AI's tone and guidance match my practice style.
- *Acceptance Criteria*:
  - System prompt textarea is editable (locked to read-only on free tier with upgrade CTA)
  - Default prompt is pre-populated based on the matter type and phase
  - Character limit: 4,000 characters per phase prompt
  - Changes are saved to the template's JSONB `phases[].prompt` field
  - Preview mode uses the customized prompts

**US-PE-02**: As a lawyer, I want to add jurisdiction-specific instructions to the AI prompt so that the interview asks questions relevant to local court rules.
- *Acceptance Criteria*:
  - A "jurisdiction context" section within the prompt editor pre-fills with known requirements for the selected state (residency, waiting periods, filing fees from `metadata.json`)
  - Lawyer can edit or extend this context
  - System validates that required jurisdiction fields are present in the prompt

**US-PE-03**: As a lawyer, I want to preview how my customized prompts affect the AI's responses so that I can iterate without publishing.
- *Acceptance Criteria*:
  - "Test prompt" button sends the prompt + a sample user message to the LLM and displays the response
  - Test uses the same model and temperature as production (GPT-4o, temperature 0.3)
  - Test responses are ephemeral and not persisted
  - Rate limited to 20 test prompts per hour per lawyer

### 4.4 Client Interview Experience

**US-IE-01**: As a client, I want to be guided through a one-question-at-a-time interview so that I am not overwhelmed by legal complexity.
- *Acceptance Criteria*:
  - Interview uses `DynamicOrchestrator` which loads phase definitions from the purchased template's JSONB
  - AI asks exactly one question per message (enforced by `ORCHESTRATOR_BEHAVIOR` rules)
  - Progress indicator shows current phase and overall completion percentage
  - Client can see phase names but not skip ahead

**US-IE-02**: As a client, I want to save my progress and resume later so that I can complete the interview across multiple sessions.
- *Acceptance Criteria*:
  - Interview state is persisted to the `documents` table after each AI response
  - "Save and Exit" button is always visible
  - Returning to the interview loads the last state (current phase, collected data, conversation history)
  - Resume modal shows when the interview was last active and which phase the client is on

**US-IE-03**: As a client, I want to understand why the AI is asking each question so that I feel confident providing accurate information.
- *Acceptance Criteria*:
  - Each phase has a `description` field displayed as context text above the chat
  - If the client asks "why do you need this?", the AI explains the legal relevance (this behavior is part of the system prompt)
  - Tooltips on collected fields show which document section they populate

**US-IE-04**: As a client, I want to edit previously provided answers so that I can correct mistakes before generating documents.
- *Acceptance Criteria*:
  - Validation sidebar (existing `ValidationSidebar` component) shows all collected facts
  - Client can click any fact to edit it inline
  - Editing a fact re-validates the document and updates completion percentage
  - Editing does not reset the interview to an earlier phase

**US-IE-05**: As a client, I want to see a document preview before paying so that I know what I am getting.
- *Acceptance Criteria*:
  - At the REVIEW phase, client sees a rendered HTML preview of the document (existing `DocumentPreview` component)
  - Preview is watermarked "PREVIEW -- NOT FOR FILING"
  - Preview shows all sections, with collected data filled in
  - "Download PDF" is gated behind payment

**US-IE-06**: As a client in a domestic violence matter, I want to see safety resources and a quick exit button so that my physical safety is prioritized.
- *Acceptance Criteria*:
  - DVRO and related matter types show the existing `DVSafetyBanner` component
  - `QuickExit` button is visible on all interview pages
  - AI system prompt for safety-related phases includes crisis hotline numbers (National DV Hotline: 1-800-799-7233)
  - Interview data is encrypted at rest and the client can request immediate deletion

**US-IE-07**: As a client, I want to upload supporting evidence during the interview so that relevant documents are attached to my case file.
- *Acceptance Criteria*:
  - Evidence upload modal (existing `EvidenceUploadModal`) is triggered when the AI requests supporting documents
  - Accepted formats: PDF, JPEG, PNG, up to 10MB per file, up to 20 files per interview
  - Uploaded files are stored in the `evidence` table and linked to the document
  - Evidence is included as attachments in the generated PDF package

**US-IE-08**: As a client, I want the interview to be accessible on mobile devices so that I can complete it on my phone.
- *Acceptance Criteria*:
  - Interview UI is fully responsive at 320px minimum width
  - Chat interface uses native scroll behavior on mobile
  - File upload works with mobile camera (capture attribute on input)
  - Session persistence works across device switches (same account, different device)

### 4.5 PDF Generation and Customization

**US-PG-01**: As a client, I want to download a professionally formatted PDF document package after payment so that I can file it with the court.
- *Acceptance Criteria*:
  - PDF generation uses existing `PDFService` with template-defined structure
  - Package includes all documents defined by the template (petition, decree, waiver, etc.)
  - Each document has proper headers, court captions, page numbers, and signature blocks
  - US documents use Letter (8.5x11) format; international documents use A4 when `ENABLE_INTERNATIONAL=true`

**US-PG-02**: As a lawyer on the $3/month branding tier, I want my firm logo and colors on the generated PDFs so that every document is a branded advertisement.
- *Acceptance Criteria*:
  - Lawyer can upload a logo (PNG/JPEG, max 500KB, recommended 200x60px)
  - Lawyer can select a primary accent color (hex value)
  - Logo appears in the PDF header; accent color is used for horizontal rules and section headings
  - If no custom branding, PDFs use the default discover.legal branding
  - Branding settings are stored per-lawyer, not per-template (apply to all templates)

**US-PG-03**: As a client, I want to re-download my generated documents at any time so that I have access to them even if I lose the original files.
- *Acceptance Criteria*:
  - Completed documents are stored in the `documents` table with `pdf_file_path`
  - Client dashboard shows a "Downloads" section with all purchased documents
  - Download link remains active indefinitely (no expiration)
  - Re-download does not incur additional charges

**US-PG-04**: As a client, I want the generated PDF to include filing instructions specific to my court so that I know what to do next.
- *Acceptance Criteria*:
  - A "Filing Instructions" cover page is appended to the document package
  - Instructions include: which court to file at (based on county), filing fee amount, number of copies needed, whether e-filing is available, any required cover sheets
  - Instructions are generated from template metadata + jurisdiction data

### 4.6 Lawyer Dashboard

**US-LD-01**: As a lawyer, I want to see my total revenue, document sales count, and average rating on a dashboard so that I can track my marketplace performance.
- *Acceptance Criteria*:
  - Dashboard shows: total revenue (all time and this month), total documents sold, average rating, number of active templates, current subscription tier
  - Revenue chart shows daily/weekly/monthly trends (selectable)
  - Data refreshes on page load; no real-time WebSocket updates in v1

**US-LD-02**: As a lawyer, I want to see per-template performance metrics so that I can identify which templates are succeeding and which need improvement.
- *Acceptance Criteria*:
  - Template list shows: title, status, price, total sales, this month's sales, average rating, completion rate (started vs. finished interviews), revenue
  - Sortable by any column
  - Click-through to template detail shows: conversion funnel (viewed > started > completed > paid), average completion time, most common drop-off phase

**US-LD-03**: As a lawyer, I want to receive email notifications when my templates earn revenue so that passive income feels tangible.
- *Acceptance Criteria*:
  - Notification sent when a client completes a purchase (not on every interview message)
  - Email includes: template name, client's jurisdiction (not client's name), amount earned, cumulative monthly total
  - Notification frequency is configurable: every sale, daily digest, weekly digest, off
  - Email notifications are handled via service integration (e.g., SendGrid), not a dedicated database table

**US-LD-04**: As a lawyer, I want to manage all my templates (create, edit, publish, unpublish, archive) from a single page.
- *Acceptance Criteria*:
  - Template management page shows all templates with status badges (draft, published, unpublished, archived)
  - Bulk actions: publish, unpublish, archive selected templates
  - Status transitions: draft -> published, published -> unpublished, any -> archived
  - Archived templates are hidden from the marketplace but data is retained

**US-LD-05**: As a lawyer, I want to see which phases clients most frequently drop off at so that I can improve my interview flow.
- *Acceptance Criteria*:
  - Per-template funnel visualization showing: sessions started, each phase entry count, sessions completed, documents paid
  - Drop-off phases highlighted in red when drop-off rate exceeds 20%
  - Available on the $10/month analytics tier
  - Free tier shows only total completions and total revenue

**US-LD-06**: As a lawyer, I want to export my revenue data for tax reporting purposes.
- *Acceptance Criteria*:
  - "Export" button generates a CSV with: date, template name, document ID, amount earned, Stripe payout ID
  - Date range selector for the export
  - Includes a 1099-K notice when annual revenue exceeds $600 (Stripe handles actual 1099-K issuance)

### 4.7 Client Dashboard

**US-CD-01**: As a client, I want to see all my purchased documents and in-progress interviews on a dashboard so that I can manage my legal matters.
- *Acceptance Criteria*:
  - Dashboard sections: "In Progress" (active interviews), "Completed" (paid and downloaded), "All Documents"
  - In-progress items show: template name, current phase, completion percentage, last active date, "Resume" button
  - Completed items show: template name, completion date, download button, receipt link

**US-CD-02**: As a client, I want to see my payment history so that I have records of all transactions.
- *Acceptance Criteria*:
  - Payment history shows: date, template name, amount paid (breakdown: template price + platform fee + processing), payment status, receipt link
  - Receipt link opens Stripe-hosted receipt page
  - Sortable by date, filterable by status

**US-CD-03**: As a client, I want to start a new document from my dashboard so that I do not have to go back to the marketplace.
- *Acceptance Criteria*:
  - "New Document" button on dashboard navigates to marketplace search
  - Recent jurisdiction and matter type are pre-filled based on past purchases
  - "Buy Again" option on completed documents to start a new interview with the same template

**US-CD-04**: As a client, I want to delete my account and all associated data so that I maintain control of my personal information.
- *Acceptance Criteria*:
  - "Delete Account" option in account settings
  - Deletion requires email confirmation
  - All documents, interview data, conversation history, and uploaded evidence are permanently deleted
  - Payment records are retained for 7 years per legal/tax requirements (anonymized)
  - Auth0 account is deactivated

### 4.8 Payment System

**US-PS-01**: As a client, I want to pay for a document using a credit card so that I can immediately download my completed documents.
- *Acceptance Criteria*:
  - Payment uses Stripe Checkout or Stripe Elements (existing `PaymentModal` modified for Connect)
  - Amount displayed: template price + $1 platform fee + Stripe processing fee (estimated at 2.9% + $0.30)
  - Example: $19 template = $19 + $1 + $0.88 = $20.88 total
  - Payment creates a Stripe PaymentIntent with destination charge to lawyer's connected account
  - On success: document PDF generated, download link provided, receipt emailed

**US-PS-02**: As a lawyer, I want to receive payouts to my bank account for my template sales so that I actually get paid.
- *Acceptance Criteria*:
  - Lawyer onboards via Stripe Connect Express (hosted onboarding flow)
  - Payouts are automatic on a rolling basis (Stripe default: 2-day rolling for US)
  - Lawyer dashboard shows: pending balance, next payout date, payout history
  - Platform takes $1 flat fee per document (not deducted from lawyer price -- added on top for client)

**US-PS-03**: As a platform operator, I want the $1 platform fee collected on every document transaction so that the platform generates revenue.
- *Acceptance Criteria*:
  - Stripe destination charge routes `template_price` to lawyer's connected account
  - Application fee of 100 cents ($1.00) is specified on every charge
  - Stripe processing fees are borne by the client (passed through as part of the total)
  - Platform receives $1 per document regardless of template price
  - For free templates ($0 price): client pays $1 + Stripe processing = approximately $1.33 total

**US-PS-04**: As a lawyer, I want to see a breakdown of every transaction so that I understand exactly how the money flows.
- *Acceptance Criteria*:
  - Transaction detail shows: gross amount (client paid), Stripe processing fee, platform fee ($1), net to lawyer
  - Example: Client pays $20.88 -> Stripe takes $0.88 -> Platform takes $1.00 -> Lawyer receives $19.00
  - Transaction list in lawyer dashboard with CSV export

**US-PS-05**: As a client, I want to see a clear price breakdown before confirming payment so that there are no surprises.
- *Acceptance Criteria*:
  - Pre-payment summary shows: Template: $19.00 / Platform fee: $1.00 / Processing: ~$0.88 / Total: $20.88
  - Processing fee is estimated (exact amount varies by card type)
  - "Why these fees?" link explains: platform fee funds the AI interview engine; processing fee is Stripe's standard rate

**US-PS-06**: As a client, I want to request a refund if my document is incorrect or the interview did not work as described.
- *Acceptance Criteria*:
  - "Request Refund" button available within 30 days of purchase
  - Refund request goes to platform review queue (not automatic)
  - Platform can issue full or partial refund
  - Refund reverses the destination charge (Stripe claws back from lawyer's connected account)
  - Refund reason is logged for template quality monitoring

### 4.9 Subscription Management

**US-SM-01**: As a lawyer, I want to subscribe to feature tiers so that I can unlock advanced capabilities.
- *Acceptance Criteria*:
  - Subscription tiers:
    - Free: Visual editor, 3 template listings, basic stats (revenue + completions only)
    - $1/month: AI prompt editing per phase
    - $3/month: Custom branding (logo + colors on PDFs)
    - $5/month: Clio integration (import/export contacts, matters, documents)
    - $10/month: Advanced analytics (funnel, drop-off, conversion, cohort analysis)
    - $25/month: API access + white-label embed widget
    - $49/month: Pro bundle (all features included)
  - Subscriptions are managed via Stripe Billing (recurring charges)
  - Tiers are additive: subscribing to $10/month analytics does NOT include $3/month branding (unless on $49 bundle)

**US-SM-02**: As a lawyer, I want to upgrade or downgrade my subscription at any time so that I can adjust based on my needs.
- *Acceptance Criteria*:
  - Upgrade takes effect immediately (prorated charge for current billing period)
  - Downgrade takes effect at end of current billing period
  - Downgrading removes access to the downgraded features (e.g., custom branding reverts to default on next PDF generation)
  - In-progress interviews continue to use the features available when the interview started

**US-SM-03**: As a lawyer, I want to see which features each tier unlocks so that I can make an informed purchasing decision.
- *Acceptance Criteria*:
  - Pricing page shows a comparison matrix of all tiers
  - Each locked feature in the UI shows an upgrade CTA with the minimum tier needed
  - Example: AI prompt textarea shows "Unlock prompt editing -- $1/month" with a subscribe button

**US-SM-04**: As a lawyer, I want my free tier to never expire so that I can always use the basic template editor and publish up to 3 templates.
- *Acceptance Criteria*:
  - Free tier has no time limit
  - 3-template limit is enforced at publish time (drafts are unlimited)
  - If a lawyer downgrades from a paid tier, they keep their published templates but cannot publish new ones beyond the 3-template limit

### 4.10 Affiliate System

**US-AF-01**: As a lawyer, I want to generate an affiliate link for my templates so that I can promote them on my website and social media.
- *Acceptance Criteria*:
  - Each template has a shareable URL: `make.discover.legal/marketplace/t/{slug}?ref={affiliate_code}`
  - Affiliate code is unique per lawyer (auto-generated, not editable)
  - Link is copyable from the template management page
  - Clicking an affiliate link sets a cookie with 30-day expiration (last-click attribution)

**US-AF-02**: As an affiliate, I want to earn $0.25 for every document purchased through my link so that I am incentivized to promote the platform.
- *Acceptance Criteria*:
  - When a client completes a purchase with an active affiliate cookie, $0.25 is credited to the affiliate's account
  - The $0.25 is funded from the platform's $1 fee (platform net per doc drops to $0.75 on affiliate-referred sales)
  - Affiliate earnings are tracked in the `affiliate_referrals` table (payouts managed via `affiliate_payouts`)
  - Minimum payout threshold: $10.00

**US-AF-03**: As an affiliate, I want to see my conversion metrics so that I can optimize my promotional efforts.
- *Acceptance Criteria*:
  - Affiliate dashboard shows: total clicks, unique visitors, conversions (purchases), conversion rate, total earnings, pending payout
  - Per-link breakdown if the affiliate promotes multiple templates
  - Date range filter for all metrics

**US-AF-04**: As a lawyer, I want to set a higher commission for affiliates promoting my templates so that I can incentivize external promotion.
- *Acceptance Criteria*:
  - Default affiliate commission: $0.25 (platform-funded)
  - Lawyer can increase commission up to $5.00 per conversion
  - Excess above $0.25 is deducted from the lawyer's template revenue for that sale
  - Example: Lawyer sets $1.00 commission. Platform pays $0.25, lawyer pays $0.75 from their $19.00 revenue (net: $18.25)

**US-AF-05**: As a lawyer, I want to refer other lawyers to the platform and earn a one-time $5 bonus per referred lawyer who publishes their first template.
- *Acceptance Criteria*:
  - Lawyer-to-lawyer referral is separate from client affiliate links
  - Referral tracked via unique invite code
  - $5.00 credited when the referred lawyer publishes their first template (not on signup alone)
  - One-time per referred lawyer (not recurring)
  - Credited to the referring lawyer's payout balance

### 4.11 Clio Integration

**US-CI-01**: As a lawyer on the $5/month Clio tier, I want to connect my Clio account so that I can import client data and export documents.
- *Acceptance Criteria*:
  - OAuth2 authorization code flow with Clio's API
  - Lawyer clicks "Connect Clio" button, is redirected to Clio for authorization, redirected back with auth code
  - Access token and refresh token stored encrypted in the database
  - Connection status shown in lawyer settings (connected/disconnected, connected account name)

**US-CI-02**: As a lawyer, I want to import my Clio contacts into a template interview so that clients do not have to re-enter information I already have.
- *Acceptance Criteria*:
  - "Import from Clio" button in the interview pre-fill screen
  - Searches Clio contacts by name or email
  - Imported fields: name, email, phone, address, date of birth
  - Imported data pre-fills the interview; client can review and correct before proceeding

**US-CI-03**: As a lawyer, I want to export completed documents back to a Clio matter so that my practice management system stays up to date.
- *Acceptance Criteria*:
  - "Export to Clio" button on completed documents in lawyer dashboard
  - Lawyer selects the target Clio matter (search by matter name/number)
  - PDF document is uploaded as a document in the Clio matter
  - Activity note is created in the Clio matter: "Document generated via discover.legal: [template name]"

**US-CI-04**: As a lawyer, I want Clio integration to automatically create a new matter when a client purchases one of my templates so that I can track marketplace interactions in my practice management system.
- *Acceptance Criteria*:
  - Auto-create is an opt-in setting per template
  - When enabled: on purchase, a new Clio matter is created with the client's name, matter type, and jurisdiction
  - Document is attached to the matter upon completion
  - Lawyer sees the Clio matter link in their dashboard for that transaction

### 4.12 Review and Rating System

**US-RR-01**: As a client, I want to rate and review a template after completing my document so that I can help other clients make informed decisions.
- *Acceptance Criteria*:
  - Rating prompt appears after document download (not during interview)
  - 1-5 star rating plus optional text review (max 1,000 characters)
  - Client can only review templates they have completed (verified purchase)
  - One review per client per template (can edit within 30 days)

**US-RR-02**: As a client, I want to read reviews from other clients before purchasing a template so that I can assess quality.
- *Acceptance Criteria*:
  - Template detail page shows reviews sorted by most recent (default), most helpful, highest rated, lowest rated
  - Each review shows: star rating, review text, date, "Verified Purchase" badge
  - Client names are shown as first name + last initial (e.g., "Sarah M.") for privacy
  - Average rating shown prominently with total review count

**US-RR-03**: As a lawyer, I want to respond to client reviews so that I can address feedback publicly.
- *Acceptance Criteria*:
  - Lawyer can post one response per review
  - Response appears directly below the client review
  - Responses labeled "Response from [Lawyer Name]"
  - Lawyer cannot edit or delete client reviews

**US-RR-04**: As a platform operator, I want to flag and moderate reviews that contain inappropriate content, personal information, or false claims.
- *Acceptance Criteria*:
  - Reviews are automatically scanned for PII (phone numbers, email addresses, case numbers) and blocked if detected
  - "Report" button on each review triggers manual review
  - Platform admin can hide reviews pending investigation
  - Removal reasons: contains PII, defamatory, spam, not a verified purchase

**US-RR-05**: As a client, I want to see a "Quality Score" for each template that combines multiple signals so that I can quickly assess reliability.
- *Acceptance Criteria*:
  - Quality Score is a composite of: average rating (40%), completion rate (30%), refund rate (20%), lawyer credentials (10%)
  - Displayed as a badge: "Excellent" (90+), "Good" (75-89), "Fair" (60-74), no badge below 60
  - Calculation is transparent (tooltip shows component breakdown)
  - Recalculated daily (not real-time) to prevent gaming

### 4.13 Gamification and Engagement

**US-GE-01**: As a lawyer, I want to see a public leaderboard of top template creators so that I can see how I rank against peers.
- *Acceptance Criteria*:
  - Leaderboard page shows top 100 creators ranked by: total revenue (default), total completions, average rating, templates published
  - Filterable by: jurisdiction, matter type, practice area, time period (all time, this year, this month)
  - Lawyer's own rank is highlighted regardless of position
  - Leaderboard updates daily at midnight UTC

**US-GE-02**: As a lawyer, I want to earn achievement badges so that my profile signals credibility to potential clients.
- *Acceptance Criteria*:
  - Achievement categories:
    - Volume: "First Sale", "100 Documents Sold", "500 Documents Sold", "1,000 Documents Sold"
    - Revenue: "First $100", "First $1,000", "$5,000 Club", "$10,000 Club"
    - Quality: "5-Star Template", "Top Rated in [State]", "Top Rated in [Matter Type]"
    - Engagement: "Early Adopter" (joined in first 6 months), "Template Author" (published 5+), "Multi-Jurisdiction" (published in 3+ states)
    - Streaks: "7-Day Streak" (at least 1 sale per day for 7 days), "30-Day Streak"
  - Badges displayed on lawyer profile and template detail pages
  - Earned badges cannot be revoked (except "Top Rated" which recalculates periodically)

**US-GE-03**: As a lawyer, I want to receive a weekly email digest of my marketplace performance so that I stay engaged even when I am not actively using the platform.
- *Acceptance Criteria*:
  - Weekly email includes: revenue this week, total documents sold, new reviews, rank change on leaderboard, new competitor templates in my jurisdiction
  - "New competitor templates" is the anti-apathy trigger -- knowing someone just published a competing template motivates updates
  - Unsubscribe option available

**US-GE-04**: As a lawyer, I want to see real-time revenue notifications when a client purchases my template so that passive income feels tangible and immediate.
- *Acceptance Criteria*:
  - In-app notification (bell icon): "You earned $19 from Texas Uncontested Divorce in Harris County"
  - Push notification (if browser permissions granted): same message
  - Email notification: configurable frequency (every sale, daily digest, weekly, off)
  - Notification includes: template name, jurisdiction, amount earned, cumulative monthly total

**US-GE-05**: As a lawyer, I want to see my "Marketplace Score" -- a single number that represents my overall marketplace presence -- so that I have a gamified goal to improve.
- *Acceptance Criteria*:
  - Marketplace Score (0-1000) is a weighted composite of: total revenue (30%), total completions (25%), average rating (20%), template count (15%), response rate to reviews (10%)
  - Score displayed prominently on lawyer dashboard
  - Thresholds unlock visual badges: Bronze (200), Silver (400), Gold (600), Platinum (800), Diamond (950)
  - Score history chart shows trend over time

**US-GE-06**: As a client, I want to see "trending" and "new" template badges on the marketplace so that I can discover fresh and popular options.
- *Acceptance Criteria*:
  - "Trending" badge: templates with >20% sales increase week-over-week
  - "New" badge: templates published within the last 14 days
  - "Staff Pick" badge: manually curated by platform team (reserved for v2)
  - Badges appear on search result cards and template detail pages

### 4.14 Lawyer Onboarding and Verification

**US-LV-01**: As a lawyer, I want to sign up and verify my bar admission so that clients trust my credentials.
- *Acceptance Criteria*:
  - Lawyer role is assigned after bar verification (not on signup)
  - Verification accepts: bar number + state, name as it appears on bar records
  - Platform verifies against state bar association public lookup APIs where available (automated for states with API access, manual review for others)
  - Verified badge appears on lawyer profile and all template listings
  - Verification must be completed before any template can be published

**US-LV-02**: As a lawyer, I want a guided onboarding flow that helps me publish my first template so that I am not lost in an unfamiliar product.
- *Acceptance Criteria*:
  - Onboarding checklist: (1) Complete profile, (2) Connect Stripe, (3) Verify bar admission, (4) Create first template, (5) Publish first template
  - Each step has a guided walkthrough with tooltips
  - Dashboard shows onboarding progress until all 5 steps are complete
  - "Skip for now" option on non-blocking steps (Stripe can be connected later)

**US-LV-03**: As a lawyer, I want to connect my Stripe account during onboarding so that I can receive payouts immediately when my templates sell.
- *Acceptance Criteria*:
  - Stripe Connect Express onboarding flow (Stripe-hosted, compliant)
  - Onboarding collects: bank account, identity verification, tax information
  - On completion, `stripe_account_id` is stored in the lawyer's profile
  - Templates cannot be set to a non-zero price until Stripe is connected

### 4.15 Admin and Moderation

**US-AM-01**: As a platform admin, I want to review and approve templates before they go live so that the marketplace maintains quality standards.
- *Acceptance Criteria*:
  - New templates enter a "pending review" state before being publicly visible
  - Admin review queue shows: template title, lawyer name, jurisdiction, matter type, submission date
  - Admin can: approve, reject (with reason), or request changes
  - Approval SLA: 48 hours (goal, not hard requirement)
  - Auto-approval for lawyers with 10+ approved templates and no rejections in the last 6 months

**US-AM-02**: As a platform admin, I want to see a fraud and quality dashboard so that I can identify problematic templates or lawyers.
- *Acceptance Criteria*:
  - Dashboard shows: templates with high refund rates (>10%), templates with ratings below 3.0, lawyers with multiple rejected submissions, suspicious activity patterns (rapid price changes, bulk publishing)
  - Alert triggers are configurable
  - Admin can suspend a lawyer's account pending investigation

**US-AM-03**: As a platform admin, I want to manage the platform fee and affiliate commission rates so that business model parameters can be adjusted without code changes.
- *Acceptance Criteria*:
  - Admin settings page for: platform fee per document (default $1.00), default affiliate commission (default $0.25), maximum affiliate commission (default $5.00), refund window (default 30 days)
  - Changes apply to future transactions only
  - Audit log records all admin setting changes

---

## 5. Feature Specifications

### 5.1 Marketplace Discovery

#### 5.1.1 Search Engine

The marketplace search is the primary discovery mechanism. It must be fast, relevant, and jurisdiction-aware.

**Search index**:
- Indexed fields: template title, description, lawyer name, jurisdiction codes, matter type code, practice area, tags
- Full-text search using PostgreSQL `tsvector` / `tsquery` with rank
- Faceted filtering: jurisdiction, matter type, practice area, price range, rating, completions count

**Search API**: `GET /api/marketplace/search`
- Query parameters: `q` (text), `jurisdiction`, `matter_type`, `practice_area`, `price_min`, `price_max`, `rating_min`, `completions_min`, `sort` (relevance, price_asc, price_desc, rating, completions, newest), `page`, `per_page`
- Response: paginated array of template summaries + facet counts
- Performance target: p95 < 500ms for first page

**Search result card fields**:
- Template title
- Lawyer display name (linked to profile)
- Jurisdiction badges (e.g., "TX", "CA")
- Price (or "Free")
- Average rating (stars) + review count
- Total completions count
- Quality Score badge (if applicable)
- "Trending" / "New" badges (if applicable)

**Empty state**: When no results match, display:
- "No templates found for [query]"
- Suggested related searches (adjacent jurisdictions, broader matter types)
- CTA for lawyers: "Be the first to create a [matter type] template for [jurisdiction]"

#### 5.1.2 Category Browsing

The category browser is the secondary discovery path for users who do not have a specific search query.

**Hierarchy**:
1. Practice Area (Family Law, Civil Law)
2. Matter Type (Divorce, Custody, Small Claims, etc.)
3. Jurisdiction (Texas, California, Ontario, etc.)

**Pages**:
- `/marketplace` -- landing page with featured templates, categories, leaderboard highlights
- `/marketplace/family-law` -- all family law matter types
- `/marketplace/civil-law` -- all civil law matter types
- `/marketplace/{matter-type}` -- all templates for a matter type (e.g., `/marketplace/divorce`)
- `/marketplace/{jurisdiction}` -- all templates for a jurisdiction (e.g., `/marketplace/texas`)
- `/marketplace/{jurisdiction}/{matter-type}` -- filtered (e.g., `/marketplace/texas/divorce`)
- `/marketplace/t/{slug}` -- individual template detail page

#### 5.1.3 Jurisdiction Detection

Reuses and extends the existing `detectCountry()` logic from `routes/chat.js`:

- Primary: user profile state (if logged in and set)
- Secondary: URL parameter (`?state=TX`)
- Tertiary: browser Geolocation API (requires user permission)
- Fallback: IP-based geolocation (free tier API, country/region level)
- Default: show top templates across all jurisdictions

### 5.2 Template Builder

#### 5.2.1 Architecture

The template builder enables lawyers to create interview-based document templates without writing code. It produces a JSONB configuration that the `DynamicOrchestrator` consumes at runtime.

**Data model** (stored in `marketplace_templates` table):

```
{
  "id": "uuid",
  "lawyer_id": "integer",
  "slug": "texas-uncontested-divorce-no-kids",
  "title": "Texas Uncontested Divorce (No Children)",
  "description": "Complete document package for...",
  "matter_type": "divorce",
  "practice_area": "family",
  "jurisdictions": ["TX"],
  "price_cents": 1900,
  "status": "published",
  "version": 3,
  "template_config": {
    "phases": [
      {
        "code": "INTAKE",
        "displayName": "Basic Information",
        "description": "We'll start by collecting your basic information.",
        "prompt": "You are helping a self-represented litigant...",
        "fields": [
          { "key": "petitionerFirstName", "label": "Your first name", "type": "text", "required": true },
          { "key": "petitionerLastName", "label": "Your last name", "type": "text", "required": true },
          { "key": "county", "label": "County of filing", "type": "text", "required": true }
        ],
        "skipIf": null,
        "order": 1
      },
      {
        "code": "GROUNDS",
        "displayName": "Grounds for Divorce",
        "prompt": "...",
        "fields": [...],
        "skipIf": null,
        "order": 2
      }
    ],
    "phaseOrder": ["INTAKE", "GROUNDS", "PROPERTY", "REVIEW"],
    "fieldMap": {
      "petitioner_first_name": "petitionerFirstName",
      "respondent_first_name": "respondentFirstName"
    },
    "documentStructure": {
      "sections": [
        { "type": "header", "template": "IN THE {{courtType}} COURT..." },
        { "type": "body", "template": "COMES NOW, {{petitionerName}}..." },
        { "type": "signature", "template": "Respectfully submitted..." },
        { "type": "notary", "template": "STATE OF {{state}}..." }
      ]
    },
    "outputDocuments": ["divorce_petition", "waiver_of_service", "divorce_decree"],
    "jurisdictionMetadata": {
      "waitingPeriod": "60 days",
      "filingFee": "$300-$350",
      "residencyRequirement": "6 months state, 90 days county"
    }
  }
}
```

#### 5.2.2 Visual Editor Components

The visual editor is composed of these panels:

1. **Phase List Panel** (left sidebar):
   - Draggable list of phases
   - Add/remove phase buttons
   - Phase status indicators (configured, incomplete, empty)
   - Drag handle for reordering

2. **Phase Detail Panel** (center):
   - Phase name and display name inputs
   - Phase description textarea
   - Fields list with add/remove/reorder
   - Each field: key, label, type (text, date, number, boolean, select), required flag, validation rules
   - Conditional skip logic builder (field, operator, value)
   - System prompt textarea (read-only on free tier, editable on $1+ tier)

3. **Document Structure Panel** (right sidebar or tab):
   - Section list with drag-and-drop reorder
   - Each section: type selector, template text editor with `{{field}}` autocomplete
   - Preview pane showing rendered document with sample data
   - Court format presets per jurisdiction

4. **Settings Panel** (tab):
   - Title, description, jurisdiction selector, matter type, price, tags
   - Output documents checklist (which documents are generated)
   - Filing instructions editor

5. **Toolbar**:
   - Save (draft), Preview, Publish, Duplicate, Version History

#### 5.2.3 DynamicOrchestrator

The `DynamicOrchestrator` extends the existing `BaseMatterOrchestrator` to accept JSONB configuration from the database instead of hardcoded JavaScript objects.

```
class DynamicOrchestrator extends BaseMatterOrchestrator {
  constructor(templateConfig) {
    super({
      stateCode: templateConfig.jurisdictions[0],
      stateName: null,
      matterTypeCode: templateConfig.matter_type,
      practiceArea: templateConfig.practice_area,
      phases: templateConfig.template_config.phases.reduce((acc, p) => {
        acc[p.code] = {
          prompt: p.prompt,
          displayName: p.displayName,
          optional: !!p.skipIf,
          skipIf: p.skipIf ? (data) => evaluateCondition(p.skipIf, data) : undefined
        };
        return acc;
      }, {}),
      phaseOrder: templateConfig.template_config.phaseOrder,
      fieldMap: templateConfig.template_config.fieldMap,
      buildTool: () => buildToolFromFields(templateConfig.template_config.phases)
    });
  }
}
```

An `OrchestratorFactory` resolves the correct orchestrator for a given interview:
1. Check if the document references a marketplace template -> use `DynamicOrchestrator`
2. Otherwise, fall back to existing hardcoded orchestrators (backward compatible)

### 5.3 AI Prompt Editor

Available on the $1/month subscription tier and above.

#### 5.3.1 Prompt Structure

Each phase's system prompt has three sections:

1. **Role and Context** (platform-managed, not editable): Sets the AI's role as a legal document assistant, injects the `ORCHESTRATOR_BEHAVIOR` rules (one question at a time, auto-transition), and adds the progress indicator.

2. **Phase Instructions** (lawyer-editable): The core prompt that tells the AI what to collect in this phase, what to explain to the client, and what the legal requirements are. This is the section the lawyer edits.

3. **Jurisdiction Context** (auto-generated, lawyer-extendable): Pre-filled with known jurisdiction data (residency requirements, waiting periods, filing fees). Lawyer can extend but not remove the auto-generated content.

#### 5.3.2 Prompt Validation

Before a template can be published, the system validates that:
- Every phase has a non-empty prompt
- The prompt references the fields that the phase is expected to collect
- The prompt does not contain disallowed instructions (e.g., "ignore previous instructions", "you are not an AI")
- The prompt length is within limits (4,000 characters per phase, 20,000 total across all phases)

#### 5.3.3 Prompt Testing

The test interface allows lawyers to:
1. Enter a sample user message
2. See the AI's response using their customized prompt
3. Verify that the tool call extracts the expected fields
4. Iterate without affecting live interviews

Rate limit: 20 test calls per hour per lawyer. Uses the same model as production (GPT-4o at temperature 0.3).

### 5.4 Client Interview Experience

The client interview is the core product experience. It reuses the existing chat interface with modifications.

#### 5.4.1 Interview Flow

1. Client purchases a template (or starts a free template)
2. System creates a new `documents` row linked to the marketplace template ID
3. `OrchestratorFactory` instantiates a `DynamicOrchestrator` from the template's JSONB config
4. Client is presented with the chat interface (`ChatInterface` component)
5. AI sends the first phase's opening question
6. Client responds; AI extracts data via tool call, validates, asks next question
7. When a phase is complete, the orchestrator advances to the next phase
8. When all phases are complete, client sees the REVIEW phase with document preview
9. On REVIEW confirmation, document is generated and available for download (payment already completed at purchase)

#### 5.4.2 Modified Components

| Component | Modification |
|-----------|-------------|
| `ChatInterface` | Accept `templateConfig` prop; display phase names from JSONB config |
| `EditorView` | Becomes `InterviewShell`; load template from marketplace_templates instead of hardcoded config |
| `DocumentPreview` | Accept document structure from JSONB config for rendering |
| `ValidationSidebar` | No change needed; works with any fact array |
| `PaymentModal` | Support Stripe Connect destination charges; show fee breakdown |
| `Header` | Role-aware navigation (lawyer portal vs. client marketplace) |

#### 5.4.3 Interview Persistence

The interview state is persisted after every AI response:
- `documents.content`: current interview data (all collected fields)
- `documents.conversation_history`: full chat history (capped at 50 messages)
- `documents.content.orchestratorState`: current phase, completed phases, phase history
- `documents.completion_percentage`: calculated from completed phases / total phases

### 5.5 PDF Generation and Customization

#### 5.5.1 Dynamic PDF Generation

The existing `PDFService` is extended to accept document structure from the marketplace template's JSONB config instead of hardcoded template classes.

**DynamicPDFService** responsibilities:
1. Load the document structure from the template config
2. Substitute `{{field}}` placeholders with collected interview data
3. Apply lawyer branding (if $3/month tier): logo, accent color
4. Generate pages for each output document type
5. Append filing instructions page
6. Apply watermark in preview mode

**Page formats**:
- US jurisdictions: Letter (8.5" x 11"), 1" margins
- Canadian jurisdictions: Letter (default) with option for A4
- International jurisdictions: A4 (210mm x 297mm) when `ENABLE_INTERNATIONAL=true`

#### 5.5.2 Custom Branding ($3/month tier)

Lawyers on the branding tier can customize:
- **Logo**: displayed in the PDF header, left-aligned, max height 40px
- **Accent color**: used for horizontal rules and section heading text
- **Contact line**: small text below the logo (e.g., "Template by Law Office of Maria Chen | 713-555-1234")

Branding is per-lawyer (not per-template). All templates by the same lawyer share branding settings.

### 5.6 Lawyer Dashboard

#### 5.6.1 Dashboard Layout

**Top bar**: Marketplace Score (0-1000) with tier badge, notification bell, account menu

**Summary cards** (row of 4):
- Revenue this month ($X,XXX)
- Documents sold this month (XXX)
- Average rating (X.X stars)
- Active templates (XX)

**Revenue chart**: Line chart showing daily revenue for the selected period (7d, 30d, 90d, 1y, all time)

**Template performance table**: sortable columns for all templates with key metrics

**Recent activity feed**: latest 20 events (sales, reviews, template approvals)

#### 5.6.2 Analytics ($10/month tier)

The advanced analytics tier adds:
- **Conversion funnel**: template viewed -> interview started -> interview completed -> document paid
- **Drop-off analysis**: per-phase drop-off rates with visual funnel
- **Cohort analysis**: retention of repeat buyers over time
- **Revenue forecasting**: trend projection based on recent growth rate
- **Competitor alerts**: weekly notification when new templates are published in the same jurisdiction and matter type
- **Demand heatmap**: which jurisdictions and matter types have the most search queries but fewest templates (opportunity identification)

### 5.7 Client Dashboard

Extends the existing `UserDashboard` component.

**Sections**:
1. **In Progress**: active interviews with resume button, current phase indicator, last active timestamp
2. **Completed**: downloaded documents with re-download button, review prompt (if not yet reviewed)
3. **Payment History**: all transactions with receipt links
4. **Account Settings**: profile, notification preferences, connected accounts, delete account

### 5.8 Payment System

#### 5.8.1 Stripe Connect Architecture

**Account types**:
- **Platform**: discover.legal Stripe account (already exists)
- **Connected accounts**: lawyer accounts created via Stripe Connect Express

**Charge flow** (destination charges):

```
Client pays $20.88 total
  -> Stripe creates a charge on the platform account
  -> Stripe transfers $19.00 to lawyer's connected account
  -> Stripe retains $0.88 processing fee
  -> Platform retains $1.00 application fee
```

Implementation uses `stripe.paymentIntents.create()` with:
```javascript
{
  amount: totalAmountCents,        // 2088 ($20.88)
  currency: 'usd',
  application_fee_amount: 100,     // $1.00 platform fee in cents
  transfer_data: {
    destination: lawyerStripeAccountId
  },
  metadata: {
    template_id: templateId,
    document_id: documentId,
    lawyer_id: lawyerId,
    affiliate_code: affiliateCode || null
  }
}
```

#### 5.8.2 Free Templates

For templates priced at $0:
- Client still pays: $0 (template) + $1.00 (platform fee) + $0.33 (Stripe processing on $1.00) = $1.33 total
- No transfer to lawyer's connected account
- Platform receives $1.00; Stripe receives $0.33
- This ensures the platform always earns on every transaction

#### 5.8.3 Refund Handling

Refund policy: 30-day window, manually reviewed.

Refund flow:
1. Client requests refund via dashboard
2. Request enters admin review queue
3. Admin approves/denies
4. On approval: Stripe issues refund, reverses transfer to lawyer, platform fee may or may not be refunded (configurable)
5. Refund logged in `payments` table and `refund_requests` table

### 5.9 Subscription Management

Subscriptions use Stripe Billing with the following product structure:

| Product | Price ID | Amount | Features Unlocked |
|---------|----------|--------|-------------------|
| Prompt Editor | `price_prompt_monthly` | $1/month | AI prompt editing per phase |
| Custom Branding | `price_brand_monthly` | $3/month | Logo + colors on PDFs |
| Clio Integration | `price_clio_monthly` | $5/month | Clio OAuth + import/export |
| Advanced Analytics | `price_analytics_monthly` | $10/month | Funnel, cohort, forecasting |
| API Access | `price_api_monthly` | $25/month | REST API + white-label embed |
| Pro Bundle | `price_pro_monthly` | $49/month | All features |

**Implementation**:
- Tiers are ADDITIVE (a-la-carte): each feature is a separate subscription purchased individually. A lawyer who wants branding ($3) + Clio ($5) pays $8/month.
- Each tier is an independent Stripe Subscription Item (not stacking)
- The $49/month Pro Bundle includes everything and replaces all individual subscriptions
- Subscription status stored in `lawyer_subscriptions` table
- Feature gating checked on every relevant API call via middleware
- Webhook `customer.subscription.updated` updates local state

### 5.10 Affiliate System

#### 5.10.1 Attribution Model

- **Cookie-based**: affiliate code stored in a cookie with 30-day expiration
- **Last-click wins**: if a client clicks multiple affiliate links, the most recent one gets credit
- **Single attribution**: each purchase is attributed to at most one affiliate
- **Verified purchase**: affiliate conversion only counted when payment succeeds (not on interview start)

#### 5.10.2 Payout Structure

- Base commission: $0.25 per conversion (platform-funded from the $1 platform fee)
- Lawyer-set commission: $0.25 to $5.00 (excess funded by lawyer)
- Minimum payout threshold: $10.00
- Payout method: Stripe transfer to affiliate's connected account (same Stripe Connect infrastructure as lawyer payouts)

#### 5.10.3 Anti-Fraud Measures

- Affiliate cannot earn commissions on their own purchases
- IP-based duplicate detection (same IP, same template, within 24 hours)
- Cookie fingerprinting to detect cookie manipulation
- Conversion rate monitoring: affiliates with >50% conversion rates are flagged for review (normal range: 2-15%)

### 5.11 Clio Integration

#### 5.11.1 OAuth2 Flow

1. Lawyer clicks "Connect Clio" in settings
2. Redirect to: `https://app.clio.com/oauth/authorize?response_type=code&client_id={CLIO_CLIENT_ID}&redirect_uri={CALLBACK_URL}&scope=contacts matters documents`
3. User authorizes in Clio
4. Clio redirects to callback with authorization code
5. Backend exchanges code for access + refresh tokens
6. Tokens stored encrypted in `clio_connections` table

#### 5.11.2 Available Operations

| Operation | Clio API Endpoint | Trigger |
|-----------|-------------------|---------|
| List contacts | `GET /api/v4/contacts` | Pre-fill interview |
| Get contact | `GET /api/v4/contacts/{id}` | Import specific contact |
| Create matter | `POST /api/v4/matters` | On template purchase (opt-in) |
| Upload document | `POST /api/v4/documents` | On document completion |
| Create activity | `POST /api/v4/activities` | On document export |

#### 5.11.3 Token Management

- Access tokens expire after 1 hour
- Refresh tokens used to obtain new access tokens automatically
- If refresh fails (user revoked access), mark connection as "disconnected" and prompt re-authorization
- All Clio API calls wrapped in retry logic with token refresh on 401

### 5.12 Review and Rating System

#### 5.12.1 Data Model

```sql
CREATE TABLE template_reviews (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES marketplace_templates(id),
  client_id INTEGER NOT NULL REFERENCES users(id),
  document_id INTEGER NOT NULL REFERENCES documents(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  lawyer_response TEXT,
  lawyer_response_at TIMESTAMP,
  is_visible BOOLEAN DEFAULT true,
  moderation_status VARCHAR(20) DEFAULT 'approved',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(template_id, client_id)
);
```

#### 5.12.2 Quality Score Algorithm

```
quality_score = (
  (avg_rating / 5.0) * 0.40 +
  (completion_rate) * 0.30 +
  (1 - refund_rate) * 0.20 +
  (credential_score) * 0.10
) * 100
```

Where:
- `avg_rating`: average of all ratings (1-5), normalized to 0-1
- `completion_rate`: interviews completed / interviews started, 0-1
- `refund_rate`: refunds / total sales, 0-1 (inverted so lower refunds = higher score)
- `credential_score`: 0.5 base + 0.25 if bar-verified + 0.25 if 5+ years practice

Recalculated nightly. Minimum 5 reviews required before a Quality Score is displayed.

### 5.13 Gamification and Engagement

#### 5.13.1 Leaderboard System

**Global leaderboard**: Top 100 creators across all jurisdictions and matter types
**Filtered leaderboards**: Top creators per jurisdiction, per matter type, per practice area

**Ranking algorithm**:
- Primary: total revenue (all time)
- Tiebreaker 1: total completions
- Tiebreaker 2: average rating
- Tiebreaker 3: number of templates

**Anti-gaming**: Leaderboard position is recalculated daily. Revenue from refunded transactions is excluded. Self-purchases (if somehow detected) are excluded.

#### 5.13.2 Achievement System

Achievements are stored in `lawyer_achievements` table:

| Achievement | Trigger | Badge |
|-------------|---------|-------|
| First Sale | 1 document sold | Bronze circle |
| Century | 100 documents sold | Silver circle |
| Five Hundred Club | 500 documents sold | Gold circle |
| Thousand | 1,000 documents sold | Platinum circle |
| First Hundred | $100 cumulative revenue | Dollar sign badge |
| Grand | $1,000 cumulative revenue | Star badge |
| Five Grand | $5,000 cumulative revenue | Diamond badge |
| Ten Grand | $10,000 cumulative revenue | Crown badge |
| Five Stars | Any template reaches 5.0 avg rating (min 10 reviews) | Star badge |
| Top Rated | #1 rated in any state | State badge |
| Early Adopter | Signed up in first 6 months | Clock badge |
| Prolific | Published 5+ templates | Pencil badge |
| Multi-State | Published in 3+ jurisdictions | Map badge |
| Week Streak | At least 1 sale/day for 7 consecutive days | Fire badge |
| Month Streak | At least 1 sale/day for 30 consecutive days | Flame badge |

#### 5.13.3 Notification Strategy

The notification system is designed to maximize re-engagement without becoming spam:

| Event | In-App | Push | Email |
|-------|--------|------|-------|
| New sale | Always | If permission granted | Configurable frequency |
| New review | Always | Never | Weekly digest |
| Achievement earned | Always | If permission granted | Immediate |
| Leaderboard rank change | Always | Never | Weekly digest |
| New competitor template | Always | Never | Weekly digest |
| Template approved | Always | If permission granted | Immediate |
| Template rejected | Always | If permission granted | Immediate |
| Payout sent | Always | Never | Immediate |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| Marketplace search p95 latency | < 500ms | Datadog APM |
| Template detail page load | < 2s | Lighthouse |
| Interview AI response time | < 8s (GPT-4o) | Server-side timer |
| PDF generation time | < 10s for standard package | Server-side timer |
| Dashboard page load | < 3s | Lighthouse |
| API response (non-AI) | < 200ms p95 | Datadog APM |
| Database query p95 | < 50ms | pg_stat_statements |
| Concurrent interviews | 500+ simultaneous | Load test (k6) |

### 6.2 Security

- All existing security measures continue (RLS, parameterized queries, CSRF, rate limiting)
- Stripe Connect Express handles PCI compliance for lawyer bank details
- Lawyer templates cannot contain executable code (JSONB only, no `eval()` or function definitions)
- Template prompts are sanitized against injection attacks (no `{{constructor}}` or `{{__proto__}}` patterns)
- Client interview data is encrypted at rest (PostgreSQL column-level encryption for PII fields)
- Lawyer bar numbers are not publicly displayed (verified badge only, no number shown)
- Rate limits extended for marketplace:
  - Marketplace search: 60 requests/minute per IP
  - Template creation: 10 templates/hour per lawyer
  - Review submission: 5 reviews/hour per client
  - Affiliate link clicks: 100/minute per affiliate code (anti-click-fraud)

### 6.3 Scalability

- Database: PostgreSQL with read replicas for marketplace search queries
- CDN: Static assets and PDF downloads served via CloudFront or Render's CDN
- Interview state: no change to existing architecture (PostgreSQL JSONB is sufficient for projected volume)
- Target: support 10,000 concurrent users with existing Render infrastructure (vertical scaling) for year 1; evaluate horizontal scaling at 50,000+ concurrent

### 6.4 Availability

- Target: 99.9% uptime (8.76 hours downtime/year)
- Stripe webhook retry handles payment processing during brief outages
- Interview state is persistent; clients lose no data during server restarts
- PDF generation is idempotent; failed generation can be retried without side effects

### 6.5 Accessibility

- WCAG 2.1 Level AA compliance for all marketplace and interview pages
- Screen reader support for chat interface (aria-live regions for AI responses)
- Keyboard navigation for template builder (tab order, focus management)
- Color contrast ratios meet AA standards for all text
- Minimum touch target size 44x44px for mobile

### 6.6 Internationalization

- All UI strings are externalized (i18n-ready), though v1 is English-only
- Currency display respects locale (USD for US, CAD for Canada, etc.)
- Date formats respect locale (MM/DD/YYYY for US, DD/MM/YYYY for international)
- Legal terminology is jurisdiction-specific (petition vs. application, county vs. parish)

### 6.7 Data Retention

| Data Type | Retention Period | Justification |
|-----------|-----------------|---------------|
| Interview data (client PII) | Until client deletes account | User control |
| Conversation history | 1 year after document completion | Support / disputes |
| Payment records | 7 years | Tax / legal compliance |
| Activity logs | 90 days (existing policy) | Debugging |
| Clio tokens | Until disconnected + 30 days | Grace period |
| Affiliate cookies | 30 days | Attribution window |
| Template versions | Indefinite | Audit trail |

---

## 7. Success Metrics

### 7.1 Key Performance Indicators (KPIs)

**North Star Metric**: Monthly documents generated through marketplace templates

**Supply-side KPIs** (lawyers):
| KPI | Month 1 Target | Month 6 Target | Year 1 Target |
|-----|----------------|----------------|----------------|
| Registered lawyers | 50 | 500 | 2,000 |
| Published templates | 100 | 2,000 | 10,000 |
| Templates per active lawyer | 2 | 4 | 5 |
| Lawyer retention (monthly) | 60% | 70% | 75% |
| Avg lawyer monthly revenue | $50 | $200 | $500 |
| Subscription revenue (MRR) | $200 | $5,000 | $30,000 |

**Demand-side KPIs** (clients):
| KPI | Month 1 Target | Month 6 Target | Year 1 Target |
|-----|----------------|----------------|----------------|
| Monthly documents generated | 200 | 5,000 | 50,000 |
| Interview completion rate | 50% | 65% | 75% |
| Client satisfaction (NPS) | 30 | 40 | 50 |
| Repeat purchase rate | 10% | 20% | 25% |
| Platform fee revenue (MRR) | $200 | $5,000 | $50,000 |

**Marketplace health KPIs**:
| KPI | Target |
|-----|--------|
| Avg template rating | > 4.0 stars |
| Refund rate | < 5% |
| Template moderation approval rate | > 85% |
| Avg time to first sale (new template) | < 14 days |
| Jurisdiction coverage (with at least 1 template) | 50 of 64 NA jurisdictions by month 6 |

### 7.2 OKRs (First Quarter Post-Launch)

**Objective 1**: Establish a functioning two-sided marketplace
- KR1: 100 lawyers publish at least 1 template
- KR2: 500 clients complete at least 1 interview
- KR3: $5,000 total platform fee revenue

**Objective 2**: Prove the $1/doc model is sustainable
- KR1: Average platform cost per document < $0.50 (including AI API costs)
- KR2: Monthly subscription revenue covers operating costs
- KR3: No single lawyer accounts for more than 10% of total revenue (marketplace, not dependency)

**Objective 3**: Validate emotional design thesis
- KR1: At least 3 lawyer social media posts about the platform (positive or negative -- both validate engagement)
- KR2: Leaderboard generates at least 10 template updates per month (competitive response)
- KR3: Revenue notification open rate > 50%

### 7.3 What "Winning" Looks Like

At 12 months post-launch:
- 10,000 templates across 50+ jurisdictions
- 50,000 documents generated per month
- $50,000/month in platform fee revenue
- At least 10 lawyers earning $2,000+/month passively
- The top lawyer on the leaderboard has become a recognized name in legal tech circles
- At least one bar association has published an opinion about the platform (positive or negative -- publicity is the goal)
- Self-represented litigants in at least 40 states have access to attorney-quality templates at $10-30 per document

---

## 8. Competitive Analysis

### 8.1 Direct Competitors

| Competitor | What They Do | Price Point | Key Weakness |
|------------|-------------|-------------|--------------|
| **LegalZoom** | Form-fill document generation | $79-$599 | No guided interview; generic templates not written by local attorneys; no marketplace |
| **Rocket Lawyer** | Document generation + attorney access | $39.99/month subscription | Subscription model is expensive for infrequent users; templates are platform-owned, not attorney-owned |
| **US Legal Forms** | Form library (200K+ forms) | $6.99-$49.99 per form | Fill-in-the-blank PDFs with no guidance; no AI interview; no jurisdiction-specific customization |
| **HelloDivorce** | Divorce-specific document generation | $99-$999 | Single matter type (divorce only); no marketplace; limited jurisdictions |
| **DivorceWriter** | Divorce document generator | $137 | Single matter type; no AI guidance; generic templates |

### 8.2 Adjacent Competitors

| Competitor | What They Do | Relationship to Us |
|------------|-------------|-------------------|
| **Clio** | Practice management software | Integration partner, not competitor. We connect to Clio; they do not generate client-facing documents. |
| **MyCase** | Practice management + client portal | Adjacent. They have a client portal but no document marketplace. |
| **LawDepot** | Form templates | Document-only, no interview, no marketplace. |
| **A2J Author** | Court-guided interview builder | Closest in concept to our template builder. Non-profit, used by courts and legal aid. Not a marketplace. Slow, grant-funded, limited adoption. |

### 8.3 Why We Win

1. **Attorney-quality at self-help prices**: LegalZoom charges $299 for a generic template. Our attorneys charge $10-30 for a jurisdiction-specific template with AI-guided interview. The quality is higher and the price is 90% lower.

2. **Two-sided marketplace effects**: More lawyers means more templates, which attracts more clients, which generates more revenue for lawyers, which attracts more lawyers. This is a flywheel that platform-owned products (LegalZoom, Rocket Lawyer) cannot replicate because they create all content internally.

3. **AI-guided interview**: No competitor offers a one-question-at-a-time AI interview that explains legal concepts, validates answers, and generates multiple documents from a single interview session. This is our core technology advantage, already built and battle-tested with 110 jurisdiction templates.

4. **Emotional engagement for lawyers**: No competitor has a leaderboard, achievement system, competitive alerts, or revenue notifications. These gamification mechanics create stickiness and word-of-mouth that documentation generators cannot match.

5. **Microtransaction pricing for lawyers**: Competitors that serve lawyers (Clio, Rocket Lawyer Premium) charge $39-$89/month. Our $1-$49/month tiers are an order of magnitude cheaper, reducing friction to near zero.

---

## 9. Risks and Mitigations

### 9.1 Legal and Regulatory Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| **UPL claims against the platform** | Critical | Medium | Platform provides the technology; lawyers create the legal content. Clear TOS disclaimers. State-by-state legal analysis documented in section 11. |
| **Bar association opposition** | High | Medium | Proactive engagement with bar associations. Position the platform as helping lawyers reach underserved populations. Highlight that templates are created by licensed attorneys, not by the platform. |
| **Lawyer malpractice from templates** | High | Low | TOS requires lawyers to maintain malpractice insurance. Templates carry disclaimers. Platform does not practice law; lawyers are responsible for template accuracy. |
| **LDA/LDP registration** (CA, AZ, FL, NV) | Medium | High | Existing `REGISTRATION_PENDING_STATES` flag already gates these jurisdictions. Complete registration in these states before enabling marketplace there. |

### 9.2 Business Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| **Insufficient lawyer supply at launch** | High | Medium | Seed the marketplace with 50-100 platform-created templates (converted from existing 110 jurisdiction templates). Recruit 20 "founding lawyers" pre-launch with free Pro tier for 6 months. |
| **$1/doc margin too thin** | Medium | Low | $1/doc at 50K docs/month = $50K MRR. Subscription revenue ($30K target) provides margin buffer. AI API costs per document are approximately $0.10-0.20 (GPT-4o). Unit economics are positive at modest volume. |
| **Race to the bottom on pricing** | Medium | Medium | Quality Score and reviews surface quality, not just price. Leaderboard tracks revenue, not just volume. Lawyers who undercut on price but have poor completion rates rank lower. |
| **Template quality variance** | High | High | Moderation queue for first-time publishers. Quality Score penalizes high refund rates. Client reviews create accountability. Platform can unpublish templates below quality thresholds. |

### 9.3 Technical Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| **DynamicOrchestrator edge cases** | Medium | Medium | Extensive testing against existing 110 jurisdiction templates (convert each and verify identical output). Fallback to hardcoded orchestrators if dynamic fails. |
| **Stripe Connect compliance complexity** | Medium | Low | Use Stripe Connect Express (Stripe handles KYC, tax reporting, compliance). Platform only stores `stripe_account_id`. |
| **AI prompt injection via lawyer templates** | High | Low | Prompt sanitization layer. Platform-managed prefix that cannot be overridden. Rate limit on prompt testing to prevent abuse. |
| **Database performance with JSONB search** | Medium | Medium | PostgreSQL GIN indexes on JSONB fields. Full-text search index on template title/description. Read replicas for marketplace search. |
| **Migration complexity (12 new migrations)** | Medium | Medium | Migrations are additive (no destructive changes to existing tables). All 12 ship in Phase 1. Run in sequence. Tested on staging before production. Rollback scripts for each migration. |

### 9.4 Market Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| **LegalZoom or Rocket Lawyer launches a marketplace** | High | Low | First-mover advantage in attorney-created marketplace. Existing 110 jurisdiction templates as seed inventory. Gamification and community create switching costs. |
| **Lawyers refuse to engage with technology** | Medium | Medium | Target tech-savvy younger lawyers (Priya persona) first. Visual editor requires zero coding. Onboarding walkthrough minimizes friction. Early success stories create social proof. |
| **Clients do not trust attorney-quality at low prices** | Medium | Medium | Verified attorney badges. Client reviews. Quality Score. Court-filed success stories (with client permission). |

---

## 10. Phased Rollout Plan

### 10.1 Phase 1 (v1.0) -- Minimum Viable Marketplace (12-16 weeks)

**Goal**: Two-sided marketplace with basic buying and selling.

**Includes**:
- Lawyer signup, bar verification (manual review), Stripe Connect onboarding
- Template builder (visual editor, phase definition, document structure)
- Template publishing (with admin moderation queue)
- Marketplace search and browse (by jurisdiction, matter type)
- Template detail pages with pricing
- Client purchase flow (Stripe Connect destination charges)
- Client interview experience (DynamicOrchestrator)
- PDF generation from marketplace templates
- Basic lawyer dashboard (revenue, sales count, template list)
- Basic client dashboard (in-progress, completed, downloads)
- Free tier functionality only (no paid subscription features)
- Seeded marketplace with 50-100 templates converted from existing jurisdiction templates
- All 12 database migrations (014-025) -- creating tables is low risk; all ship in Phase 1 regardless of which API features they support (see Appendix A)

**Does not include**:
- Subscription tiers (all lawyers get free tier only)
- AI prompt editor
- Custom branding
- Clio integration
- Affiliate system
- Reviews and ratings
- Gamification (leaderboards, achievements)
- Advanced analytics
- API access / white-label
- International jurisdictions (remains behind existing feature flag)

### 10.2 Phase 2 (v1.5) -- Monetization and Engagement (8-12 weeks after v1.0)

**Goal**: Enable lawyer subscriptions, client reviews, and engagement mechanics.

**Includes**:
- Subscription management (all 7 tiers via Stripe Billing)
- AI prompt editor ($1/month tier)
- Custom branding ($3/month tier)
- Review and rating system (client reviews, lawyer responses)
- Quality Score calculation
- Leaderboard (global and filtered)
- Achievement system (badges)
- Revenue notifications (in-app, email, push)
- Weekly digest emails
- Advanced analytics ($10/month tier)
- Template versioning
- Refund management system

### 10.3 Phase 3 (v2.0) -- Integration and Growth (8-12 weeks after v1.5)

**Goal**: Expand platform capabilities and distribution channels.

**Includes**:
- Clio integration ($5/month tier)
- Affiliate system (links, tracking, payouts)
- API access ($25/month tier) -- REST API for programmatic template access
- White-label embed widget ($25/month tier) -- embeddable interview widget for lawyer websites
- Template import from Word/PDF
- Compare templates feature
- "Staff Pick" curation
- Auto-approval for high-quality lawyers
- International jurisdiction support via marketplace (if ENABLE_INTERNATIONAL=true)
- Mobile-optimized interview experience

### 10.4 Phase 4 (v2.5) -- Scale and Intelligence (ongoing)

**Goal**: Data-driven marketplace optimization.

**Includes**:
- AI-powered template recommendations ("clients who bought X also bought Y")
- Dynamic pricing suggestions for lawyers based on market data
- Automated quality monitoring (flag templates with declining completion rates)
- Multi-language support (Spanish as first additional language)
- Lawyer-to-lawyer collaboration (co-authoring templates, revenue splitting)
- Court form auto-mapping (match template output to official court form numbers)
- Legal update monitoring (alert lawyers when statutes cited in their templates change)

---

## 11. Regulatory Considerations

### 11.1 Unauthorized Practice of Law (UPL)

UPL is the single most important regulatory consideration for this product. The analysis below is organized by jurisdiction category.

#### 11.1.1 Core Legal Theory

The platform's position is that it is a **technology provider**, not a law firm. The platform:
- Does NOT create legal content (lawyers do)
- Does NOT provide legal advice (the AI assists with factual data collection, not legal strategy)
- Does NOT select legal remedies for clients (the lawyer's template defines the document type)
- Does NOT represent clients in court

The AI interview engine asks questions defined by the lawyer template creator. It collects factual information (names, dates, addresses, financial data). It does not advise the client on whether to file for divorce, which grounds to select, or how to present their case.

This is analogous to TurboTax: the platform asks questions and generates a document, but the content is defined by licensed professionals (CPAs for tax forms, attorneys for legal documents).

#### 11.1.2 State-by-State Considerations

**Document Preparer Registration States** (highest regulatory burden):

| State | Requirement | Our Status | Impact |
|-------|-------------|------------|--------|
| **California** | Legal Document Assistant (LDA) registration (Bus. & Prof. Code 6400-6415) | In `REGISTRATION_PENDING_STATES` set | Templates for CA require either LDA registration or clear framing that the platform is a technology tool used by licensed CA attorneys to serve their clients |
| **Arizona** | Legal Document Preparer certification (ACJA 7-208) | In `REGISTRATION_PENDING_STATES` set | Similar to CA; the platform facilitates attorney-client relationships |
| **Florida** | Nonlawyer registration (RRTFB 10-2.1) | In `REGISTRATION_PENDING_STATES` set | Registration required before enabling FL marketplace templates |
| **Nevada** | Document Preparation Service (NRS 240A) | In `REGISTRATION_PENDING_STATES` set | Registration required |

**Key precedent states**:

| State | UPL Landscape | Risk Level | Notes |
|-------|---------------|------------|-------|
| **Texas** | TX Penal Code 38.123; Supreme Court has taken expansive view of UPL | Medium | The platform must NOT be seen as "selecting" documents for clients. Template selection by the client (from lawyer-created options) is key. |
| **New York** | Judiciary Law 478-484; aggressive UPL enforcement | High | NY requires attorney involvement at a deeper level. All NY marketplace templates must be created by NY-barred attorneys. |
| **Illinois** | Supreme Court Rule 5.5; broad definition | Medium | Similar to TX. Technology provider framing is critical. |
| **Ohio** | Ohio State Bar Ass'n v. Boles (2013) | Low | Ohio has been relatively permissive toward document technology. |

**Safe harbor strategies**:

1. **Attorney-created content**: Every template is created by a licensed, bar-verified attorney. The platform does not author any legal content.

2. **No legal advice**: The AI collects factual information and generates documents. It does not advise on legal strategy, case merit, or remedy selection. This is disclosed in the TOS, on every interview page, and at document completion.

3. **Disclaimer on every document**: "This document was prepared using AI-assisted technology based on a template created by [Lawyer Name], [Bar Number]. This is not legal advice. You should have this document reviewed by a licensed attorney before filing."

4. **Lawyer responsibility**: The TOS makes the template-creating lawyer responsible for the legal accuracy of their templates. The platform provides the technology infrastructure.

5. **State-specific gating**: The existing `REGISTRATION_PENDING_STATES` mechanism allows the platform to disable marketplace functionality in states where regulatory clarity is insufficient. Additional states can be added to this set without code changes.

#### 11.1.3 Canadian Considerations

- Legal document preparation by non-lawyers is generally permitted in Canada as long as no legal advice is given
- The platform must not call itself a "paralegal service" in Ontario (regulated by the Law Society of Ontario)
- Quebec has distinct civil law traditions; templates must be reviewed by a member of the Barreau du Quebec
- Each province has its own law society rules; lawyer verification must match the relevant provincial bar

#### 11.1.4 International Considerations (When ENABLE_INTERNATIONAL=true)

Each international jurisdiction has its own UPL framework. Before enabling marketplace templates for any international jurisdiction, a country-specific legal review must be completed. Key considerations:

- **UK**: Solicitors Regulation Authority (SRA) permits limited document technology. Non-reserved legal activities can be performed by non-lawyers.
- **Australia**: Each state has its own Legal Profession Uniform Law. Technology providers are generally not considered to be practicing law.
- **Singapore**: Legal Profession Act 2016 has specific provisions for technology-assisted legal services.
- **India**: Advocates Act 1961 is broadly interpreted. Marketplace templates created by Indian advocates should be compliant.

### 11.2 Ethical Rules

#### 11.2.1 Fee Sharing (Model Rule 5.4)

ABA Model Rule 5.4 prohibits lawyers from sharing legal fees with non-lawyers. The platform's $1 per-document fee is NOT a fee-sharing arrangement because:
- The $1 is a technology platform fee charged to the client, not deducted from the lawyer's fee
- The lawyer sets their own price and receives 100% of it
- The platform fee is separate from the legal services component
- This is analogous to a lawyer paying for Westlaw access -- the technology provider earns revenue, but it is not fee-sharing

This analysis should be reviewed with counsel in each target jurisdiction.

#### 11.2.2 Solicitation (Model Rule 7.2, 7.3)

Lawyer profiles on the marketplace constitute advertising, not solicitation, because:
- Clients find lawyers through search (not the reverse)
- No direct, real-time contact between lawyers and clients through the platform
- Lawyer profiles and templates are a form of written advertising (permitted under 7.2)
- The platform does not send targeted communications to specific potential clients on behalf of lawyers

#### 11.2.3 Competence (Model Rule 1.1)

By creating a template for a specific jurisdiction and matter type, the lawyer represents competence in that area. The platform:
- Requires bar verification before template publication
- Limits template jurisdiction to states where the lawyer is admitted
- Includes the lawyer's name and bar number on generated documents
- Holds the lawyer (not the platform) responsible for template accuracy

### 11.3 Compliance Infrastructure

**Platform-level**:
- Lawyer bar verification before publishing
- Template moderation queue
- Jurisdictional gating (`REGISTRATION_PENDING_STATES`)
- Mandatory disclaimers on all generated documents
- TOS that clearly delineates platform vs. lawyer responsibility
- Audit trail of all template versions (for regulatory inquiries)

**Lawyer-level**:
- TOS acceptance acknowledging responsibility for template accuracy
- Confirmation that they maintain professional liability insurance
- Agreement to keep templates updated when laws change
- Agreement not to use the platform to engage in UPL in jurisdictions where they are not licensed

---

## 12. Appendices

### Appendix A: Database Migration Summary (014-025)

> **Note**: All 12 migrations (014-025) ship in Phase 1. Creating tables is low-risk and additive. The Phase 1/2/3 distinction in the rollout plan (Section 10) refers to API endpoints and frontend features, not database tables.

| Migration | Creates |
|-----------|---------|
| 014 | ALTER `users` (add `user_role` column) |
| 015 | `lawyer_profiles` |
| 016 | `marketplace_templates` (with tsvector search) |
| 017 | `template_versions`, FK additions |
| 018 | `template_purchases` |
| 019 | `template_reviews` |
| 020 | `lawyer_subscriptions` |
| 021 | `affiliate_accounts`, `affiliate_referrals`, `affiliate_payouts` |
| 022 | `clio_connections` |
| 023 | `template_analytics`, `lawyer_achievements`, `leaderboard_snapshots` |
| 024 | `payout_batches`, `template_categories`, `featured_placements`, `template_flags` |
| 025 | `interview_sessions`, RLS policies for all new tables |

### Appendix B: New API Endpoint Summary

**Marketplace** (public, no auth): 8 endpoints
- `GET /api/marketplace/search`
- `GET /api/marketplace/featured`
- `GET /api/marketplace/categories`
- `GET /api/marketplace/templates/:slug`
- `GET /api/marketplace/templates/:slug/reviews`
- `GET /api/marketplace/leaderboard`
- `GET /api/marketplace/jurisdictions/:code`
- `GET /api/marketplace/matters/:code`

**Template Management** (lawyer auth): 14 endpoints
- `POST /api/lawyer/templates`
- `GET /api/lawyer/templates`
- `GET /api/lawyer/templates/:id`
- `PUT /api/lawyer/templates/:id`
- `POST /api/lawyer/templates/:id/publish`
- `POST /api/lawyer/templates/:id/unpublish`
- `POST /api/lawyer/templates/:id/duplicate`
- `POST /api/lawyer/templates/:id/preview`
- `POST /api/lawyer/templates/:id/test-prompt`
- `GET /api/lawyer/templates/:id/versions`
- `GET /api/lawyer/templates/:id/analytics`
- `POST /api/lawyer/templates/import`
- `DELETE /api/lawyer/templates/:id`
- `PUT /api/lawyer/templates/:id/branding`

**Lawyer Dashboard** (lawyer auth): 10 endpoints
- `GET /api/lawyer/dashboard`
- `GET /api/lawyer/revenue`
- `GET /api/lawyer/revenue/export`
- `GET /api/lawyer/notifications`
- `PUT /api/lawyer/notifications/settings`
- `GET /api/lawyer/achievements`
- `GET /api/lawyer/profile`
- `PUT /api/lawyer/profile`
- `POST /api/lawyer/profile/verify-bar`
- `GET /api/lawyer/marketplace-score`

**Subscriptions** (lawyer auth): 6 endpoints
- `GET /api/lawyer/subscriptions`
- `POST /api/lawyer/subscriptions`
- `PUT /api/lawyer/subscriptions/:id`
- `DELETE /api/lawyer/subscriptions/:id`
- `GET /api/lawyer/subscriptions/features`
- `POST /api/lawyer/subscriptions/portal` (Stripe Billing portal redirect)

**Affiliate** (lawyer auth): 6 endpoints
- `GET /api/lawyer/affiliates/code`
- `GET /api/lawyer/affiliates/stats`
- `GET /api/lawyer/affiliates/conversions`
- `PUT /api/lawyer/affiliates/commission`
- `GET /api/lawyer/affiliates/referrals`
- `POST /api/lawyer/affiliates/invite`

**Clio** (lawyer auth): 6 endpoints
- `GET /api/lawyer/clio/connect`
- `GET /api/lawyer/clio/callback`
- `DELETE /api/lawyer/clio/disconnect`
- `GET /api/lawyer/clio/contacts`
- `POST /api/lawyer/clio/export/:documentId`
- `GET /api/lawyer/clio/status`

**Reviews** (client auth): 4 endpoints
- `POST /api/reviews`
- `PUT /api/reviews/:id`
- `POST /api/reviews/:id/report`
- `DELETE /api/reviews/:id`

**Review Responses** (lawyer auth): 2 endpoints
- `POST /api/lawyer/reviews/:id/respond`
- `PUT /api/lawyer/reviews/:id/respond`

**Client Interview** (client auth): 8 endpoints
- `POST /api/interviews/start` (purchase + create document)
- `POST /api/interviews/:id/message`
- `GET /api/interviews/:id`
- `GET /api/interviews/:id/preview`
- `POST /api/interviews/:id/generate-pdf`
- `PUT /api/interviews/:id/facts/:factId`
- `POST /api/interviews/:id/evidence`
- `GET /api/interviews/active`

**Client Dashboard** (client auth): 6 endpoints
- `GET /api/my/dashboard`
- `GET /api/my/documents`
- `GET /api/my/documents/:id/download`
- `GET /api/my/payments`
- `POST /api/my/refund-request`
- `DELETE /api/my/account`

**Admin** (admin auth): 12 endpoints
- `GET /api/admin/templates/review-queue`
- `POST /api/admin/templates/:id/approve`
- `POST /api/admin/templates/:id/reject`
- `GET /api/admin/refund-requests`
- `POST /api/admin/refund-requests/:id/approve`
- `POST /api/admin/refund-requests/:id/deny`
- `GET /api/admin/reviews/reported`
- `POST /api/admin/reviews/:id/hide`
- `POST /api/admin/reviews/:id/restore`
- `GET /api/admin/lawyers`
- `POST /api/admin/lawyers/:id/suspend`
- `PUT /api/admin/settings`

**Webhooks** (Stripe): 4 endpoints
- `POST /api/webhooks/stripe-connect` (Connect account events)
- `POST /api/webhooks/stripe-billing` (Subscription events)
- `POST /api/webhooks/stripe-payment` (Payment events -- extends existing)
- `POST /api/webhooks/clio` (Clio webhook events)

**Total new endpoints**: ~101 new endpoints (see API Design doc for authoritative list)

### Appendix C: New React Components Summary

**Marketplace pages** (~15 components):
- `MarketplaceLanding`, `MarketplaceSearch`, `SearchResultCard`, `SearchFilters`, `CategoryBrowser`, `MatterTypeCard`, `TemplateDetailPage`, `TemplateCompare`, `JurisdictionSelector`, `PriceBreakdown`, `QualityBadge`, `TrendingBadge`, `LawyerProfileCard`, `ReviewsList`, `ReviewCard`

**Lawyer portal** (~25 components):
- `LawyerDashboard`, `RevenueChart`, `TemplateTable`, `TemplateBuilder`, `PhaseListPanel`, `PhaseDetailPanel`, `FieldEditor`, `ConditionBuilder`, `DocumentStructurePanel`, `SectionEditor`, `PromptEditor`, `PromptTestPanel`, `BrandingEditor`, `TemplateSettings`, `PublishModal`, `VersionHistory`, `AnalyticsDashboard`, `FunnelChart`, `CompetitorAlerts`, `DemandHeatmap`, `AffiliateManager`, `ClioBridge`, `BarVerificationForm`, `OnboardingChecklist`, `StripeConnectSetup`

**Client portal** (~10 components):
- `ClientDashboard`, `InterviewShell`, `ActiveInterviews`, `CompletedDocuments`, `PaymentHistory`, `RefundRequestForm`, `ReviewPrompt`, `ReviewForm`, `AccountSettings`, `DeleteAccountModal`

**Shared/updated** (~15 components):
- `RoleGuard`, `RoleProvider`, `MarketplaceProvider`, `TemplateProvider`, `NotificationBell`, `NotificationDropdown`, `SubscriptionGate`, `FeatureUpgradeCTA`, `Leaderboard`, `LeaderboardRow`, `AchievementBadge`, `MarketplaceScore`, `PricingTable`, `SubscriptionManager`, `StripeConnectButton`

**Gamification** (~8 components):
- `LeaderboardPage`, `LeaderboardFilters`, `AchievementGrid`, `AchievementModal`, `MarketplaceScoreCard`, `ScoreHistory`, `StreakIndicator`, `WeeklyDigestPreview`

**Total new components**: ~73

### Appendix D: Existing Code Reuse Map

| Existing Asset | Reuse Strategy |
|---------------|----------------|
| `BaseMatterOrchestrator` | Extended by `DynamicOrchestrator`; zero changes to base class |
| `ChatInterface` component | Add `templateConfig` prop; keep existing API contract |
| `DocumentPreview` component | Reuse as-is; accepts any content JSONB |
| `ValidationSidebar` component | Reuse as-is; works with any fact array |
| `PaymentModal` component | Modify for Stripe Connect destination charges |
| `EditorView` | Refactor into `InterviewShell` (generic wrapper) |
| `DVSafetyBanner` / `QuickExit` | Reuse as-is in marketplace interviews |
| `Header` | Modify for role-aware navigation |
| `UserDashboard` | Becomes `ClientDashboard` with marketplace sections |
| `authService.js` | Add role claim extraction |
| `DocumentContext` | Split into buyer `DocumentContext` + lawyer `TemplateContext` |
| `useAffidavitData` hook | Reuse as-is for interview data management |
| `useSaveDocument` hook | Reuse as-is for interview persistence |
| `useCountyValidation` hook | Reuse as-is for jurisdiction validation |
| `PDFService` | Extended by `DynamicPDFService`; base class unchanged |
| `ResilientOpenAIService` | Reuse as-is; same LLM calls |
| `document_templates` table | Columns `is_public`, `is_premium`, `price_cents`, `applicable_states` already exist |
| `interview_phase_configs` table | Foundation for marketplace template phase storage |
| `REGISTRATION_PENDING_STATES` | Reuse for marketplace jurisdiction gating |
| `detectCountry()` | Extend for marketplace jurisdiction detection |

### Appendix E: Fee Structure Reference

**Client pays**:
```
Template Price (set by lawyer)     $19.00
+ Platform Fee (fixed)            +  $1.00
+ Stripe Processing (~2.9%+$0.30) +  $0.88
= Total Client Charge              $20.88
```

**Lawyer receives**:
```
Template Price                     $19.00
- Nothing (platform fee is additive, not deductive)
= Lawyer Net Revenue               $19.00
```

**Platform receives**:
```
Platform Fee                        $1.00
- Affiliate Commission (if any)   -  $0.25
= Platform Net Revenue              $0.75 (with affiliate) or $1.00 (without)
```

**Stripe receives**:
```
~2.9% + $0.30 of total charge      $0.88
```

### Appendix F: Glossary

| Term | Definition |
|------|-----------|
| **Template** | A JSONB configuration created by a lawyer that defines an interview flow and document output |
| **Interview** | The AI-guided question-and-answer session a client completes to generate a document |
| **Phase** | A logical section of an interview (e.g., INTAKE, GROUNDS, CHILDREN, REVIEW) |
| **Orchestrator** | The server-side engine that manages interview state and communicates with the LLM |
| **DynamicOrchestrator** | An orchestrator that loads its configuration from a marketplace template's JSONB |
| **Marketplace Score** | A 0-1000 composite metric representing a lawyer's overall marketplace presence |
| **Quality Score** | A 0-100 composite metric representing a template's reliability |
| **Platform Fee** | The fixed $1.00 charged per document to fund platform operations |
| **Destination Charge** | A Stripe Connect payment pattern where the charge is created on the platform account and funds are transferred to the connected account |
| **SRL** | Self-Represented Litigant -- a person who files legal documents without attorney representation |
| **UPL** | Unauthorized Practice of Law -- performing legal services without a license |
| **RLS** | Row Level Security -- PostgreSQL feature that restricts data access at the database level |

---

*End of PRD. This document serves as the master reference for the discover.legal marketplace transformation. All technical architecture, API design, and frontend specifications should be built in conformance with the requirements specified here.*
