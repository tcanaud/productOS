const CHIPS = [
  'E-commerce checkout flow',
  'User onboarding flow',
  'SaaS subscription funnel',
  'Mobile app navigation',
  'API integration flow',
];

type SuggestionChipsProps = {
  onSelect: (chip: string) => void;
};

export function SuggestionChips({ onSelect }: SuggestionChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CHIPS.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onSelect(chip)}
          className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
