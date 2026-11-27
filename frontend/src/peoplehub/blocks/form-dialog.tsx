import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@/components/ui";
import { Button, Label, NativeSelect, TextArea, TextInput, cn } from "@/peoplehub/ui";
import { PEOPLE } from "@/peoplehub/mocks/people";
import type { FormConfig } from "@/peoplehub/modules/types";

const FETCH_REGISTRY: Record<string, { url: string; extract: (data: unknown) => string[] }> = {
  departments: {
    url: "/t2.0/authentificationUtilization/dept-mgmt/",
    extract: (data: unknown) => {
      const depts = (data as any)?.response?.departments;
      return Array.isArray(depts) ? depts.map((d: any) => d.name as string).filter(Boolean).sort() : [];
    },
  },
  users: {
    url: "/api/users",
    extract: (data: unknown) => {
      const list = (data as any)?.response;
      return Array.isArray(list) ? list.map((u: any) => u.Name as string).filter(Boolean).sort() : [];
    },
  },
};

export function FormDialog({ config, open, onOpenChange, onSubmit }: {
  config: FormConfig; open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (values: Record<string, string | File>) => void;
}) {
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, string[]>>({});
  const [fileNames, setFileNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const fieldsToFetch = config.fields.filter((f) => f.fetchOptions && FETCH_REGISTRY[f.fetchOptions]);
    if (!fieldsToFetch.length) return;
    const fetched: Record<string, string[]> = {};
    const token = (() => { try { return JSON.parse(localStorage.getItem("authUserLD") ?? "{}").token ?? ""; } catch { return ""; } })();
    Promise.all(
      fieldsToFetch.map(async (f) => {
        const reg = FETCH_REGISTRY[f.fetchOptions!]!;
        try {
          const res = await fetch(reg.url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          if (res.ok) fetched[f.name] = reg.extract(await res.json());
        } catch { /* keep empty */ }
      })
    ).then(() => setDynamicOptions(fetched));
  }, [open, config.fields]);

  function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const values: Record<string, string | File> = {};
    const errs: Record<string, boolean> = {};
    for (const f of config.fields) {
      const v = data.get(f.name);
      if (f.type === "file") {
        values[f.name] = v instanceof File && v.size > 0 ? v : "";
      } else {
        values[f.name] = String(v ?? "").trim();
      }
      if (f.required && !values[f.name]) errs[f.name] = true;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit(values);
    onOpenChange(false);
    setFileNames({});
  }

  const formKey = config.fields.map(f => f.defaultValue ?? "").join("|");

  return (
    <Modal isOpen={open} onOpenChange={(o) => { setErrors({}); onOpenChange(o); }} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <form key={formKey} onSubmit={handle} noValidate className="flex max-h-[90dvh] flex-col">
          <ModalHeader className="flex flex-col gap-1 border-b border-ink-200 dark:border-white/10">
            <span className="text-lg font-black uppercase tracking-title">{config.title}</span>
            {config.description && <span className="text-sm font-normal text-ink-500">{config.description}</span>}
          </ModalHeader>
          <ModalBody className="grid gap-4 py-5 sm:grid-cols-2">
            {config.fields.map((f) => {
              const id = `f-${f.name}`;
              const invalid = errors[f.name];
              return (
                <div key={f.name} className={cn("space-y-1.5", (f.full || f.type === "textarea" || f.type === "file") && "sm:col-span-2")}>
                  <Label htmlFor={id}>{f.label}{f.required && <span className="text-rose-600"> *</span>}</Label>
                  {f.type === "select" || f.type === "person" ? (
                    <NativeSelect id={id} name={f.name} defaultValue={f.defaultValue ?? ""} aria-invalid={invalid} className={invalid ? "border-rose-500" : undefined}>
                      <option value="" disabled>{f.placeholder ?? "Select…"}</option>
                      {(f.type === "person" ? PEOPLE.map((p) => p.name) : (dynamicOptions[f.name] ?? f.options ?? [])).map((o) => <option key={o}>{o}</option>)}
                    </NativeSelect>
                  ) : f.type === "textarea" ? (
                    <TextArea id={id} name={f.name} placeholder={f.placeholder} rows={3} aria-invalid={invalid} className={invalid ? "border-rose-500" : undefined} defaultValue={f.defaultValue ?? ""} />
                  ) : f.type === "file" ? (
                    <label htmlFor={id} className={cn("flex cursor-pointer flex-col items-center gap-1 border border-dashed px-4 py-6 text-center transition-colors", fileNames[f.name] ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-ink-300 bg-ink-50 hover:bg-ink-100 dark:border-white/15 dark:bg-white/[0.03]")}>
                      <Upload className={cn("size-5", fileNames[f.name] ? "text-brand-600" : "text-ink-500")} />
                      {fileNames[f.name] ? (
                        <span className="text-sm font-semibold text-brand-600 break-all">{fileNames[f.name]}</span>
                      ) : (
                        <span className="text-sm font-medium">Click to upload</span>
                      )}
                      <span className="text-xs text-ink-500">{f.hint ?? "PDF, JPG or PNG up to 5 MB"}</span>
                      <input id={id} name={f.name} type="file" className="sr-only"
                        accept={f.accept}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && f.accept) {
                            const ext = "." + file.name.split(".").pop()?.toLowerCase();
                            const allowed = f.accept.split(",").map(a => a.trim().toLowerCase());
                            if (!allowed.includes(ext)) {
                              e.target.value = "";
                              setFileNames(prev => ({ ...prev, [f.name]: "" }));
                              return;
                            }
                          }
                          setFileNames(prev => ({ ...prev, [f.name]: file?.name ?? "" }));
                        }} />
                    </label>
                  ) : (
                    <TextInput id={id} name={f.name} type={f.type} placeholder={f.placeholder} aria-invalid={invalid} min={f.type === "number" ? 0 : undefined} className={invalid ? "border-rose-500" : undefined} defaultValue={f.defaultValue ?? ""} />
                  )}
                  {invalid ? <p className="text-xs text-rose-600">{f.label} is required</p> : f.hint && f.type !== "file" && <p className="text-xs text-ink-500">{f.hint}</p>}
                </div>
              );
            })}
          </ModalBody>
          <ModalFooter className="border-t border-ink-200 dark:border-white/10">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{config.submitLabel ?? "Submit"}</Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
