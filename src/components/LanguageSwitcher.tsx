import { getLocale, locales, m, setLocale } from "@/i18n";
import { Button } from "@/components/ui/button";

// The locale follows the browser; these small buttons only override it.
export function LanguageSwitcher() {
  const current = getLocale();

  return (
    <div role="group" aria-label={m.language_label()} className="flex gap-1">
      {locales.map((locale) => (
        <Button
          key={locale}
          variant={locale === current ? "secondary" : "ghost"}
          size="xs"
          aria-pressed={locale === current}
          // "EN" reads as letters: say the language, in itself.
          lang={locale}
          aria-label={new Intl.DisplayNames([locale], { type: "language" }).of(locale)}
          onClick={() => void setLocale(locale)}
        >
          {locale.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
