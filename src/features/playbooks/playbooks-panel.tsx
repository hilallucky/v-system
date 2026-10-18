import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Download, LoaderCircle, Search, X } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import {
  getPlaybookCatalogs,
  getPlaybookRecords,
  savePlaybookRecord,
  type PlaybookCatalogs,
  type PlaybookForm,
  type PlaybookRecord,
} from "../../lib/api";
import { cn } from "../../lib/utils";

const titles: Record<PlaybookForm, string> = {
  "follow-up-checklist": "Follow Up Checklist",
  "monthly-target": "Monthly Target",
  "activity-record-plan": "Activity Record & Plan",
  "customer-list": "Customer List",
  "prospect-list": "Prospect List",
  "daily-tasks": "7 Daily Tasks",
  "monthly-side-volume": "Monthly Side Volume Target",
};

const monthNames = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(2020, index, 1)),
);
const dayCount = (month: number, year: number) => new Date(year, month, 0).getDate();
const stringValue = (value: unknown) => value === null || value === undefined ? "" : String(value);
const boolValue = (value: unknown) => value === true || value === 1;

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  min,
  max,
  name,
}: {
  label: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date" | "number";
  required?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block min-w-0 text-[11px] font-medium text-slate-600">
      {label}
      <input
        type={type}
        name={name}
        value={value}
        required={required}
        min={min}
        max={max}
        step={type === "number" ? 1 : undefined}
        onChange={event => onChange(event.target.value)}
        className="mt-1 h-9 w-full rounded-md border border-border bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-[#754691] focus:ring-2 focus:ring-[#754691]/20"
      />
    </label>
  );
}

function CellInput({
  value,
  onSave,
  type = "text",
  disabled,
  className,
  label,
}: {
  value: unknown;
  onSave: (value: string) => void;
  type?: "text" | "date" | "number";
  disabled: boolean;
  className?: string;
  label: string;
}) {
  const current = stringValue(value);
  return (
    <input
      key={`${label}:${current}`}
      type={type}
      defaultValue={current}
      disabled={disabled}
      min={type === "number" ? 0 : undefined}
      step={type === "number" ? 1 : undefined}
      aria-label={label}
      onBlur={event => {
        if (event.currentTarget.value !== current) onSave(event.currentTarget.value);
      }}
      className={cn(
        "h-8 w-full min-w-20 rounded border border-slate-300 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-[#754691] focus:ring-2 focus:ring-[#754691]/20 disabled:bg-slate-50",
        className,
      )}
    />
  );
}

function CellSelect({
  value,
  options,
  onSave,
  disabled,
  label,
}: {
  value: unknown;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={stringValue(value)}
      disabled={disabled}
      onChange={event => onSave(event.target.value)}
      className="h-8 w-full min-w-24 rounded border border-slate-300 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-[#754691] focus:ring-2 focus:ring-[#754691]/20 disabled:bg-slate-50"
    >
      <option value="">Select…</option>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

function CheckCell({
  checked,
  onToggle,
  disabled,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={`${label}: ${checked ? "Yes" : "No"}`}
      aria-pressed={checked}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "mx-auto grid size-8 place-items-center rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#754691]/30 disabled:cursor-not-allowed",
        checked ? "text-emerald-700 hover:bg-emerald-50" : "text-rose-600 hover:bg-rose-50",
      )}
    >
      {checked ? <Check size={17} strokeWidth={3} /> : <X size={17} strokeWidth={2.5} />}
    </button>
  );
}

function TableShell({
  children,
  minWidth,
}: {
  children: ReactNode;
  minWidth: string;
}) {
  return (
    <Card className="overflow-hidden border-[#e6d9ed] focus-within:border-[#9b78ad] focus-within:ring-2 focus-within:ring-[#754691]/10">
      <div className="overflow-x-auto">
        <table className={`w-full ${minWidth} border-collapse text-left text-xs`}>{children}</table>
      </div>
    </Card>
  );
}

function TableHead({ children, rowSpan, colSpan }: { children: ReactNode; rowSpan?: number; colSpan?: number }) {
  return (
    <th
      scope={colSpan && colSpan > 1 ? "colgroup" : rowSpan && rowSpan > 1 ? "col" : undefined}
      rowSpan={rowSpan}
      colSpan={colSpan}
      className="border border-[#8052a0] bg-[#57217e] px-2 py-2 text-center align-middle text-[10px] font-semibold text-white"
    >
      {children}
    </th>
  );
}

function TableCell({ children, className, rowSpan, colSpan }: { children: ReactNode; className?: string; rowSpan?: number; colSpan?: number }) {
  return <td rowSpan={rowSpan} colSpan={colSpan} className={cn("border border-[#eaddef] px-2 py-1.5 align-middle", className)}>{children}</td>;
}

function useTableView<T>(items: T[], searchText: (item: T) => string = item => JSON.stringify(item)) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredItems = normalizedSearch
    ? items.filter(item => searchText(item).toLocaleLowerCase().includes(normalizedSearch))
    : items;
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const activePage = Math.min(page, pageCount);
  const startIndex = filteredItems.length ? (activePage - 1) * pageSize : 0;
  const endIndex = Math.min(startIndex + pageSize, filteredItems.length);

  return {
    search,
    setSearch: (value: string) => {
      setSearch(value);
      setPage(1);
    },
    pageSize,
    setPageSize: (value: number) => {
      setPageSize(value);
      setPage(1);
    },
    page: activePage,
    setPage,
    pageCount,
    startIndex,
    endIndex,
    totalCount: items.length,
    filteredItems,
    pageItems: filteredItems.slice(startIndex, endIndex),
  };
}

