import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { addWeeks, parseISO, startOfISOWeek } from "date-fns";
import { CalendarDays, Plus } from "lucide-react";
import { cn } from "cn";
import { m } from "@/i18n";
import { HeaderActions, HeaderBrand, LockButton, type Panel } from "@/components/AppHeader";
import { lazyDeferred } from "@/components/lazyDeferred";
import { DayToggle } from "@/components/DayToggle";
import { ProfileTriggerFallback } from "@/components/ProfileTrigger";
import { TimetableGrid, type WeekView } from "@/components/TimetableGrid";
import { WeekFilterSwitch, type View } from "@/components/ViewSwitch";
import { WeekNav } from "@/components/WeekNav";
import { AppShell } from "@/components/ohmtools/app-shell";
import { Panel as PanelGroup } from "@/components/ohmtools/panel";
import { ViewControls, Views } from "@/components/ohmtools/views";
import { OverridesContext } from "@/components/OverridesContext";
import type { DataProps } from "@/components/DataControls";
import type { NotesHandle } from "@/components/NotesSection";
import type { EditRequest } from "@/components/SubjectEditor";
import type { CategoryRef } from "@/components/GroupTree";
import { Button } from "@/components/ui/button";
import type { DetailActions } from "@/components/SubjectBlock";
import { useCatalog } from "@/hooks/useCatalog";
import { useCatalogSources } from "@/hooks/useCatalogSources";
import { useInstallHint } from "@/hooks/useInstallHint";
import { useNotes } from "@/hooks/useNotes";
import { useNow } from "@/hooks/useNow";
import { useOnline } from "@/hooks/useOnline";
import { useOwnData } from "@/hooks/useOwnData";
import { useSemesterDates } from "@/hooks/useSemesterDates";
import { useProfiles } from "@/hooks/useProfiles";
import { useStripSharedUrl } from "@/hooks/useShareLink";
import { Catalog, CatalogKind, degreeProgramOf } from "@/lib/primitives/catalog";
import type { SubjectInformation } from "@/lib/primitives/meta";
import { uniqueName } from "@/lib/primitives/name";
import { isKnownSharedProfile, type Profile, type ProfileName } from "@/lib/primitives/profile";
import { Subjects, type Day } from "@/lib/primitives/subject";
import type { TimetableName } from "@/lib/primitives/timetable";
import { categoriesOf } from "@/lib/primitives/tree";
import { dayOf, eventsForWeek } from "@/lib/primitives/week";
import {
  type Entry,
  generalEntries,
  nextWeekWithEntries,
  weekEntries,
  weekFilterMatches,
  type WeekFilter,
} from "@/lib/layout";
import { DEFAULT_CATALOG_URL } from "@/lib/catalog";
import {
  dayOfDate,
  followMentions,
  isOne,
  mentionMatches,
  mentionResolver,
  mentionsOfText,
  mentionToken,
  type MentionTarget,
} from "@/lib/mentions";
import { insertInline, insertLine } from "@/lib/notes";
import { payloadFromLocation } from "@/lib/share";
import { sameHighlight, type Highlight, type SubjectRef } from "@/lib/link";
import { transition } from "@/lib/ohmtools/motion";
import { toast } from "@/lib/ohmtools/toast";
import { currentStep, SHORT_QUERY, useMedia, useStep } from "@/lib/ohmtools/steps";
import { dateLabel, shortDate } from "@/lib/subjects";
import {
  calendarWeek,
  current,
  dayPick,
  defaultView,
  shownDay,
  shownWeek,
  weekPick,
  type Picked,
} from "@/lib/view";

// Everything but the shell and the grid comes from one deferred chunk (see
// `components/deferred`): rendering any of these on the first render starts
// the download, and the grid paints without waiting for it.
const ProfileMenu = lazyDeferred((d) => d.ProfileMenu);
const GroupTree = lazyDeferred((d) => d.GroupTree);
const AppDialogs = lazyDeferred((d) => d.AppDialogs);
const SubjectInfoDialog = lazyDeferred((d) => d.SubjectInfoDialog);
const Settings = lazyDeferred((d) => d.Settings);
const NotesSection = lazyDeferred((d) => d.NotesSection);
const NotesActions = lazyDeferred((d) => d.NotesActions);
const UpdatePrompt = lazyDeferred((d) => d.UpdatePrompt);

