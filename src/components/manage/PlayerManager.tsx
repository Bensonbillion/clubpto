import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, X, Search } from "lucide-react";

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string;
  total_points: number;
  total_wins: number;
  created_at: string;
}

const emptyForm = { first_name: "", last_name: "", preferred_name: "", email: "" };

interface PlayerManagerProps {
  onProfilesChanged?: () => void;
}

const PlayerManager = ({ onProfilesChanged }: PlayerManagerProps = {}) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchPlayers = useCallback(async () => {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .order("first_name", { ascending: true });
    if (error) {
      console.error("Failed to load players:", error);
    } else {
      setPlayers(data || []);
    }
    setLoading(false);
  }, []);

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
      email: player.email,
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

    const payload: Record<string, any> = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      preferred_name: form.preferred_name.trim() || null,
    };
    if (form.email.trim()) {
      payload.email = form.email.trim().toLowerCase();
    }

    if (editingId) {
      const { error } = await supabase.from("players").update(payload).eq("id", editingId);
      if (error) {
        toast.error("Failed to update: " + error.message);
      } else {
        toast.success("Player updated");
        closeForm();
        fetchPlayers();
        onProfilesChanged?.();
      }
    } else {
      const { error } = await supabase.from("players").insert(payload);
      if (error) {
        if (error.message.includes("duplicate")) {
          toast.error("A player with that email already exists");
        } else {
          toast.error("Failed to create: " + error.message);
        }
      } else {
        toast.success("Player created");
        closeForm();
        fetchPlayers();
        onProfilesChanged?.();
      }
    }
    setSaving(false);
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
          <p className="text-sm text-muted-foreground mt-1">{players.length} player{players.length !== 1 ? "s" : ""} registered</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/80 transition-colors min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          New Player
        </button>
      </div>

      {/* Search + Dropdown */}
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
            {search ? "No players match your search" : "No players yet — create one above"}
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
                </div>
                <div className="text-right text-sm shrink-0 ml-4">
                  <span className="font-semibold text-accent">{player.total_points} pts</span>
                  <span className="text-muted-foreground ml-2">{player.total_wins}W</span>
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
            </div>
            <button
              onClick={() => openEdit(selected)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted/30 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
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
