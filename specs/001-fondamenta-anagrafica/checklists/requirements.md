# Specification Quality Checklist: Fondamenta e anagrafica

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-28
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- FR-024 risolto (Q1: A): il pulsante "Scarica modello CSV" di `/start` non compare finché non arriva RF-23.
- RNF-03 cita l'header del token segreto: è un vincolo di sicurezza dell'AFU, non un dettaglio di implementazione scelto dalla spec.
- RF-04, secondo criterio: diviso nell'AFU; l'effetto sul pulsante WhatsApp è ora un criterio di RF-11 (feature dei promemoria).
- AFU §5.6 corretta: "compie 33 anni tra 137 giorni".
- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`
