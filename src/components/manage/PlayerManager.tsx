import { useEffect, useState, useCallback } from "react";
import { query } from "@/lib/turso";
import { toast } from "sonner";
import { Plus, Pencil, X, Search, Trash2, RotateCcw } from "lucide-react";

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string | null;
  phone: string | null;
  total_points: number;
  total_wins: number;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
}

const emptyForm = { first_name: "", last_name: "", preferred_name: "", email: "", phone: "" };

type ViewMode = "active" | "deleted";

interface PlayerManagerProps {
  onProfilesChanged?: () => void;
}

const PlayerManager = ({ onProfilesChanged }: PlayerManagerProps = {}) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    try {
      const isDeleted = viewMode === "deleted" ? 1 : 0;
      const result = await query(
        'SELECT * FROM players WHERE is_deleted = ? ORDER BY first_name ASC',
        [isDeleted]
      );
      setPlayers(result.rows.map((r: any) => ({
        id: r.id,
        first_name: r.first_name,
        last_name: r.last_name,
        preferred_name: r.preferred_name,
        email: r.email,
        phone: r.phone,
        total_points: Number(r.total_points),
        total_wins: Number(r.total_wins),
        is_deleted: !!r.is_deleted,
        deleted_at: r.deleted_at,
        created_at: r.created_at,
      })));
    } catch (err) {
      console.error("Failed to load players:", err);
    }
    setLoading(false);
  }, [viewMode]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  const selected = players.find((p) => p.id === selectedId) || null;

  const filtered = players.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.first_name.toLowerCase().includes(q) ||
      p.last_name.toLowerCase().includes(q) ||
      (p.preferred_name && p.preferred_name.toLowerCase().includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q))
    );
  });

  const getDisplayName = (p: Player) =>
    p.preferred_name || `${p.first_name} ${p.last_name}`;

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (player: Player) => {
    setForm({
      first_name: player.first_name,
      last_name: player.last_name,
      preferred_name: player.preferred_name || "",
      email: player.email || "",
      phone: player.phone || "",
    });
    setEditingId(player.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("First name and last name are required");
      return;
    }
    setSaving(true);

    try {
      if (editingId) {
        await query(
          'UPDATE players SET first_name = ?, last_name = ?, preferred_name = ?, email = ?, phone = ? WHERE id = ?',
          [
            form.first_name.trim(),
            form.last_name.trim(),
            form.preferred_name.trim() || null,
            form.email.trim().toLowerCase() || null,
            form.phone.trim() || null,
            editingId,
          ]
        );
        toast.success("Player updated");
        closeForm();
        fetchPlayers();
        onProfilesChanged?.();
      } else {
        await query(
          'INSERT INTO players (first_name, last_name, preferred_name, email, phone) VALUES (?, ?, ?, ?, ?)',
          [
            form.first_name.trim(),
            form.last_name.trim(),
            form.preferred_name.trim() || null,
            form.email.trim().toLowerCase() || null,
            form.phone.trim() || null,
          ]
        );
        toast.success("Player created");
        closeForm();
        fetchPlayers();
        onProfilesChanged?.();
      }
    } catch (err: any) {
      if (err.message?.includes("UNIQUE") || err.message?.includes("unique")) {
        toast.error("A player with that email already exists");
      } else {
        toast.error("Failed to save: " + (err.message || "Unknown error"));
      }
    }
    setSaving(false);
  };

  const handleSoftDelete = async (player: Player) => {
    if (confirmDeleteId !== player.id) {
      setConfirmDeleteId(player.id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }

    try {
      await query(
        'UPDATE players SET is_deleted = 1, deleted_at = datetime("now") WHERE id = ?',
        [player.id]
      );
      toast.success(`${getDisplayName(player)} deleted`);
      setConfirmDeleteId(null);
      setSelectedId(null);
      fetchPlayers();
      onProfilesChanged?.();
    } catch (err: any) {
      toast.error("Failed to delete: " + err.message);
    }
  };

  const handleRestore = async (player: Player) => {
    try {
      await query(
        'UPDATE players SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL WHERE id = ?',
        [player.id]
      );
      toast.success(`${getDisplayName(player)} restored`);
      setSelectedId(null);
      fetchPlayers();
      onProfilesChanged?.();
    } catch (err: any) {
      toast.error("Failed to restore: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground text-base animate-pulse">Loading players...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl text-accent">Player Profiles</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {players.length} {viewMode === "active" ? "active" : "deleted"} player{players.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {viewMode === "active" && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/80 transition-colors min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              New Player
            </button>
          )}
        </div>
      </div>

      {/* Active / Deleted toggle */}
      <div className="flex rounded-lg border border-border overflow-hidden w-fit">
        <button
          onClick={() => { setViewMode("active"); setSelectedId(null); }}
          className={`px-5 py-2.5 text-sm font-medium transition-colors ${
            viewMode === "active"
              ? "bg-accent text-accent-foreground"
              : "bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          Active
        </button>
        <button
          onClick={() => { setViewMode("deleted"); setSelectedId(null); }}
          className={`px-5 py-2.5 text-sm font-medium transition-colors ${
            viewMode === "deleted"
              ? "bg-accent text-accent-foreground"
              : "bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          Deleted
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search players by name or email..."
          className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>

      {/* Player List */}
      <div className="rounded-lg border border-border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            {search
              ? "No players match your search"
              : viewMode === "deleted"
              ? "No deleted players"
              : "No players yet — create one above"}
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {filtered.map((player) => (
              <button
                key={player.id}
                onClick={() => setSelectedId(selectedId === player.id ? null : player.id)}
                className={`w-full text-left px-4 py-3.5 flex items-center justify-between transition-colors hover:bg-muted/30 ${
                  selectedId === player.id ? "bg-accent/5 border-l-2 border-l-accent" : ""
                }`}
              >
                <div>
                  <span className="font-medium text-foreground">
                    {player.preferred_name || player.first_name} {player.last_name}
                  </span>
                  {player.preferred_name && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({player.first_name} {player.last_name})
                    </span>
                  )}
                  {player.email && <p className="text-xs text-muted-foreground mt-0.5">{player.email}</p>}
                  {viewMode === "deleted" && player.deleted_at && (
                    <p className="text-xs text-destructive/70 mt-0.5">
                      Deleted {new Date(player.deleted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <div className="text-right text-sm">
                    <span className="font-semibold text-accent">{player.total_points} pts</span>
                    <span className="text-muted-foreground ml-2">{player.total_wins}W</span>
                  </div>
                  {viewMode === "deleted" ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRestore(player); }}
                      className="p-2 text-green-500 hover:text-green-400 transition-colors"
                      title="Restore player"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSoftDelete(player); }}
                      className={`p-2 transition-colors ${
                        confirmDeleteId === player.id
                          ? "text-destructive animate-pulse"
                          : "text-muted-foreground hover:text-destructive"
                      }`}
                      title={confirmDeleteId === player.id ? "Click again to confirm" : "Delete player"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Player Detail */}
      {selected && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-display text-xl text-foreground">
                {selected.preferred_name || selected.first_name} {selected.last_name}
              </h3>
              {selected.email && <p className="text-sm text-muted-foreground">{selected.email}</p>}
              {selected.phone && <p className="text-sm text-muted-foreground">{selected.phone}</p>}
            </div>
            <div className="flex gap-2">
              {viewMode === "active" && (
                <button
                  onClick={() => openEdit(selected)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted/30 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              )}
              {viewMode === "deleted" && (
                <button
                  onClick={() => handleRestore(selected)}
                  className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-500 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restore
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Points</p>
              <p className="text-2xl font-bold text-accent mt-1">{selected.total_points}</p>
            </div>
            <div className="rounded-lg bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Wins</p>
              <p className="text-2xl font-bold text-foreground mt-1">{selected.total_wins}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Created {new Date(selected.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {selected.deleted_at && (
              <span className="text-destructive/70 ml-2">
                · Deleted {new Date(selected.deleted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl text-foreground">
                {editingId ? "Edit Player" : "New Player"}
              </h3>
              <button onClick={closeForm} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    First Name *
                  </label>
                  <input
                    value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Last Name *
                  </label>
                  <input
                    value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Preferred Name
                </label>
                <input
                  value={form.preferred_name}
                  onChange={(e) => setForm((f) => ({ ...f, preferred_name: e.target.value }))}
                  placeholder="Display name (optional)"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Phone
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="416-555-0101"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/80 transition-colors disabled:opacity-50 min-h-[44px]"
              >
                {saving ? "Saving..." : editingId ? "Save Changes" : "Create Player"}
              </button>
              <button
                onClick={closeForm}
                className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerManager;
