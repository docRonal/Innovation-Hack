import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import {
  getSnapshot,
  markAllNotificationsRead,
  resetDemo,
  subscribe,
  switchRole,
} from "@/api/demoClient";
import type { Snapshot } from "@/api/types";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminPage } from "@/features/admin/AdminPage";
import { ManagerPage } from "@/features/manager/ManagerPage";
import { viewForSession } from "@/features/roleView";
import ServerSetupPage from "@/features/setup/ServerSetupPage";
import { WorkerPage } from "@/features/worker/WorkerPage";
import { AppShell } from "@/layout/AppShell";
import { roleCodeFromHash, roleHash } from "@/lib/demoRoleRoute";
import { getServerUrl, isNativeApp, needsServerSetup } from "@/platform/server";

const Workspace = lazy(() =>
  import("@/features/workspace/Workspace").then((module) => ({ default: module.Workspace })),
);

const workspaceLoading = <output className="block p-6 text-sm">Ładowanie laboratorium…</output>;

function View({ snapshot }: { snapshot: Snapshot }) {
  switch (viewForSession(snapshot.session)) {
    case "manager":
      return <ManagerPage snapshot={snapshot} />;
    case "office":
      return <AdminPage snapshot={snapshot} />;
    case "lab":
      return <WorkerPage snapshot={snapshot} />;
  }
}

/** Polish plural for notification counts: 1 powiadomienie, 2 powiadomienia, 5 powiadomień. */
function notificationCountLabel(count: number): string {
  if (count === 1) {
    return "1 powiadomienie";
  }
  const rest = count % 10;
  const tens = count % 100;
  if (rest >= 2 && rest <= 4 && (tens < 12 || tens > 14)) {
    return `${count} powiadomienia`;
  }
  return `${count} powiadomień`;
}

function resetDemoData(): void {
  resetDemo();
  toast.success("Dane demonstracyjne przywrócone", {
    description: "Wpisy z prototypu usunięte, terminy przeliczone od nowa.",
  });
}

function markNotificationsRead(): void {
  const count = markAllNotificationsRead();
  if (count === 0) {
    toast.info("Brak nieprzeczytanych powiadomień");
    return;
  }
  toast.success(`Oznaczono ${notificationCountLabel(count)} jako przeczytane`);
}

export default function App() {
  const [ready, setReady] = useState(() => !needsServerSetup());
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    const currentRole = snapshot.session.role.code;
    const applyHash = (): void => {
      const roleCode = roleCodeFromHash(window.location.hash);
      if (roleCode !== null && roleCode !== currentRole) {
        switchRole(roleCode);
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [snapshot.session.role.code]);

  if (!ready) {
    return (
      <ServerSetupPage
        onDone={() => {
          setReady(true);
        }}
      />
    );
  }

  if (
    !new URLSearchParams(window.location.search).has("demo") &&
    !window.location.hash.startsWith("#/role/")
  ) {
    return (
      <Suspense fallback={workspaceLoading}>
        <Workspace />
      </Suspense>
    );
  }

  const server = getServerUrl();

  const changeRole = (roleCode: string): void => {
    const role = snapshot.demoRoles.find((candidate) => candidate.code === roleCode);
    if (!switchRole(roleCode)) {
      return;
    }
    const nextHash = roleHash(roleCode);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
    toast.success(`Podgląd roli: ${role?.name ?? roleCode}`);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <AppShell
        snapshot={snapshot}
        onRoleChange={changeRole}
        onReset={resetDemoData}
        onMarkNotificationsRead={markNotificationsRead}
      >
        {isNativeApp() && server !== null && (
          <p className="mb-4 text-xs text-muted-foreground">Serwer: {server}</p>
        )}
        <View snapshot={snapshot} />
      </AppShell>
      <Toaster position="top-center" richColors />
    </TooltipProvider>
  );
}
