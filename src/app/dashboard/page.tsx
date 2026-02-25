"use client";

import { useEffect, useState, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import { EXPENSE_CATEGORIES } from "@/lib/categories";
import {
  MEAL_TYPES,
  COMMON_PEOPLE,
  GIFT_RECIPIENTS,
  GIFT_OCCASIONS,
  buildMealPurpose,
  buildGiftPurpose,
  type PurposeMode,
} from "@/lib/purposes";
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
  Trash2,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Copy,
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
  const [deleting, setDeleting] = useState(false);

  // Duplicate resolution flow
  const [duplicateMode, setDuplicateMode] = useState(false);
  const [duplicateGroupIndex, setDuplicateGroupIndex] = useState(0);

  // Categorize flow
  const [categorizeMode, setCategorizeMode] = useState(false);
  const [categorizeIndex, setCategorizeIndex] = useState(0);
  const [categorizePurposeMode, setCategorizePurposeMode] = useState<PurposeMode>("meal");
  const [catMealType, setCatMealType] = useState<string | null>(null);
  const [catPeople, setCatPeople] = useState<string[]>([]);
  const [catGiftOccasion, setCatGiftOccasion] = useState<string | null>(null);
  const [catGiftRecipients, setCatGiftRecipients] = useState<string[]>([]);
  const [catCustomPurpose, setCatCustomPurpose] = useState("");

  const fetchReceipts = useCallback(async () => {
    let query = getSupabase()
      .from("receipts")
      .select("*")
      .order("receipt_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

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

  async function handleDelete() {
    if (!selectedReceipt) return;
    setDeleting(true);

    try {
      const res = await fetch("/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptId: selectedReceipt.id }),
      });

      if (res.ok) {
        setSelectedReceipt(null);
        setEditingReceipt(null);
        fetchReceipts();
      }
    } finally {
      setDeleting(false);
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

  // Categorize flow helpers
  const unreviewedReceipts = receipts.filter((r) => !r.reviewed && r.status === "completed");
  const currentCategorizeReceipt = unreviewedReceipts[categorizeIndex];

  function resetCategorizeForm() {
    setCategorizePurposeMode("meal");
    setCatMealType(null);
    setCatPeople([]);
    setCatGiftOccasion(null);
    setCatGiftRecipients([]);
    setCatCustomPurpose("");
  }

  function startCategorize() {
    setCategorizeMode(true);
    setCategorizeIndex(0);
    resetCategorizeForm();
  }

  function getCatPurpose(): string {
    if (categorizePurposeMode === "custom") return catCustomPurpose.trim();
    if (categorizePurposeMode === "meal") return buildMealPurpose(catMealType, catPeople);
    if (categorizePurposeMode === "gift") return buildGiftPurpose(catGiftOccasion, catGiftRecipients);
    return "";
  }

  async function saveCategorize(receipt: Receipt, category: string, description: string) {
    await getSupabase()
      .from("receipts")
      .update({
        category,
        description: description || receipt.description,
        reviewed: true,
      })
      .eq("id", receipt.id);

    resetCategorizeForm();

    if (categorizeIndex >= unreviewedReceipts.length - 1) {
      setCategorizeMode(false);
      fetchReceipts();
    } else {
      setCategorizeIndex((i) => i + 1);
      fetchReceipts();
    }
  }

  function skipCategorize() {
    resetCategorizeForm();
    if (categorizeIndex >= unreviewedReceipts.length - 1) {
      setCategorizeMode(false);
    } else {
      setCategorizeIndex((i) => i + 1);
    }
  }

  function toggleInList(list: string[], item: string, setter: (val: string[]) => void) {
    setter(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  }

  // Duplicate detection: group by vendor+date+total
  function findDuplicateGroups(): Receipt[][] {
    const groups = new Map<string, Receipt[]>();
    for (const r of receipts) {
      if (r.status !== "completed") continue;
      const key = `${(r.vendor || "").toLowerCase().trim()}|${r.receipt_date || ""}|${r.total ?? ""}`;
      if (!r.vendor && !r.receipt_date && r.total == null) continue;
      const group = groups.get(key) || [];
      group.push(r);
      groups.set(key, group);
    }
    return Array.from(groups.values()).filter((g) => g.length > 1);
  }

  const duplicateGroups = findDuplicateGroups();

  async function keepOneDeleteRest(keepId: string, group: Receipt[]) {
    const toDelete = group.filter((r) => r.id !== keepId);
    for (const r of toDelete) {
      await fetch("/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptId: r.id }),
      });
    }
    if (duplicateGroupIndex >= duplicateGroups.length - 1) {
      setDuplicateMode(false);
      setDuplicateGroupIndex(0);
    } else {
      setDuplicateGroupIndex((i) => i);
    }
    fetchReceipts();
  }

  async function deleteAllInGroup(group: Receipt[]) {
    for (const r of group) {
      await fetch("/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptId: r.id }),
      });
    }
    if (duplicateGroupIndex >= duplicateGroups.length - 1) {
      setDuplicateMode(false);
      setDuplicateGroupIndex(0);
    }
    fetchReceipts();
  }

  function skipDuplicateGroup() {
    if (duplicateGroupIndex >= duplicateGroups.length - 1) {
      setDuplicateMode(false);
      setDuplicateGroupIndex(0);
    } else {
      setDuplicateGroupIndex((i) => i + 1);
    }
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

  // Duplicate resolution UI
  if (duplicateMode && duplicateGroups.length > 0) {
    const group = duplicateGroups[duplicateGroupIndex];
    if (!group) {
      setDuplicateMode(false);
      setDuplicateGroupIndex(0);
    } else {
      return (
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
            <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
              <button
                onClick={() => { setDuplicateMode(false); setDuplicateGroupIndex(0); }}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <span className="text-sm font-medium text-gray-500">
                Duplicate {duplicateGroupIndex + 1} of {duplicateGroups.length}
              </span>
              <button
                onClick={skipDuplicateGroup}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                Not a duplicate
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </header>

          <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
            <div className="text-center mb-2">
              <h2 className="font-semibold text-gray-900">
                {group[0].vendor || "Unknown vendor"} - {group[0].receipt_date || "No date"}
              </h2>
              <p className="text-sm text-gray-500">
                {group.length} matching receipts{group[0].total != null ? ` at $${group[0].total.toFixed(2)}` : ""}
              </p>
            </div>

            <p className="text-sm text-gray-600 text-center">Tap the one to keep, or delete all:</p>

            {group.map((receipt) => (
              <div
                key={receipt.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                <img
                  src={receipt.image_url}
                  alt="Receipt"
                  className="w-full h-40 object-contain bg-gray-50"
                />
                <div className="p-3 flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Uploaded {format(new Date(receipt.created_at), "MMM d, h:mm a")}
                  </div>
                  <button
                    onClick={() => keepOneDeleteRest(receipt.id, group)}
                    className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
                  >
                    Keep This One
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={() => deleteAllInGroup(group)}
              className="w-full flex items-center justify-center gap-2 border-2 border-red-200 text-red-600 rounded-xl py-3 font-medium hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete All {group.length}
            </button>
          </main>
        </div>
      );
    }
  }

  // Categorize flow UI
  if (categorizeMode && currentCategorizeReceipt) {
    const purpose = getCatPurpose();

    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => { setCategorizeMode(false); fetchReceipts(); }}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <span className="text-sm font-medium text-gray-500">
              {categorizeIndex + 1} of {unreviewedReceipts.length}
            </span>
            <button
              onClick={skipCategorize}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              Skip
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
          {/* Receipt image */}
          <img
            src={currentCategorizeReceipt.image_url}
            alt="Receipt"
            className="w-full max-h-56 object-contain rounded-xl border border-gray-200 bg-white"
          />

          {/* Auto-extracted info */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-1">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Vendor</span>
              <span className="text-sm font-medium text-gray-900">{currentCategorizeReceipt.vendor || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Date</span>
              <span className="text-sm font-medium text-gray-900">{currentCategorizeReceipt.receipt_date || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Total</span>
              <span className="text-sm font-medium text-gray-900">
                {currentCategorizeReceipt.total != null ? `$${currentCategorizeReceipt.total.toFixed(2)}` : "—"}
              </span>
            </div>
            {currentCategorizeReceipt.category && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">AI Category</span>
                <span className="text-sm font-medium text-teal-600">{currentCategorizeReceipt.category}</span>
              </div>
            )}
          </div>

          {/* Category selection */}
          <div>
            <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wide">Category</label>
            <div className="flex flex-wrap gap-2">
              {EXPENSE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setEditingReceipt((prev) => ({ ...prev, category: cat }))}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    (editingReceipt?.category || currentCategorizeReceipt.category) === cat
                      ? "bg-teal-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Purpose */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <label className="block text-xs text-gray-500 uppercase tracking-wide">Purpose</label>

            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {([
                ["meal", "Meal"],
                ["gift", "Gift"],
                ["custom", "Custom"],
              ] as [PurposeMode, string][]).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setCategorizePurposeMode(mode)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                    categorizePurposeMode === mode
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {categorizePurposeMode === "meal" && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {MEAL_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => setCatMealType(catMealType === type ? null : type)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        catMealType === type ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {COMMON_PEOPLE.map((person) => (
                    <button
                      key={person}
                      onClick={() => toggleInList(catPeople, person, setCatPeople)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        catPeople.includes(person) ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {person}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {categorizePurposeMode === "gift" && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {GIFT_OCCASIONS.map((occasion) => (
                    <button
                      key={occasion}
                      onClick={() => setCatGiftOccasion(catGiftOccasion === occasion ? null : occasion)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        catGiftOccasion === occasion ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {occasion}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {GIFT_RECIPIENTS.map((recipient) => (
                    <button
                      key={recipient}
                      onClick={() => toggleInList(catGiftRecipients, recipient, setCatGiftRecipients)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        catGiftRecipients.includes(recipient) ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {recipient}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {categorizePurposeMode === "custom" && (
              <input
                type="text"
                value={catCustomPurpose}
                onChange={(e) => setCatCustomPurpose(e.target.value)}
                placeholder="e.g. Career planning dinner with Dr. Smith"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900"
              />
            )}

            {purpose && (
              <div className="bg-teal-50 rounded-lg p-2 text-sm text-teal-800">
                {purpose}
              </div>
            )}
          </div>

          {/* Save button */}
          <button
            onClick={() =>
              saveCategorize(
                currentCategorizeReceipt,
                editingReceipt?.category || currentCategorizeReceipt.category || "",
                purpose
              )
            }
            className="w-full bg-teal-600 text-white rounded-xl py-4 font-medium hover:bg-teal-700 transition-colors"
          >
            Save & Next
          </button>
        </main>
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
        {/* Duplicate banner */}
        {duplicateGroups.length > 0 && (
          <button
            onClick={() => { setDuplicateMode(true); setDuplicateGroupIndex(0); }}
            className="w-full mb-4 bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-center justify-between hover:bg-red-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Copy className="w-6 h-6 text-red-500" />
              <div className="text-left">
                <div className="font-semibold text-red-900">
                  {duplicateGroups.length} possible duplicate{duplicateGroups.length !== 1 ? "s" : ""}
                </div>
                <div className="text-sm text-red-600">
                  Resolve duplicate receipts
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-red-400" />
          </button>
        )}

        {/* Categorize banner */}
        {unreviewedReceipts.length > 0 && (
          <button
            onClick={startCategorize}
            className="w-full mb-6 bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-center justify-between hover:bg-amber-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ClipboardList className="w-6 h-6 text-amber-600" />
              <div className="text-left">
                <div className="font-semibold text-amber-900">
                  Categorize {unreviewedReceipts.length} expense{unreviewedReceipts.length !== 1 ? "s" : ""}
                </div>
                <div className="text-sm text-amber-600">
                  Review and add purpose to unreviewed receipts
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-amber-400" />
          </button>
        )}

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
            <div className="text-sm text-gray-500">Reviewed</div>
            <div className="text-2xl font-bold text-gray-900">
              {receipts.filter((r) => r.reviewed).length} / {receipts.length}
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
                  {receipt.description && (
                    <div className="text-xs text-gray-400 truncate mt-0.5">{receipt.description}</div>
                  )}
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
                  <label className="block text-xs text-gray-500 mb-1">Description / Purpose</label>
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

              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-red-200 text-red-600 font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 bg-teal-600 text-white rounded-xl py-3 font-medium hover:bg-teal-700 transition-colors"
                >
                  Save & Mark Reviewed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
