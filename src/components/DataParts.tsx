import { m } from "@/i18n";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { dataParts, type DataPart } from "@/lib/reset";

const PART_NAME: Record<DataPart, () => string> = {
  profiles: m.data_delete_profiles,
  notes: m.data_delete_notes,
  files: m.data_delete_files,
  catalog: m.data_delete_catalog,
  settings: m.data_delete_settings,
  app: m.data_delete_app,
};

const PART_TEXT: Record<DataPart, () => string> = {
  profiles: m.data_delete_profiles_text,
  notes: m.data_delete_notes_text,
  files: m.data_delete_files_text,
  catalog: m.data_delete_catalog_text,
  settings: m.data_delete_settings_text,
  app: m.data_delete_app_text,
};

// What "Delete data" can remove (`@/lib/reset`), ticked one by one, in the
// settings' dialog and on the error screen alike; `id` keeps their checkbox
// ids apart. Ticking keeps the parts in list order.
export function DataPartsList({
  id,
  chosen,
  onChange,
}: {
  id: string;
  chosen: readonly DataPart[];
  onChange: (chosen: DataPart[]) => void;
}) {
  return (
    <>
      <ul className="flex flex-col divide-y overflow-y-auto">
        {dataParts.map((part) => (
          <li key={part} className="flex items-start gap-3 py-2">
            <Checkbox
              id={`${id}-${part}`}
              className="mt-0.5"
              checked={chosen.includes(part)}
              onCheckedChange={(next) =>
                onChange(
                  next === true
                    ? dataParts.filter((one) => one === part || chosen.includes(one))
                    : chosen.filter((one) => one !== part),
                )
              }
            />
            <Label htmlFor={`${id}-${part}`} className="flex flex-col items-start gap-1">
              {PART_NAME[part]()}
              <span className="font-normal text-muted-foreground">{PART_TEXT[part]()}</span>
            </Label>
          </li>
        ))}
      </ul>
      {chosen.length === dataParts.length && (
        <p className="text-sm text-muted-foreground">{m.data_delete_all()}</p>
      )}
    </>
  );
}
