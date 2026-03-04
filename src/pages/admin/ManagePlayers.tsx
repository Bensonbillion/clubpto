import { Link } from "react-router-dom";
import { Upload, ArrowLeft } from "lucide-react";
import PlayerManager from "@/components/manage/PlayerManager";

const ManagePlayers = () => {
  return (
    <div className="min-h-screen bg-[#1A1A1A] text-[#F5F0EB]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/manage" className="p-2 rounded-lg border border-[#3A3A3A] hover:border-[#C9A84C] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-display text-3xl text-[#C9A84C]">Player Management</h1>
              <p className="text-sm text-[#A8A29E] mt-1">Create, edit, delete, and restore player profiles</p>
            </div>
          </div>
          <Link
            to="/admin/import"
            className="flex items-center gap-2 rounded-lg border border-[#3A3A3A] px-4 py-2.5 text-sm hover:border-[#C9A84C] transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </Link>
        </div>

        {/* Player Manager */}
        <PlayerManager />
      </div>
    </div>
  );
};

export default ManagePlayers;
