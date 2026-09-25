import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";
import { startOfISOWeek } from "date-fns";
import { ChevronDown, Database, Settings } from "lucide-react";
import { cn } from "cn";
import { m } from "@/i18n";
import { DayToggle } from "@/components/DayToggle";
import { Header } from "@/components/Header";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { TimetableGrid, type WeekView } from "@/components/TimetableGrid";
import { TAB_ITEM, TabBar, type Tab } from "@/components/TabBar";
import { ViewSwitch, type View } from "@/components/ViewSwitch";
import { WeekNav } from "@/components/WeekNav";
import { Button } from "@/components/ui/button";
import { useCatalog } from "@/hooks/useCatalog";
import { useCatalogSources } from "@/hooks/useCatalogSources";
import { useInstallHint } from "@/hooks/useInstallHint";
import { useOnline } from "@/hooks/useOnline";
import { useSemesterDates } from "@/hooks/useSemesterDates";
import { useProfiles } from "@/hooks/useProfiles";
import { useShareLink } from "@/hooks/useShareLink";
import { Catalog } from "@/lib/primitives/catalog";
import { isKnownSharedProfile } from "@/lib/primitives/profile";
import type { Day } from "@/lib/primitives/subject";
import type { TimetableName } from "@/lib/primitives/timetable";
import { dayOf, eventsForWeek, semesterBegin, semesterWeek } from "@/lib/primitives/week";
import { generalEntries, weekEntries } from "@/lib/layout";
import { payloadFromLocation } from "@/lib/share";
import { sameHighlight, type Highlight, type SubjectRef } from "@/lib/link";
import { isDesktop } from "@/lib/media";
import { defaultView } from "@/lib/view";

// Everything but the grid comes from one deferred chunk (see
// `components/deferred`): rendering any of these on the first render starts
// the download, and the grid paints without waiting for it.
const deferred = () => import("@/components/deferred");
const ProfileSection = lazy(() => deferred().then((d) => ({ default: d.ProfileSection })));
const GroupTree = lazy(() => deferred().then((d) => ({ default: d.GroupTree })));
const AppDialogs = lazy(() => deferred().then((d) => ({ default: d.AppDialogs })));
const AppToaster = lazy(() => deferred().then((d) => ({ default: d.AppToaster })));
const DataMenu = lazy(() => deferred().then((d) => ({ default: d.DataMenu })));

