# Story 6.1 — Studio Layout & Onboarding UX

## Status: review

## Story

**As a** Product Manager,
**I want** a welcoming studio interface with a conversation panel and diagram preview,
**so that** I can start designing my product through natural conversation instead of writing code.

## Acceptance Criteria

1. **Given** a PM opens a workspace
   **When** they enter the studio
   **Then** a split-view layout shows a conversation panel (left, ~40%) and a diagram preview area (right, ~60%)

2. **Given** a PM arrives on an empty workspace
   **When** the studio loads
   **Then** a welcoming prompt invites them to describe their idea, with inspirational suggestion chips (e.g. "E-commerce checkout flow", "User onboarding flow")

3. **Given** a PM clicks a suggestion chip
   **When** the chip is selected
   **Then** the text is pre-filled in the conversation input and ready to send

4. **Given** the studio is active
   **When** the PM types and sends a message
   **Then** the conversation panel displays the message and shows a loading state while the AI responds

## Technical Notes

### Layout Structure

- Route: `app/(dashboard)/studio/[workspaceId]/page.tsx` (or similar studio route)
- Split-view: CSS flexbox or grid — left panel 40%, right panel 60%
- Responsive: stack vertically on mobile (below md breakpoint)
- Both panels scrollable independently

### Components to Create

- `StudioLayout.tsx` — top-level split layout container
- `ConversationPanel.tsx` — left panel: message list + input + suggestion chips
- `DiagramPreviewPanel.tsx` — right panel: placeholder/preview area for diagram
- `SuggestionChips.tsx` — row of clickable chips that pre-fill the input
- `MessageList.tsx` — scrollable list of user/AI messages
- `ConversationInput.tsx` — textarea + send button; accepts `defaultValue` prop for chip pre-fill

### Suggestion Chips (initial set)

- "E-commerce checkout flow"
- "User onboarding flow"
- "SaaS subscription funnel"
- "Mobile app navigation"
- "API integration flow"

### State Management

- Local React state (`useState`) for conversation messages array and input value
- Message shape: `{ id: string; role: 'user' | 'assistant'; content: string; timestamp: Date }`
- Loading state: boolean flag set to `true` on send, reset when AI response arrives (stub for now)
- Chip click sets input value; focus input after chip selection

### Empty State / Onboarding

- When `messages.length === 0`, show welcome message and suggestion chips in conversation panel
- Welcome text: "Describe your product idea or flow, and I'll help you design it."
- Chips disappear once conversation has started (or after first message sent)

### Diagram Preview Panel (Story 6.1 scope)

- Static placeholder with a dashed border and centered text: "Your diagram will appear here"
- No actual diagram rendering in this story (deferred to Story 6.2)
- Mermaid preview component from Story 2.1 can be wired in a later story

### Sending a Message

- User types in `ConversationInput` and submits (Enter key or send button)
- Message appended to list with `role: 'user'`
- Loading indicator shown (spinner or animated dots) as next message placeholder
- AI response stubbed: after 1s timeout, append a placeholder `role: 'assistant'` message: "Got it! Generating your diagram..."
- Real AI integration deferred to Story 6.2

### API & Data (Story 6.1 scope)

- No API calls in this story — all state is local/ephemeral
- No persistence; conversation resets on page reload
- Backend integration deferred to Story 6.2+

## Tasks

### Task 1 — Studio Route & Page Scaffold

- [x] Create `src/app/(dashboard)/studio/page.tsx` (or `[workspaceId]/page.tsx`)
- [x] Add studio link to Sidebar navigation
- [x] Ensure route is protected by existing middleware

### Task 2 — StudioLayout Component

- [x] Create `src/components/studio/StudioLayout.tsx`
- [x] Implement 40/60 split using Tailwind flex/grid
- [x] Left panel: `ConversationPanel`; right panel: `DiagramPreviewPanel`
- [x] Add responsive stacking for mobile

### Task 3 — DiagramPreviewPanel Placeholder

- [x] Create `src/components/studio/DiagramPreviewPanel.tsx`
- [x] Dashed border placeholder with centered label
- [x] Accepts optional `diagramContent?: string` prop (unused in 6.1, wired in 6.2)

