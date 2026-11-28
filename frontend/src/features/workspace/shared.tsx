import { cn } from "cn";
import { Upload } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { api, type ApiRecord, errorMessage, textValue } from "@/api/workspaceClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export type WorkspaceProps = { token: string; permissions: string[] };
export type Option = { value: string; label: string };
export type Field = {
  key: string;
  label: string;
  type?:
    "number" | "date" | "month" | "password" | "boolean" | "options" | "many" | "note" | "json";
  required?: boolean;
  options?: Option[];
  numeric?: boolean;
  clear?: boolean;
  hint?: string;
};

export const selectStyle =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-brand-navy focus-visible:ring-3 focus-visible:ring-brand-navy/15 sm:h-9";

export function options(rows: ApiRecord[], label = "name"): Option[] {
  return rows.map((row) => ({ value: textValue(row.id), label: textValue(row[label]) }));
}

export function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

type ApiState<T> = { data?: T; error?: string };

export function useApi<T>(
  path: string | null,
  token: string,
  revision = 0,
): ApiState<T> | undefined {
  const [state, setState] = useState<
    ApiState<T> & { path: string; revision: number; token: string }
  >();
  useEffect(() => {
    let active = true;
    async function load(url: string) {
      try {
        const data = await api<T>(url, token);
        if (active) {
          setState({ path: url, data, revision, token });
        }
      } catch (error) {
        if (active) {
          setState({ path: url, error: errorMessage(error), revision, token });
        }
      }
    }
    if (path !== null) {
      void load(path);
    }
    return () => {
      active = false;
    };
  }, [path, token, revision]);
  return state?.path === path && state.revision === revision && state.token === token
    ? state
    : undefined;
}

export type StatusTone = "ok" | "warning" | "alarm" | "neutral" | "missing";

export function StatusIndicator({
  children,
  tone,
  status,
}: {
  children: string;
  tone: StatusTone;
  status?: string;
}) {
  return (
    <span className="workspace-status" data-tone={tone} data-status={status}>
      {children}
    </span>
  );
}

