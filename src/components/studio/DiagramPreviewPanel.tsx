/** diagramContent prop is a forward-compatible placeholder; will be wired in Story 6.2 */
export type DiagramPreviewPanelProps = {
  diagramContent?: string;
};

export function DiagramPreviewPanel(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  props: DiagramPreviewPanelProps
) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed border-border">
        <p className="text-sm text-muted-foreground">Your diagram will appear here</p>
      </div>
    </div>
  );
}