export default function App() {
  const [weekStart, setWeekStart] = useState(() => startOfISOWeek(new Date()));
  // Where the global dates came from, plus the footer switch.
  const sources = useCatalogSources();
  const dates = useSemesterDates(sources);
  // Current week during the lecture period, else the general grid.
  const [view, setView] = useState<View>(() => defaultView(dates.dates, new Date()));
  // The one day the grid shows below `md`; weekends start on "other", where
  // weekend events end up.
  const [day, setDay] = useState<Day>(() => dayOf(new Date()));
  // Only used to explain the catalog: nothing in the app needs the network.
  const online = useOnline();
  // The optional static catalog: locations, abbreviations, dates and ready-made
  // timetables fetched from `VITE_CATALOG_URL`. Missing or offline changes
  // nothing — the dates stay as they are and the picker simply lists less.
  const catalog = useCatalog({
    autoUpdate: sources.autoUpdate,
    sources: sources.sources,
    onDates: dates.install,
  });
  // Profiles own their timetables: there is no device-wide file store.
  const profiles = useProfiles();
  useInstallHint();
  // A link opened directly is an import like any other: read it on the first
  // render, before `useShareLink` strips the URL, and let the dialog ask for a
  // name and which timetables to take instead of creating a profile behind
  // the user's back. Reopening a link this device already holds (the same
  // timetables with the same selection) opens no dialog.
  const [linkPayload, setLinkPayload] = useState(() => {
    const link = payloadFromLocation();
    return link && !isKnownSharedProfile(link, profiles.profiles) ? link : null;
  });
  const [importing, setImporting] = useState(() => linkPayload !== null);
  // Which timetables the picker may offer, and which of its two modes it is in.
  const [picking, setPicking] = useState<"new-profile" | "add" | null>(null);
  // The timetable the update dialog is asking about, by name.
  const [updating, setUpdating] = useState<TimetableName | null>(null);
  // The link behind the share button; the global dates never go in it.
  const share = useShareLink(profiles.active);
  const timetables = profiles.timetables;
  const hasTimetables = timetables.length > 0;
  // Phones show one column at a time (`TabBar`). An empty profile starts on
  // its groups, where timetables are added; anything else on the grid. Not
  // persisted.
  const [tab, setTab] = useState<Tab>(() => (hasTimetables ? "timetable" : "groups"));
  const switchTab = (next: Tab) => {
    setTab(next);
    window.scrollTo({ top: 0 });
  };

  // Tree ↔ grid, shared by sidebar and grid. Desktop: the group cell under the
  // mouse or focus keeps its blocks lit and dims the rest (phones never show
  // both at once). Every screen: a block's popup jumps to its group cell,
  // which flashes for a moment.
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [flash, setFlash] = useState<(SubjectRef & { nonce: number }) | null>(null);
  const highlightGroup = (next: Highlight | null) => {
    const wanted = next && isDesktop() ? next : null;
    setHighlight((previous) => (sameHighlight(previous, wanted) ? previous : wanted));
  };
  const jumpToGroup = (subject: SubjectRef) => {
    if (!isDesktop()) setTab("groups");
    setFlash({ ...subject, nonce: Date.now() });
  };
  useEffect(() => {
    if (!flash) return;
    const done = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(done);
  }, [flash]);
  // Offline the catalog can hand over nothing, so it offers nothing.
  const offerCatalog = online ? catalog : Catalog.empty;

  const dataMenu: DataMenuProps = {
    autoUpdate: sources.autoUpdate,
    onAutoUpdate: sources.setAutoUpdate,
    datesManual: dates.manual,
    onUploadDates: (file) => void dates.upload(file),
    onCatalogDates: () => void dates.useCatalogDates(),
    profileCount: profiles.profiles.length,
  };

  // Weeks count from the semester begin: the one nearest the dates' lecture
  // start, without dates the last one before today.
  const now = new Date();
  const weekNumber = semesterWeek(weekStart, semesterBegin(dates.dates, now));

  let week: WeekView | null = null;
  // Visible = the enabled subjects of this profile's timetables.
  let entries = generalEntries(timetables);
  if (view === "week") {
    const containsToday = startOfISOWeek(now).getTime() === weekStart.getTime();
    const today = dayOf(now);
    const events = eventsForWeek(dates.dates, weekStart);
    week = { ...events, today: containsToday && today !== "other" ? today : null };
    entries = weekEntries(timetables, weekNumber, weekStart, events);
  }

  return (
    // Desktop: the page itself never scrolls — the shell is exactly one
    // viewport tall and the subject section takes whatever height the
    // fixed-height profile section leaves. Phones (and any viewport too short,
    // see the `desktop` variant in index.css) keep the ordinary page scroll.
    // Phones keep room for the fixed tab bar at the bottom.
    <div className="flex min-h-screen flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] desktop:h-screen desktop:min-h-0 desktop:overflow-hidden desktop:pb-0">
      <Header />

      <main className="grid w-full min-h-0 grid-cols-1 desktop:flex-1 desktop:grid-cols-[24rem_minmax(0,1fr)]">
        {/* Desktop shows both columns, phones the one their tab picks.
            Divider lines separate the sections instead of boxes. */}
        <div
          className={cn(
            "min-h-0 flex-col divide-y desktop:flex desktop:border-r",
            tab === "groups" ? "flex" : "hidden",
          )}
        >
          {/* Nothing while it loads: the column is a fixed 24rem on desktop
              and its own tab on phones, so the grid never shifts. */}
          <Suspense fallback={null}>
            <ProfileSection
              className="shrink-0"
              profiles={profiles.profiles}
              activeName={profiles.activeName}
              locked={profiles.locked}
              dates={dates.dates}
              share={share}
              catalog={catalog}
              onSelect={profiles.select}
              onOpenAdd={() => setPicking("new-profile")}
              onRename={profiles.rename}
              onDuplicate={profiles.duplicate}
              onRemove={profiles.remove}
              onToggleLock={profiles.toggleLock}
              onOpenImport={() => setImporting(true)}
            />
            {/* The only section that grows: it eats the leftover height and
                its trees scroll inside it when they are longer than that. */}
            <GroupTree
              timetables={timetables}
              library={profiles.profiles.flatMap((profile) => profile.timetables)}
              locked={profiles.locked}
              catalog={catalog}
              online={online}
              onSetEnabled={profiles.setEnabled}
              onUpdate={setUpdating}
              onRename={profiles.renameTimetable}
              onRemove={profiles.removeTimetable}
              onEditSubjects={profiles.editSubjects}
              onAddTimetables={() => setPicking("add")}
              onHighlight={highlightGroup}
              flash={flash}
            />
          </Suspense>
        </div>

        {/* On desktop the footer belongs to this column and sits at its
            bottom, so it lines up with the sidebar's end instead of running
            under it. */}
        <div
          className={cn("min-h-0 flex-col desktop:flex", tab === "timetable" ? "flex" : "hidden")}
        >
          {/* Phones: a dock sticking to the top of the tab bar, where the
              thumb is — last in the column so it ends up in flow below the
              grid and the page needs no room guessed for it. Desktop: the
              toolbar above the grid. */}
          <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 order-last flex flex-col gap-2 border-t bg-background px-6 py-3 desktop:static desktop:order-none desktop:border-0 desktop:pt-6 desktop:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ViewSwitch value={view} onChange={setView} />
              {view === "week" && (
                <WeekNav
                  value={weekStart}
                  onChange={setWeekStart}
                  semesterWeek={weekNumber >= 1 ? weekNumber : null}
                />
              )}
            </div>
            <DayToggle value={day} onChange={setDay} className="md:hidden" />
          </div>
          <div className="p-6 desktop:min-h-0 desktop:flex-1 desktop:overflow-auto desktop:pt-4">
            <TimetableGrid
              entries={entries}
              week={week}
              hasFiles={hasTimetables}
              highlight={highlight}
              onJump={jumpToGroup}
              selectedDay={day}
              onSelectDay={setDay}
            />
          </div>
          <Footer data={dataMenu} />
        </div>
      </main>

      <Suspense fallback={null}>
        <AppDialogs
          profiles={profiles}
          catalog={offerCatalog}
          online={online}
          picking={picking}
          onPickingChange={setPicking}
          updating={updating}
          onUpdatingChange={setUpdating}
          importing={importing}
          onImportingChange={setImporting}
          linkPayload={linkPayload}
          onLinkPayloadChange={setLinkPayload}
        />
        {/* Transient feedback only (upload, import, copy, download); anything
            the user has to act on stays on the page itself. `@/lib/toast`
            holds every toast until this is mounted. */}
        <AppToaster />
      </Suspense>

      <TabBar
        value={tab}
        onChange={switchTab}
        settings={
          // The footer's content, behind the bar's last slot. Until the
          // deferred chunk arrives a disabled look-alike holds the slot.
          <Suspense fallback={<SettingsFallback />}>
            <DataMenu
              {...dataMenu}
              trigger={<Button variant="ghost" className={TAB_ITEM} />}
              settings
            >
              <SettingsTriggerContent />
            </DataMenu>
          </Suspense>
        }
      />
    </div>
  );
}

