"use client";

import { useEffect, useState, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import { EXPENSE_CATEGORIES } from "@/lib/categories";
import {
  LogOut,
  Filter,
  Download,
  ChevronDown,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  X,
} from "lucide-react";
import { format } from "date-fns";

interface Receipt {
  id: string;
  created_at: string;
  image_url: string;
  vendor: string | null;
  receipt_date: string | null;
  total: number | null;
  tax: number | null;
  category: string | null;
  description: string | null;
  payment_method: string | null;
  status: string;
  reviewed: boolean;
  notes: string | null;
}

export default function DashboardPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<Partial<Receipt> | null>(null);

  const fetchReceipts = useCallback(async () => {
    let query = getSupabase()
      .from("receipts")
      .select("*")
      .order("receipt_date", { ascending: false, nullsFirst: false });

    if (categoryFilter !== "all") {
      query = query.eq("category", categoryFilter);
    }
    if (dateFrom) {
      query = query.gte("receipt_date", dateFrom);
    }
    if (dateTo) {
      query = query.lte("receipt_date", dateTo);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Fetch error:", error);
      return;
    }

    setReceipts(data || []);
    setLoading(false);
  }, [categoryFilter, dateFrom, dateTo]);

  useEffect(() => {
    // Check auth
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        window.location.href = "/login";
        return;
      }
      fetchReceipts();
    });
  }, [fetchReceipts]);

  async function handleLogout() {
    await getSupabase().auth.signOut();
    window.location.href = "/login";
  }

  async function handleSaveEdit() {
    if (!selectedReceipt || !editingReceipt) return;

    const { error } = await getSupabase()
      .from("receipts")
      .update({
        vendor: editingReceipt.vendor,
        receipt_date: editingReceipt.receipt_date,
        total: editingReceipt.total,
        category: editingReceipt.category,
        description: editingReceipt.description,
        notes: editingReceipt.notes,
        reviewed: true,
      })
      .eq("id", selectedReceipt.id);

    if (!error) {
      setSelectedReceipt(null);
      setEditingReceipt(null);
      fetchReceipts();
    }
  }

  function exportCSV() {
    const headers = ["Date", "Vendor", "Category", "Description", "Total", "Tax", "Payment Method", "Status", "Reviewed"];
    const rows = receipts.map((r) => [
      r.receipt_date || "",
      r.vendor || "",
      r.category || "",
      r.description || "",
      r.total?.toString() || "",
      r.tax?.toString() || "",
      r.payment_method || "",
      r.status,
      r.reviewed ? "Yes" : "No",
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smobooks-expenses-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalAmount = receipts
    .filter((r) => r.total != null)
    .reduce((sum, r) => sum + (r.total || 0), 0);

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "processing":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "failed":
      case "needs_review":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">SmoBooks</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-sm text-gray-500">Total Receipts</div>
            <div className="text-2xl font-bold text-gray-900">{receipts.length}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-sm text-gray-500">Total Amount</div>
            <div className="text-2xl font-bold text-gray-900">
              ${totalAmount.toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200 col-span-2 md:col-span-1">
            <div className="text-sm text-gray-500">Needs Review</div>
            <div className="text-2xl font-bold text-gray-900">
              {receipts.filter((r) => !r.reviewed && r.status === "completed").length}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-white"
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>

          {showFilters && (
            <div className="mt-2 bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                >
                  <option value="all">All Categories</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                />
              </div>
            </div>
          )}
        </div>

        {/* Receipts list */}
        <div className="space-y-2">
          {receipts.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No receipts yet. Upload some from the home page!
            </div>
          ) : (
            receipts.map((receipt) => (
              <div
                key={receipt.id}
                onClick={() => {
                  setSelectedReceipt(receipt);
                  setEditingReceipt({ ...receipt });
                }}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 cursor-pointer hover:border-teal-300 transition-colors"
              >
                <div className="flex-shrink-0">
                  {statusIcon(receipt.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">
                      {receipt.vendor || "Unknown vendor"}
                    </span>
                    {receipt.reviewed && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        Reviewed
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 flex gap-3">
                    <span>{receipt.receipt_date || "No date"}</span>
                    {receipt.category && <span>{receipt.category}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-semibold text-gray-900">
                    {receipt.total != null ? `$${receipt.total.toFixed(2)}` : "—"}
                  </div>
                </div>
                <Eye className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>
            ))
          )}
        </div>
      </main>

      {/* Receipt detail modal */}
      {selectedReceipt && editingReceipt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-2xl md:rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="font-semibold text-gray-900">Receipt Details</h2>
              <button
                onClick={() => {
                  setSelectedReceipt(null);
                  setEditingReceipt(null);
                }}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Receipt image */}
              <img
                src={selectedReceipt.image_url}
                alt="Receipt"
                className="w-full max-h-48 object-contain rounded-lg border border-gray-200 bg-gray-50"
              />

              {/* Editable fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Vendor</label>
                  <input
                    type="text"
                    value={editingReceipt.vendor || ""}
                    onChange={(e) => setEditingReceipt({ ...editingReceipt, vendor: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date</label>
                  <input
                    type="date"
                    value={editingReceipt.receipt_date || ""}
                    onChange={(e) => setEditingReceipt({ ...editingReceipt, receipt_date: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Total</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingReceipt.total ?? ""}
                    onChange={(e) => setEditingReceipt({ ...editingReceipt, total: parseFloat(e.target.value) || null })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Category</label>
                  <select
                    value={editingReceipt.category || ""}
                    onChange={(e) => setEditingReceipt({ ...editingReceipt, category: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  >
                    <option value="">Select category</option>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Description</label>
                  <input
                    type="text"
                    value={editingReceipt.description || ""}
                    onChange={(e) => setEditingReceipt({ ...editingReceipt, description: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Notes</label>
                  <textarea
                    value={editingReceipt.notes || ""}
                    onChange={(e) => setEditingReceipt({ ...editingReceipt, notes: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveEdit}
                className="w-full bg-teal-600 text-white rounded-xl py-3 font-medium hover:bg-teal-700 transition-colors"
              >
                Save & Mark Reviewed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
