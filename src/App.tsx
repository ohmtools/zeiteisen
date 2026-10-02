import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Bug, ChevronDown, Database } from "lucide-react";
import { cn } from "cn";
import { m } from "@/i18n";
import { DayToggle } from "@/components/DayToggle";
import { Brand } from "@/components/Brand";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import type { SubjectInformation } from "@/lib/primitives/meta";
import { TimetableGrid, type WeekView } from "@/components/TimetableGrid";
import { TabBar, type Tab } from "@/components/TabBar";
import { ViewSwitch, type View } from "@/components/ViewSwitch";
import { WeekNav } from "@/components/WeekNav";
import { OverridesContext } from "@/components/OverridesContext";
import type { DataProps } from "@/components/DataControls";
import type { NotesHandle } from "@/components/NotesSection";
import { Button } from "@/components/ui/button";
import { useCatalog } from "@/hooks/useCatalog";
import { useCatalogSources } from "@/hooks/useCatalogSources";
import { useInstallHint } from "@/hooks/useInstallHint";
import { useNotes } from "@/hooks/useNotes";
import { useNotesStrip } from "@/hooks/useNotesStrip";
import { useNow } from "@/hooks/useNow";
import { useOnline } from "@/hooks/useOnline";
import { useOwnData } from "@/hooks/useOwnData";
import { useSemesterDates } from "@/hooks/useSemesterDates";
import { useProfiles } from "@/hooks/useProfiles";
import { useStripSharedUrl } from "@/hooks/useShareLink";
import { Catalog, CatalogKind, degreeProgramOf } from "@/lib/primitives/catalog";
import { isKnownSharedProfile } from "@/lib/primitives/profile";
import type { Day } from "@/lib/primitives/subject";
import type { TimetableName } from "@/lib/primitives/timetable";
import { dayOf, eventsForWeek } from "@/lib/primitives/week";
import { generalEntries, weekEntries } from "@/lib/layout";
import { DEFAULT_CATALOG_URL } from "@/lib/catalog";
import { payloadFromLocation } from "@/lib/share";
import { sameHighlight, type Highlight, type SubjectRef } from "@/lib/link";
import { isDesktop } from "@/lib/media";
import { dayPickedIn, defaultView, shownDay, shownWeek, type Picked } from "@/lib/view";

// Everything but the grid comes from one deferred chunk (see
// `components/deferred`): rendering any of these on the first render starts
// the download, and the grid paints without waiting for it.
const deferred = () => import("@/components/deferred");
const ProfileSection = lazy(() => deferred().then((d) => ({ default: d.ProfileSection })));
const GroupTree = lazy(() => deferred().then((d) => ({ default: d.GroupTree })));
const AppDialogs = lazy(() => deferred().then((d) => ({ default: d.AppDialogs })));
const SubjectInfoDialog = lazy(() => deferred().then((d) => ({ default: d.SubjectInfoDialog })));
const AppToaster = lazy(() => deferred().then((d) => ({ default: d.AppToaster })));
const DataMenu = lazy(() => deferred().then((d) => ({ default: d.DataMenu })));
const DebugButton = lazy(() => deferred().then((d) => ({ default: d.DebugButton })));
const SettingsPage = lazy(() => deferred().then((d) => ({ default: d.SettingsPage })));
const NotesSection = lazy(() => deferred().then((d) => ({ default: d.NotesSection })));

