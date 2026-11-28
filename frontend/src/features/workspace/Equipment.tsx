import {
  ArrowLeft,
  ArrowRight,
  Download,
  Ellipsis,
  ExternalLink,
  FileCheck2,
  MapPin,
  QrCode,
  ScanLine,
  Search,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { Status as EquipmentStatus } from "@/api/types";
import {
  api,
  type ApiRecord,
  download,
  errorMessage,
  objectValue,
  textValue,
} from "@/api/workspaceClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMonth } from "@/lib/months";
import { isValidPublicId, parseEquipmentUrl } from "@/lib/qr";
import { isStatus } from "@/lib/status";
import { isNfcAvailable, writeEquipmentNfcTag } from "@/platform/nfc";
import { canScanQr } from "@/platform/scan";
import { getApiBaseUrl } from "@/platform/server";

import { CalibrationEntry } from "./CalibrationEntry";
import {
  Action,
  choice,
  type Columns,
  type Field,
  Loading,
  options,
  revealDetails,
  Rows,
  StatusIndicator,
  type StatusTone,
  today,
  useApi,
  type WorkspaceProps,
} from "./shared";

import "./equipment.css";

const statusLabels: Record<EquipmentStatus, string> = {
  OK: "Aktualne",
  DUE_SOON: "Zbliża się termin",
  OVERDUE: "Po terminie",
  NO_DATA: "Brak wpisu",
  WITHDRAWN: "Wycofane",
  NOT_REQUIRED: "Niewymagane",
  LOW: "Niski stan",
  COUNT_DUE: "Spis do wykonania",
};

const statusTones: Record<EquipmentStatus, StatusTone> = {
  OK: "ok",
  DUE_SOON: "warning",
  OVERDUE: "alarm",
  NO_DATA: "missing",
  WITHDRAWN: "neutral",
  NOT_REQUIRED: "neutral",
  LOW: "alarm",
  COUNT_DUE: "warning",
};

export function equipmentStatusLabel(status: string) {
  return isStatus(status) ? statusLabels[status] : status;
}

export function Status({ value }: { value: unknown }) {
  const key = textValue(value);
  return (
    <StatusIndicator tone={isStatus(key) ? statusTones[key] : "neutral"} status={key}>
      {equipmentStatusLabel(key)}
    </StatusIndicator>
  );
}

type CheckPlan = ApiRecord & { id: number; name: string; fields: ApiRecord[]; active: boolean };
type EquipmentCard = ApiRecord & {
  id: number;
  name: string;
  code: string;
  qr_url: string;
  can_write: boolean;
  can_write_result: boolean;
  check_plans: CheckPlan[];
};
type Calibration = ApiRecord & { id: number; points: ApiRecord[]; attachment_ids: number[] };

const mode = choice(["EXTERNAL", "Zewnętrzne"], ["ON_SITE", "Na miejscu"]);
export const calibrationFields: Field[] = [
  { key: "calibration_required", label: "Wymaga wzorcowania", type: "boolean" },
  { key: "calibration_interval_months", label: "Cykl (miesiące)", type: "number", clear: true },
  { key: "calibration_mode", label: "Tryb wzorcowania", type: "options", options: mode },
  { key: "lead_months", label: "Wyprzedzenie przypomnienia (miesiące)", type: "number" },
  { key: "acceptance_criteria", label: "Kryteria akceptacji", type: "note" },
  { key: "notes", label: "Uwagi", type: "note" },
];

export const modelFields: Field[] = [
  { key: "name", label: "Nazwa" },
  { key: "category", label: "Kategoria" },
  { key: "manufacturer", label: "Producent" },
  { key: "model", label: "Model" },
  { key: "software_version", label: "Wersja oprogramowania" },
];
const deviceFields: Field[] = [
  { key: "number", label: "Numer ewidencyjny", required: true },
  ...modelFields,
  { key: "serial_no", label: "Numer seryjny" },
  { key: "location", label: "Lokalizacja" },
  ...calibrationFields,
];
const withdrawFields: Field[] = [
  { key: "reason", label: "Uzasadnienie", required: true, type: "note" },
];

/** API months ("2026-05") as printed on calibration stickers ("05/2026"). */
function month(value: unknown) {
  return typeof value === "string" ? formatMonth(value) : "—";
}

export function apiSave(path: string, token: string, method: string) {
  return (data: unknown) => api(path, token, method, data);
}

export function DownloadButton({
  token,
  path,
  filename,
  label,
}: {
  token: string;
  path: string;
  filename: string;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      await download(path, token, filename);
    } catch (failure) {
      toast.error(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={run} disabled={busy}>
      <Download />
      {busy ? "Pobieranie…" : label}
    </Button>
  );
}

export function Equipment({
  token,
  permissions,
  publicId,
  scannerView = false,
  onCloseScanner,
  focusScanner,
  scanBusy,
  scanError,
  onCancelScan,
  onDismissScanError,
  onScan,
  onPublicId,
  onResults,
}: WorkspaceProps & {
  publicId: string | null;
  scannerView?: boolean;
  onCloseScanner?: () => void;
  focusScanner: boolean;
  scanBusy: boolean;
  scanError: string;
  onCancelScan: () => void;
  onDismissScanError: () => void;
  onScan: (preferNfc: boolean) => Promise<void>;
  onPublicId: (id: string | null) => void;
  onResults: (id?: number) => void;
}) {
  const [id, setId] = useState<number>();
  const [query, setQuery] = useState("");
  const [lookupError, setLookupError] = useState("");
  const scannerInput = useRef<HTMLInputElement>(null);
  const registrySearch = useRef<HTMLInputElement>(null);
  const restoringRegistry = useRef(false);
  const scanInputId = useId();
  const scanErrorId = useId();
  useEffect(() => {
    if (focusScanner) {
      scannerInput.current?.focus();
    }
  }, [focusScanner]);
  const [revision, setRevision] = useState(0);
  const after = () => setRevision((previous) => previous + 1);
  const edit = permissions.includes("equipment:write");
  const results = permissions.includes("result:write");
  const labs = useApi<ApiRecord[]>("/labs", token);
  const catalog = useApi<ApiRecord[]>(edit ? "/equipment-catalog" : null, token);
  const collection = useApi<ApiRecord[]>(
    `/equipment?q=${encodeURIComponent(query)}`,
    token,
    revision,
  );
  const path =
    publicId !== null
      ? `/equipment/by-qr/${publicId}`
      : id === undefined
        ? null
        : `/equipment/${id}`;
  const details = useApi<EquipmentCard>(path, token, revision);
  const backFromDetails = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (path !== null) {
      backFromDetails.current?.focus({ preventScroll: true });
    } else if (!scannerView && restoringRegistry.current) {
      registrySearch.current?.focus({ preventScroll: true });
      restoringRegistry.current = false;
    }
  }, [path, scannerView]);
  const scopedFields = useMemo<Field[]>(
    () => [
      {
        key: "lab_id",
        label: "Pracownia",
        type: "options",
        options: options(labs?.data ?? []),
        numeric: true,
        required: true,
      },
      ...deviceFields,
    ],
    [labs],
  );
  const createEquipmentFields = useMemo<Field[]>(
    () => [
      {
        key: "catalog_id",
        label: "Model z katalogu (opcjonalnie)",
        type: "options",
        numeric: true,
        options: options(catalog?.data ?? [], "display_label"),
      },
      ...scopedFields.filter(
        (field) => field.key !== "calibration_interval_months" && field.key !== "name",
      ),
      { key: "name", label: "Nazwa (wymagana przy wpisie bez katalogu)" },
      { key: "calibration_interval_months", label: "Cykl (miesiące)", type: "number" },
      { key: "last_calibrated_month", label: "Ostatnie wzorcowanie", type: "month" },
    ],
    [catalog, scopedFields],
  );
  function lookup(value: string) {
    onDismissScanError();
    const raw = value.trim();
    const scanned = parseEquipmentUrl(raw) ?? (isValidPublicId(raw) ? raw : null);
    if (scanned === null) {
      setLookupError("Wklej link z etykiety QR / NFC lub wpisz identyfikator urządzenia.");
      return;
    }
    setLookupError("");
    onPublicId(scanned);
  }
  function startScan(preferNfc: boolean) {
    setLookupError("");
    void onScan(preferNfc);
  }
  if (path !== null) {
    return (
      <div className="workspace-equipment-details">
        <Button
          ref={backFromDetails}
          type="button"
          variant="link"
          className="justify-self-start px-0!"
          onClick={() => {
            restoringRegistry.current = true;
            setId(undefined);
            onPublicId(null);
            onCloseScanner?.();
          }}
        >
          <ArrowLeft />
          Wróć do rejestru
        </Button>
        {details?.data ? (
          <EquipmentDetails
            key={details.data.id}
            device={details.data}
            token={token}
            permissions={permissions}
            fields={scopedFields}
            after={after}
            revision={revision}
            onResults={onResults}
          />
        ) : (
          <Loading state={details} />
        )}
      </div>
    );
  }
  const qrAvailable = canScanQr();
  const nfcAvailable = isNfcAvailable();
  const activeError = lookupError || scanError;
  const scanner = (
    <Card
      className={scannerView ? "workspace-scan-panel workspace-feature" : "workspace-scan-panel"}
    >
      <CardHeader>
        <QrCode className="workspace-scan-icon" aria-hidden />
        <CardTitle>
          <h2>Otwórz kartę z etykiety</h2>
        </CardTitle>
        <CardDescription>
          {qrAvailable || nfcAvailable
            ? "Odczytaj etykietę urządzenia lub wpisz jej dane ręcznie."
            : "Wklej link z etykiety QR lub NFC albo wpisz identyfikator urządzenia."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {(qrAvailable || nfcAvailable || scanBusy) && (
          <div className="workspace-scan-methods">
            {qrAvailable && (
              <Button type="button" disabled={scanBusy} onClick={() => startScan(false)}>
                <QrCode aria-hidden />
                Skanuj QR
              </Button>
            )}
            {nfcAvailable && (
              <Button
                variant={qrAvailable ? "outline" : "default"}
                type="button"
                disabled={scanBusy}
                onClick={() => startScan(true)}
              >
                <ScanLine aria-hidden />
                Odczytaj NFC
              </Button>
            )}
            {scanBusy && (
              <>
                <output className="workspace-scan-progress">Odczytywanie etykiety…</output>
                <Button variant="outline" type="button" onClick={onCancelScan}>
                  Anuluj odczyt
                </Button>
              </>
            )}
          </div>
        )}
        <form
          className="workspace-scan-form"
          onSubmit={(event) => {
            event.preventDefault();
            lookup(textValue(new FormData(event.currentTarget).get("tag"), ""));
          }}
        >
          <Label htmlFor={scanInputId}>Link lub identyfikator etykiety</Label>
          <div className="workspace-scan-fields">
            <Input
              ref={scannerInput}
              id={scanInputId}
              name="tag"
              placeholder="Wklej link lub wpisz identyfikator"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={Boolean(lookupError)}
              aria-describedby={lookupError ? scanErrorId : undefined}
              required
              disabled={scanBusy}
            />
            <Button
              type="submit"
              variant={qrAvailable || nfcAvailable ? "outline" : "default"}
              disabled={scanBusy}
            >
              Otwórz kartę
              <ArrowRight aria-hidden />
            </Button>
          </div>
        </form>
        {activeError && (
          <Alert id={scanErrorId} variant="destructive">
            <AlertDescription>{activeError}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );

  if (scannerView) {
    return (
      <div className="workspace-scan-page">
        {scanner}
        {onCloseScanner && (
          <Button
            type="button"
            variant="link"
            className="justify-self-start px-0!"
            onClick={() => {
              restoringRegistry.current = true;
              onCloseScanner();
            }}
          >
            <ArrowLeft aria-hidden />
            Wróć do rejestru
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="workspace-equipment-register">
      <Card className="min-w-0">
        <CardHeader className="gap-3 sm:flex sm:items-center sm:justify-between">
          <div>
            <CardTitle>
              <h2>Rejestr urządzeń</h2>
            </CardTitle>
            <CardDescription>Daty wzorcowań i karty urządzeń.</CardDescription>
          </div>
          {edit && (
            <Action
              label="Dodaj urządzenie"
              primary
              fields={createEquipmentFields}
              save={apiSave("/equipment", token, "POST")}
              after={after}
            />
          )}
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-brand-navy"
              aria-hidden
            />
            <Input
              ref={registrySearch}
              type="search"
              aria-label="Szukaj urządzeń"
              placeholder="Nazwa, kod lub numer seryjny"
              className="pl-9!"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </div>
          {collection?.data ? (
            <Rows
              rows={collection.data}
              columns={registerColumns}
              renderAction={(row) => (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Otwórz kartę · ${textValue(row.name)} · ${textValue(row.code)}`}
                  onClick={() => {
                    setId(Number(row.id));
                    window.scrollTo(0, 0);
                  }}
                >
                  Otwórz kartę
                  <ArrowRight aria-hidden />
                </Button>
              )}
            />
          ) : (
            <Loading state={collection} />
          )}
          {results && (
            <Button variant="link" className="justify-self-start px-0!" onClick={() => onResults()}>
              Wyniki badań
              <ArrowRight aria-hidden />
            </Button>
          )}
        </CardContent>
      </Card>
      {scanner}
    </div>
  );
}

function EquipmentDetails({
  device,
  token,
  permissions,
  fields,
  revision,
  after,
  onResults,
}: WorkspaceProps & {
  device: EquipmentCard;
  fields: Field[];
  after: () => void;
  revision: number;
  onResults: (id?: number) => void;
}) {
  const path = `/equipment/${device.id}`;
  const write = permissions.includes("equipment:write");
  const calibrate = permissions.includes("calibration:write");
  const users = useApi<ApiRecord[]>(
    write && permissions.includes("users:write") ? "/users" : null,
    token,
  );
  const authorized = useApi<ApiRecord[]>(
    write ? `${path}/authorized-users` : null,
    token,
    revision,
  );
  const calibrations = useApi<Calibration[]>(`${path}/calibrations`, token, revision);
  const templates = useApi<ApiRecord[]>(write ? "/form-templates" : null, token);
  const allCheckPlans = useApi<CheckPlan[]>(write ? `${path}/check-plans` : null, token, revision);
  const [history, setHistory] = useState<number>();
  const [openedPlan, setOpenedPlan] = useState<number>();
  const [nfcWriting, setNfcWriting] = useState(false);
  const [activeDialog, setActiveDialog] = useState<"edit" | "withdraw" | "auth" | null>(null);

  async function writeNfc() {
    if (nfcWriting) {
      return;
    }
    setNfcWriting(true);
    try {
      const base = getApiBaseUrl() || window.location.origin;
      const result = await writeEquipmentNfcTag(base, textValue(device.public_id));
      if (result.kind === "written") {
        toast.success("Zapisano tag NFC urządzenia", { description: device.code });
      } else if (result.kind === "error") {
        toast.error(result.message);
      } else if (result.kind === "unavailable") {
        toast.info("Zapis tagów NFC jest niedostępny na tym urządzeniu.");
      }
    } finally {
      setNfcWriting(false);
    }
  }
  const planFields = useMemo<Field[]>(
    () => [
      { key: "name", label: "Nazwa sprawdzenia", required: true },
      { key: "interval_months", label: "Cykl (miesiące)", type: "number", required: true },
      { key: "lead_months", label: "Wyprzedzenie (miesiące)", type: "number" },
      {
        key: "form_template_id",
        label: "Szablon formularza",
        type: "options",
        options: options(templates?.data ?? []),
        numeric: true,
        required: true,
      },
      { key: "active", label: "Aktywny", type: "boolean" },
    ],
    [templates],
  );
  const authorizationFields = useMemo<Field[]>(
    () => [
      {
        key: "user_ids",
        label: "Upoważnieni użytkownicy",
        type: "many",
        numeric: true,
        options: options(users?.data ?? [], "full_name"),
      },
    ],
    [users],
  );
  const authorizationInitial = useMemo<ApiRecord>(
    () => ({ user_ids: authorized?.data?.map((user) => user.id) }),
    [authorized],
  );
  const withdrawn = typeof device.withdrawn_at === "string";
  const selectedCalibration = calibrations?.data?.find((entry) => entry.id === history);
  return (
    <>
      <Card className="workspace-device-panel">
        <CardHeader className="gap-4 sm:flex sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-bold text-brand-navy tabular-nums">{device.code}</span>
              <Status value={device.status} />
            </div>
            <CardTitle className="workspace-device-title">
              <h2>{device.name}</h2>
            </CardTitle>
            <CardDescription className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <span>{[device.manufacturer, device.model].filter(Boolean).join(" ")}</span>
              {typeof device.location === "string" && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden />
                  {device.location}
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            {calibrate && (
              <CalibrationEntry
                token={token}
                equipmentId={device.id}
                name={device.name}
                after={after}
              >
                <Button type="button">
                  <FileCheck2 aria-hidden />
                  Zarejestruj świadectwo
                </Button>
              </CalibrationEntry>
            )}
            {device.can_write_result && (
              <Button variant="outline" onClick={() => onResults(device.id)}>
                Wpisz wynik badania
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <dl className="workspace-device-facts">
            {[
              ["Następne wzorcowanie", month(device.next_due_month)],
              ["Ostatnie wzorcowanie", month(device.last_calibrated_month)],
              [
                "Cykl wzorcowania",
                device.calibration_interval_months == null
                  ? "—"
                  : `${textValue(device.calibration_interval_months)} mies.`,
              ],
              ["Numer seryjny", textValue(device.serial_no)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            <DownloadButton
              token={token}
              path={`${path}/history.pdf`}
              filename={`karta-${device.id}.pdf`}
              label="Karta PDF"
            />
            {write ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={nfcWriting}>
                      <Ellipsis />
                      {nfcWriting ? "Zbliż tag NFC…" : "Więcej akcji"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem onSelect={() => setActiveDialog("edit")}>
                      Edytuj urządzenie
                    </DropdownMenuItem>
                    {authorized?.data && users?.data && (
                      <DropdownMenuItem onSelect={() => setActiveDialog("auth")}>
                        Upoważnienia
                      </DropdownMenuItem>
                    )}
                    {isNfcAvailable() && (
                      <DropdownMenuItem disabled={nfcWriting} onSelect={() => void writeNfc()}>
                        <ScanLine />
                        Zapisz tag NFC
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <a href={device.qr_url} target="_blank" rel="noreferrer">
                        <ExternalLink />
                        Link etykiety QR / NFC
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setActiveDialog("withdraw")}>
                      {withdrawn ? "Przywróć urządzenie" : "Wycofaj urządzenie"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Action
                  label="Edytuj urządzenie"
                  fields={fields}
                  initial={device}
                  save={apiSave(path, token, "PATCH")}
                  after={after}
                  hideTrigger
                  open={activeDialog === "edit"}
                  onOpenChange={(next) => setActiveDialog(next ? "edit" : null)}
                />
                <Action
                  label={withdrawn ? "Przywróć urządzenie" : "Wycofaj urządzenie"}
                  fields={withdrawFields}
                  save={apiSave(`${path}/${withdrawn ? "restore" : "withdraw"}`, token, "POST")}
                  after={after}
                  hideTrigger
                  open={activeDialog === "withdraw"}
                  onOpenChange={(next) => setActiveDialog(next ? "withdraw" : null)}
                />
                {authorized?.data && users?.data && (
                  <Action
                    label="Upoważnienia"
                    fields={authorizationFields}
                    initial={authorizationInitial}
                    save={apiSave(`${path}/authorized-users`, token, "PUT")}
                    after={after}
                    hideTrigger
                    open={activeDialog === "auth"}
                    onOpenChange={(next) => setActiveDialog(next ? "auth" : null)}
                  />
                )}
              </>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <a href={device.qr_url} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  Link etykiety
                </a>
              </Button>
            )}
          </div>
          {device.acceptance_criteria != null && (
            <p className="text-sm">
              <strong>Kryteria akceptacji</strong> {textValue(device.acceptance_criteria)}
            </p>
          )}
          {device.notes != null && (
            <p className="text-sm">
              <strong>Uwagi</strong> {textValue(device.notes)}
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Świadectwa i historia wzorcowań</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {calibrations?.data ? (
            <Rows
              rows={calibrations.data}
              columns={calibrationColumns}
              renderAction={(row) => (
                <Button
                  variant="outline"
                  size="sm"
                  aria-expanded={history === row.id}
                  aria-controls={history === row.id ? "workspace-calibration-points" : undefined}
                  onClick={() => setHistory(history === row.id ? undefined : Number(row.id))}
                >
                  {history === row.id ? "Zwiń" : "Szczegóły"}
                </Button>
              )}
            />
          ) : (
            <Loading state={calibrations} />
          )}
          {selectedCalibration && (
            <div
              key={selectedCalibration.id}
              id="workspace-calibration-points"
              className="workspace-disclosure"
            >
              <h3
                className="workspace-detail-anchor mb-2 font-semibold"
                tabIndex={-1}
                ref={revealDetails}
              >
                Punkty wzorcowania
              </h3>
              <Rows rows={selectedCalibration.points} columns={pointColumns} />
              {selectedCalibration.note != null && (
                <p className="mt-2 text-sm">{textValue(selectedCalibration.note)}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedCalibration.attachment_ids.map((att) => (
                  <DownloadButton
                    key={att}
                    token={token}
                    path={`/attachments/${att}`}
                    filename=""
                    label={`Pobierz świadectwo #${att}`}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="gap-3 sm:flex sm:items-center sm:justify-between">
          <div>
            <CardTitle>
              <h2>Sprawdzenia okresowe</h2>
            </CardTitle>
            <CardDescription>
              Wewnętrzne czynności zgodnie z planem danego urządzenia.
            </CardDescription>
          </div>
          {write && (
            <Action
              label="Dodaj plan sprawdzenia"
              fields={planFields}
              save={apiSave(`${path}/check-plans`, token, "POST")}
              after={after}
            />
          )}
        </CardHeader>
        <CardContent>
          <Rows
            rows={allCheckPlans?.data ?? device.check_plans}
            columns={checkPlanColumns}
            renderAction={(row) => (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  aria-expanded={openedPlan === row.id}
                  aria-controls={openedPlan === row.id ? "workspace-check-history" : undefined}
                  onClick={() => setOpenedPlan(openedPlan === row.id ? undefined : Number(row.id))}
                >
                  {openedPlan === row.id ? "Zwiń historię" : "Historia sprawdzeń"}
                </Button>
                {write && (
                  <Action
                    label="Edytuj plan"
                    fields={planFields}
                    initial={row}
                    save={apiSave(`/check-plans/${Number(row.id)}`, token, "PATCH")}
                    after={after}
                  />
                )}
                {device.can_write && row.active === true && (
                  <CheckEntry token={token} row={row} after={after} />
                )}
              </>
            )}
          />
          {openedPlan !== undefined && (
            <div key={openedPlan} id="workspace-check-history" className="workspace-disclosure">
              <h3
                className="workspace-detail-anchor mb-2 font-semibold"
                tabIndex={-1}
                ref={revealDetails}
              >
                Historia sprawdzeń
              </h3>
              <CheckHistory token={token} id={openedPlan} revision={revision} />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function CheckEntry({ token, row, after }: { token: string; row: ApiRecord; after: () => void }) {
  const specs = useMemo(
    () => (Array.isArray(row.fields) ? row.fields.map(objectValue) : []),
    [row.fields],
  );
  const measurements = useMemo<Field[]>(
    () =>
      specs.map((field) => ({
        key: `value:${textValue(field.key)}`,
        label: `${textValue(field.label)}${field.unit ? ` (${textValue(field.unit)})` : ""}`,
        type: field.type === "bool" ? "boolean" : field.type === "date" ? "date" : undefined,
        required: field.required === true,
        hint:
          field.min != null || field.max != null
            ? `Zakres: ${textValue(field.min)} – ${textValue(field.max)}`
            : undefined,
      })),
    [specs],
  );
  const entryFields = useMemo<Field[]>(
    () => [
      { key: "performed_on", label: "Data sprawdzenia", type: "date", required: true },
      ...measurements,
      { key: "note", label: "Uwagi", type: "note" },
    ],
    [measurements],
  );
  const entryInitial = useMemo<ApiRecord>(() => ({ performed_on: today() }), []);
  return (
    <Action
      label="Zapisz sprawdzenie"
      description={textValue(row.name)}
      fields={entryFields}
      initial={entryInitial}
      save={(data) =>
        api(`/check-plans/${Number(row.id)}/records`, token, "POST", {
          performed_on: data.performed_on,
          note: data.note,
          values: Object.fromEntries(
            Object.entries(data)
              .filter(([key]) => key.startsWith("value:"))
              .map(([key, value]) => [key.slice(6), value]),
          ),
        })
      }
      after={after}
    />
  );
}

function CheckHistory({ token, id, revision }: { token: string; id: number; revision: number }) {
  const state = useApi<ApiRecord[]>(`/check-plans/${id}/records`, token, revision);
  if (!state?.data) {
    return <Loading state={state} />;
  }
  return (
    <Rows rows={state.data} columns={checkHistoryColumns} empty="Brak zapisanych sprawdzeń." />
  );
}

const registerColumns: Columns = [
  ["name", "Urządzenie"],
  ["code", "Kod"],
  ["last_calibrated_month", "Ostatnie wzorcowanie", month],
  ["next_due_month", "Następny termin", month],
  ["status", "Status", (value) => <Status value={value} />],
];

const calibrationColumns: Columns = [
  ["calibrated_month", "Miesiąc", month],
  ["vendor", "Firma"],
  ["certificate_no", "Świadectwo"],
  ["result", "Decyzja"],
  ["next_due_month", "Termin z wpisu", month],
];

const pointColumns: Columns = [
  ["point", "Punkt"],
  ["error", "Błąd"],
  ["uncertainty", "Niepewność"],
  ["unit", "Jednostka"],
];

const checkPlanColumns: Columns = [
  ["name", "Czynność"],
  ["last_performed_on", "Ostatnie sprawdzenie"],
  ["next_due_month", "Następny termin", month],
  ["status", "Status", (value) => <Status value={value} />],
];

const checkHistoryColumns: Columns = [
  ["performed_on", "Data"],
  [
    "values",
    "Pomiary",
    (value) =>
      Object.entries(objectValue(value))
        .map(
          ([key, result]) =>
            `${key}: ${textValue(result, typeof result === "boolean" ? (result ? "Tak" : "Nie") : "—")}`,
        )
        .join(" · "),
  ],
  [
    "out_of_range",
    "Ocena",
    (value) => (
      <StatusIndicator tone={value ? "alarm" : "ok"}>
        {value ? "Poza zakresem" : "W zakresie"}
      </StatusIndicator>
    ),
  ],
  ["note", "Uwagi"],
];
