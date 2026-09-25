import { m } from "@/i18n";

export function Header() {
  return (
    <header className="border-b flex">
      <h1 className="inline-flex items-center gap-1 font-heading font-semibold px-6">
        <img src="/favicon.svg" alt="" className="h-6 w-6 -translate-y-0.5" />
        <span className="py-6 leading-[0.75]">{m.app_title()}</span>
      </h1>
    </header>
  );
}
