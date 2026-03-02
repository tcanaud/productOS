# Story 4.2: Export Specs as Markdown

Status: ready-for-dev

## Story

As a Product Manager,
I want to export my generated specs as Markdown files,
so that I can share them with my team via any channel.

## Acceptance Criteria

1. PM can choose full export (all specs) or individual export (PRD only, stories only, edge cases only) (AC:1)
2. Exported Markdown has proper formatting and section headers (AC:2)
3. File downloads cleanly with appropriate filename (AC:3)

## Tasks / Subtasks

- [ ] Task 1: Markdown template engine (AC: 2)
  - [ ] PRD Markdown template (sections: Overview, Goals, Requirements, NFRs)
  - [ ] Stories Markdown template (per story: user story format, GWT criteria)
  - [ ] Edge cases Markdown template (table format with severity)
  - [ ] Full export template (combined document with table of contents)
  - [ ] Ensure clean CommonMark output
- [ ] Task 2: Export API endpoint (AC: 1, 2, 3)
  - [ ] GET /api/specs/:id/export?format=md&scope=all|prd|stories|edgecases
  - [ ] Return Markdown string with Content-Disposition header for download
  - [ ] Filename convention: `{workspace-name}-{scope}-{date}.md`
- [ ] Task 3: Export UI (AC: 1, 3)
  - [ ] "Export" dropdown button in specs viewer
  - [ ] Options: Full Export, PRD Only, Stories Only, Edge Cases Only
  - [ ] Download triggers browser file save
  - [ ] Success toast notification
- [ ] Task 4: Tests (AC: 1-3)
  - [ ] Unit tests for each Markdown template
  - [ ] Test export endpoint returns valid Markdown
  - [ ] Test each scope option produces correct content

## Dev Notes

- Straightforward once Story 4.1 is done — templates transform JSON spec data to Markdown
- Keep templates simple and clean — no complex formatting
- Consider adding copy-to-clipboard as bonus UX
- No server-side file storage — generate on-the-fly and stream to client

### Project Structure Notes

- `/src/lib/export/markdown-templates.ts` — template functions
- `/src/app/api/specs/[id]/export/route.ts` — export endpoint
- `/src/components/specs/ExportButton.tsx` — export UI component

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4 — Story 4.2]
- [Source: Story 4.1 — depends on spec data model]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
