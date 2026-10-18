import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, LoaderCircle, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import {
  deletePlaybookRecord,
  getPlaybookCatalogs,
  getPlaybookRecords,
  savePlaybookRecord,
  type PlaybookCatalogs,
  type PlaybookForm,
  type PlaybookRecord,
} from "../../lib/api";

type FieldKind =
  | "text"
  | "textarea"
  | "date"
  | "number"
  | "month"
  | "year"
  | "day"
  | "checkbox"
  | "rank"
  | "status"
  | "product"
  | "response"
  | "products";

interface FieldDefinition {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  defaultValue?: string | boolean | string[];
}

const now = new Date();
const fields: Record<PlaybookForm, FieldDefinition[]> = {
  "follow-up-checklist": [
    { key: "memberCode", label: "Member code", kind: "text", required: true },
    { key: "consumeProduct", label: "Consume product", kind: "checkbox" },
    { key: "productName", label: "Product name", kind: "text" },
    { key: "consumeDate", label: "Consume date", kind: "date" },
    { key: "prospectList", label: "Prospect list", kind: "checkbox" },
    { key: "welcomeToEskayvie", label: "Welcome to Eskayvie", kind: "checkbox" },
    { key: "product", label: "Product", kind: "checkbox" },
    { key: "marketingPlan", label: "Marketing plan", kind: "checkbox" },
    { key: "hbo", label: "HBO", kind: "checkbox" },
    { key: "remarks", label: "Remarks", kind: "textarea" },
  ],
  "monthly-target": [
    { key: "targetMonth", label: "Month", kind: "month", required: true, defaultValue: String(now.getMonth() + 1) },
    { key: "targetYear", label: "Year", kind: "year", required: true, defaultValue: String(now.getFullYear()) },
    { key: "dayOfMonth", label: "Day", kind: "day", required: true },
    { key: "targetIncome", label: "Target income", kind: "number" },
    { key: "targetRecruit", label: "Target recruits", kind: "number" },
    { key: "targetRo", label: "Target repeat orders", kind: "number" },
    { key: "rankCode", label: "Target rank", kind: "rank" },
    { key: "effort", label: "Effort / plan", kind: "textarea" },
    { key: "statusId", label: "Status", kind: "status" },
  ],
  "activity-record-plan": [
    { key: "planMonth", label: "Month", kind: "month", required: true, defaultValue: String(now.getMonth() + 1) },
    { key: "planYear", label: "Year", kind: "year", required: true, defaultValue: String(now.getFullYear()) },
    { key: "dayOfMonth", label: "Day", kind: "day", required: true },
    { key: "activity", label: "Activity / plan", kind: "textarea" },
    { key: "statusId", label: "Status", kind: "status" },
  ],
  "customer-list": [
    { key: "name", label: "Customer name", kind: "text", required: true },
    { key: "phoneNumber", label: "Phone number", kind: "text" },
    { key: "birthDate", label: "Birth date", kind: "date" },
    { key: "orderDate", label: "Order date", kind: "date" },
    { key: "productCodes", label: "Products", kind: "products" },
    { key: "notes", label: "Notes", kind: "textarea" },
  ],
  "prospect-list": [
    { key: "name", label: "Prospect name", kind: "text", required: true },
    { key: "phoneNumber", label: "Phone number", kind: "text" },
    { key: "domicile", label: "Domicile", kind: "text" },
    { key: "occupation", label: "Occupation", kind: "text" },
    { key: "prospectDate", label: "Prospect date", kind: "date" },
    { key: "response", label: "Response", kind: "response" },
    { key: "reason", label: "Reason", kind: "textarea" },
    { key: "followUp", label: "Follow up required", kind: "checkbox" },
    { key: "followUpDate", label: "Follow-up date", kind: "date" },
  ],
  "daily-tasks": [
    { key: "taskMonth", label: "Month", kind: "month", required: true, defaultValue: String(now.getMonth() + 1) },
    { key: "taskYear", label: "Year", kind: "year", required: true, defaultValue: String(now.getFullYear()) },
    { key: "dayOfMonth", label: "Day", kind: "day", required: true },
    { key: "learn", label: "Learn", kind: "checkbox" },
    { key: "videoOnboarding", label: "Video onboarding", kind: "checkbox" },
    { key: "consumeProduct", label: "Consume product", kind: "checkbox" },
    { key: "repeatOrder", label: "Repeat order", kind: "checkbox" },
    { key: "attendZoom", label: "Attend Zoom", kind: "checkbox" },
    { key: "contactUpline", label: "Contact upline", kind: "checkbox" },
    { key: "sponsoring", label: "Sponsoring", kind: "checkbox" },
  ],
  "monthly-side-volume": [
    { key: "targetMonth", label: "Month", kind: "month", required: true, defaultValue: String(now.getMonth() + 1) },
    { key: "targetYear", label: "Year", kind: "year", required: true, defaultValue: String(now.getFullYear()) },
    { key: "productCode", label: "Product", kind: "product", required: true },
    { key: "targetValue", label: "Target volume", kind: "number" },
    { key: "actualValue", label: "Actual volume", kind: "number" },
  ],
};