export default function App() {
  // "Now" ticks every minute, so a page left open moves on with the clock.
  const now = useNow();
  // Narrow (phones), compact (whole week, panels as a sheet) or wide (a
  // sidebar beside the grid), live.
  const step = useStep();
  const short = useMedia(SHORT_QUERY);
  // The week the week view shows and the one day of the phone grid: what the
  // user picked while the pick holds, else the current one.
  const [pickedWeek, setPickedWeek] = useState<Picked<number> | null>(null);
  const weekTime = shownWeek(pickedWeek, now);
  // One Date per shown week: the compiler would build a new one on every tick
  // of `now`, and with it the week's events and blocks.
  const weekStart = useMemo(() => new Date(weekTime), [weekTime]);
  const [pickedDay, setPickedDay] = useState<Picked<Day> | null>(null);
  const day = shownDay(pickedDay, now, weekTime);
  // The clock read on the click (an event handler may), so the handlers do not
  // change, and re-render the grid, on every tick. A week pick takes the
  // phone's day pick along (or `nextDay`, where a swipe lands): in another
  // week it holds as long as the week pick.
  const pickWeek = (next: Date, nextDay?: Day) => {
    const at = new Date();
    const week = weekPick(next.getTime(), at);
    setPickedWeek(week);
    const value = nextDay ?? current(pickedDay, at);
    if (value !== null) setPickedDay(dayPick(value, week, at));
  };
  const pickDay = (next: Day) => setPickedDay(dayPick(next, pickedWeek, new Date()));
  // "Today" drops both picks: week and day follow the clock again.
  const pickToday = () => {
    setPickedWeek(null);
    setPickedDay(null);
  };
  const atToday = weekTime === shownWeek(null, now) && day === shownDay(null, now, weekTime);
  // Where the global dates came from, plus the settings' switch.
  const sources = useCatalogSources();
  const dates = useSemesterDates(sources);
  // The user's own locations and degrees, in place of the catalog's.
  const own = useOwnData();
  // Current week during the lecture period, else the general grid.
  const [view, setView] = useState<View>(() => defaultView(dates.dates, new Date()));
  // The general view's "All weeks | Even | Odd"; not persisted.
  const [filter, setFilter] = useState<WeekFilter>("all");
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
  const [subjectInfo, setSubjectInfo] = useState<SubjectInformation | null>(null);
  // The timetable the update dialog is asking about, by name.
  const [updating, setUpdating] = useState<TimetableName | null>(null);
  // The subject the editor is asked for (from the tree or a block's
  // details): it asks first for a catalog timetable (`SubjectEditor`).
  const [editing, setEditing] = useState<EditRequest | null>(null);
  // An opened link stays in the address bar until the import dialog closes.
  useStripSharedUrl(importing);
  const timetables = profiles.timetables;
  const hasTimetables = timetables.length > 0;
  // A first visit: one profile, still empty.
  const welcome = !hasTimetables && profiles.profiles.length <= 1;

  // Groups or notes: open beside the grid on wide screens (groups
  // at first, user decision: they are what the app is for), else closed until
  // asked for. Not persisted. A first visit has no groups yet: the sidebar
  // waits until the welcome brought a timetable in.
  const [panel, setPanel] = useState<Panel | null>(() =>
    currentStep() === "wide" && !welcome ? "groups" : null,
  );
  // The panel the container shows: the open one, or while a sheet slides
  // out the one that was open.
  const [shownPanel, setShownPanel] = useState<Panel>(panel ?? "groups");
  const [wasWelcome, setWasWelcome] = useState(welcome);
  if (wasWelcome !== welcome) {
    setWasWelcome(welcome);
    if (!welcome && panel === null && step === "wide") {
      setPanel("groups");
      setShownPanel("groups");
    }
  }
  // The groups panel's category view, if one is open (`GroupTree`).
  const [category, setCategory] = useState<CategoryRef | null>(null);
  // The group cell lighting its blocks in the grid (tree ↔ grid, below).
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  // The notes came by N: the compact sheet leaves the focus to them.
  const [notesByKey, setNotesByKey] = useState(false);
  const openPanel = (next: Panel | null) => {
    const update = () => {
      setPanel(next);
      if (next) setShownPanel(next);
      setNotesByKey(false);
      if (next !== "groups") {
        setCategory(null);
        // The tree goes without a blur or pointer leave: its highlight with it.
        setHighlight(null);
      }
    };
    // The design's motion for panels (as `usePanel()`, which holds one
    // panel, not two): the sidebar slides in or out beside the grid, a
    // phone's page comes in from the right and goes back the way it came;
    // the compact sheet brings its own animation.
    if (next === panel || step === "compact") update();
    else if (step === "wide") transition("panel", update);
    else transition(next === null ? "back" : "forward", update);
  };

  // The settings, an area (`Settings`): a dialog on wide screens, beside
  // whatever panel is open; elsewhere a page coming in from the right (as
  // `useArea()`).
  const [settings, setSettings] = useState(false);
  const openSettings = (open: boolean) => {
    const update = () => setSettings(open);
    if (step !== "wide" && open !== settings) transition(open ? "forward" : "back", update);
    else update();
  };

  // N, anywhere but in a field, a dialog or a menu: to the notes, caret at
  // the end. Escape in them goes back to the grid. Before the deferred chunk
  // has arrived the notes are not there yet: the caret waits for them.
  const notesRef = useRef<NotesHandle | null>(null);
  // Edit as soon as the notes are there: at the end (`true`) or at a caret.
  const editPending = useRef<boolean | number>(false);
  const notesHandle = (handle: NotesHandle | null) => {
    notesRef.current = handle;
    editNow(editPending, handle);
  };
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // No keyboard shortcuts on phones (DESIGN.md, "Elements by step").
      if (!isNotesShortcut(event) || currentStep() === "narrow") return;
      event.preventDefault();
      editPending.current = true;
      // The notes have to be on screen before the text area takes the focus.
      flushSync(() => {
        setPanel("notes");
        setShownPanel("notes");
        setSettings(false);
        setNotesByKey(true);
        setHighlight(null);
      });
      // Already on screen, no new handle came: edit now.
      editNow(editPending, notesRef.current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Tree ↔ grid, shared by panel and grid. Wide screens: the group cell under
  // the mouse or focus keeps its blocks lit and dims the rest, so does an open
  // category view (phones never show both at once). Every screen: a block's
  // details jump to its group cell, which flashes for a moment.
  const [flash, setFlash] = useState<(SubjectRef & { nonce: number }) | null>(null);
  const highlightGroup = (next: Highlight | null) => {
    const wanted = next && currentStep() === "wide" ? next : null;
    setHighlight((previous) => (sameHighlight(previous, wanted) ? previous : wanted));
  };
  const jumpToGroup = (subject: SubjectRef) => {
    openPanel("groups");
    setCategory(null);
    setFlash({ ...subject, nonce: Date.now() });
  };
  useEffect(() => {
    if (!flash) return;
    const done = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(done);
  }, [flash]);
  // Notes ↔ grid. Links in the notes name a Termin by date, time and class
  // (`@/lib/mentions`): the blocks they point at carry the notes' mark, a
  // press on one shows its block (which pulses), its details lead back to
  // the line.
  const mentions = useMemo(() => mentionsOfText(notes), [notes]);
  const [blockFlash, setBlockFlash] = useState<{ key: string; nonce: number } | null>(null);
  useEffect(() => {
    if (!blockFlash) return;
    const done = setTimeout(() => setBlockFlash(null), 1600);
    return () => clearTimeout(done);
  }, [blockFlash]);
  const [noteReveal, setNoteReveal] = useState<{ start: number; nonce: number } | null>(null);
  // Tells one flash or reveal of the same block or line from the next.
  const nonce = useRef(0);
  // A link to every Termin of a class (from or up to a date too): its next
  // one.
  const jumpToMention = (mention: MentionTarget) => {
    const status = mentionResolver(
      profiles.profiles,
      profiles.activeName,
      dates.dates,
      new Date(),
    ).status(mention);
    const target = isOne(mention)
      ? mention.date
      : status.kind === "broken"
        ? null
        : status.entry.meeting.date;
    if (target === null) return;
    setView("week");
    pickWeek(startOfISOWeek(parseISO(target)));
    pickDay(dayOfDate(target));
    if (status.kind === "ok") setBlockFlash({ key: status.entry.key, nonce: ++nonce.current });
    // The panel covers the grid on phones and compact screens.
    if (currentStep() !== "wide") openPanel(null);
  };
  const openNote = (start: number) => {
    openPanel("notes");
    setNoteReveal({ start, nonce: ++nonce.current });
  };
  // "Mention in the notes": a new task at the end linking to the block, the
  // caret after the link to say what it is about.
  const mentionInNotes = (entry: Entry) => {
    const line = insertLine(notes, notes.length, "- [ ] ");
    const next = insertInline(line.text, line.caret, mentionToken(entry));
    setNotes(next.text);
    editPending.current = next.caret;
    flushSync(() => {
      openPanel("notes");
      setSettings(false);
    });
    editNow(editPending, notesRef.current);
  };

  // A link's class edited, updated from the catalog or deleted: links follow
  // an edit where that is clear ("2 links updated", with Undo for the notes),
  // and a toast counts those now pointing nowhere. Only when links are hit:
  // nothing is said otherwise. Switching off and switching profiles keep
  // every link (the notes show those muted), renaming touches none.
  const following = useRef<{ before: Profile[]; relinkIn: ProfileName | null } | null>(null);
  const notesNow = useRef(notes);
  useEffect(() => {
    notesNow.current = notes;
  }, [notes]);
  const watched =
    <A extends unknown[], R>(change: (...args: A) => R, relink: boolean) =>
    (...args: A): R => {
      following.current = {
        before: profiles.profiles,
        relinkIn: relink ? profiles.activeName : null,
      };
      return change(...args);
    };
  useEffect(() => {
    const pending = following.current;
    if (!pending || pending.before === profiles.profiles) return;
    following.current = null;
    const old = notesNow.current;
    const { text, moved, lost } = followMentions(
      old,
      pending.before,
      profiles.profiles,
      dates.dates,
      pending.relinkIn,
    );
    if (moved > 0) {
      setNotes(text);
      toast.success(m.toast_mentions_moved({ count: moved }), {
        duration: 8000,
        action: {
          label: m.undo(),
          // Back to the links as they were, while nothing was typed since.
          onClick: () => {
            if (notesNow.current === text) setNotes(old);
          },
        },
      });
    }
    if (lost > 0) toast.warning(m.toast_mentions_lost({ count: lost }));
  }, [profiles.profiles, dates.dates, setNotes]);
  // The profile changes that may hit a link, watched.
  const watchedProfiles = {
    ...profiles,
    editSubjects: watched(profiles.editSubjects, true),
    replaceTimetable: watched(profiles.replaceTimetable, true),
    removeSubject: watched(profiles.removeSubject, false),
    removeTimetable: watched(profiles.removeTimetable, false),
    remove: watched(profiles.remove, false),
  };

  // Offline the catalog can hand over nothing, so it offers nothing.
  const offerCatalog = online ? catalog : Catalog.empty;
  const categoryHighlight = categoryLit(
    category,
    timetables,
    step === "wide" && panel === "groups",
  );

  // A new empty timetable, its name made unique in the profile: the welcome
  // screen's third way, and what "add subject" suggests for a catalog one.
  const addEmptyTimetable = (): TimetableName | null => {
    const name = uniqueName(
      timetables.map((one) => one.name),
      m.timetable_default_name(),
    );
    const added = profiles.addTimetables([
      { name, origin: { kind: "local" }, subjects: Subjects.empty() },
    ]);
    return added ? name : null;
  };

  // The settings, as dialog or page.
  const dataProps: DataProps = {
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
  // Visible = the enabled subjects of this profile's timetables; the general
  // view's filter only drops G or U.
  let entries = generalEntries(timetables).filter((entry) =>
    weekFilterMatches(entry.subject.repeat, filter),
  );
  if (view === "week") {
    const containsToday = calendarWeek(now) === weekTime;
    const today = dayOf(now);
    const events = eventsForWeek(dates.dates, weekStart);
    week = {
      ...events,
      today: containsToday && today !== "other" ? today : null,
      start: weekStart,
    };
    entries = weekEntries(timetables, weekStart, events);
  }

  const actions: DetailActions = {
    locked: profiles.locked,
    onDisable: (entry) => profiles.setEnabled(entry.timetableName, [entry.index], false),
    onEdit: (entry) => setEditing({ name: entry.timetableName, index: entry.index }),
    onJump: (entry) => jumpToGroup({ timetableName: entry.timetableName, index: entry.index }),
    onInfo: setSubjectInfo,
    mentionsOf: (entry) => mentions.filter((mention) => mentionMatches(mention, entry)),
    onOpenNote: openNote,
    onMention: mentionInNotes,
  };
  // The blocks a link points at; only blocks on days links name are checked,
  // every block when a link names every Termin of a class (the general
  // view's too: such a link names no date) or a span of them.
  const mentionedDates = new Set(mentions.filter(isOne).map((mention) => mention.date));
  const anyClass = mentions.some((mention) => !isOne(mention));
  const noted = new Set(
    entries
      .filter(
        (entry) =>
          (anyClass || (entry.meeting.date !== null && mentionedDates.has(entry.meeting.date))) &&
          mentions.some((mention) => mentionMatches(mention, entry)),
      )
      .map((entry) => entry.key),
  );

  // Over an empty grid: no timetables yet, or a week without classes and
  // where the next ones are.
  let overlay = null;
  if (!hasTimetables) {
    overlay = (
      <EmptyState
        title={m.empty_title({ name: profiles.activeName })}
        text={m.empty_text()}
        action={
          profiles.locked ? null : (
            <Button className="w-full" onClick={() => setPicking("add")}>
              {m.empty_add()}
            </Button>
          )
        }
      />
    );
  } else if (view === "week" && entries.length === 0) {
    const next = nextWeekWithEntries(timetables, dates.dates, weekStart);
    overlay = (
      <EmptyState
        title={m.week_empty_title()}
        text={
          // A weekly class outside Mon-Fri has no single date: then the week.
          next
            ? next.first.date
              ? m.week_empty_next({ date: dateLabel(next.first.date) })
              : m.week_empty_next_week({ date: shortDate(startOfISOWeek(next.start)) })
            : m.week_empty_none()
        }
        action={
          next && (
            <Button variant="secondary" className="w-full" onClick={() => pickWeek(next.start)}>
              {m.week_empty_jump({ date: shortDate(startOfISOWeek(next.start)) })}
            </Button>
          )
        }
      />
    );
  }

  const weekControl =
    view === "week" ? (
      <WeekNav
        value={weekStart}
        onChange={pickWeek}
        onToday={pickToday}
        atToday={atToday}
        step={step}
        className={step === "narrow" ? "w-full justify-between" : undefined}
      />
    ) : (
      <WeekFilterSwitch value={filter} onChange={setFilter} />
    );

  const profileMenu = (
    <Suspense fallback={<ProfileTriggerFallback name={profiles.activeName} />}>
      <ProfileMenu
        profiles={profiles.profiles}
        activeName={profiles.activeName}
        dates={dates.dates}
        catalog={catalog}
        onSelect={profiles.select}
        onOpenAdd={() => setPicking("new-profile")}
        onRename={profiles.rename}
        onDuplicate={profiles.duplicate}
        onRemove={watchedProfiles.remove}
        onOpenImport={() => setImporting(true)}
      />
    </Suspense>
  );

  // The panel's header (title, buttons, a category's back arrow) and body,
  // whichever container holds it. The lock stands in the panel's header on
  // phones, where the app's header is out of sight.
  const lock = step === "narrow" && (
    <LockButton locked={profiles.locked} onToggle={profiles.toggleLock} />
  );
  const openCategory = shownPanel === "groups" ? categoryOf(category, timetables) : null;
  const header =
    shownPanel === "notes"
      ? {
          title: m.notes_title(),
          actions: (
            <Suspense fallback={null}>
              <NotesActions notes={notes} onChange={setNotes} />
            </Suspense>
          ),
        }
      : openCategory
        ? {
            title:
              openCategory.category === null
                ? m.tree_no_group_title()
                : m.tree_category({ category: openCategory.category }),
            subtitle: openCategory.timetableName,
            actions: lock,
            onBack: () => setCategory(null),
          }
        : {
            title: m.panel_groups(),
            actions: (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={profiles.locked}
                  aria-label={m.profile_add_timetables()}
                  title={m.profile_add_timetables()}
                  onClick={() => setPicking("add")}
                >
                  <Plus />
                </Button>
                {lock}
              </>
            ),
          };
  const panelBody =
    shownPanel === "groups" ? (
      <GroupTree
        timetables={timetables}
        locked={profiles.locked}
        catalog={catalog}
        online={online}
        catalogIgnored={sources.mode === "ignore"}
        category={category}
        onCategory={setCategory}
        onSetEnabled={profiles.setEnabled}
        onUpdate={setUpdating}
        onRename={profiles.renameTimetable}
        onRemove={watchedProfiles.removeTimetable}
        onEdit={setEditing}
        onAddTimetables={() => setPicking("add")}
        onToggleLock={profiles.toggleLock}
        onHighlight={highlightGroup}
        flash={flash}
      />
    ) : (
      <NotesSection
        ref={notesHandle}
        notes={notes}
        onChange={setNotes}
        onLeave={() => gridRef.current?.focus()}
        timetables={timetables}
        profiles={profiles.profiles}
        activeName={profiles.activeName}
        dates={dates.dates}
        today={now}
        onJump={jumpToMention}
        onShowGroup={(entry) =>
          jumpToGroup({ timetableName: entry.timetableName, index: entry.index })
        }
        onSelectProfile={profiles.select}
        reveal={noteReveal}
      />
    );

  return (
    // Names and building links for every block and the subject editor.
    <OverridesContext value={overrides}>
      {/* The design's shell (`AppShell`): one viewport tall, the page never
          scrolls; the header, the bar at the bottom on phones, the wide
          sidebar, pages over everything and the toaster. The groups below
          place themselves into it. Toasts are transient feedback only
          (upload, import, copy, download): anything the user has to act on
          stays on the page itself. */}
      <AppShell
        title={m.app_title()}
        brand={
          <HeaderBrand
            step={step}
            profile={profileMenu}
            locked={profiles.locked}
            onToggleLock={profiles.toggleLock}
            welcome={welcome}
          />
        }
        actions={
          <HeaderActions
            step={step}
            locked={profiles.locked}
            onToggleLock={profiles.toggleLock}
            panel={panel}
            onPanel={openPanel}
            settings={settings}
            onSettings={() => openSettings(!settings)}
            welcome={welcome}
          />
        }
      >
        {/* "Week | General" with the week (or the week filter): in the header
            from compact on, in the bar at the bottom on phones, the day bar
            under them. */}
        {!welcome && (
          <>
            <Views
              value={view}
              onValueChange={setView}
              items={[
                { value: "week", label: m.view_week() },
                { value: "general", label: m.view_general() },
              ]}
              label={m.view_label()}
            />
            <ViewControls
              narrow={
                <DayToggle
                  value={day}
                  onChange={pickDay}
                  weekStart={view === "week" ? weekStart : null}
                />
              }
            >
              {weekControl}
            </ViewControls>
          </>
        )}
        <div
          ref={gridRef}
          tabIndex={-1}
          className="flex min-h-0 min-w-0 flex-1 flex-col p-4 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] outline-none compact:p-6 compact:pr-[max(1.5rem,env(safe-area-inset-right))] compact:pl-[max(1.5rem,env(safe-area-inset-left))] short:py-3"
        >
          {welcome ? (
            <Welcome
              onCatalog={() => setPicking("add")}
              onImport={() => setImporting(true)}
              onEmpty={() => {
                const name = addEmptyTimetable();
                if (name) openPanel("groups");
              }}
            />
          ) : (
            <TimetableGrid
              entries={entries}
              week={week}
              step={step}
              short={short}
              overlay={overlay}
              highlight={(step === "wide" ? highlight : null) ?? categoryHighlight}
              actions={actions}
              selectedDay={day}
              onSelectDay={pickDay}
              noted={noted}
              flash={blockFlash}
              // Swipes change the week where a finger may be the pointer:
              // phones and compact screens, never wide ones (DESIGN.md,
              // "Elements by step"); the buttons stay.
              onSwipeWeek={
                view === "week" && step !== "wide"
                  ? (direction, nextDay) => pickWeek(addWeeks(weekStart, direction), nextDay)
                  : undefined
              }
            />
          )}
        </div>

        {/* Groups or notes: a sidebar on wide screens (closable, user
            decision), a sheet from the right on compact ones, a page of its
            own on phones. */}
        <PanelGroup
          open={panel !== null}
          onClose={() => openPanel(null)}
          {...header}
          initialFocus={!(panel === "notes" && notesByKey)}
          closeLabel={m.panel_close()}
          backLabel={m.panel_back()}
        >
          <Suspense fallback={null}>{panelBody}</Suspense>
        </PanelGroup>

        <Suspense fallback={null}>
          <Settings open={settings} onClose={() => openSettings(false)} {...dataProps} />
          <AppDialogs
            profiles={watchedProfiles}
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
            editing={editing}
            onEditingChange={setEditing}
            onAddEmpty={addEmptyTimetable}
            onRefreshCatalog={() => refreshCatalog()}
          />
          <SubjectInfoDialog info={subjectInfo} onClose={() => setSubjectInfo(null)} />
          <UpdatePrompt />
        </Suspense>
      </AppShell>
    </OverridesContext>
  );
}

// The category view open in the groups panel, if it still exists (a
// timetable removed or changed takes it away: the overview shows).
function categoryOf(
  category: CategoryRef | null,
  timetables: ReturnType<typeof useProfiles>["timetables"],
): CategoryRef | null {
  if (!category) return null;
  const timetable = timetables.find((one) => one.name === category.timetableName);
  const found =
    timetable && categoriesOf(timetable.subjects).some((one) => one.category === category.category);
  return found ? category : null;
}

// The open category view lights its own blocks on wide screens, where grid
// and panel show side by side; every other block steps back.
function categoryLit(
  category: CategoryRef | null,
  timetables: ReturnType<typeof useProfiles>["timetables"],
  shown: boolean,
): Highlight | null {
  if (!category || !shown) return null;
  const timetable = timetables.find((one) => one.name === category.timetableName);
  const node = timetable
    ? categoriesOf(timetable.subjects).find((one) => one.category === category.category)
    : undefined;
  if (!node) return null;
  return {
    timetableName: category.timetableName,
    indexes: node.groups.flatMap((group) => group.indexes),
  };
}

// The centred card over an empty grid.
function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex max-w-xs animate-in flex-col items-center gap-4 rounded-[10px] bg-background/80 p-4 text-center backdrop-blur-sm duration-560 ease-out fade-in-0 zoom-in-95">
      <span className="flex size-9 items-center justify-center rounded-md bg-secondary">
        <CalendarDays className="size-4" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-balance">{title}</h2>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
      {action}
    </div>
  );
}

