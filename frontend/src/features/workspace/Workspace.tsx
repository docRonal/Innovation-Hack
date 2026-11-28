import { cn } from "cn";
import {
  Bell,
  CalendarDays,
  ChartLine,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Ellipsis,
  FileText,
  FlaskConical,
  History,
  LayoutGrid,
  LogOut,
  PanelTop,
  ScanLine,
  Server,
  Settings,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { type DemoEvent, fetchDemoEvents } from "@/api/demoEvents";
import { api, ApiError, apiVoid, errorMessage, textValue } from "@/api/workspaceClient";
import { CorporateBrand, PlantSkyline } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { parseEquipmentUrl } from "@/lib/qr";
import {
  notifyLocally,
  notifyUnreadSummary,
  requestLocalNotificationPermission,
} from "@/platform/localNotify";
import { canScanQr, scanEquipment } from "@/platform/scan";
import { clearServerUrl, getServerUrl, isNativeApp } from "@/platform/server";
import { clearToken, getToken, setToken } from "@/platform/tokenStore";

import { Administration, Audit, roleLabel } from "./Administration";
import { Equipment } from "./Equipment";
import { CalibrationPlans, Notifications, Reagents, Schedule } from "./Operations";
import { Overview } from "./Overview";
import { Reports, Results } from "./Results";
import { Control, Loading, Message } from "./shared";

import "@/layout/app-shell.css";
import "@/layout/workspace-pages.css";

type User = { full_name: string; login: string; role: string; permissions: string[] };
type Session = { user: User; token: string };
type NotificationToastPayload = {
  title: string;
  count: number;
  kind: string;
  ref_type: string;
  ref_id: number;
};
type NotificationPoll = {
  unread_count: number;
  latest_id: number;
  toast: NotificationToastPayload | null;
};

const POLL_INTERVAL_MS = 4000;
const SUMMARY_REMINDER_MS = 180_000;

const reviewPassword = import.meta.env.DEV ? import.meta.env.VITE_REVIEW_PASSWORD : undefined;
const demoAccounts = [
  { login: "admin", role: "admin" },
  { login: "kierownik", role: "manager" },
  { login: "laborant", role: "worker" },
];
const sections = [
  {
    key: "overview",
    label: "Przegląd",
    icon: LayoutGrid,
    group: "",
    permissions: ["schedule:read"],
  },
  {
    key: "schedule",
    label: "Harmonogram",
    icon: CalendarDays,
    group: "Wyposażenie",
    permissions: ["schedule:read"],
  },
  {
    key: "equipment",
    label: "Urządzenia",
    icon: PanelTop,
    group: "Wyposażenie",
    permissions: ["equipment:read"],
  },
  {
    key: "plans",
    label: "Plan wzorcowań",
    icon: ClipboardList,
    group: "Wyposażenie",
    permissions: ["calibration:write", "calibration:approve"],
  },
  {
    key: "results",
    label: "Wyniki badań",
    icon: ChartLine,
    group: "Badania",
    permissions: ["result:read"],
  },
  {
    key: "reagents",
    label: "Odczynniki i CRM",
    icon: FlaskConical,
    group: "Badania",
    permissions: ["reagent:read"],
  },
  {
    key: "reports",
    label: "Raporty",
    icon: FileText,
    group: "Badania",
    permissions: ["report:read"],
  },
  {
    key: "settings",
    label: "Administracja",
    icon: Settings,
    group: "System",
    permissions: ["settings:write", "users:write", "equipment:write"],
  },
  {
    key: "audit",
    label: "Historia zmian",
    icon: History,
    group: "System",
    permissions: ["audit:read"],
  },
] as const;
type Section = (typeof sections)[number]["key"] | "notifications";
const desktopSections = ["overview", "schedule", "equipment", "results", "reagents"] as const;
const mobileSections = ["overview", "schedule", "equipment"] as const;
const mobileToastOffset = { bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" };

function initials(name: string) {
  const words = name.split(/\s+/).filter(Boolean);
  return `${words[0]?.[0] ?? ""}${words.length > 1 ? (words.at(-1)?.[0] ?? "") : ""}`.toUpperCase();
}

function Monogram({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-brand-lime-soft font-bold text-brand-navy",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function Workspace({ onChangeServer }: { onChangeServer?: () => void } = {}) {
  const [session, setSession] = useState<Session | null>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [equipmentId, setEquipmentId] = useState<number>();
  const [scannerRequest, setScannerRequest] = useState(0);
  const [scannerView, setScannerView] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const scanController = useRef<AbortController | null>(null);
  const [publicId, setPublicId] = useState(() => parseEquipmentUrl(window.location.pathname));
  const [section, setSection] = useState<Section>(() =>
    publicId === null ? "overview" : "equipment",
  );
  const [notificationRevision, setNotificationRevision] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const pollStateRef = useRef<{ token: string; cursor: number | null; lastSummaryAt: number }>({
    token: "",
    cursor: null,
    lastSummaryAt: 0,
  });

  async function changeServer() {
    scanController.current?.abort();
    if (session) {
      await apiVoid("/auth/logout", session.token, "POST").catch(() => undefined);
    }
    await clearToken();
    clearServerUrl();
    setSession(null);
    setUnreadCount(0);
    onChangeServer?.();
  }

  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const token = await getToken();
        const saved = token === null ? null : { token, user: await api<User>("/me", token) };
        if (active) {
          setSession(saved);
        }
      } catch (failure) {
        if (failure instanceof ApiError && failure.status === 401) {
          await clearToken();
        }
        if (active) {
          if (!(failure instanceof ApiError && failure.status === 401)) {
            setError(errorMessage(failure));
          }
          setSession(null);
        }
      }
    }
    void restore();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function syncPath() {
      const id = parseEquipmentUrl(window.location.pathname);
      setPublicId(id);
      setScannerView(false);
      setSection(id === null ? "overview" : "equipment");
    }
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  useEffect(() => () => scanController.current?.abort(), []);

  const openPublic = useCallback((id: string | null) => {
    const path = id === null ? "/" : `/e/${id}`;
    if (path !== window.location.pathname) {
      window.history.pushState(null, "", path);
    }
    setPublicId(id);
  }, []);

  const navigate = useCallback(
    (next: Section) => {
      window.scrollTo(0, 0);
      scanController.current?.abort();
      setScannerView(false);
      setScanError("");
      if (publicId !== null) {
        openPublic(null);
      }
      if (next !== "results") {
        setEquipmentId(undefined);
      }
      setSection(next);
    },
    [openPublic, publicId],
  );

  // Live notification polling: keeps unread bell badge accurate, coalesces bursts, and triggers native banners.
  useEffect(() => {
    if (!session) {
      pollStateRef.current = { token: "", cursor: null, lastSummaryAt: 0 };
      return undefined;
    }
    const token = session.token;
    if (pollStateRef.current.token !== token) {
      pollStateRef.current = { token, cursor: null, lastSummaryAt: 0 };
      void requestLocalNotificationPermission();
    }
    let cancelled = false;
    let timer: number | undefined;

    const poll = async (): Promise<void> => {
      try {
        const state = pollStateRef.current;
        const query = state.cursor === null ? "" : `?since_id=${state.cursor}`;
        const snap = await api<NotificationPoll>(`/notifications/poll${query}`, token);
        if (cancelled || pollStateRef.current.token !== token) {
          return;
        }
        setUnreadCount(snap.unread_count);
        if (state.cursor === null) {
          state.cursor = snap.latest_id;
          if (snap.unread_count > 0) {
            state.lastSummaryAt = Date.now();
            void notifyUnreadSummary(snap.unread_count);
          }
        } else {
          state.cursor = Math.max(state.cursor, snap.latest_id);
          if (snap.toast !== null) {
            state.lastSummaryAt = Date.now();
            setNotificationRevision((value) => value + 1);
            toast.warning(snap.toast.title, {
              description:
                snap.unread_count > 1 ? `Nieprzeczytane łącznie: ${snap.unread_count}` : undefined,
              action: {
                label: "Otwórz",
                onClick: () => navigate("notifications"),
              },
            });
            void notifyLocally(
              snap.toast.count > 1
                ? `Nowe powiadomienia (${snap.toast.count})`
                : "Nowe powiadomienie w laboratorium",
              snap.toast.title,
            );
          } else if (
            snap.unread_count >= 3 &&
            Date.now() - state.lastSummaryAt >= SUMMARY_REMINDER_MS
          ) {
            state.lastSummaryAt = Date.now();
            void notifyUnreadSummary(snap.unread_count);
          }
        }
      } catch {
        // Best effort: transient network hiccups must not interrupt the workspace.
      }
      if (!cancelled) {
        timer = window.setTimeout(() => void poll(), POLL_INTERVAL_MS);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [navigate, session]);

  // Presentation console: the API queues ephemeral signals that drive the app on stage.
  useEffect(() => {
    if (!session) {
      return undefined;
    }
    const token = session.token;
    let after = 0;
    let primed = false;
    let cancelled = false;
    let timer: number | undefined;

    const apply = (event: DemoEvent): void => {
      switch (event.action) {
        case "push":
          setNotificationRevision((value) => value + 1);
          toast.success(event.title, { description: event.message });
          void notifyLocally(event.title, event.message);
          break;
        case "scan":
          if (event.public_id !== null) {
            toast.success(event.source === "qr" ? "Zeskanowano kod QR" : "Odczytano tag NFC", {
              description: [event.code, event.name].filter(Boolean).join(" · "),
            });
            openPublic(event.public_id);
            setSection("equipment");
          }
          break;
        case "card":
          if (event.public_id !== null) {
            openPublic(event.public_id);
            setSection("equipment");
          }
          break;
        case "toast":
          toast.info(event.title, { description: event.message });
          break;
      }
    };

    const poll = async (): Promise<void> => {
      try {
        const events = await fetchDemoEvents(token, after);
        if (cancelled) {
          return;
        }
        if (!primed) {
          primed = true;
          after = events.reduce((max, event) => Math.max(max, event.id), after);
        } else {
          for (const event of events) {
            after = Math.max(after, event.id);
            apply(event);
          }
        }
      } catch {
        // Best effort: a console poll hiccup must not disturb the workspace.
      }
      if (!cancelled) {
        timer = window.setTimeout(() => void poll(), 1200);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [openPublic, session]);

  async function login(loginName: string, password: string) {
    if (busy) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const next = await api<Session>("/auth/login", null, "POST", { login: loginName, password });
      try {
        await setToken(next.token);
      } catch (failure) {
        await apiVoid("/auth/logout", next.token, "POST").catch(() => undefined);
        throw failure;
      }
      const previous = session?.token;
      if (previous) {
        await apiVoid("/auth/logout", previous, "POST").catch(() => undefined);
      }
      scanController.current?.abort();
      setScanError("");
      setScannerRequest(0);
      setSession(next);
      setScannerView(false);
      setEquipmentId(undefined);
      setSection(publicId !== null || next.user.role === "worker" ? "equipment" : "overview");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (!session || busy) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiVoid("/auth/logout", session.token, "POST");
    } catch (failure) {
      if (!(failure instanceof ApiError && failure.status === 401)) {
        setError(errorMessage(failure));
      }
    } finally {
      await clearToken();
      scanController.current?.abort();
      setScanError("");
      setScannerRequest(0);
      setScannerView(false);
      setSession(null);
      setBusy(false);
    }
  }

  const user = session?.user;
  const permitted = sections.filter(({ permissions }) =>
    permissions.some((permission) => user?.permissions.includes(permission)),
  );
  const activeSection =
    section === "notifications" || permitted.some(({ key }) => key === section)
      ? section
      : permitted[0]?.key;

  async function scan(preferNfc: boolean) {
    if (scanController.current !== null) {
      return;
    }
    const controller = new AbortController();
    scanController.current = controller;
    setScanBusy(true);
    setScanError("");
    try {
      const outcome = await scanEquipment({ preferNfc, signal: controller.signal });
      if (controller.signal.aborted) {
        return;
      }
      if (outcome.status === "ok") {
        openPublic(outcome.publicId);
      } else if (outcome.status !== "cancelled") {
        setScanError(outcome.message);
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        setScanError(errorMessage(failure));
      }
    } finally {
      scanController.current = null;
      setScanBusy(false);
    }
  }

  function openScanner() {
    window.scrollTo(0, 0);
    openPublic(null);
    setSection("equipment");
    setEquipmentId(undefined);
    setScannerView(true);
    setScanError("");
    setScannerRequest((request) => request + 1);
    if (canScanQr()) {
      void scan(false);
    }
  }

  function openDevice(id: string) {
    setScannerView(false);
    openPublic(id);
    setEquipmentId(undefined);
    setSection("equipment");
    window.scrollTo(0, 0);
  }
  const current = sections.find(({ key }) => key === activeSection);
  const scanningPage = scannerView && publicId === null && activeSection === "equipment";
  const TitleIcon = scanningPage ? ScanLine : (current?.icon ?? Bell);
  const nativeServerUrl = isNativeApp() ? getServerUrl() : null;
  const overview = activeSection === "overview";
  const hasEquipment = permitted.some(({ key }) => key === "equipment");
  const desktopEquipment = permitted.filter(({ key }) => key === "equipment" || key === "plans");
  const desktopMore = permitted.filter(
    ({ key }) => !desktopSections.some((sectionKey) => key === sectionKey) && key !== "plans",
  );
  const mobileMore = permitted.filter(
    ({ key }) => !mobileSections.some((sectionKey) => key === sectionKey),
  );
  const accountItems = (
    <>
      {user && (
        <div className="flex items-center gap-3 px-2 py-2.5">
          <Monogram name={user.full_name} className="size-10 text-sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">{roleLabel(user.role)}</p>
          </div>
        </div>
      )}
      {reviewPassword && (
        <>
          {user && <DropdownMenuSeparator />}
          <DropdownMenuLabel className="px-2 text-xs font-normal text-muted-foreground">
            Konto testowe
          </DropdownMenuLabel>
          {demoAccounts.map((account) => (
            <DropdownMenuItem
              key={account.login}
              className="px-2 py-1.5"
              disabled={busy}
              onSelect={() => {
                if (account.login !== user?.login) {
                  void login(account.login, reviewPassword);
                }
              }}
            >
              {roleLabel(account.role)}
              {account.login === user?.login && (
                <Check className="ml-auto text-brand-lime-ink" aria-label="Bieżące" />
              )}
            </DropdownMenuItem>
          ))}
        </>
      )}
      {isNativeApp() && onChangeServer && (
        <>
          {(user || reviewPassword) && <DropdownMenuSeparator />}
          <DropdownMenuItem
            className="px-2 py-1.5"
            disabled={busy}
            onSelect={() => {
              void changeServer();
            }}
          >
            <Server />
            Zmień serwer
          </DropdownMenuItem>
        </>
      )}
      {user && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="px-2 py-1.5"
            disabled={busy}
            onSelect={() => {
              void logout();
            }}
          >
            <LogOut />
            Wyloguj
          </DropdownMenuItem>
        </>
      )}
    </>
  );

  function sectionMenuItems(items: typeof permitted) {
    return items.map(({ key, icon: Icon, label }) => (
      <DropdownMenuItem key={key} onSelect={() => navigate(key)}>
        <Icon aria-hidden />
        {label}
        {activeSection === key && <Check className="ml-auto" aria-label="Bieżące" />}
      </DropdownMenuItem>
    ));
  }

  function mobileSection(key: (typeof mobileSections)[number], title?: string) {
    const item = permitted.find((entry) => entry.key === key);
    if (item === undefined) {
      return null;
    }
    const Icon = item.icon;
    return (
      <button
        type="button"
        aria-current={activeSection === key && !scanningPage ? "page" : undefined}
        onClick={() => navigate(key)}
      >
        <span className="workspace-nav-icon">
          <Icon aria-hidden />
        </span>
        {title ?? item.label}
      </button>
    );
  }

  return (
    <div className="workspace">
      <header className={cn("workspace-header", !user && "workspace-header--signed-out")}>
        <div className="workspace-container workspace-header-inner">
          <a href="/" className="workspace-brand">
            <CorporateBrand />
          </a>
          <div className="workspace-utilities">
            {user && (
              <button
                type="button"
                className="workspace-bell"
                aria-label={`Powiadomienia: ${unreadCount} nowych`}
                aria-current={activeSection === "notifications" ? "page" : undefined}
                onClick={() => navigate("notifications")}
              >
                <span
                  className={cn(
                    "workspace-bell-icon",
                    unreadCount > 0 && "workspace-bell-icon--unread",
                  )}
                >
                  <Bell aria-hidden />
                  {unreadCount > 0 && (
                    <span className="workspace-bell-dot" aria-hidden>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </span>
                <span className="workspace-bell-label">Powiadomienia</span>
              </button>
            )}
            {(user || reviewPassword) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" disabled={busy} className="workspace-account">
                    {user ? "Konto" : "Wybierz rolę"}
                    <ChevronDown aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} className="workspace-menu w-64">
                  {accountItems}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {user && (
            <nav aria-label="Sekcje laboratorium" className="workspace-desktop-nav">
              {desktopSections.map((key) => {
                if (key === "equipment" && desktopEquipment.length > 1) {
                  return (
                    <DropdownMenu key={key}>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-current={
                            !scanningPage &&
                            (activeSection === "equipment" || activeSection === "plans")
                              ? "page"
                              : undefined
                          }
                        >
                          Urządzenia
                          <ChevronDown aria-hidden />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="workspace-menu min-w-48">
                        {sectionMenuItems(desktopEquipment)}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                }
                const item =
                  key === "equipment"
                    ? desktopEquipment[0]
                    : permitted.find((entry) => entry.key === key);
                if (item === undefined) {
                  return null;
                }
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-current={activeSection === item.key && !scanningPage ? "page" : undefined}
                    onClick={() => navigate(item.key)}
                  >
                    {item.label}
                  </button>
                );
              })}
              {desktopMore.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-current={
                        desktopMore.some(({ key }) => activeSection === key) ? "page" : undefined
                      }
                    >
                      Więcej
                      <ChevronDown aria-hidden />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="workspace-menu min-w-48">
                    {sectionMenuItems(desktopMore)}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </nav>
          )}
          {hasEquipment && (
            <button
              className="workspace-desktop-scan"
              aria-current={scanningPage ? "page" : undefined}
              type="button"
              disabled={scanBusy}
              onClick={openScanner}
            >
              Skanuj QR
              <ScanLine aria-hidden />
            </button>
          )}
        </div>
      </header>
      {!session ? (
        <main className="workspace-login grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <section className="workspace-login-intro hidden flex-col justify-between gap-12 overflow-hidden px-12 pt-16 lg:flex">
            <div className="max-w-lg">
              <h1 className="text-4xl leading-tight font-bold">
                Nadzór nad wyposażeniem laboratorium
              </h1>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-foreground/75">
                Rejestr urządzeń, terminy wzorcowań i sprawdzeń, odczynniki oraz wyniki badań
                cementu. Każda zmiana zostaje w historii.
              </p>
            </div>
            <PlantSkyline className="mt-12 w-full text-brand-navy-deep/35" />
          </section>
          <div className="flex items-start justify-center px-4 py-10 sm:items-center sm:px-8">
            <div className="w-full max-w-sm">
              {session === undefined ? (
                <Loading />
              ) : (
                <LoginForm
                  busy={busy}
                  error={error}
                  login={login}
                  equipment={publicId !== null}
                  serverUrl={nativeServerUrl}
                  onChangeServer={isNativeApp() && onChangeServer ? changeServer : undefined}
                />
              )}
            </div>
          </div>
        </main>
      ) : (
        <>
          <main className="workspace-main">
            {overview ? (
              <>
                {error && (
                  <div className="workspace-container pt-4">
                    <Message>{error}</Message>
                  </div>
                )}
                <Overview
                  token={session.token}
                  permissions={session.user.permissions}
                  onOpenDevice={openDevice}
                  onNavigate={navigate}
                />
              </>
            ) : (
              <>
                <div className="workspace-page-heading">
                  <div className="workspace-container workspace-page-heading-inner">
                    <p>
                      <TitleIcon aria-hidden />
                      {current?.group || "Laboratorium"}
                    </p>
                    <h1>{scanningPage ? "Skanuj QR" : (current?.label ?? "Powiadomienia")}</h1>
                  </div>
                </div>
                <div className="workspace-container workspace-content">
                  {error && <Message>{error}</Message>}
                  {activeSection === "schedule" && (
                    <Schedule token={session.token} permissions={session.user.permissions} />
                  )}
                  {activeSection === "equipment" && (
                    <Equipment
                      key={`${session.token}:${scannerRequest}`}
                      token={session.token}
                      permissions={session.user.permissions}
                      publicId={publicId}
                      focusScanner={scanningPage && !canScanQr()}
                      scannerView={scanningPage}
                      onCloseScanner={() => navigate("equipment")}
                      scanBusy={scanBusy}
                      scanError={scanError}
                      onCancelScan={() => scanController.current?.abort()}
                      onDismissScanError={() => setScanError("")}
                      onScan={scan}
                      onPublicId={openPublic}
                      onResults={(id) => {
                        setEquipmentId(id);
                        navigate("results");
                      }}
                    />
                  )}
                  {activeSection === "plans" && (
                    <CalibrationPlans
                      token={session.token}
                      permissions={session.user.permissions}
                    />
                  )}
                  {activeSection === "results" && (
                    <Results
                      key={session.token}
                      token={session.token}
                      permissions={session.user.permissions}
                      equipmentId={equipmentId}
                    />
                  )}
                  {activeSection === "reagents" && (
                    <Reagents token={session.token} permissions={session.user.permissions} />
                  )}
                  {activeSection === "reports" && (
                    <Reports token={session.token} permissions={session.user.permissions} />
                  )}
                  {activeSection === "settings" && (
                    <Administration token={session.token} permissions={session.user.permissions} />
                  )}
                  {activeSection === "audit" && (
                    <Audit token={session.token} permissions={session.user.permissions} />
                  )}
                  {activeSection === "notifications" && (
                    <Notifications
                      key={notificationRevision}
                      token={session.token}
                      permissions={session.user.permissions}
                      after={() => setNotificationRevision((value) => value + 1)}
                    />
                  )}
                </div>
              </>
            )}
          </main>
          <nav aria-label="Sekcje laboratorium" className="workspace-mobile-nav">
            {mobileSection("overview")}
            {mobileSection("schedule", "Terminy")}
            {hasEquipment && (
              <button
                type="button"
                className="workspace-mobile-scan"
                aria-current={scanningPage ? "page" : undefined}
                disabled={scanBusy}
                onClick={openScanner}
              >
                <span className="workspace-nav-icon">
                  <ScanLine aria-hidden />
                </span>
                Skanuj QR
              </button>
            )}
            {mobileSection("equipment")}
            <Sheet>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-current={
                    mobileMore.some(({ key }) => activeSection === key) ? "page" : undefined
                  }
                >
                  <span className="workspace-nav-icon">
                    <Ellipsis aria-hidden />
                  </span>
                  Więcej
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="workspace-more-sheet">
                <SheetHeader>
                  <SheetTitle>Więcej</SheetTitle>
                  <SheetDescription className="sr-only">
                    Pozostałe sekcje laboratorium i konto użytkownika
                  </SheetDescription>
                </SheetHeader>
                {mobileMore.length > 0 && (
                  <div className="workspace-more-links">
                    {mobileMore.map(({ key, label, icon: Icon }) => (
                      <SheetClose key={key} asChild>
                        <button
                          type="button"
                          aria-current={activeSection === key ? "page" : undefined}
                          onClick={() => navigate(key)}
                        >
                          <Icon aria-hidden />
                          <span>{label}</span>
                          {activeSection === key ? (
                            <Check aria-hidden />
                          ) : (
                            <ChevronRight aria-hidden />
                          )}
                        </button>
                      </SheetClose>
                    ))}
                  </div>
                )}
                <section className="workspace-more-account">
                  <h3>Konto</h3>
                  {user && (
                    <div className="workspace-account-identity">
                      <Monogram name={user.full_name} className="size-9 text-xs" />
                      <div>
                        <p>{user.full_name}</p>
                        <p>{roleLabel(user.role)}</p>
                      </div>
                    </div>
                  )}
                  {reviewPassword && (
                    <div className="workspace-more-links">
                      {demoAccounts.map((account) => (
                        <SheetClose key={account.login} asChild>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (account.login !== user?.login) {
                                void login(account.login, reviewPassword);
                              }
                            }}
                          >
                            <span>{roleLabel(account.role)}</span>
                            {account.login === user?.login && <Check aria-label="Bieżące" />}
                          </button>
                        </SheetClose>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {isNativeApp() && onChangeServer && (
                      <SheetClose asChild>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            void changeServer();
                          }}
                        >
                          <Server aria-hidden />
                          Zmień serwer
                        </Button>
                      </SheetClose>
                    )}
                    <SheetClose asChild>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          void logout();
                        }}
                      >
                        <LogOut aria-hidden />
                        Wyloguj
                      </Button>
                    </SheetClose>
                  </div>
                </section>
              </SheetContent>
            </Sheet>
          </nav>
        </>
      )}
      <Toaster position="bottom-center" mobileOffset={mobileToastOffset} richColors />
    </div>
  );
}

function LoginForm({
  login,
  busy,
  error,
  equipment,
  serverUrl,
  onChangeServer,
}: {
  login: (name: string, password: string) => Promise<void>;
  busy: boolean;
  error: string;
  equipment: boolean;
  serverUrl?: string | null;
  onChangeServer?: () => Promise<void>;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    void login(textValue(values.get("login"), "").trim(), textValue(values.get("password"), ""));
  }
  return (
    <Card className="workspace-login-card">
      <CardHeader>
        <CardTitle className="text-xl text-brand-navy">Zaloguj się</CardTitle>
        <CardDescription>
          {equipment
            ? "Po zalogowaniu otworzymy kartę z etykiety."
            : "Zaloguj się na konto laboratorium."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submit}>
          <Control label="Login" htmlFor="workspace-login">
            <Input id="workspace-login" name="login" autoComplete="username" required />
          </Control>
          <Control label="Hasło" htmlFor="workspace-password">
            <Input
              id="workspace-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Control>
          {error && <Message>{error}</Message>}
          <Button type="submit" disabled={busy}>
            {busy ? "Logowanie…" : "Zaloguj się"}
          </Button>
        </form>
        {serverUrl && onChangeServer && (
          <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
            <span className="truncate">Serwer: {serverUrl}</span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0"
              disabled={busy}
              onClick={() => {
                void onChangeServer();
              }}
            >
              Zmień serwer
            </Button>
          </div>
        )}
        {reviewPassword && (
          <p className="mt-4 text-xs text-muted-foreground">
            Do przeglądu aplikacji wybierz rolę w prawym górnym rogu.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