export default function App() {
  // "Now" ticks every minute, so a page left open moves on with the clock.
  const now = useNow();
  // The week the week view shows and the one day of the phone grid: what the
  // user picked while that week (day) lasts, else the current one.
  const [pickedWeek, setPickedWeek] = useState<Picked<number> | null>(null);
  const weekTime = shownWeek(pickedWeek, now);
  // One Date per shown week: the compiler would build a new one on every tick
  // of `now`, and with it the week's events and blocks.
  const weekStart = useMemo(() => new Date(weekTime), [weekTime]);
  const [pickedDay, setPickedDay] = useState<Picked<Day> | null>(null);
  const day = shownDay(pickedDay, now);
  // The clock read on the click (an event handler may), so the handlers do not
  // change, and re-render the grid, on every tick.
  const pickWeek = (next: Date) =>
    setPickedWeek({ value: next.getTime(), pickedIn: shownWeek(null, new Date()) });
  const pickDay = (next: Day) => setPickedDay({ value: next, pickedIn: dayPickedIn(new Date()) });
  // "Today" drops both picks: week and day follow the clock again.
  const pickToday = () => {
    setPickedWeek(null);
    setPickedDay(null);
  };
  const atToday = weekTime === shownWeek(null, now) && day === shownDay(null, now);
  // Where the global dates came from, plus the footer switch.
  const sources = useCatalogSources();
  const dates = useSemesterDates(sources);
  // The user's own locations and degrees, in place of the catalog's.
  const own = useOwnData();
  // Current week during the lecture period, else the general grid.
  const [view, setView] = useState<View>(() => defaultView(dates.dates, new Date()));
  // Only used to explain the catalog: nothing in the app needs the network.
  const online = useOnline();
  // The optional static catalog: locations, degrees, dates and ready-made
  // timetables fetched from `VITE_CATALOG_URL` or the user's URL. Missing or
  // offline changes nothing — the dates stay as they are and the picker
  // simply lists less. Ignored, it is not read at all.
  const {
    catalog,
    refresh: refreshCatalog,
    fetchJson: fetchCatalogJson,
    dropFor: dropCatalogFor,
    overrides,
  } = useCatalog({
    mode: sources.mode,
    url: sources.url,
    sources: sources.sources,
    onDates: dates.install,
    // Silent when another catalog is about to install its own dates.
    onDropDates: (next) => dates.removeCatalogDates({ quiet: next.mode !== "ignore" }),
    own: { locations: own.locations, degrees: own.degrees },
  });
  // Profiles own their timetables: there is no device-wide file store.
  const profiles = useProfiles();
  useInstallHint();
  // Plain text, this device only: never in a link or a profile file.
  const { notes, setNotes } = useNotes();
  // The desktop strip's height and folding.
  const notesStrip = useNotesStrip();
  // A link opened directly is an import like any other: read it on the first
  // render (`useStripSharedUrl` strips the URL once the dialog closes), and let
  // the dialog ask for a name and which timetables to take instead of
  // creating a profile behind the user's back. Reopening a link this device already holds (the same
  // timetables with the same selection) opens no dialog.
  const [linkPayload, setLinkPayload] = useState(() => {
    const link = payloadFromLocation();
    return link && !isKnownSharedProfile(link, profiles.profiles) ? link : null;
  });
  const [importing, setImportingState] = useState(() => linkPayload !== null);
  // Which timetables the picker may offer, and which of its two modes it is in.
  const [picking, setPickingState] = useState<"new-profile" | "add" | null>(null);
  // Both dialogs offer catalog timetables: ask the catalog again on opening,
  // so they never list an index the page read hours ago. A link opened
  // directly needs no extra call, the page load refreshes anyway.
  const setImporting = (open: boolean) => {
    if (open && !importing) refreshCatalog();
    setImportingState(open);
  };
  const setPicking = (mode: "new-profile" | "add" | null) => {
    if (mode && !picking) refreshCatalog();
    setPickingState(mode);
  };
  // The timetable the update dialog is asking about, by name.
  const [subjectInfo, setSubjectInfo] = useState<SubjectInformation | null>(null);
  const [updating, setUpdating] = useState<TimetableName | null>(null);
  // An opened link stays in the address bar until the import dialog closes.
  useStripSharedUrl(importing);
  const timetables = profiles.timetables;
  const hasTimetables = timetables.length > 0;
  // Phones show one page at a time (`TabBar`): grid, groups, notes or
  // settings. An
  // empty profile starts on its groups, where timetables are added; anything
  // else on the grid. Not persisted.
  const [tab, setTab] = useState<Tab>(() => (hasTimetables ? "timetable" : "groups"));
  const switchTab = (next: Tab) => {
    setTab(next);
    window.scrollTo({ top: 0 });
  };

  // N, anywhere but in a field, a dialog or a menu: to the notes (phones
  // switch to their tab first), caret at the end. Escape in them goes back to
  // the grid.
  const notesRef = useRef<NotesHandle>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isNotesShortcut(event)) return;
      event.preventDefault();
      // The tab has to be on screen before the text area can take the focus.
      if (!isDesktop()) flushSync(() => setTab("notes"));
      notesRef.current?.edit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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

  // The desktop footer's Data menu and the phones' Settings page.
  const dataMenu: DataProps = {
    catalogMode: sources.mode,
    onCatalogMode: (mode) => {
      dropCatalogFor({ mode, url: sources.url });
      sources.setMode(mode);
    },
    catalogUrl: sources.url,
    defaultCatalogUrl: DEFAULT_CATALOG_URL,
    onCatalogUrl: (url) => {
      dropCatalogFor({ mode: sources.mode, url });
      sources.setUrl(url);
    },
    datesManual: dates.manual,
    onUploadDates: (file) => void dates.upload(file),
    onCatalogDates: () => void dates.switchToCatalogDates(fetchCatalogJson),
    ownLocations: own.locations !== null,
    onUploadLocations: (file) => void own.uploadLocations(file),
    onCatalogLocations: own.switchToCatalogLocations,
    ownDegrees: own.degrees,
    catalogDegrees: catalog
      .entries(CatalogKind.Degrees)
      .map(degreeProgramOf)
      .filter((program) => program !== null),
    onReadDegrees: own.readDegrees,
    onAddDegrees: own.addDegrees,
    onRemoveDegrees: own.removeDegrees,
    profileCount: profiles.profiles.length,
  };

  let week: WeekView | null = null;
  // Visible = the enabled subjects of this profile's timetables.
  let entries = generalEntries(timetables);
  if (view === "week") {
    const containsToday = shownWeek(null, now) === weekTime;
    const today = dayOf(now);
    const events = eventsForWeek(dates.dates, weekStart);
    week = { ...events, today: containsToday && today !== "other" ? today : null };
    entries = weekEntries(timetables, weekStart, events);
  }

  return (
    // Names and building links for every block and the subject editor.
    <OverridesContext value={overrides}>
      {/* Desktop: the page itself never scrolls — the shell is exactly one
          viewport tall and the subject section takes whatever height the
          fixed-height profile section leaves. Phones (and any viewport too
          short, see the `desktop` variant in index.css): the Timetable tab is
          one viewport tall too, the grid stretches to fill it; the Groups and
          Settings tabs keep the ordinary page scroll. Phones keep room for the fixed tab
          bar and, in landscape, for the notch. */}
      <div
        className={cn(
          "flex flex-col pr-[env(safe-area-inset-right)] pb-[calc(3.5rem+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] desktop:h-dvh desktop:min-h-0 desktop:overflow-hidden desktop:pb-0",
          tab === "timetable" || tab === "notes" ? "h-dvh overflow-hidden" : "min-h-screen",
        )}
      >
        {/* No visible header (user decision); the name lives in the footer. */}
        <h1 className="sr-only">{m.app_title()}</h1>

        <main className="grid w-full min-h-0 flex-1 grid-cols-1 desktop:grid-cols-[24rem_minmax(0,1fr)]">
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

          {/* On desktop the notes and the footer belong to this column and
            sit at its bottom, so they line up with the sidebar's end instead
            of running under it. Phones: the timetable tab shows dock and grid,
            the notes tab the notes alone. */}
          <div
            className={cn(
              "min-h-0 flex-col desktop:flex",
              tab === "timetable" || tab === "notes" ? "flex" : "hidden",
            )}
          >
            {/* Phones: a dock between grid and tab bar, where the thumb is —
              last in the column. Rows: week nav (an empty row in the general
              view), day, view switch. Desktop: one toolbar row above the grid, switch
              left, week nav right. */}
            <div
              className={cn(
                "order-last flex flex-col gap-2 border-t px-6 py-3 desktop:order-none desktop:flex-row desktop:flex-wrap desktop:items-center desktop:justify-between desktop:border-0 desktop:pt-6 desktop:pb-0",
                tab === "notes" && "hidden desktop:flex",
              )}
            >
              {/* Stays in the general view, empty, so the grid keeps its height. */}
              <div className="flex h-8 items-center desktop:order-last">
                {view === "week" && (
                  <WeekNav
                    value={weekStart}
                    onChange={pickWeek}
                    onToday={pickToday}
                    atToday={atToday}
                  />
                )}
              </div>
              <DayToggle value={day} onChange={pickDay} className="md:hidden" />
              <ViewSwitch value={view} onChange={setView} />
            </div>
            {/* Below `desktop` the grid fills the height the dock leaves and
              scrolls only when that is too short for its minimum rows. */}
            <div
              ref={gridRef}
              tabIndex={-1}
              className={cn(
                "flex min-h-0 flex-1 flex-col overflow-y-auto p-6 outline-none",
                tab === "notes" && "hidden desktop:flex",
              )}
            >
              <TimetableGrid
                entries={entries}
                week={week}
                hasFiles={hasTimetables}
                highlight={highlight}
                onJump={jumpToGroup}
                onInfo={setSubjectInfo}
                selectedDay={day}
                onSelectDay={pickDay}
              />
            </div>
            {/* Desktop: a strip of the height the user dragged it to (144px
              by default, between 112px and 60% of the screen, the bounds of
              `NotesSection`), or its title row alone when folded. Set here,
              so the grid keeps its rows while the deferred chunk loads.
              Phones: the whole page. */}
            <div
              style={
                { "--notes-height": `${notesStrip.strip.height ?? 144}px` } as React.CSSProperties
              }
              className={cn(
                "min-h-0 flex-1 flex-col desktop:flex desktop:flex-none desktop:border-t",
                notesStrip.strip.collapsed
                  ? "desktop:h-[calc(3rem+1px)]"
                  : "desktop:h-[clamp(112px,var(--notes-height),60dvh)]",
                tab === "notes" ? "flex" : "hidden",
              )}
            >
              <Suspense fallback={null}>
                <NotesSection
                  ref={notesRef}
                  notes={notes}
                  onChange={setNotes}
                  strip={notesStrip.strip}
                  onStripPreview={notesStrip.preview}
                  onStripSave={notesStrip.save}
                  onLeave={() => {
                    if (isDesktop()) gridRef.current?.focus();
                  }}
                />
              </Suspense>
            </div>
            <Footer data={dataMenu} />
          </div>

          {/* Phones only: the desktop footer's content as a page. */}
          <div className={cn("flex-col desktop:hidden", tab === "settings" ? "flex" : "hidden")}>
            <Suspense fallback={null}>
              <SettingsPage {...dataMenu} />
            </Suspense>
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
          <SubjectInfoDialog info={subjectInfo} onClose={() => setSubjectInfo(null)} />
          {/* Transient feedback only (upload, import, copy, download); anything
            the user has to act on stays on the page itself. `@/lib/toast`
            holds every toast until this is mounted. */}
          <AppToaster />
        </Suspense>

        <TabBar value={tab} onChange={switchTab} />
      </div>
    </OverridesContext>
  );
}

// Logo and name · note · Data menu · language. The menu comes with the deferred chunk; until
// then a disabled look-alike holds its place, so nothing shifts.
function Footer({ data }: { data: DataProps }) {
  return (
    <footer className="hidden border-t desktop:block">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-3 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Brand className="text-foreground" />
          {m.footer_note()}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Desktop only; phones have it on the Settings page, under About. */}
          <Suspense
            fallback={
              <Button variant="ghost" size="xs" disabled>
                <DebugTriggerContent />
              </Button>
            }
          >
            <DebugButton variant="ghost" size="xs" />
          </Suspense>
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

// A bare N (or Shift+N) typed outside anything that takes text or keys of
// its own.
function isNotesShortcut(event: KeyboardEvent): boolean {
  if (event.key !== "n" && event.key !== "N") return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (event.isComposing || event.repeat || event.defaultPrevented) return false;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return true;
  if (target.isContentEditable) return false;
  return !target.closest(
    "input, textarea, select, [role=dialog], [role=alertdialog], [role=menu], [role=listbox]",
  );
}

// What `DebugButton` shows, for its fallback.
function DebugTriggerContent() {
  return (
    <>
      <Bug data-icon="inline-start" />
      {m.debug_menu()}
    </>
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
