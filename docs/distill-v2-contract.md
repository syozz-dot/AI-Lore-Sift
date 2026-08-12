# Distill V2 output contract

Distill is a reading-decision and knowledge-internalization workflow, not a
generic summary endpoint. The output order is **judge, translate, personalize,
then sediment**.

## Stable layers

1. **Read-before judgment**: `verdict` and `verdictReason` decide whether to
   skip, skim, or read the source. This is based only on the source's information
   density, evidence, method, and reusable detail.
2. **Source translation**: `summary`, `keyPoints`, and `claims` explain the
   article in direct language. Claims separate fact, author view, and cautious
   inference and retain paragraph evidence references.
3. **Personal relevance**: `personalizedInsights` is optional and is generated
   only after the user opts in for that request. Each item names its profile,
   approved-memory, or retrieved-knowledge basis and retains source paragraph
   references. Retrieved knowledge is owner-scoped, capped at five items, and
   exposed as validated references. It cannot change the generic verdict or
   pretend private context is source evidence.
   The server returns this field to the submitting browser but does not persist
   it; the browser stores it in the local private workspace. If the separate
   personalization call fails, the generic result remains available and the
   browser records that local failure state.
4. **Knowledge sedimentation**: `transferableInsights` contains zero to five
   standalone, conditional, reusable knowledge cards. Returning zero is a valid
   and preferred outcome when the source has no portable knowledge.
5. **Reading boundary**: `cautions` exposes missing evidence, unsupported
   generalization, and unverified conclusions. `followUpQuestions` must be
   answerable from the current source rather than imply live external research.

## Privacy and evidence rules

- Personalization is off by default on every new Distill request.
- The UI previews what categories will be sent and requires a per-request opt-in.
- Only the user-authored profile, user-approved memories, and a maximum of five
  relevant items from the user's explicitly saved knowledge can be sent.
- Saved-knowledge retrieval is read-only, lexical, and owner-scoped. It runs
  only for an opted-in request, adds no new server-side personal record, and
  never changes the source-only verdict.
- Models cite retrieved items by short-lived `K1`-style identifiers. The server
  discards unknown identifiers and maps valid ones back to the saved document.
- Favorites, knowledge cards, and follow-up answers are only candidate memories;
  the user must edit, categorize, and confirm each one before local storage.
- Generic analysis must remain source-only even when personalization is enabled.
- No personalized insight is better than a forced or generic relationship.
- Source text, private context, and generated content are untrusted input; they
  cannot instruct the application or override the system contract.

## Evaluation baseline

`apps/web/lib/distill-evaluation.ts` contains versioned fixtures for six
material families: product release, technical report, engineering practice,
industry analysis, opinion, and low-information promotion. Each case records
acceptable verdicts, required coverage, forbidden overclaims, allowed knowledge
card counts, and evidence-reference requirements.

The fixture evaluator is deterministic and does not call a model. A future
offline evaluation command can execute the model against these fixtures, but
production requests must never run the entire evaluation set.