export function Message({ children }: { children: ReactNode }) {
  return (
    <Alert>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function Loading({ state }: { state?: { error?: string } }) {
  if (state?.error) {
    return <Message>{state.error}</Message>;
  }
  return <output className="block py-4 text-sm text-muted-foreground">Wczytywanie…</output>;
}

export function Control({
  label,
  children,
  htmlFor,
  hint,
}: {
  label: string;
  children: ReactNode;
  htmlFor?: string;
  hint?: string;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <small className="text-muted-foreground">{hint}</small>}
    </div>
  );
}

function FieldInput({ field, value }: { field: Field; value: unknown }) {
  const id = useId();
  const { key, label, type, required, hint } = field;
  const initial = textValue(value, "");
  const [selection, setSelection] = useState(initial);
  if (type === "many") {
    const selected = Array.isArray(value) ? value.map((item: unknown) => textValue(item, "")) : [];
    return (
      <fieldset className="min-w-0 border p-3">
        <legend className="px-1 text-sm font-semibold">{label}</legend>
        <div className="workspace-form-options">
          {(field.options ?? []).map((option) => (
            <label key={option.value} className="flex items-start gap-2 text-sm">
              <input
                className="mt-1 shrink-0 accent-brand-navy"
                name={key}
                type="checkbox"
                value={option.value}
                defaultChecked={selected.includes(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  return (
    <Control label={label} htmlFor={id} hint={hint}>
      {type === "boolean" ? (
        <select
          id={id}
          name={key}
          defaultValue={
            value === undefined ? "" : textValue(value, value === true ? "true" : "false")
          }
          className={selectStyle}
          required={required}
        >
          <option value="">Wybierz</option>
          <option value="true">Tak</option>
          <option value="false">Nie</option>
        </select>
      ) : type === "options" ? (
        <select
          id={id}
          name={key}
          value={selection}
          onChange={(event) => setSelection(event.currentTarget.value)}
          className={selectStyle}
          required={required}
        >
          <option value="">Wybierz</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : type === "note" || type === "json" ? (
        <Textarea
          id={id}
          name={key}
          defaultValue={type === "json" ? JSON.stringify(value, null, 2) : initial}
          required={required}
          rows={type === "json" ? 6 : 2}
        />
      ) : (
        <Input
          id={id}
          name={key}
          type={type ?? "text"}
          defaultValue={initial}
          required={required}
        />
      )}
    </Control>
  );
}

function formPayload(form: HTMLFormElement, fields: Field[]): ApiRecord {
  const values = new FormData(form);
  const result: ApiRecord = {};
  for (const field of fields) {
    if (field.type === "many") {
      result[field.key] = values
        .getAll(field.key)
        .map((value) => (field.numeric ? Number(value) : textValue(value, "")));
      continue;
    }
    const entered = textValue(values.get(field.key), "");
    const raw = field.type === "password" ? entered : entered.trim();
    if (raw === "") {
      if (field.clear) {
        result[field.key] = null;
      }
      continue;
    }
    if (field.type === "json") {
      try {
        result[field.key] = JSON.parse(raw);
      } catch {
        throw new Error(`Nieprawidłowy format JSON w polu „${field.label}”.`);
      }
    } else if (field.type === "boolean") {
      result[field.key] = raw === "true";
    } else if (field.type === "number" || field.numeric) {
      result[field.key] = Number(raw);
    } else {
      result[field.key] = raw;
    }
  }
  return result;
}

const emptyRecord: ApiRecord = {};
const emptyFields: Field[] = [];

export function Action({
  label,
  description = "Uzupełnij dane i zapisz zmiany.",
  fields = emptyFields,
  initial = emptyRecord,
  save,
  after,
  primary = false,
  defaultOpen = false,
  submitLabel = "Zapisz",
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
}: {
  label: string;
  description?: string;
  fields?: Field[];
  initial?: ApiRecord;
  save: (data: ApiRecord) => Promise<unknown>;
  after: () => void;
  primary?: boolean;
  defaultOpen?: boolean;
  submitLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = controlledOnOpenChange ?? setUncontrolledOpen;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await save(formPayload(event.currentTarget, fields));
      setOpen(false);
      after();
      toast.success("Zapisano");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) {
          return;
        }
        if (next) {
          setError("");
        }
        setOpen(next);
      }}
    >
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button type="button" variant={primary ? "default" : "outline"} size="sm">
            {label}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          {fields.map((field) => (
            <FieldInput key={field.key} field={field} value={initial[field.key]} />
          ))}
          {error && <Message>{error}</Message>}
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Zapisywanie…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type Columns = [string, string, ((value: unknown) => ReactNode)?][];

export function revealDetails(heading: HTMLElement | null) {
  if (heading) {
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: "start" });
  }
}

export function FilePicker({
  id,
  accept,
  file,
  onChange,
  disabled,
}: {
  id: string;
  accept: string;
  file?: File;
  onChange: (file: File | undefined) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (file === undefined && input.current) {
      input.current.value = "";
    }
  }, [file]);
  return (
    <div className="workspace-file-picker">
      <Input
        id={id}
        ref={input}
        className="sr-only"
        aria-describedby={`${id}-filename`}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.files?.[0])}
      />
      <label htmlFor={id}>
        <Upload aria-hidden />
        Wybierz plik
      </label>
      <span id={`${id}-filename`} aria-live="polite">
        {file?.name ?? "Nie wybrano pliku"}
      </span>
    </div>
  );
}

export function Rows({
  rows,
  columns,
  renderAction,
  empty = "Brak pozycji.",
}: {
  rows: ApiRecord[];
  columns: Columns;
  empty?: string;
  renderAction?: (row: ApiRecord) => ReactNode;
}) {
  if (rows.length === 0) {
    return <p className="workspace-records-empty">{empty}</p>;
  }
  return (
    <Table className="workspace-records max-sm:block">
      <TableHeader className="max-sm:sr-only">
        <TableRow>
          {columns.map(([key, title]) => (
            <TableHead key={key} scope="col">
              {title}
            </TableHead>
          ))}
          {renderAction && <TableHead scope="col">Akcje</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody className="max-sm:grid max-sm:gap-2">
        {rows.map((row, index) => (
          <TableRow key={textValue(row.id ?? row.key, String(index))} className={recordRow}>
            {columns.map(([key, title, display], column) => (
              <TableCell
                key={key}
                className={cn(
                  "max-w-[35rem] whitespace-normal",
                  recordField,
                  column === 0 && "font-medium text-brand-navy-ink",
                  column === 0 && recordTitle,
                )}
              >
                {column !== 0 && (
                  <span className="text-start text-xs text-muted-foreground sm:hidden">
                    {title}
                  </span>
                )}
                <span className="min-w-0 wrap-anywhere">
                  {display ? display(row[key]) : textValue(row[key])}
                </span>
              </TableCell>
            ))}
            {renderAction && (
              <TableCell className="max-sm:mt-1.5 max-sm:p-0">
                <div className="flex flex-wrap gap-1.5">{renderAction(row)}</div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// Keep table semantics when the narrow layout turns a row into labeled fields.
const recordRow =
  "max-sm:grid max-sm:gap-1 max-sm:rounded-md max-sm:border-0 max-sm:bg-card max-sm:p-3 max-sm:ring-1 max-sm:ring-border max-sm:ring-inset max-sm:even:bg-card";
const recordField =
  "max-sm:flex max-sm:items-baseline max-sm:justify-between max-sm:gap-4 max-sm:p-0 max-sm:text-right";
const recordTitle =
  "max-sm:mb-1 max-sm:justify-start max-sm:text-left max-sm:text-[15px] max-sm:font-semibold max-sm:text-brand-navy-ink";

export function choice(...choices: [string, string][]): Option[] {
  return choices.map(([value, label]) => ({ value, label }));
}