### Task 4 — ConversationPanel & Message List

- [x] Create `src/components/studio/ConversationPanel.tsx`
- [x] Create `src/components/studio/MessageList.tsx`
- [x] Render user and assistant messages with distinct styles
- [x] Auto-scroll to bottom on new message

### Task 5 — SuggestionChips

- [x] Create `src/components/studio/SuggestionChips.tsx`
- [x] Display chips when conversation is empty
- [x] On click: set input value, hide chips, focus input

### Task 6 — ConversationInput

- [x] Create `src/components/studio/ConversationInput.tsx`
- [x] Textarea with send button (Enter = send, Shift+Enter = newline)
- [x] Disabled while loading state is active
- [x] Accepts `value`, `onChange`, `onSend`, `disabled` props

### Task 7 — Loading State & Stub AI Response

- [x] Add loading indicator (animated dots or spinner) in MessageList when `isLoading=true`
- [x] On message send: set `isLoading=true`, schedule stub response after 1000ms

## Definition of Done

- [x] Split-view layout renders correctly at desktop and mobile breakpoints
- [x] Empty state shows welcome text and suggestion chips
- [x] Clicking a chip pre-fills the input field
- [x] Sending a message appends it to the conversation list
- [x] Loading indicator appears after sending
- [x] Stub AI response appears after ~1s
- [x] No TypeScript errors (`tsc --noEmit` passes — 0 new errors introduced)
- [x] No ESLint errors
- [x] Studio route is accessible from the sidebar navigation

## Dev Agent Record

### Implementation Plan

Placed studio at `src/app/(dashboard)/workspace/[id]/studio/` following the existing workspace sub-route pattern. All state is local (no API calls in this story). Split implemented with Tailwind `md:flex-row` + `md:w-2/5` / `flex-1`. A `studio/layout.tsx` ensures the panel fills height correctly.

### Completion Notes

- **StudioLayout**: orchestrates state (`messages`, `inputValue`, `isLoading`), uses `crypto.randomUUID()` for message IDs; stub AI response fires after 1000ms
- **ConversationPanel**: shows onboarding empty state (welcome text + chips) OR MessageList when `messages.length > 0`
- **MessageList**: auto-scrolls via `useEffect` + `scrollIntoView`; bouncing three-dot loader for `isLoading`
- **SuggestionChips**: 5 pre-defined chips; chip click triggers `onChipSelect` → sets input value and focuses textarea via forwarded `inputRef`
- **ConversationInput**: shadcn `Textarea` + icon `Button`; Enter=send, Shift+Enter=newline; disabled while loading
- **DiagramPreviewPanel**: pure placeholder with `diagramContent?: string` prop for future Story 6.2 wiring
- **WorkspaceSidebar**: added `{ segment: 'studio', label: 'Studio', icon: Sparkles }` nav item
- Route is protected by existing dashboard layout auth check (middleware + `requireAuth` in `layout.tsx`)
- All 6 pre-existing TS errors are unrelated to this story (in api routes and spec-output schema)
- 0 ESLint errors in all new/modified files

### Files Changed

- `src/app/(dashboard)/workspace/[id]/studio/page.tsx` — new studio page
- `src/app/(dashboard)/workspace/[id]/studio/layout.tsx` — overflow container for studio height
- `src/components/studio/StudioLayout.tsx` — state orchestrator + 40/60 split layout
- `src/components/studio/ConversationPanel.tsx` — left panel (empty state + messages + input)
- `src/components/studio/MessageList.tsx` — message bubbles + loading dots
- `src/components/studio/ConversationInput.tsx` — textarea + send button
- `src/components/studio/SuggestionChips.tsx` — clickable suggestion chips
- `src/components/studio/DiagramPreviewPanel.tsx` — dashed placeholder (right panel)
- `src/components/layout/WorkspaceSidebar.tsx` — added Studio nav item with Sparkles icon

## Change Log

- 2026-03-03: Story 6.1 implemented — studio split-view layout, onboarding UX with suggestion chips, conversation panel with message list, loading state and stub AI response, studio route added to WorkspaceSidebar navigation.