const titles: Record<PlaybookForm, string> = {
  "follow-up-checklist": "Follow Up Checklist",
  "monthly-target": "Monthly Target",
  "activity-record-plan": "Activity Record & Plan",
  "customer-list": "Customer List",
  "prospect-list": "Prospect List",
  "daily-tasks": "7 Daily Tasks",
  "monthly-side-volume": "Monthly Side Volume Target",
};

function emptyForm(form: PlaybookForm) {
  return Object.fromEntries(
    fields[form].map(field => [
      field.key,
      field.defaultValue ?? (field.kind === "checkbox" ? false : field.kind === "products" ? [] : ""),
    ]),
  ) as Record<string, string | boolean | string[]>;
}

function makePayload(form: PlaybookForm, values: Record<string, string | boolean | string[]>) {
  const payload: Record<string, unknown> = {};
  for (const field of fields[form]) {
    const value = values[field.key];
    if (field.kind === "month" || field.kind === "year" || field.kind === "day") {
      payload[field.key] = Number(value);
    } else if (field.kind === "number") {
      payload[field.key] = value === "" ? null : Number(value);
    } else if (field.kind === "checkbox" || field.kind === "products") {
      payload[field.key] = value;
    } else {
      payload[field.key] = value === "" ? null : value;
    }
  }
  if (typeof values.id === "string" || typeof values.id === "number") {
    payload.id = Number(values.id);
  }
  return payload;
}