type DataMenuProps = Omit<ComponentProps<typeof DataMenu>, "trigger" | "children" | "settings">;

function SettingsTriggerContent() {
  return (
    <>
      <Settings className="size-5" />
      {m.settings_menu()}
    </>
  );
}

function SettingsFallback() {
  return (
    <Button variant="ghost" className={TAB_ITEM} disabled>
      <SettingsTriggerContent />
    </Button>
  );
}

// Note · Data menu · language. The menu comes with the deferred chunk; until
// then a disabled look-alike holds its place, so nothing shifts.
function Footer({ data }: { data: DataMenuProps }) {
  return (
    <footer className="hidden border-t desktop:block">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-3 text-sm text-muted-foreground">
        {m.footer_note()}
        <div className="flex flex-wrap items-center gap-2">
          <Suspense
            fallback={
              <Button variant="ghost" size="xs" disabled>
                <DataTriggerContent />
              </Button>
            }
          >
            <DataMenu {...data} trigger={<Button variant="ghost" size="xs" />}>
              <DataTriggerContent />
            </DataMenu>
          </Suspense>
          <LanguageSwitcher />
        </div>
      </div>
    </footer>
  );
}

function DataTriggerContent() {
  return (
    <>
      <Database data-icon="inline-start" />
      {m.data_menu()}
      <ChevronDown data-icon="inline-end" />
    </>
  );
}