// Rises into place on mount, held back until its delay (`fill-mode-both`).
const RISE = "animate-in fade-in-0 slide-in-from-bottom-2 duration-500 ease-out fill-mode-both";

// A first visit (one empty profile): three ways in.
function Welcome({
  onCatalog,
  onImport,
  onEmpty,
}: {
  onCatalog: () => void;
  onImport: () => void;
  onEmpty: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        {/* One after the other: tile, words, the three ways in. */}
        <span className="flex size-10 animate-in items-center justify-center rounded-md bg-red text-red-foreground duration-500 ease-out fade-in-0 zoom-in-50 spin-in-12">
          <CalendarDays className="size-5" />
        </span>
        <div className={cn("flex flex-col gap-2 delay-100", RISE)}>
          <h2 className="text-base font-semibold">{m.welcome_title()}</h2>
          <p className="text-sm text-muted-foreground">{m.welcome_text()}</p>
        </div>
        <div className={cn("flex w-full flex-col gap-2 delay-200", RISE)}>
          <Button className="w-full" onClick={onCatalog}>
            {m.welcome_catalog()}
          </Button>
          <Button variant="secondary" className="w-full" onClick={onImport}>
            {m.welcome_import()}
          </Button>
          <Button variant="ghost" className="w-full" onClick={onEmpty}>
            {m.welcome_empty()}
          </Button>
        </div>
      </div>
    </div>
  );
}

// The edit waiting for the notes, once they are on screen: at the end
// (`true`) or at a caret.
function editNow(pending: { current: boolean | number }, handle: NotesHandle | null) {
  const at = pending.current;
  if (at === false || !handle) return;
  pending.current = false;
  handle.edit(at === true ? undefined : at);
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