function displayValue(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ") || "—";
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export function PlaybooksPanel({ form }: { form: PlaybookForm }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState(() => emptyForm(form));
  const [editing, setEditing] = useState(false);
  const recordsQuery = useQuery({
    queryKey: ["playbook-records", form],
    queryFn: () => getPlaybookRecords(form),
  });
  const catalogsQuery = useQuery({
    queryKey: ["playbook-catalogs"],
    queryFn: getPlaybookCatalogs,
  });
  const saveMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) => savePlaybookRecord(form, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["playbook-records", form] });
      setValues(emptyForm(form));
      setEditing(false);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePlaybookRecord(form, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["playbook-records", form] }),
  });

  function setField(key: string, value: string | boolean | string[]) {
    setValues(current => ({ ...current, [key]: value }));
  }

  function editRecord(record: PlaybookRecord) {
    const next = emptyForm(form);
    for (const field of fields[form]) {
      const value = record[field.key];
      if (value !== undefined && value !== null) {
        next[field.key] = Array.isArray(value)
          ? value.map(String)
          : typeof value === "boolean"
            ? value
            : String(value);
      }
    }
    next.id = String(record.id);
    setValues(next);
    setEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderField(field: FieldDefinition, catalogs: PlaybookCatalogs) {
    const value = values[field.key];
    const className = "mt-1 min-h-9 w-full rounded-md border border-border bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-[#754691] focus:ring-2 focus:ring-[#754691]/20";
    if (field.kind === "checkbox") {
      return (
        <label key={field.key} className="flex min-h-9 items-center gap-2 rounded-md border border-border bg-white px-3 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={event => setField(field.key, event.target.checked)}
            className="size-4 accent-blue-700"
          />
          {field.label}
        </label>
      );
    }
    if (field.kind === "products") {
      const selected = Array.isArray(value) ? value : [];
      return (
        <fieldset key={field.key} className="rounded-md border border-border bg-white p-3">
          <legend className="px-1 text-[11px] font-medium text-slate-600">{field.label}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {catalogs.products.map(product => (
              <label key={product.code} className="flex items-center gap-1.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={selected.includes(product.code)}
                  onChange={event => setField(
                    field.key,
                    event.target.checked
                      ? [...selected, product.code]
                      : selected.filter(code => code !== product.code),
                  )}
                  className="size-4 accent-blue-700"
                />
                {product.name}
              </label>
            ))}
            {!catalogs.products.length && <span className="text-xs text-muted">No products are configured.</span>}
          </div>
        </fieldset>
      );
    }
    if (field.kind === "textarea") {
      return (
        <label key={field.key} className="block text-[11px] font-medium text-slate-600">
          {field.label}
          <textarea
            className={`${className} min-h-20 resize-y`}
            value={String(value ?? "")}
            onChange={event => setField(field.key, event.target.value)}
          />
        </label>
      );
    }
    if (field.kind === "rank" || field.kind === "status" || field.kind === "product" || field.kind === "response") {
      let options: { value: string; label: string }[] = [];
      if (field.kind === "rank") options = catalogs.ranks.map(entry => ({ value: entry.code, label: entry.name }));
      if (field.kind === "status") options = catalogs.statuses.map(entry => ({ value: String(entry.id), label: entry.name }));
      if (field.kind === "product") options = catalogs.products.map(entry => ({ value: entry.code, label: entry.name }));
      if (field.kind === "response") options = ["Baik", "Kurang", "Tidak Baik"].map(item => ({ value: item, label: item }));
      return (
        <label key={field.key} className="block text-[11px] font-medium text-slate-600">
          {field.label}
          <select
            className={className}
            value={String(value ?? "")}
            required={field.required}
            onChange={event => setField(field.key, event.target.value)}
          >
            <option value="">Select…</option>
            {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      );
    }
    return (
      <label key={field.key} className="block text-[11px] font-medium text-slate-600">
        {field.label}
        <input
          className={className}
          type={field.kind === "number" || field.kind === "month" || field.kind === "year" || field.kind === "day" ? "number" : field.kind}
          min={field.kind === "month" || field.kind === "day" ? 1 : field.kind === "number" ? 0 : undefined}
          max={field.kind === "month" ? 12 : field.kind === "day" ? 31 : undefined}
          step={field.kind === "number" ? "any" : undefined}
          required={field.required}
          value={String(value ?? "")}
          onChange={event => setField(field.key, event.target.value)}
        />
      </label>
    );
  }

  const records = recordsQuery.data ?? [];
  const catalogs = catalogsQuery.data;
  const error = saveMutation.error?.message ?? deleteMutation.error?.message;

  return (
    <div className="mx-auto max-w-[1280px]">
      <header className="mb-5">
        <div className="mb-1 text-[10px] text-muted">Applications / Playbooks / Form</div>
        <h1 className="text-[22px] font-semibold tracking-[-0.5px] text-slate-800">{titles[form]}</h1>
        <p className="mt-1 text-[11px] text-muted">Create and manage your own playbook records.</p>
      </header>

      <Card className="mb-5 p-5">
        <form
          onSubmit={event => {
            event.preventDefault();
            saveMutation.mutate(makePayload(form, values));
          }}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-800">{editing ? "Edit record" : "Add record"}</h2>
            {editing && (
              <Button type="button" variant="ghost" size="sm" onClick={() => {
                setValues(emptyForm(form));
                setEditing(false);
              }}>
                <RotateCcw size={13} /> Cancel edit
              </Button>
            )}
          </div>
          {catalogsQuery.isError ? (
            <div className="mb-4 flex items-center gap-2 rounded-md bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle size={15} /> Could not load form options: {catalogsQuery.error.message}
            </div>
          ) : catalogsQuery.isPending ? (
            <div className="mb-4 flex items-center gap-2 text-xs text-muted">
              <LoaderCircle size={14} className="animate-spin" /> Loading form options…
            </div>
          ) : catalogs ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fields[form].map(field => renderField(field, catalogs))}
            </div>
          ) : null}
          {error && <p className="mt-3 text-xs text-red-600" role="alert">{error}</p>}
          {saveMutation.isError && (
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => saveMutation.reset()}>
              Dismiss error
            </Button>
          )}
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={saveMutation.isPending || catalogsQuery.isPending || catalogsQuery.isError}>
              {saveMutation.isPending && <LoaderCircle size={14} className="animate-spin" />}
              {editing ? "Save changes" : "Save record"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-800">Saved records</h2>
        </div>
        {recordsQuery.isPending ? (
          <div className="flex items-center gap-2 p-5 text-xs text-muted">
            <LoaderCircle size={14} className="animate-spin" /> Loading records…
          </div>
        ) : recordsQuery.isError ? (
          <div className="p-5">
            <p className="flex items-center gap-2 text-xs text-red-700">
              <AlertCircle size={15} /> {recordsQuery.error.message}
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void recordsQuery.refetch()}>Try again</Button>
          </div>
        ) : records.length === 0 ? (
          <p className="p-5 text-xs text-muted">No records yet. Add one using the form above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  {fields[form].map(field => <th key={field.key} className="px-3 py-3 font-semibold">{field.label}</th>)}
                  <th className="px-3 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map(record => (
                  <tr key={record.id} className="border-t border-border text-slate-600">
                    {fields[form].map(field => (
                      <td key={field.key} className="max-w-64 truncate px-3 py-3">{displayValue(record[field.key])}</td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <Button type="button" variant="ghost" size="sm" aria-label="Edit record" onClick={() => editRecord(record)}>
                        <Pencil size={13} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Delete record"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm("Delete this playbook record?")) deleteMutation.mutate(record.id);
                        }}
                      >
                        <Trash2 size={13} className="text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {deleteMutation.isError && (
          <p className="flex items-center gap-2 border-t border-border p-4 text-xs text-red-700" role="alert">
            <AlertCircle size={14} /> Could not delete record: {deleteMutation.error.message}
          </p>
        )}
      </Card>
    </div>
  );
}
