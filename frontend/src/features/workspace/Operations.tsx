import { Bell, CalendarDays, Check, ClipboardList, FlaskConical } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  api,
  type ApiRecord,
  apiVoid,
  errorMessage,
  objectValue,
  textValue,
} from "@/api/workspaceClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { scheduleDue } from "@/lib/overview";
import { enablePushNotifications, isPushAvailable } from "@/platform/push";

import { apiSave, Status } from "./Equipment";
import {
  Action,
  choice,
  type Columns,
  Control,
  type Field,
  Loading,
  options,
  revealDetails,
  Rows,
  selectStyle,
  today,
  useApi,
  type WorkspaceProps,
} from "./shared";

const kinds = choice(
  ["CALIBRATION", "Wzorcowanie"],
  ["CHECK", "Sprawdzenie"],
  ["LOT_EXPIRY", "Ważność partii"],
  ["STOCK_COUNT", "Spis odczynników"],
  ["LOW_STOCK", "Niski stan"],
);

export function Schedule({ token }: WorkspaceProps) {
  const [lab, setLab] = useState("");
  const [kind, setKind] = useState("");
  const [all, setAll] = useState(false);
  const query = new URLSearchParams({ include_ok: String(all) });
  if (lab) {
    query.set("lab_id", lab);
  }
  if (kind) {
    query.set("kind", kind);
  }
  const labs = useApi<ApiRecord[]>("/labs", token);
  const state = useApi<ApiRecord[]>(`/schedule?${query}`, token);
  const rows = useMemo(
    () =>
      state?.data?.map((row) => ({
        label: row.label,
        kind: row.kind,
        due: scheduleDue({
          kind: textValue(row.kind),
          due: typeof row.due === "string" ? row.due : null,
        }),
        status: row.status,
      })),
    [state],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <CalendarDays className="size-5 shrink-0 text-brand-lime-ink" aria-hidden />
          Terminy pracowni
        </CardTitle>
        <CardDescription>Najbliższe terminy i zadania pracowni.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <fieldset
          className="workspace-filter-bar grid min-w-0 gap-3 border bg-background px-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end sm:px-4"
          aria-label="Filtry harmonogramu"
        >
          <Control label="Pracownia" htmlFor="schedule-lab">
            <select
              id="schedule-lab"
              className={selectStyle}
              value={lab}
              onChange={(event) => setLab(event.currentTarget.value)}
            >
              <option value="">Wszystkie dostępne</option>
              {options(labs?.data ?? []).map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Control>
          <Control label="Rodzaj zadania" htmlFor="schedule-kind">
            <select
              id="schedule-kind"
              className={selectStyle}
              value={kind}
              onChange={(event) => setKind(event.currentTarget.value)}
            >
              <option value="">Wszystkie</option>
              {kinds.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Control>
          <label className="flex min-h-9 cursor-pointer items-center gap-2 border border-input bg-card px-3 text-sm font-semibold">
            <input
              type="checkbox"
              className="size-4 accent-brand-navy"
              checked={all}
              onChange={(event) => setAll(event.currentTarget.checked)}
            />
            Pokaż aktualne
          </label>
        </fieldset>
        {rows ? <Rows rows={rows} columns={scheduleColumns} /> : <Loading state={state} />}
      </CardContent>
    </Card>
  );
}

const reagentFields: Field[] = [
  { key: "name", label: "Nazwa", required: true },
  {
    key: "kind",
    label: "Rodzaj",
    type: "options",
    options: choice(["REAGENT", "Odczynnik"], ["CRM", "Certyfikowany materiał odniesienia (CRM)"]),
  },
  { key: "unit", label: "Jednostka stanu", required: true },
  { key: "min_stock", label: "Próg niskiego stanu", clear: true },
  { key: "stock_count_interval_days", label: "Cykl spisu (dni)", type: "number" },
  {
    key: "expiry_lead_months",
    label: "Wyprzedzenie powiadomienia o ważności (miesiące)",
    type: "number",
  },
  { key: "active", label: "Aktywny", type: "boolean" },
];
const lotFields: Field[] = [
  { key: "lot_no", label: "Numer partii", required: true },
  { key: "received_on", label: "Data przyjęcia", type: "date", required: true },
  { key: "expiry_date", label: "Data ważności", type: "date", required: true },
  { key: "quantity", label: "Ilość", required: true },
];
const stockFields: Field[] = [
  { key: "counted_on", label: "Data spisu", type: "date", required: true },
  { key: "quantity", label: "Aktualna ilość", required: true },
];

const disposeLotFields: Field[] = [
  {
    key: "disposed_on",
    label: "Data utylizacji",
    type: "date",
    required: true,
  },
];

export function Reagents({ token, permissions }: WorkspaceProps) {
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<number>();
  const lotHeading = useRef<HTMLHeadingElement>(null);
  const focusLotHeading = useCallback((node: HTMLHeadingElement | null) => {
    lotHeading.current = node;
    revealDetails(node);
  }, []);
  const after = () => setRevision((value) => value + 1);
  const state = useApi<ApiRecord[]>("/reagents", token, revision);
  const labs = useApi<ApiRecord[]>("/labs", token);
  const current = state?.data?.find((row) => row.id === selected);
  const lowStockCount = state?.data?.filter((row) => row.low_stock === true).length ?? 0;
  const admin = permissions.includes("reagent:write");
  const stock = permissions.includes("stock:write");
  const lots = useMemo(
    () => (Array.isArray(current?.lots) ? current.lots.map(objectValue) : []),
    [current],
  );
  const createReagentFields = useMemo<Field[]>(
    () => [
      {
        key: "lab_id",
        label: "Pracownia",
        type: "options",
        options: options(labs?.data ?? []),
        numeric: true,
        required: true,
      },
      ...reagentFields,
    ],
    [labs],
  );
  const stockInitial = useMemo(() => ({ counted_on: today() }), []);
  const lotInitial = useMemo(() => ({ received_on: today() }), []);
  const disposeInitial = useMemo(() => ({ disposed_on: today() }), []);
  return (
    <div className="workspace-inventory grid gap-4">
      <Card>
        <CardHeader className="gap-3 sm:flex sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2.5">
              <FlaskConical className="size-5 shrink-0 text-brand-lime-ink" aria-hidden />
              Zapasy i partie
            </CardTitle>
            <CardDescription>
              CRM to certyfikowany materiał odniesienia. Tu sprawdzisz zapasy i ważność partii.
            </CardDescription>
          </div>
          {admin && (
            <Action
              label="Dodaj odczynnik lub CRM"
              fields={createReagentFields}
              save={apiSave("/reagents", token, "POST")}
              primary
              after={after}
            />
          )}
        </CardHeader>
        <CardContent className="grid gap-4">
          {lowStockCount > 0 && (
            <p className="workspace-attention-note">
              <strong>Niski stan zapasu</strong>
              <span className="font-semibold tabular-nums">{lowStockCount}</span>
            </p>
          )}
          {state?.data ? (
            <Rows
              rows={state.data}
              columns={reagentColumns}
              renderAction={(row) => (
                <>
                  <Button
                    variant={row.id === selected ? "secondary" : "outline"}
                    size="sm"
                    aria-expanded={row.id === selected}
                    aria-controls={row.id === selected ? "reagent-lots" : undefined}
                    onClick={() => {
                      if (row.id === selected) {
                        revealDetails(lotHeading.current);
                      } else {
                        setSelected(Number(row.id));
                      }
                    }}
                  >
                    Partie
                  </Button>
                  {admin && (
                    <Action
                      label="Edytuj"
                      fields={reagentFields}
                      initial={row}
                      save={apiSave(`/reagents/${Number(row.id)}`, token, "PATCH")}
                      after={after}
                    />
                  )}
                  {stock && row.active === true && (
                    <Action
                      label="Zapisz stan"
                      fields={stockFields}
                      initial={stockInitial}
                      save={apiSave(`/reagents/${Number(row.id)}/stock-counts`, token, "POST")}
                      after={after}
                    />
                  )}
                </>
              )}
            />
          ) : (
            <Loading state={state} />
          )}
        </CardContent>
      </Card>
      {current && (
        <Card key={Number(current.id)} id="reagent-lots" className="workspace-inventory-detail">
          <CardHeader className="gap-3 sm:flex sm:items-center sm:justify-between">
            <div>
              <CardTitle>
                <h2 className="workspace-detail-anchor" tabIndex={-1} ref={focusLotHeading}>
                  Partie · {textValue(current.name)}
                </h2>
              </CardTitle>
              <CardDescription>Daty przyjęcia, ważności i utylizacji.</CardDescription>
            </div>
            {admin && (
              <Action
                label="Dodaj partię"
                fields={lotFields}
                initial={lotInitial}
                save={apiSave(`/reagents/${Number(current.id)}/lots`, token, "POST")}
                after={after}
              />
            )}
          </CardHeader>
          <CardContent>
            <Rows
              rows={lots}
              columns={lotColumns}
              empty="Brak partii dla tej pozycji."
              renderAction={(row) =>
                admin &&
                row.disposed_on == null && (
                  <Action
                    label="Zarejestruj utylizację"
                    fields={disposeLotFields}
                    initial={disposeInitial}
                    save={apiSave(`/lots/${Number(row.id)}`, token, "PATCH")}
                    after={after}
                  />
                )
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function Notifications({ token, after }: WorkspaceProps & { after: () => void }) {
  const [revision, setRevision] = useState(0);
  const [pushBusy, setPushBusy] = useState(false);
  const [markAllBusy, setMarkAllBusy] = useState(false);
  const state = useApi<ApiRecord[]>("/notifications", token, revision);
  function changed() {
    setRevision((value) => value + 1);
    after();
  }
  async function markAll() {
    if (markAllBusy) {
      return;
    }
    setMarkAllBusy(true);
    try {
      await api("/notifications/read-all", token, "POST");
      changed();
    } catch (failure) {
      toast.error(errorMessage(failure));
    } finally {
      setMarkAllBusy(false);
    }
  }
  async function configurePush() {
    setPushBusy(true);
    try {
      const result = await enablePushNotifications((payload) =>
        apiVoid("/devices", token, "POST", payload),
      );
      if (result.status === "registered") {
        toast.success("Powiadomienia na telefon są włączone.");
      } else {
        toast.info(
          result.status === "denied"
            ? "Brak zgody na powiadomienia."
            : "Powiadomienia push są niedostępne w tej wersji aplikacji.",
        );
      }
    } catch (failure) {
      toast.error(errorMessage(failure));
    } finally {
      setPushBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader className="gap-3 sm:flex sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2.5">
            <Bell className="size-5 shrink-0 text-brand-lime-ink" aria-hidden />
            Twoje powiadomienia
          </CardTitle>
          <CardDescription>Terminy, przekroczenia i gotowe raporty.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {isPushAvailable() && (
            <Button size="sm" variant="outline" disabled={pushBusy} onClick={configurePush}>
              Włącz push na telefonie
            </Button>
          )}
          {state?.data?.some((row) => row.read_at == null) && (
            <Button
              size="sm"
              variant="outline"
              disabled={markAllBusy}
              onClick={() => void markAll()}
            >
              <Check />
              {markAllBusy ? "Zapisywanie…" : "Przeczytaj wszystkie"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {state?.data ? (
          state.data.length > 0 ? (
            <ul className="divide-y border-y">
              {state.data.map((row) => (
                <NotificationItem key={textValue(row.id)} row={row} token={token} after={changed} />
              ))}
            </ul>
          ) : (
            <p className="border-y py-6 text-sm text-muted-foreground">Brak powiadomień.</p>
          )
        ) : (
          <Loading state={state} />
        )}
      </CardContent>
    </Card>
  );
}

function NotificationItem({
  row,
  token,
  after,
}: {
  row: ApiRecord;
  token: string;
  after: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const unread = row.read_at == null;
  const title = textValue(row.title);
  const date = typeof row.created_at === "string" ? row.created_at.slice(0, 10) : null;
  async function markRead() {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await api(`/notifications/${Number(row.id)}/read`, token, "POST");
      after();
    } catch (failure) {
      toast.error(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 py-4 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center">
      <span
        className={
          unread
            ? "grid size-8 place-items-center bg-brand-lime-soft text-brand-lime-ink"
            : "grid size-8 place-items-center bg-background text-muted-foreground"
        }
        aria-hidden
      >
        {unread ? <Bell className="size-4" /> : <Check className="size-4" />}
      </span>
      <div className="grid min-w-0 gap-1">
        <p className="text-sm font-semibold break-words text-foreground">{title}</p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className={unread ? "font-semibold text-brand-lime-ink" : undefined}>
            {unread ? "Nowe" : "Przeczytane"}
          </span>
          {date && <time dateTime={date}>{formatDate(date)}</time>}
          {typeof row.due === "string" && <span>Termin: {formatDate(row.due)}</span>}
        </div>
      </div>
      {unread && (
        <div className="col-start-2 sm:col-start-3">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void markRead()}>
            <Check />
            {busy ? "…" : "Przeczytane"}
          </Button>
        </div>
      )}
    </li>
  );
}

export function CalibrationPlans({ token, permissions }: WorkspaceProps) {
  const [revision, setRevision] = useState(0);
  const after = () => setRevision((value) => value + 1);
  const state = useApi<ApiRecord[]>("/calibration-plans", token, revision);
  const devices = useApi<ApiRecord[]>(
    permissions.includes("calibration:write") ? "/equipment" : null,
    token,
  );
  const optionsList = useMemo(
    () =>
      (devices?.data ?? [])
        .filter((device) => device.withdrawn_at == null && device.calibration_required === true)
        .map((device) => ({
          value: textValue(device.id),
          label: `${textValue(device.code)} · ${textValue(device.name)}`,
        })),
    [devices],
  );
  const fields = useMemo<Field[]>(
    () => [
      {
        key: "equipment_id",
        label: "Urządzenie",
        type: "options",
        numeric: true,
        options: optionsList,
        required: true,
      },
      { key: "dispatch_on", label: "Planowana wysyłka", type: "date", required: true },
      { key: "return_on", label: "Planowany powrót", type: "date", required: true },
      { key: "note", label: "Uwagi", type: "note" },
    ],
    [optionsList],
  );
  const editFields = useMemo(() => fields.filter(({ key }) => key !== "equipment_id"), [fields]);
  const waitingCount = state?.data?.filter((row) => row.approved_at == null).length ?? 0;
  return (
    <Card>
      <CardHeader className="gap-3 sm:flex sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2.5">
            <ClipboardList className="size-5 shrink-0 text-brand-lime-ink" aria-hidden />
            Wysyłki do wzorcowania
          </CardTitle>
          <CardDescription>
            Wysyłka urządzeń do firmy wzorcującej i zatwierdzenia kierownika.
          </CardDescription>
        </div>
        {permissions.includes("calibration:write") && (
          <Action
            label="Dodaj do planu"
            fields={fields}
            save={apiSave("/calibration-plans", token, "POST")}
            after={after}
            primary
          />
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        {waitingCount > 0 && (
          <p className="workspace-attention-note">
            <strong>Oczekuje na zatwierdzenie</strong>
            <span className="font-semibold tabular-nums">{waitingCount}</span>
          </p>
        )}
        {state?.data ? (
          <Rows
            rows={state.data}
            columns={calibrationPlanColumns}
            empty="Brak zaplanowanych wysyłek do wzorcowania."
            renderAction={(row) => (
              <>
                {row.approved_at == null && permissions.includes("calibration:write") && (
                  <Action
                    label="Edytuj plan wysyłki"
                    fields={editFields}
                    initial={row}
                    save={apiSave(`/calibration-plans/${Number(row.id)}`, token, "PATCH")}
                    after={after}
                  />
                )}
                {row.approved_at == null && permissions.includes("calibration:approve") && (
                  <Action
                    label="Zatwierdź plan wzorcowania"
                    submitLabel="Zatwierdź plan"
                    description={`Zatwierdzasz plan wysyłki urządzenia: ${textValue(row.equipment)}.`}

                    save={() => api(`/calibration-plans/${Number(row.id)}/approve`, token, "POST")}
                    after={after}
                  />
                )}
              </>
            )}
          />
        ) : (
          <Loading state={state} />
        )}
      </CardContent>
    </Card>
  );
}

const scheduleColumns: Columns = [
  ["label", "Pozycja"],
  [
    "kind",
    "Rodzaj",
    (value) => kinds.find(({ value: key }) => key === value)?.label ?? textValue(value),
  ],
  ["due", "Termin"],
  ["status", "Status", (value) => <Status value={value} />],
];

function displayDate(value: unknown) {
  return typeof value === "string" ? formatDate(value) : textValue(value);
}

const reagentColumns: Columns = [
  ["name", "Nazwa"],
  ["kind", "Rodzaj", (value) => (value === "CRM" ? "CRM" : "Odczynnik")],
  ["lab_code", "Pracownia"],
  ["current_stock", "Stan fizyczny"],
  ["usable_stock_estimate", "Ważny CRM (szacunek)"],
  ["recommended_lot_no", "Zalecana partia"],
  ["unit", "Jednostka"],
  ["nearest_expiry", "Najbliższa ważność", displayDate],
  ["low_stock", "Stan zapasu", (value) => (value ? <Status value="LOW" /> : "—")],
];

const lotColumns: Columns = [
  ["lot_no", "Numer partii"],
  ["quantity", "Ilość"],
  ["received_on", "Przyjęto", displayDate],
  ["expiry_date", "Ważna do", displayDate],
  ["disposed_on", "Utylizacja", displayDate],
  ["status", "Status", (value) => <Status value={value} />],
];

const calibrationPlanColumns: Columns = [
  ["equipment", "Urządzenie"],
  ["dispatch_on", "Wysyłka", displayDate],
  ["return_on", "Powrót", displayDate],
  ["available_devices", "Najmniej dostępnych zastępstw"],
  ["warning", "Konflikt dostępności"],
  ["approved_by_name", "Zatwierdził", (value) => (value == null ? "Oczekuje" : textValue(value))],
  ["note", "Uwagi"],
];
