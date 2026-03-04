import { useState, useRef } from "react";
import { query } from "@/lib/turso";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle2, XCircle, AlertTriangle, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

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

  // Normalize headers: "First Name" → "first_name"
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

const ImportPlayers = () => {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResults(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      setRows(parsed);
      if (parsed.length === 0) {
        toast.error("No valid rows found. Ensure CSV has first_name and last_name columns.");
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    const importResults: ImportResult[] = [];

    for (const row of rows) {
      try {
        // Check duplicate by email
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
            // Restore soft-deleted
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
  };

  const reset = () => {
    setRows([]);
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
    <div className="min-h-screen bg-[#1A1A1A] text-[#F5F0EB]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/admin/players" className="p-2 rounded-lg border border-[#3A3A3A] hover:border-[#C9A84C] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-display text-3xl text-[#C9A84C]">Import Players</h1>
            <p className="text-sm text-[#A8A29E] mt-1">Upload a CSV to bulk-import player profiles</p>
          </div>
        </div>

        {/* CSV format hint */}
        <div className="rounded-lg border border-[#3A3A3A] bg-[#2D2D2D] p-4 mb-6">
          <p className="text-xs uppercase tracking-wider text-[#A8A29E] mb-2">Expected CSV format</p>
          <code className="text-sm text-[#C9A84C] block">
            first_name,last_name,preferred_name,email,phone
          </code>
          <p className="text-xs text-[#A8A29E] mt-2">
            Only first_name and last_name are required. Other columns are optional.
          </p>
        </div>

        {/* File upload */}
        <div className="mb-6">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-[#3A3A3A] rounded-lg p-8 flex flex-col items-center gap-3 hover:border-[#C9A84C] transition-colors"
          >
            <Upload className="w-8 h-8 text-[#A8A29E]" />
            <span className="text-[#A8A29E]">
              {fileName ? fileName : "Click to select CSV file"}
            </span>
          </button>
        </div>

        {/* Preview */}
        {rows.length > 0 && !results && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#C9A84C]" />
                <span className="text-sm">{rows.length} players found</span>
              </div>
              <button onClick={reset} className="text-sm text-[#A8A29E] hover:text-[#F5F0EB] transition-colors">
                Clear
              </button>
            </div>

            <div className="rounded-lg border border-[#3A3A3A] overflow-hidden max-h-[300px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#2D2D2D] sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-[#A8A29E] font-medium">Name</th>
                    <th className="text-left px-3 py-2 text-[#A8A29E] font-medium">Email</th>
                    <th className="text-left px-3 py-2 text-[#A8A29E] font-medium">Phone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3A3A3A]">
                  {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-[#2D2D2D]/50">
                      <td className="px-3 py-2">
                        {row.preferred_name ? `${row.preferred_name} (${row.first_name})` : row.first_name} {row.last_name}
                      </td>
                      <td className="px-3 py-2 text-[#A8A29E]">{row.email || "—"}</td>
                      <td className="px-3 py-2 text-[#A8A29E]">{row.phone || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full rounded-lg bg-[#C9A84C] text-[#1A1A1A] py-3 font-semibold hover:bg-[#C9A84C]/80 transition-colors disabled:opacity-50"
            >
              {importing ? "Importing..." : `Import ${rows.length} Players`}
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
                <div key={s.label} className="rounded-lg border border-[#3A3A3A] bg-[#2D2D2D] p-3 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                  <p className="text-xs text-[#A8A29E]">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-[#3A3A3A] overflow-hidden max-h-[300px] overflow-y-auto">
              <div className="divide-y divide-[#3A3A3A]">
                {results.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    {statusIcon(r.status)}
                    <span className="flex-1">{r.name}</span>
                    <span className="text-xs text-[#A8A29E]">{r.message}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={reset}
              className="w-full rounded-lg border border-[#3A3A3A] py-3 text-sm hover:border-[#C9A84C] transition-colors"
            >
              Import Another File
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportPlayers;
