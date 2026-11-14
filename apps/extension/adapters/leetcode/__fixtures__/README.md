# LeetCode payload fixtures

Response bodies for the submit/check endpoints, used by adapter unit tests and the Playwright mock page.

Provenance: built on 2026-11-14 from field names read out of leetcode.com's own client bundle
(the result parser that consumes `/submissions/detail/{id}/check/`). They are **synthetic**: no
signed-in submission was available while writing them. To replace them with real recordings, run the
extension with `pnpm --filter @leettrack/extension dev`, submit once, and copy the
`[leettrack:record]` lines from the page console. Strip problem-statement text (test inputs from the
description) before committing.

`graphql-submission-analysis.json` is **real**: the `submissionAnalysis(submissionId)` GraphQL
response for an accepted Two Sum submission, recorded on 2026-11-14 from a signed-in account. Only
the complexity fields were requested; the ids were replaced. LeetCode runs this analysis only when
the user clicks Analyze on an accepted submission (`mutation submissionSubmitAnalysis`), then polls
this query every second until `status` is `FINISHED`. Uses are rationed per account
(`query submissionAnalysisUsesLeft`).
