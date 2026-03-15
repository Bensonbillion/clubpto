import { useState, useRef } from "react";
import { query } from "@/lib/turso";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface CsvRow {
  first_name: string;
  last_name: string;
  preferred_name?: string;
  email?: string;
  phone?: string;
}

interface ImportResult {
  name: string;
  status: "created" | "restored" | "duplicate" | "error";
  message: string;
}

interface CsvImportProps {
  onImportComplete?: () => void;
}

function parseQuotedCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function cleanPhone(raw: string): string {
  if (!raw) return "";
  return raw.replace(/^['"]+/g, "").replace(/['"]+$/g, "").trim();
}

function cleanEmail(raw: string): string {
  if (!raw) return "";
  return raw.split(",")[0].trim().toLowerCase();
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];

  const rawHeaders = parseQuotedCsvLine(lines[0]);
  const headers = rawHeaders.map((h) => h.toLowerCase().replace(/\s+/g, "_"));

  const firstIdx = headers.indexOf("first_name");
  const lastIdx = headers.indexOf("last_name");
  if (firstIdx === -1 || lastIdx === -1) return [];

  const prefIdx = headers.indexOf("preferred_name");
  const emailIdx = headers.indexOf("email");
  const phoneIdx = headers.indexOf("phone");

  return lines.slice(1).map((line) => {
    const cols = parseQuotedCsvLine(line);
    return {
      first_name: (cols[firstIdx] || "").trim(),
      last_name: (cols[lastIdx] || "").trim(),
      preferred_name: prefIdx >= 0 ? (cols[prefIdx] || "").trim() || undefined : undefined,
      email: emailIdx >= 0 ? cleanEmail(cols[emailIdx]) || undefined : undefined,
      phone: phoneIdx >= 0 ? cleanPhone(cols[phoneIdx]) || undefined : undefined,
    };
  }).filter((r) => r.first_name && r.last_name);
}

/** Deduplicate rows by email — keep the row with the longest combined name */
function dedup(rows: CsvRow[]): { unique: CsvRow[]; removedCount: number } {
  const byEmail = new Map<string, CsvRow[]>();
  const noEmail: CsvRow[] = [];

  for (const row of rows) {
    if (!row.email) {
      noEmail.push(row);
      continue;
    }
    const key = row.email.toLowerCase();
    const group = byEmail.get(key);
    if (group) {
      group.push(row);
    } else {
      byEmail.set(key, [row]);
    }
  }

  const unique: CsvRow[] = [...noEmail];
  for (const group of byEmail.values()) {
    // Keep the row with the longest combined name (most complete, not abbreviated)
    const best = group.reduce((a, b) =>
      (a.first_name.length + a.last_name.length) >= (b.first_name.length + b.last_name.length) ? a : b
    );
    unique.push(best);
  }

  return { unique, removedCount: rows.length - unique.length };
}

const CsvImport = ({ onImportComplete }: CsvImportProps) => {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [existingEmails, setExistingEmails] = useState<Set<string>>(new Set());
  const [rawCount, setRawCount] = useState(0);
  const [dedupCount, setDedupCount] = useState(0);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const newRows = rows.filter((r) => !r.email || !existingEmails.has(r.email));
  const existingRows = rows.filter((r) => r.email && existingEmails.has(r.email));

  const checkExisting = async (unique: CsvRow[]) => {
    setChecking(true);
    try {
      const result = await query(
        'SELECT email FROM players WHERE is_deleted = 0 AND email IS NOT NULL'
      );
      const dbEmails = new Set(
        (result.rows as any[]).map((r: any) => (r.email as string).toLowerCase())
      );
      setExistingEmails(dbEmails);
    } catch (err) {
      console.error("Failed to check existing players:", err);
    } finally {
      setChecking(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a .csv file");
      return;
    }
    setFileName(file.name);
    setResults(null);
    setExistingEmails(new Set());

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      setRawCount(parsed.length);
      const { unique, removedCount } = dedup(parsed);
      setDedupCount(removedCount);
      setRows(unique);
      if (unique.length === 0) {
        toast.error("No valid rows found. Ensure CSV has first_name and last_name columns.");
        return;
      }
      await checkExisting(unique);
    };
    reader.readAsText(file);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleImport = async () => {
    if (newRows.length === 0) return;
    setImporting(true);
    const importResults: ImportResult[] = [];

    for (const row of newRows) {
      try {
        // Double-check against DB (handles soft-deleted players)
        if (row.email) {
          const existing = await query(
            "SELECT id, is_deleted FROM players WHERE email = ? LIMIT 1",
            [row.email.toLowerCase()]
          );

          if (existing.rows.length > 0) {
            const player = existing.rows[0] as any;
            if (!player.is_deleted) {
              importResults.push({ name: `${row.first_name} ${row.last_name}`, status: "duplicate", message: "Already exists" });
              continue;
            }
            await query(
              'UPDATE players SET first_name = ?, last_name = ?, preferred_name = ?, phone = ?, is_deleted = 0, deleted_at = NULL WHERE id = ?',
              [row.first_name, row.last_name, row.preferred_name || null, row.phone || null, player.id]
            );
            importResults.push({ name: `${row.first_name} ${row.last_name}`, status: "restored", message: "Restored from deleted" });
            continue;
          }
        }

        await query(
          "INSERT INTO players (first_name, last_name, preferred_name, email, phone) VALUES (?, ?, ?, ?, ?)",
          [row.first_name, row.last_name, row.preferred_name || null, row.email ? row.email.toLowerCase() : null, row.phone || null]
        );
        importResults.push({ name: `${row.first_name} ${row.last_name}`, status: "created", message: "Created" });
      } catch (err: any) {
        importResults.push({ name: `${row.first_name} ${row.last_name}`, status: "error", message: err.message || "Unknown error" });
      }
    }

    setResults(importResults);
    setImporting(false);

    const created = importResults.filter((r) => r.status === "created").length;
    const restored = importResults.filter((r) => r.status === "restored").length;
    toast.success(`Import complete: ${created} created, ${restored} restored`);
    onImportComplete?.();
  };

  const reset = () => {
    setRows([]);
    setExistingEmails(new Set());
    setRawCount(0);
    setDedupCount(0);
    setFileName("");
    setResults(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const statusIcon = (status: ImportResult["status"]) => {
    switch (status) {
      case "created": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "restored": return <CheckCircle2 className="w-4 h-4 text-blue-400" />;
      case "duplicate": return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "error": return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <div className="space-y-5">
      {/* CSV format hint */}
      <div className="rounded-lg border border-border bg-muted p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Expected CSV format</p>
        <code className="text-sm text-accent block">
          first_name,last_name,preferred_name,email,phone
        </code>
        <p className="text-xs text-muted-foreground mt-2">
          Only first_name and last_name are required. Duplicates by email are automatically removed.
        </p>
      </div>

      {/* File upload */}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={handleFile}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`w-full border-2 border-dashed rounded-lg p-8 flex flex-col items-center gap-3 transition-colors ${
            dragging ? "border-accent bg-accent/10" : "border-border hover:border-accent"
          }`}
        >
          <Upload className={`w-8 h-8 ${dragging ? "text-accent" : "text-muted-foreground"}`} />
          <span className={dragging ? "text-accent" : "text-muted-foreground"}>
            {dragging ? "Drop CSV file here" : fileName ? fileName : "Click or drag & drop CSV file"}
          </span>
        </button>
      </div>

      {/* Preview */}
      {rows.length > 0 && !results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              <span className="text-sm">
                {rows.length} unique player{rows.length !== 1 ? "s" : ""}
                {dedupCount > 0 && (
                  <span className="text-muted-foreground"> ({dedupCount} duplicate{dedupCount !== 1 ? "s" : ""} removed from CSV)</span>
                )}
              </span>
            </div>
            <button onClick={reset} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Clear
            </button>
          </div>

          {/* Existing vs new summary */}
          {!checking && existingEmails.size > 0 && (
            <div className="flex gap-3">
              <div className="flex-1 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-center">
                <p className="text-xl font-bold text-green-500">{newRows.length}</p>
                <p className="text-xs text-muted-foreground">New players</p>
              </div>
              <div className="flex-1 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-center">
                <p className="text-xl font-bold text-yellow-500">{existingRows.length}</p>
                <p className="text-xs text-muted-foreground">Already registered</p>
              </div>
            </div>
          )}
          {checking && (
            <p className="text-sm text-muted-foreground">Checking for existing profiles...</p>
          )}

          <div className="rounded-lg border border-border overflow-hidden max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Name</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Email</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, i) => {
                  const isExisting = row.email && existingEmails.has(row.email);
                  return (
                    <tr key={i} className={`hover:bg-muted/50 ${isExisting ? "opacity-50" : ""}`}>
                      <td className="px-3 py-2">
                        {row.preferred_name ? `${row.preferred_name} (${row.first_name})` : row.first_name} {row.last_name}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{row.email || "—"}</td>
                      <td className="px-3 py-2">
                        {isExisting ? (
                          <span className="text-yellow-500 text-xs">Already registered</span>
                        ) : (
                          <span className="text-green-500 text-xs">New</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleImport}
            disabled={importing || checking || newRows.length === 0}
            className="w-full rounded-lg bg-accent text-accent-foreground py-3 font-semibold hover:bg-accent/80 transition-colors disabled:opacity-50"
          >
            {importing ? "Importing..." : newRows.length === 0 ? "All players already registered" : `Import ${newRows.length} New Player${newRows.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Created", count: results.filter((r) => r.status === "created").length, color: "text-green-500" },
              { label: "Restored", count: results.filter((r) => r.status === "restored").length, color: "text-blue-400" },
              { label: "Duplicates", count: results.filter((r) => r.status === "duplicate").length, color: "text-yellow-500" },
              { label: "Errors", count: results.filter((r) => r.status === "error").length, color: "text-red-500" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-muted p-3 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border overflow-hidden max-h-[300px] overflow-y-auto">
            <div className="divide-y divide-border">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  {statusIcon(r.status)}
                  <span className="flex-1">{r.name}</span>
                  <span className="text-xs text-muted-foreground">{r.message}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={reset}
            className="w-full rounded-lg border border-border py-3 text-sm hover:border-accent transition-colors"
          >
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
};

export default CsvImport;
