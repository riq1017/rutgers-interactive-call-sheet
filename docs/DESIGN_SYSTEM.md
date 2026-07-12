# DESIGN_SYSTEM

## Design System Governance Standard

DS-001 Single Design Language: Coordinator OS uses one premium coaching-app language across all programs. Rutgers scarlet, black, and white are the active program skin, not a hardcoded product boundary.

DS-002 Shared Component Architecture: shared cards, headers, tabs, buttons, badges, metrics, portraits, and detail panels must be reused before creating one-off UI.

DS-003 Shared Design Tokens: spacing, radii, shadows, semantic colors, type sizes, and motion timings live in CSS variables and should be extended through tokens.

DS-004 Card-First User Experience: every coaching surface should be organized as compact cards with expandable detail.

DS-005 Mobile-First Design: 390 x 844 and 430 x 932 are protected phone viewports. No horizontal scrolling is allowed.

DS-006 Native Application Experience: the shell uses a persistent coordinator header, scrollable content, safe-area padding, and floating bottom navigation.

DS-007 Visual Hierarchy: pages begin with a high-priority hero or primary decision card, followed by supporting cards and drill-down detail.

DS-008 Motion Standard: motion must be restrained, fast, reversible, and disabled through `prefers-reduced-motion`.

DS-009 Football Before Decoration: visual polish must clarify football decisions and may not obscure data, controls, or evidence.

DS-013 Product Identity: Coordinator OS is program-agnostic. Rutgers is the current active program and future team changes should be handled by JSON changes.

DS-014 One Decision Per Card: every card answers one coaching question, such as what to call, where to run, where protection needs help, who can beat us, or who to feature.
