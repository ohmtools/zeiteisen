import { m } from "@/i18n";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const VIEWS = ["general", "week"] as const;

export type View = (typeof VIEWS)[number];

function isView(value: string | undefined): value is View {
  return VIEWS.some((view) => view === value);
}

type Props = {
  value: View;
  onChange: (view: View) => void;
};

export function ViewSwitch({ value, onChange }: Props) {
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      className="w-full sm:w-auto"
      value={[value]}
      onValueChange={([view]) => {
        if (isView(view)) onChange(view);
      }}
    >
      <ToggleGroupItem value="general" className="flex-1">
        {m.view_general()}
      </ToggleGroupItem>
      <ToggleGroupItem value="week" className="flex-1">
        {m.view_week()}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