function TableControls<T>({
  label,
  view,
  exportHref,
}: {
  label: string;
  view: ReturnType<typeof useTableView<T>>;
  exportHref: string;
}) {
  return (
    <section aria-label={`${label} table summary and controls`} className="mb-3 rounded-lg border border-[#e7d9ef] bg-[#fbf8fd] p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold text-[#4A2260]">Table summary</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
            <span className="rounded-md border border-[#e7d9ef] bg-white px-2.5 py-1.5 text-slate-600">
              Total rows <strong className="ml-1 text-[#4A2260]">{view.totalCount}</strong>
            </span>
            <span className="rounded-md border border-[#e7d9ef] bg-white px-2.5 py-1.5 text-slate-600">
              Matching <strong className="ml-1 text-[#4A2260]">{view.filteredItems.length}</strong>
            </span>
            <span className="rounded-md border border-[#e7d9ef] bg-white px-2.5 py-1.5 text-slate-600">
              Page <strong className="ml-1 text-[#4A2260]">{view.page} / {view.pageCount}</strong>
            </span>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={exportHref} download>
            <Download size={14} />
            Export CSV
          </a>
        </Button>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-white px-3 focus-within:border-[#754691] focus-within:ring-2 focus-within:ring-[#754691]/20 sm:max-w-md">
          <Search size={15} className="shrink-0 text-muted" />
          <input
            type="search"
            value={view.search}
            onChange={event => view.setSearch(event.target.value)}
            placeholder={`Search ${label.toLocaleLowerCase()}…`}
            aria-label={`Search ${label}`}
            className="h-9 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600 sm:justify-end">
          <span aria-live="polite">
            {view.filteredItems.length
              ? `Showing ${view.startIndex + 1}–${view.endIndex} of ${view.filteredItems.length}${view.totalCount !== view.filteredItems.length ? ` (filtered from ${view.totalCount})` : ""}`
              : `No ${label.toLocaleLowerCase()} found`}
          </span>
          <label className="flex items-center gap-1.5 whitespace-nowrap">
            Rows
            <select
              value={view.pageSize}
              onChange={event => view.setPageSize(Number(event.target.value))}
              aria-label={`Rows per page for ${label}`}
              className="h-8 rounded-md border border-border bg-white px-2 text-xs outline-none focus:border-[#754691]"
            >
              {[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}
            </select>
            per page
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
              disabled={view.page <= 1}
              onClick={() => view.setPage(view.page - 1)}
              className="grid size-8 place-items-center rounded border border-border bg-white hover:bg-[#f5eff8] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="min-w-14 text-center tabular-nums">Page {view.page} of {view.pageCount}</span>
            <button
              type="button"
              aria-label="Next page"
              disabled={view.page >= view.pageCount}
              onClick={() => view.setPage(view.page + 1)}
              className="grid size-8 place-items-center rounded border border-border bg-white hover:bg-[#f5eff8] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function PeriodToolbar({
  month,
  year,
  setMonth,
  setYear,
  showMonth = true,
  onShow,
}: {
  month: number;
  year: number;
  setMonth: (month: number) => void;
  setYear: (year: number) => void;
  showMonth?: boolean;
  onShow: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-[#e7d9ef] bg-[#fbf8fd] p-3">
      {showMonth && (
        <label className="block text-[11px] font-medium text-slate-600">
          Month
          <select
            value={month}
            onChange={event => setMonth(Number(event.target.value))}
            className="mt-1 h-9 min-w-36 rounded-md border border-border bg-white px-3 text-xs outline-none focus:border-[#754691] focus:ring-2 focus:ring-[#754691]/20"
          >
            {monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
          </select>
        </label>
      )}
      <label className="block text-[11px] font-medium text-slate-600">
        Year
        <input
          type="number"
          min={2000}
          max={2200}
          value={year}
          onChange={event => setYear(Number(event.target.value))}
          className="mt-1 h-9 w-28 rounded-md border border-border bg-white px-3 text-xs outline-none focus:border-[#754691] focus:ring-2 focus:ring-[#754691]/20"
        />
      </label>
      <Button type="button" onClick={onShow}>Show</Button>
    </div>
  );
}

function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-5">
      <p className="text-[10px] text-muted">Applications / Playbooks</p>
      <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.5px] text-[#36872f]">{title}</h1>
      <p className="mt-1 text-[11px] text-muted">{description}</p>
    </header>
  );
}

function playbookExportHref(
  form: PlaybookForm,
  period: { month?: number; year?: number } | undefined,
  search: string,
) {
  const params = new URLSearchParams();
  if (period?.month) params.set("month", String(period.month));
  if (period?.year) params.set("year", String(period.year));
  if (search.trim()) params.set("search", search.trim());
  return `/api/v1/playbooks/${form}/export?${params.toString()}`;
}

export function PlaybooksPanel({
  form,
  canAdd,
  canEdit,
  canDelete: _canDelete,
}: {
  form: PlaybookForm;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const queryClient = useQueryClient();
  const now = new Date();
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [draftPeriod, setDraftPeriod] = useState(period);
  const [draft, setDraft] = useState<Record<string, string | string[]>>({});
  const periodForm = ["monthly-target", "activity-record-plan", "daily-tasks", "monthly-side-volume"].includes(form);
  const recordsQuery = useQuery({
    queryKey: ["playbook-records", form, period.month, period.year],
    queryFn: () => getPlaybookRecords(
      form,
      form === "monthly-side-volume" ? { year: period.year } : periodForm ? period : undefined,
    ),
  });
  const catalogsQuery = useQuery({
    queryKey: ["playbook-catalogs"],
    queryFn: getPlaybookCatalogs,
  });
  const saveMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) => savePlaybookRecord(form, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["playbook-records", form] }),
  });
  const records = recordsQuery.data ?? [];
  const catalogs = catalogsQuery.data;
  const canWrite = canAdd || canEdit;

  function save(row: Record<string, unknown>, patch: Record<string, unknown>) {
    if (!canEdit && row.id) return;
    if (!canEdit && !canAdd) return;
    saveMutation.mutate({ ...row, ...patch });
  }

  function addRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAdd) return;
    const formData = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = { ...draft };
    for (const [key, value] of formData) payload[key] = String(value);
    const products = formData.getAll("productCodes").map(String);
    if (products.length || form === "customer-list") payload.productCodes = products;
    const nullableFields: Partial<Record<PlaybookForm, string[]>> = {
      "follow-up-checklist": ["rankCode", "joinDate"],
      "customer-list": ["phoneNumber", "birthDate", "orderDate"],
      "prospect-list": ["phoneNumber", "domicile", "occupation", "prospectDate", "response", "followUpDate"],
    };
    for (const key of nullableFields[form] ?? []) {
      if (payload[key] === "") payload[key] = null;
    }
    if (form === "follow-up-checklist") {
      payload.status = "Active";
      payload.memberCode = stringValue(draft.memberCode);
    }
    if (form === "customer-list") payload.status = "Active";
    if (form === "prospect-list") payload.followUp = draft.followUp === "true";
    const submittedForm = event.currentTarget;
    saveMutation.mutate(payload, {
      onSuccess: () => {
        submittedForm.reset();
        setDraft({});
      },
    });
  }

  const loading = recordsQuery.isPending || catalogsQuery.isPending;
  const error = recordsQuery.error?.message ?? catalogsQuery.error?.message ?? saveMutation.error?.message;

  return (
    <section className="mx-auto max-w-[1500px]">
      <PageHeader
        title={titles[form]}
        description={form === "follow-up-checklist"
          ? "Add and update your downline details and onboarding activities."
          : "Manage your records with inline updates. Changes are saved to your account."}
      />
      {form === "follow-up-checklist" && (
        <FollowUpPanel records={records} catalogs={catalogs} canAdd={canAdd} canEdit={canEdit} save={save} onAdd={addRecord} draft={draft} setDraft={setDraft} />
      )}
      {form === "monthly-target" && (
        <PeriodToolbar
          month={draftPeriod.month} year={draftPeriod.year}
          setMonth={month => setDraftPeriod(current => ({ ...current, month }))}
          setYear={year => setDraftPeriod(current => ({ ...current, year }))}
          onShow={() => setPeriod(draftPeriod)}
        />
      )}
      {form === "activity-record-plan" && (
        <PeriodToolbar
          month={draftPeriod.month} year={draftPeriod.year}
          setMonth={month => setDraftPeriod(current => ({ ...current, month }))}
          setYear={year => setDraftPeriod(current => ({ ...current, year }))}
          onShow={() => setPeriod(draftPeriod)}
        />
      )}
      {form === "daily-tasks" && (
        <PeriodToolbar
          month={draftPeriod.month} year={draftPeriod.year}
          setMonth={month => setDraftPeriod(current => ({ ...current, month }))}
          setYear={year => setDraftPeriod(current => ({ ...current, year }))}
          onShow={() => setPeriod(draftPeriod)}
        />
      )}
      {form === "monthly-side-volume" && (
        <PeriodToolbar
          month={draftPeriod.month} year={draftPeriod.year}
          setMonth={month => setDraftPeriod(current => ({ ...current, month }))}
          setYear={year => setDraftPeriod(current => ({ ...current, year }))}
          showMonth={false}
          onShow={() => setPeriod(draftPeriod)}
        />
      )}
      {form === "customer-list" && (
        <AddForm title="Add Customer" canAdd={canAdd} onSubmit={addRecord} error={null}>
          <Field name="name" required label="Name" value={stringValue(draft.name)} onChange={value => setDraft(current => ({ ...current, name: value }))} />
          <Field name="phoneNumber" label="Phone Number" value={stringValue(draft.phoneNumber)} onChange={value => setDraft(current => ({ ...current, phoneNumber: value }))} />
          <Field name="birthDate" type="date" label="Birth Date" value={stringValue(draft.birthDate)} onChange={value => setDraft(current => ({ ...current, birthDate: value }))} />
          <Field name="orderDate" type="date" label="Order Date" value={stringValue(draft.orderDate)} onChange={value => setDraft(current => ({ ...current, orderDate: value }))} />
          <ProductCheckboxes products={catalogs?.products ?? []} selected={Array.isArray(draft.productCodes) ? draft.productCodes : []} />
          <label className="block text-[11px] font-medium text-slate-600 sm:col-span-2">
            Remarks / Catatan
            <textarea name="notes" rows={2} className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-xs outline-none focus:border-[#754691] focus:ring-2 focus:ring-[#754691]/20" />
          </label>
        </AddForm>
      )}
      {form === "prospect-list" && (
        <AddForm title="Add Prospect" canAdd={canAdd} onSubmit={addRecord} error={null}>
          <Field name="name" required label="Name" value={stringValue(draft.name)} onChange={value => setDraft(current => ({ ...current, name: value }))} />
          <Field name="phoneNumber" label="Phone Number" value={stringValue(draft.phoneNumber)} onChange={value => setDraft(current => ({ ...current, phoneNumber: value }))} />
          <Field name="domicile" label="Domicile" value={stringValue(draft.domicile)} onChange={value => setDraft(current => ({ ...current, domicile: value }))} />
          <Field name="occupation" label="Job / Profession" value={stringValue(draft.occupation)} onChange={value => setDraft(current => ({ ...current, occupation: value }))} />
          <Field name="prospectDate" label="Date" type="date" value={stringValue(draft.prospectDate)} onChange={value => setDraft(current => ({ ...current, prospectDate: value }))} />
          <label className="block text-[11px] font-medium text-slate-600">
            Response
            <select name="response" defaultValue="" className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-xs focus:border-[#754691] focus:outline-none">
              <option value="">Select…</option><option>Baik</option><option>Kurang Baik</option><option>Tidak Baik</option>
            </select>
          </label>
          <label className="block text-[11px] font-medium text-slate-600">
            Follow-up
            <select value={stringValue(draft.followUp ?? "false")} onChange={event => setDraft(current => ({ ...current, followUp: event.target.value }))} className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-xs focus:border-[#754691] focus:outline-none">
              <option value="false">No</option><option value="true">Yes</option>
            </select>
          </label>
          <Field name="followUpDate" label="Follow-up Date" type="date" value={stringValue(draft.followUpDate)} onChange={value => setDraft(current => ({ ...current, followUpDate: value }))} />
          <label className="block text-[11px] font-medium text-slate-600 sm:col-span-2">
            Remarks / Catatan
            <textarea name="reason" rows={2} className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-xs outline-none focus:border-[#754691] focus:ring-2 focus:ring-[#754691]/20" />
          </label>
        </AddForm>
      )}
      {error && (
        <p className="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700" role="alert">
          <AlertCircle size={15} /> {error}
          {recordsQuery.isError && <button type="button" className="ml-auto underline" onClick={() => void recordsQuery.refetch()}>Retry</button>}
        </p>
      )}
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-xs text-muted"><LoaderCircle size={15} className="animate-spin" /> Loading records…</div>
      ) : catalogs && (
        <>
          {form === "monthly-target" && <MonthlyTargetTable records={records} catalogs={catalogs} period={period} canAdd={canAdd} canEdit={canEdit} pending={saveMutation.isPending} save={save} />}
          {form === "activity-record-plan" && <ActivityPlanTable records={records} catalogs={catalogs} period={period} canAdd={canAdd} canEdit={canEdit} pending={saveMutation.isPending} save={save} />}
          {form === "daily-tasks" && <DailyTasksTable records={records} period={period} canAdd={canAdd} canEdit={canEdit} pending={saveMutation.isPending} save={save} />}
          {form === "monthly-side-volume" && <SideVolumeTable records={records} products={catalogs.products} year={period.year} canAdd={canAdd} canEdit={canEdit} pending={saveMutation.isPending} save={save} />}
          {form === "customer-list" && <CustomerTable records={records} products={catalogs.products} canEdit={canEdit} pending={saveMutation.isPending} save={save} />}
          {form === "prospect-list" && <ProspectTable records={records} canEdit={canEdit} pending={saveMutation.isPending} save={save} />}
        </>
      )}
      {!canWrite && <p className="mt-3 text-[11px] text-muted">View-only access.</p>}
    </section>
  );
}

function AddForm({
  title,
  canAdd,
  onSubmit,
  error,
  children,
}: {
  title: string;
  canAdd: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error: string | null;
  children: ReactNode;
}) {
  if (!canAdd) return null;
  return (
    <Card className="mb-5 border-[#e6d9ed] p-4">
      <form onSubmit={onSubmit}>
        <details open>
          <summary className="mb-3 cursor-pointer text-xs font-semibold text-[#4A2260]">{title}</summary>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
          {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
          <Button type="submit" className="mt-4">{title}</Button>
        </details>
      </form>
    </Card>
  );
}

function ProductCheckboxes({
  products,
  selected,
}: {
  products: PlaybookCatalogs["products"];
  selected: string[];
}) {
  return (
    <fieldset className="sm:col-span-2">
      <legend className="text-[11px] font-medium text-slate-600">Products</legend>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        {products.map(product => (
          <label key={product.code} className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <input type="checkbox" name="productCodes" value={product.code} defaultChecked={selected.includes(product.code)} className="size-4 accent-[#4A2260]" />
            {product.name}
          </label>
        ))}
        {!products.length && <span className="text-xs text-muted">No active products are configured.</span>}
      </div>
    </fieldset>
  );
}

function FollowUpPanel({
  records, catalogs, canAdd, canEdit, save, onAdd, draft, setDraft,
}: {
  records: PlaybookRecord[];
  catalogs?: PlaybookCatalogs;
  canAdd: boolean;
  canEdit: boolean;
  save: (row: Record<string, unknown>, patch: Record<string, unknown>) => void;
  onAdd: (event: FormEvent<HTMLFormElement>) => void;
  draft: Record<string, string | string[]>;
  setDraft: (update: (current: Record<string, string | string[]>) => Record<string, string | string[]>) => void;
}) {
  const view = useTableView(records);
  return (
    <>
      {canAdd && (
        <AddForm title="Add New Downline" canAdd={canAdd} onSubmit={onAdd} error={null}>
          <Field name="name" required label="Name" value={stringValue(draft.name)} onChange={value => setDraft(current => ({ ...current, name: value }))} />
          <Field name="memberCode" label="Member Code (optional)" value={stringValue(draft.memberCode)} onChange={value => setDraft(current => ({ ...current, memberCode: value }))} />
          <label className="block text-[11px] font-medium text-slate-600">
            Rank
            <select name="rankCode" defaultValue="" className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-xs focus:border-[#754691] focus:outline-none">
              <option value="">Select rank…</option>
              {catalogs?.ranks.map(rank => <option key={rank.code} value={rank.code}>{rank.name}</option>)}
            </select>
          </label>
          <Field name="joinDate" label="Join Date" type="date" value={stringValue(draft.joinDate)} onChange={value => setDraft(current => ({ ...current, joinDate: value }))} />
        </AddForm>
      )}
      <TableControls label="downlines" view={view} exportHref={playbookExportHref("follow-up-checklist", undefined, view.search)} />
      <TableShell minWidth="min-w-[1080px]">
        <thead>
          <tr>
            <TableHead rowSpan={3}>No</TableHead>
            <TableHead rowSpan={3}>Name</TableHead>
            <TableHead rowSpan={3}>ID</TableHead>
            <TableHead rowSpan={3}>Join Date</TableHead>
            <TableHead rowSpan={3}>Rank</TableHead>
            <TableHead colSpan={6}>Activities</TableHead>
            <TableHead rowSpan={3}>Remarks</TableHead>
            <TableHead rowSpan={3}>Status</TableHead>
          </tr>
          <tr>
            <TableHead colSpan={2}>Personal</TableHead>
            <TableHead colSpan={4}>Training</TableHead>
          </tr>
          <tr>
            {["Consume Product", "Prospect List", "Welcome to Eskayvie", "Product", "Marketing Plan", "HBO"].map(name => <TableHead key={name}>{name}</TableHead>)}
          </tr>
        </thead>
        <tbody>
          {view.pageItems.map((record, index) => (
            <tr key={record.id} className="bg-white transition-colors hover:bg-[#f5eff8] focus-within:bg-[#efe4f5]">
              <TableCell>{view.startIndex + index + 1}</TableCell>
              <TableCell><CellInput value={record.name} label="Name" disabled={!canEdit} onSave={value => save(record, { name: value })} /></TableCell>
              <TableCell><CellInput value={record.memberCode} label="Member code" disabled={!canEdit} onSave={value => save(record, { memberCode: value })} /></TableCell>
              <TableCell><CellInput value={record.joinDate} type="date" label="Join date" disabled={!canEdit} onSave={value => save(record, { joinDate: value || null })} /></TableCell>
              <TableCell><CellSelect value={record.rankCode} label="Rank" disabled={!canEdit} options={catalogs?.ranks.map(rank => ({ value: rank.code, label: rank.name })) ?? []} onSave={value => save(record, { rankCode: value || null })} /></TableCell>
              {(["consumeProduct", "prospectList", "welcomeToEskayvie", "product", "marketingPlan", "hbo"] as const).map(field => (
                <TableCell key={field} className="text-center">
                  <CheckCell checked={boolValue(record[field])} disabled={!canEdit} label={field} onToggle={() => save(record, { [field]: !boolValue(record[field]) })} />
                </TableCell>
              ))}
              <TableCell><CellInput value={record.remarks} label="Remarks" disabled={!canEdit} onSave={value => save(record, { remarks: value || null })} /></TableCell>
              <TableCell>
                <CellSelect value={record.status} label="Status" disabled={!canEdit} options={[{ value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }]} onSave={value => save(record, { status: value })} />
              </TableCell>
            </tr>
          ))}
          {!view.pageItems.length && <tr><TableCell colSpan={13} className="py-8 text-center text-muted">{view.totalCount ? "No downlines match your search." : "No downlines yet."}</TableCell></tr>}
        </tbody>
      </TableShell>
    </>
  );
}

function periodRows(
  form: "monthly-target" | "activity-record-plan" | "daily-tasks",
  records: PlaybookRecord[],
  month: number,
  year: number,
): Array<Omit<PlaybookRecord, "id"> & { id?: number }> {
  const count = dayCount(month, year);
  const key = form === "monthly-target" ? "dayOfMonth" : "dayOfMonth";
  const existing = new Map(records.filter(record =>
    Number(record.dayOfMonth) >= 1 && Number(record.dayOfMonth) <= count,
  ).map(record => [Number(record[key]), record]));
  return Array.from({ length: count }, (_, index) => {
    const day = index + 1;
    const record = existing.get(day);
    if (record) return record;
    if (form === "monthly-target") {
      return { dayOfMonth: day, targetMonth: month, targetYear: year, targetIncome: null, targetRecruit: null, targetRo: null, rankCode: null, effort: null, statusId: null };
    }
    if (form === "activity-record-plan") {
      return { dayOfMonth: day, planMonth: month, planYear: year, activity: "", statusId: null };
    }
    return { dayOfMonth: day, taskMonth: month, taskYear: year, learn: false, videoOnboarding: false, consumeProduct: false, repeatOrder: false, attendZoom: false, contactUpline: false, sponsoring: false };
  });
}

function dayRowClass(day: number, month: number, year: number) {
  const rowDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return cn(
    "transition-colors hover:bg-[#eadcf1] focus-within:bg-[#e7d8ef]",
    rowDate < today ? "bg-[#fbf6fd]" : "bg-white",
  );
}

function MonthlyTargetTable({
  records, catalogs, period, canAdd, canEdit, pending, save,
}: {
  records: PlaybookRecord[];
  catalogs: PlaybookCatalogs;
  period: { month: number; year: number };
  canAdd: boolean;
  canEdit: boolean;
  pending: boolean;
  save: (row: Record<string, unknown>, patch: Record<string, unknown>) => void;
}) {
  const rows = periodRows("monthly-target", records, period.month, period.year);
  const view = useTableView(rows);
  return (
    <>
      <TableControls label="monthly targets" view={view} exportHref={playbookExportHref("monthly-target", period, view.search)} />
      <TableShell minWidth="min-w-[1000px]">
        <thead>
          <tr>
            <TableHead rowSpan={2}>Tanggal</TableHead>
            <TableHead colSpan={3}>Target</TableHead>
            <TableHead rowSpan={2}>Peringkat / Rank</TableHead>
            <TableHead rowSpan={2}>Usaha yang dilakukan</TableHead>
            <TableHead rowSpan={2}>Status</TableHead>
          </tr>
          <tr><TableHead>Pendapatan / Income</TableHead><TableHead>Rekrut / Recruit</TableHead><TableHead>RO</TableHead></tr>
        </thead>
        <tbody>
        {view.pageItems.map(row => {
          const day = Number(row.dayOfMonth);
          const patch = (field: string, value: unknown) => save(row, { [field]: value });
          const disabled = pending || !(canEdit || (!row.id && canAdd));
          return (
            <tr key={day} className={dayRowClass(day, period.month, period.year)}>
              <TableCell className="text-right tabular-nums">{day}</TableCell>
              {(["targetIncome", "targetRecruit", "targetRo"] as const).map(field => (
                <TableCell key={field}><CellInput type="number" value={row[field]} label={`${field} day ${day}`} disabled={disabled} onSave={value => patch(field, value === "" ? null : Number(value))} /></TableCell>
              ))}
              <TableCell><CellSelect value={row.rankCode} label={`Rank day ${day}`} disabled={disabled} options={catalogs.ranks.map(rank => ({ value: rank.code, label: rank.name }))} onSave={value => patch("rankCode", value || null)} /></TableCell>
              <TableCell><CellInput value={row.effort} label={`Activity day ${day}`} disabled={disabled} onSave={value => patch("effort", value || null)} /></TableCell>
              <TableCell><CellSelect value={row.statusId} label={`Status day ${day}`} disabled={disabled} options={catalogs.statuses.map(status => ({ value: String(status.id), label: status.name }))} onSave={value => patch("statusId", value ? Number(value) : null)} /></TableCell>
            </tr>
          );
        })}
        {!view.pageItems.length && <tr><TableCell colSpan={7} className="py-8 text-center text-muted">No monthly target dates match your search.</TableCell></tr>}
        </tbody>
      </TableShell>
    </>
  );
}

function ActivityPlanTable({
  records, catalogs, period, canAdd, canEdit, pending, save,
}: {
  records: PlaybookRecord[];
  catalogs: PlaybookCatalogs;
  period: { month: number; year: number };
  canAdd: boolean;
  canEdit: boolean;
  pending: boolean;
  save: (row: Record<string, unknown>, patch: Record<string, unknown>) => void;
}) {
  const rows = periodRows("activity-record-plan", records, period.month, period.year);
  const view = useTableView(rows);
  return (
    <>
      <TableControls label="activity plans" view={view} exportHref={playbookExportHref("activity-record-plan", period, view.search)} />
      <TableShell minWidth="min-w-[740px]">
        <thead><tr><TableHead>Tanggal</TableHead><TableHead>Rencana Aktivitas / Plan Activities</TableHead><TableHead>Status</TableHead></tr></thead>
        <tbody>
        {view.pageItems.map(row => {
          const day = Number(row.dayOfMonth);
          const disabled = pending || !(canEdit || (!row.id && canAdd));
          return (
            <tr key={day} className={dayRowClass(day, period.month, period.year)}>
              <TableCell className="w-14 text-right tabular-nums">{day}</TableCell>
              <TableCell><CellInput value={row.activity} label={`Plan day ${day}`} disabled={disabled} onSave={value => save(row, { activity: value || null })} /></TableCell>
              <TableCell className="w-48"><CellSelect value={row.statusId} label={`Status day ${day}`} disabled={disabled} options={catalogs.statuses.map(status => ({ value: String(status.id), label: status.name }))} onSave={value => save(row, { statusId: value ? Number(value) : null })} /></TableCell>
            </tr>
          );
        })}
        {!view.pageItems.length && <tr><TableCell colSpan={3} className="py-8 text-center text-muted">No activity plan dates match your search.</TableCell></tr>}
        </tbody>
      </TableShell>
    </>
  );
}

const dailyFields = [
  ["learn", "1 / Belajar"],
  ["videoOnboarding", "2 / Video onboarding"],
  ["consumeProduct", "3 / Konsumsi produk"],
  ["repeatOrder", "4 / Repeat Order"],
  ["attendZoom", "5 / Attend meeting zoom"],
  ["contactUpline", "6 / Kontak upline"],
  ["sponsoring", "7 / Sponsoring"],
] as const;

function DailyTasksTable({
  records, period, canAdd, canEdit, pending, save,
}: {
  records: PlaybookRecord[];
  period: { month: number; year: number };
  canAdd: boolean;
  canEdit: boolean;
  pending: boolean;
  save: (row: Record<string, unknown>, patch: Record<string, unknown>) => void;
}) {
  const rows = periodRows("daily-tasks", records, period.month, period.year);
  const view = useTableView(rows);
  return (
    <>
      <TableControls label="daily task dates" view={view} exportHref={playbookExportHref("daily-tasks", period, view.search)} />
      <TableShell minWidth="min-w-[900px]">
        <thead><tr><TableHead>Tanggal</TableHead>{dailyFields.map(([, label]) => <TableHead key={label}>{label}</TableHead>)}</tr></thead>
        <tbody>
        {view.pageItems.map(row => {
          const day = Number(row.dayOfMonth);
          const disabled = pending || !(canEdit || (!row.id && canAdd));
          return (
            <tr key={day} className={dayRowClass(day, period.month, period.year)}>
              <TableCell className="text-right tabular-nums">{String(day).padStart(2, "0")}</TableCell>
              {dailyFields.map(([field, label]) => (
                <TableCell key={field} className="text-center">
                  <CheckCell checked={boolValue(row[field])} disabled={disabled} label={`${label}, day ${day}`} onToggle={() => save(row, { [field]: !boolValue(row[field]) })} />
                </TableCell>
              ))}
            </tr>
          );
        })}
        {!view.pageItems.length && <tr><TableCell colSpan={8} className="py-8 text-center text-muted">No daily task dates match your search.</TableCell></tr>}
        </tbody>
      </TableShell>
    </>
  );
}

function SideVolumeTable({
  records, products, year, canAdd, canEdit, pending, save,
}: {
  records: PlaybookRecord[];
  products: PlaybookCatalogs["products"];
  year: number;
  canAdd: boolean;
  canEdit: boolean;
  pending: boolean;
  save: (row: Record<string, unknown>, patch: Record<string, unknown>) => void;
}) {
  const indexed = new Map(records.map(record => [
    `${String(record.productCode)}:${Number(record.targetMonth)}`,
    record,
  ]));
  const view = useTableView(products, product => `${product.code} ${product.name}`);
  const yearRecords = Array.from({ length: 12 }, (_, index) => index + 1);
  return (
    <>
      <TableControls label="products" view={view} exportHref={playbookExportHref("monthly-side-volume", { year }, view.search)} />
      <TableShell minWidth="min-w-[2200px]">
        <thead>
          <tr>
            <TableHead rowSpan={2}>Produk</TableHead>
            {yearRecords.map(month => (
              <TableHead key={month} colSpan={2}>
                {monthNames[month - 1]} {year}
              </TableHead>
            ))}
            <TableHead colSpan={2}>Total {year}</TableHead>
          </tr>
          <tr>
            {yearRecords.flatMap(month => [
              <TableHead key={`${month}-target`}>Target</TableHead>,
              <TableHead key={`${month}-actual`}>Actual</TableHead>,
            ])}
            <TableHead>Target</TableHead>
            <TableHead>Actual</TableHead>
          </tr>
        </thead>
        <tbody>
          {view.pageItems.map((product, productIndex) => {
            let totalTarget = 0;
            let totalActual = 0;
            return (
              <tr key={product.code} className="bg-white">
                <TableCell className="font-medium text-slate-800">
                  {view.startIndex + productIndex + 1}. {product.name}
                </TableCell>
                {yearRecords.flatMap(month => {
                  const row: Omit<PlaybookRecord, "id"> & { id?: number } = indexed.get(`${product.code}:${month}`) ?? {
                    targetMonth: month,
                    targetYear: year,
                    productCode: product.code,
                    targetValue: null,
                    actualValue: null,
                  };
                  const targetValue = row.targetValue == null ? null : Number(row.targetValue);
                  const actualValue = row.actualValue == null ? null : Number(row.actualValue);
                  totalTarget += targetValue ?? 0;
                  totalActual += actualValue ?? 0;
                  const disabled = pending || !(canEdit || (!row.id && canAdd));
                  return [
                    <TableCell key={`${month}-target`}>
                      <CellInput
                        type="number"
                        value={row.targetValue}
                        label={`${product.name} ${monthNames[month - 1]} ${year} target`}
                        disabled={disabled}
                        onSave={value => save(row, { targetValue: value === "" ? null : Number(value) })}
                      />
                    </TableCell>,
                    <TableCell key={`${month}-actual`}>
                      <CellInput
                        type="number"
                        value={row.actualValue}
                        label={`${product.name} ${monthNames[month - 1]} ${year} actual`}
                        disabled={disabled}
                        onSave={value => save(row, { actualValue: value === "" ? null : Number(value) })}
                      />
                    </TableCell>,
                  ];
                })}
                <TableCell className="bg-[#f3eaf7] font-semibold">{totalTarget}</TableCell>
                <TableCell className="bg-[#f3eaf7] font-semibold">{totalActual}</TableCell>
              </tr>
            );
          })}
          {!view.pageItems.length && <tr><TableCell colSpan={27} className="py-8 text-center text-muted">{view.totalCount ? "No products match your search." : "No active products are configured."}</TableCell></tr>}
        </tbody>
      </TableShell>
    </>
  );
}

function CustomerTable({
  records, products, canEdit, pending, save,
}: {
  records: PlaybookRecord[];
  products: PlaybookCatalogs["products"];
  canEdit: boolean;
  pending: boolean;
  save: (row: Record<string, unknown>, patch: Record<string, unknown>) => void;
}) {
  const view = useTableView(records);
  return (
    <>
      <TableControls label="customers" view={view} exportHref={playbookExportHref("customer-list", undefined, view.search)} />
      <TableShell minWidth="min-w-[1150px]">
        <thead><tr>{["No.", "Name", "No. Handphone", "Birth Date", "Products", "Order Date", "Remarks / Catatan", "Status"].map(label => <TableHead key={label}>{label}</TableHead>)}</tr></thead>
        <tbody>
        {view.pageItems.map((record, index) => {
          const selected = Array.isArray(record.productCodes) ? record.productCodes.map(String) : [];
          return (
            <tr key={record.id} className="bg-white transition-colors hover:bg-[#f5eff8] focus-within:bg-[#efe4f5]">
              <TableCell>{view.startIndex + index + 1}</TableCell>
              <TableCell><CellInput value={record.name} label="Customer name" disabled={!canEdit || pending} onSave={value => save(record, { name: value })} /></TableCell>
              <TableCell><CellInput value={record.phoneNumber} label="Phone number" disabled={!canEdit || pending} onSave={value => save(record, { phoneNumber: value || null })} /></TableCell>
              <TableCell><CellInput type="date" value={record.birthDate} label="Birth date" disabled={!canEdit || pending} onSave={value => save(record, { birthDate: value || null })} /></TableCell>
              <TableCell>
                <div className="grid grid-cols-2 gap-x-2">
                  {products.map(product => (
                    <label key={product.code} className="flex items-center gap-1 whitespace-nowrap text-[10px]">
                      <input
                        type="checkbox"
                        checked={selected.includes(product.code)}
                        disabled={!canEdit || pending}
                        onChange={event => save(record, { productCodes: event.target.checked ? [...selected, product.code] : selected.filter(code => code !== product.code) })}
                        className="size-3.5 accent-[#4A2260]"
                      />
                      {product.name}
                    </label>
                  ))}
                </div>
              </TableCell>
              <TableCell><CellInput type="date" value={record.orderDate} label="Order date" disabled={!canEdit || pending} onSave={value => save(record, { orderDate: value || null })} /></TableCell>
              <TableCell><CellInput value={record.notes} label="Remarks" disabled={!canEdit || pending} onSave={value => save(record, { notes: value || null })} /></TableCell>
              <TableCell><CellSelect value={record.status} label="Customer status" disabled={!canEdit || pending} options={[{ value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }]} onSave={value => save(record, { status: value })} /></TableCell>
            </tr>
          );
        })}
        {!view.pageItems.length && <tr><TableCell colSpan={8} className="py-8 text-center text-muted">{view.totalCount ? "No customers match your search." : "No customers yet."}</TableCell></tr>}
        </tbody>
      </TableShell>
    </>
  );
}

function ProspectTable({
  records, canEdit, pending, save,
}: {
  records: PlaybookRecord[];
  canEdit: boolean;
  pending: boolean;
  save: (row: Record<string, unknown>, patch: Record<string, unknown>) => void;
}) {
  const responseOptions = ["Baik", "Kurang Baik", "Tidak Baik"].map(value => ({ value, label: value }));
  const view = useTableView(records);
  return (
    <>
      <TableControls label="prospects" view={view} exportHref={playbookExportHref("prospect-list", undefined, view.search)} />
      <TableShell minWidth="min-w-[1300px]">
        <thead><tr>{["No.", "Name", "No. Handphone", "Domicile", "Job / Profession", "Date", "Response", "Remarks / Catatan", "Follow-up", "Follow-up Date"].map(label => <TableHead key={label}>{label}</TableHead>)}</tr></thead>
        <tbody>
        {view.pageItems.map((record, index) => (
          <tr key={record.id} className="bg-white transition-colors hover:bg-[#f5eff8] focus-within:bg-[#efe4f5]">
            <TableCell>{view.startIndex + index + 1}</TableCell>
            <TableCell><CellInput value={record.name} label="Prospect name" disabled={!canEdit || pending} onSave={value => save(record, { name: value })} /></TableCell>
            <TableCell><CellInput value={record.phoneNumber} label="Phone number" disabled={!canEdit || pending} onSave={value => save(record, { phoneNumber: value || null })} /></TableCell>
            <TableCell><CellInput value={record.domicile} label="Domicile" disabled={!canEdit || pending} onSave={value => save(record, { domicile: value || null })} /></TableCell>
            <TableCell><CellInput value={record.occupation} label="Job / profession" disabled={!canEdit || pending} onSave={value => save(record, { occupation: value || null })} /></TableCell>
            <TableCell><CellInput type="date" value={record.prospectDate} label="Prospect date" disabled={!canEdit || pending} onSave={value => save(record, { prospectDate: value || null })} /></TableCell>
            <TableCell><CellSelect value={record.response} label="Response" disabled={!canEdit || pending} options={responseOptions} onSave={value => save(record, { response: value || null })} /></TableCell>
            <TableCell><CellInput value={record.reason} label="Remarks" disabled={!canEdit || pending} onSave={value => save(record, { reason: value || null })} /></TableCell>
            <TableCell className="text-center">
              <CheckCell checked={boolValue(record.followUp)} disabled={!canEdit || pending} label={`Follow-up ${index + 1}`} onToggle={() => save(record, { followUp: !boolValue(record.followUp) })} />
            </TableCell>
            <TableCell><CellInput type="date" value={record.followUpDate} label="Follow-up date" disabled={!canEdit || pending} onSave={value => save(record, { followUpDate: value || null })} /></TableCell>
          </tr>
        ))}
        {!view.pageItems.length && <tr><TableCell colSpan={10} className="py-8 text-center text-muted">{view.totalCount ? "No prospects match your search." : "No prospects yet."}</TableCell></tr>}
        </tbody>
      </TableShell>
    </>
  );
}
