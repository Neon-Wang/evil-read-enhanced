/**
 * @file exampleSections.ts
 * @description Single source of truth for the inline component showcases.
 *
 * Each entry maps a URL slug (`/examples/<slug>`) to the inline demo
 * component and the category group it belongs to. Three consumers read
 * this list:
 *
 *   - `ExamplesSidebar` — builds the categorised left-nav links.
 *   - `ExamplesSectionPage` — looks up the demo for the active `:section`
 *     route param and renders it as a standalone sub-page.
 *   - `ExamplesIndexPage` (overview) — renders the link grid.
 *
 * The i18n title/description for an entry live at `sections.<slug>.title`
 * / `sections.<slug>.description`, so the slug doubles as the i18n key.
 *
 * Standalone showcases that own a full page of their own (Toaster,
 * Dialog, Sheet, Command, Sign-in modal, Motion, Performance) are NOT
 * listed here — they keep their dedicated route + page component.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import type { ComponentType } from 'react';

// --- Relative Imports ---
import { AnimationShowcase } from './inline/AnimationShowcase';
import { BreadcrumbShowcase } from './inline/BreadcrumbShowcase';
import { ButtonShowcase } from './inline/ButtonShowcase';
import { CardShowcase } from './inline/CardShowcase';
import { CheckoutFormShowcase } from './inline/CheckoutFormShowcase';
import { CodeBlockShowcase } from './inline/CodeBlockShowcase';
import { CollapseShowcase } from './inline/CollapseShowcase';
import { CursorShowcase } from './inline/CursorShowcase';
import { DataDisplayShowcase } from './inline/DataDisplayShowcase';
import { DividerShowcase } from './inline/DividerShowcase';
import { FeedbackShowcase } from './inline/FeedbackShowcase';
import { FooterShowcase } from './inline/FooterShowcase';
import { FormShowcase } from './inline/FormShowcase';
import { I18nShowcase } from './inline/I18nShowcase';
import { IconShowcase } from './inline/IconShowcase';
import { KbdShowcase } from './inline/KbdShowcase';
import { LoadingShowcase } from './inline/LoadingShowcase';
import { ProfileFormShowcase } from './inline/ProfileFormShowcase';
import { ProgressShowcase } from './inline/ProgressShowcase';
import { SignUpFormShowcase } from './inline/SignUpFormShowcase';
import { TableShowcase } from './inline/TableShowcase';
import { TabsShowcase } from './inline/TabsShowcase';
import { ThemeShowcase } from './inline/ThemeShowcase';
import { TitleShowcase } from './inline/TitleShowcase';
import { TypewriterShowcase } from './inline/TypewriterShowcase';

// =================================================================================================
// Types
// =================================================================================================

/** Category groups, in sidebar display order. Each maps to `toc.<key>`. */
type GroupKey = 'basics' | 'forms' | 'feedbackGroup' | 'content' | 'patterns';

interface ExampleSection {
  /** URL slug + i18n key (`/examples/<slug>`, `sections.<slug>.*`). */
  slug: string;
  group: GroupKey;
  Component: ComponentType;
}

// =================================================================================================
// Registry
// =================================================================================================

const GROUP_ORDER: GroupKey[] = [
  'basics',
  'forms',
  'feedbackGroup',
  'content',
  'patterns',
];

const exampleSections: ExampleSection[] = [
  // --- Basics ---
  { slug: 'title', group: 'basics', Component: TitleShowcase },
  { slug: 'button', group: 'basics', Component: ButtonShowcase },
  { slug: 'card', group: 'basics', Component: CardShowcase },
  { slug: 'tabs', group: 'basics', Component: TabsShowcase },
  { slug: 'collapse', group: 'basics', Component: CollapseShowcase },
  { slug: 'divider', group: 'basics', Component: DividerShowcase },
  { slug: 'breadcrumb', group: 'basics', Component: BreadcrumbShowcase },
  // --- Forms & data ---
  { slug: 'form', group: 'forms', Component: FormShowcase },
  { slug: 'signup', group: 'forms', Component: SignUpFormShowcase },
  { slug: 'profile', group: 'forms', Component: ProfileFormShowcase },
  { slug: 'checkout', group: 'forms', Component: CheckoutFormShowcase },
  { slug: 'data', group: 'forms', Component: DataDisplayShowcase },
  { slug: 'table', group: 'forms', Component: TableShowcase },
  // --- Feedback & status ---
  { slug: 'feedback', group: 'feedbackGroup', Component: FeedbackShowcase },
  { slug: 'loading', group: 'feedbackGroup', Component: LoadingShowcase },
  { slug: 'progress', group: 'feedbackGroup', Component: ProgressShowcase },
  // --- Content & flair ---
  { slug: 'icon', group: 'content', Component: IconShowcase },
  { slug: 'codeblock', group: 'content', Component: CodeBlockShowcase },
  { slug: 'typewriter', group: 'content', Component: TypewriterShowcase },
  { slug: 'cursor', group: 'content', Component: CursorShowcase },
  { slug: 'kbd', group: 'content', Component: KbdShowcase },
  { slug: 'footer', group: 'content', Component: FooterShowcase },
  // --- Interaction patterns ---
  { slug: 'theme', group: 'patterns', Component: ThemeShowcase },
  { slug: 'i18n', group: 'patterns', Component: I18nShowcase },
  { slug: 'animation', group: 'patterns', Component: AnimationShowcase },
];

function findSection(slug: string | undefined): ExampleSection | undefined {
  return exampleSections.find((s) => s.slug === slug);
}

function sectionsByGroup(group: GroupKey): ExampleSection[] {
  return exampleSections.filter((s) => s.group === group);
}

// =================================================================================================
// Exports
// =================================================================================================

export { exampleSections, GROUP_ORDER, findSection, sectionsByGroup };
export type { ExampleSection, GroupKey };
