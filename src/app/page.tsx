"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  Camera,
  CheckCircle,
  Loader2,
  AlertCircle,
  Images,
  Send,
  SkipForward,
  X,
} from "lucide-react";
import {
  MEAL_TYPES,
  COMMON_PEOPLE,
  GIFT_RECIPIENTS,
  GIFT_OCCASIONS,
  buildMealPurpose,
  buildGiftPurpose,
} from "@/lib/purposes";
import { EXPENSE_CATEGORIES } from "@/lib/categories";

type PageState = "idle" | "uploading" | "purpose" | "success" | "error" | "bulk";

type BulkUpload = {
  file: File;
  preview: string;
  state: "uploading" | "done" | "error";
  error?: string;
  receiptId?: string;
  vendor?: string | null;
  total?: number | null;
  date?: string | null;
  category?: string | null;
};

export default function UploadPage() {
  const [state, setState] = useState<PageState>("idle");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [detectedCategory, setDetectedCategory] = useState<string | null>(null);
  const [originalCategory, setOriginalCategory] = useState<string | null>(null);
  const [detectedVendor, setDetectedVendor] = useState<string | null>(null);
  const [detectedTotal, setDetectedTotal] = useState<number | null>(null);
  const [detectedDate, setDetectedDate] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Bulk upload state
  const [bulkUploads, setBulkUploads] = useState<BulkUpload[]>([]);

  // Zoomed image modal
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Bulk review queue (walked through after bulk upload if user chooses Review now)
  const [bulkReviewQueue, setBulkReviewQueue] = useState<BulkUpload[]>([]);
  const [bulkReviewIndex, setBulkReviewIndex] = useState(0);

  // Category editor (tap category on purpose step to change)
  const [editingCategory, setEditingCategory] = useState(false);

  // Purpose state
  const [mealType, setMealType] = useState<string | null>(null);
  const [people, setPeople] = useState<string[]>([]);
  const [giftOccasion, setGiftOccasion] = useState<string | null>(null);
  const [giftRecipients, setGiftRecipients] = useState<string[]>([]);
  const [customPurpose, setCustomPurpose] = useState("");

  function getPurpose(): string {
    if (detectedCategory === "Meals & Entertainment") {
      return buildMealPurpose(mealType, people) || customPurpose.trim();
    }
    if (detectedCategory === "Gift") {
      return buildGiftPurpose(giftOccasion, giftRecipients) || customPurpose.trim();
    }
    return customPurpose.trim();
  }

  const purposePreview = getPurpose();
  const inBulkReview = bulkReviewQueue.length > 0;

  function formatDate(dateStr: string | null): string | null {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // Single photo upload (camera)
  async function handleSingleFile(file: File) {
    setPreview(URL.createObjectURL(file));
    setState("uploading");
    setMessage("Processing receipt...");

    try {
      const formData = new FormData();
      formData.append("receipt", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Upload failed");

      setReceiptId(data.receiptId);
      setDetectedCategory(data.category);
      setOriginalCategory(data.category);
      setDetectedVendor(data.vendor);
      setDetectedTotal(data.total);
      setDetectedDate(data.date);
      setState("purpose");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong");
    }
  }

  // Bulk upload (gallery multi-select)
  async function handleBulkFiles(files: FileList) {
    setState("bulk");

    const newUploads: BulkUpload[] = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      state: "uploading" as const,
    }));

    setBulkUploads(newUploads);

    await Promise.all(
      newUploads.map(async (u, i) => {
        const formData = new FormData();
        formData.append("receipt", u.file);

        try {
          const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Upload failed");

          setBulkUploads((prev) =>
            prev.map((item, idx) =>
              idx === i
                ? {
                    ...item,
                    state: "done" as const,
                    receiptId: data.receiptId,
                    vendor: data.vendor,
                    total: data.total,
                    date: data.date,
                    category: data.category,
                  }
                : item
            )
          );
        } catch (error) {
          setBulkUploads((prev) =>
            prev.map((item, idx) =>
              idx === i
                ? { ...item, state: "error" as const, error: error instanceof Error ? error.message : "Failed" }
                : item
            )
          );
        }
      })
    );
  }

  function handleCameraChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleSingleFile(file);
    e.target.value = "";
  }

  function handleGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) handleBulkFiles(files);
    e.target.value = "";
  }

  function toggleInList(list: string[], item: string, setter: (val: string[]) => void) {
    setter(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  }

  function resetPurposeForm() {
    setMealType(null);
    setPeople([]);
    setGiftOccasion(null);
    setGiftRecipients([]);
    setCustomPurpose("");
    setEditingCategory(false);
  }

  function loadReceiptIntoForm(u: BulkUpload) {
    setPreview(u.preview);
    setReceiptId(u.receiptId || null);
    setDetectedVendor(u.vendor ?? null);
    setDetectedTotal(u.total ?? null);
    setDetectedDate(u.date ?? null);
    setDetectedCategory(u.category ?? null);
    setOriginalCategory(u.category ?? null);
    resetPurposeForm();
  }

  function advanceBulkReview() {
    const nextIdx = bulkReviewIndex + 1;
    if (nextIdx >= bulkReviewQueue.length) {
      setBulkReviewQueue([]);
      setBulkReviewIndex(0);
      setState("success");
      setMessage("All receipts reviewed!");
    } else {
      setBulkReviewIndex(nextIdx);
      loadReceiptIntoForm(bulkReviewQueue[nextIdx]);
    }
  }

  function startBulkReview() {
    const done = bulkUploads.filter((u) => u.state === "done" && u.receiptId);
    if (done.length === 0) {
      setState("success");
      setMessage("No receipts to review");
      return;
    }
    setBulkReviewQueue(done);
    setBulkReviewIndex(0);
    loadReceiptIntoForm(done[0]);
    setState("purpose");
  }

  function exitBulkReview() {
    setBulkReviewQueue([]);
    setBulkReviewIndex(0);
    setState("success");
    setMessage("Review paused — unreviewed receipts are flagged in the dashboard.");
  }

  async function submitPurpose() {
    const category = detectedCategory;
    const categoryChanged = category !== originalCategory && category !== null;

    if (receiptId && (purposePreview || categoryChanged)) {
      try {
        await fetch("/api/purpose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receiptId,
            ...(purposePreview ? { purpose: purposePreview } : {}),
            ...(categoryChanged ? { category } : {}),
          }),
        });
      } catch {
        // Don't block
      }
    }

    if (inBulkReview) {
      advanceBulkReview();
    } else {
      setState("success");
      setMessage("Receipt saved with purpose!");
    }
  }

  function skipPurpose() {
    if (inBulkReview) {
      advanceBulkReview();
    } else {
      setState("success");
      setMessage("Receipt saved!");
    }
  }

  function reset() {
    setState("idle");
    setMessage("");
    setPreview(null);
    setReceiptId(null);
    setDetectedCategory(null);
    setOriginalCategory(null);
    setDetectedVendor(null);
    setDetectedTotal(null);
    setDetectedDate(null);
    resetPurposeForm();
    bulkUploads.forEach((u) => URL.revokeObjectURL(u.preview));
    setBulkUploads([]);
    setBulkReviewQueue([]);
    setBulkReviewIndex(0);
  }

  const bulkDone = bulkUploads.filter((u) => u.state === "done").length;
  const bulkError = bulkUploads.filter((u) => u.state === "error").length;
  const bulkUploading = bulkUploads.filter((u) => u.state === "uploading").length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white flex flex-col items-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 mt-12">
          <h1 className="text-3xl font-bold text-gray-900">SmoBooks</h1>
          <p className="text-gray-500 mt-2">Snap receipts to log expenses</p>
        </div>

        {/* IDLE - Upload buttons */}
        {state === "idle" && (
          <div className="space-y-3">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 bg-teal-600 text-white rounded-2xl py-5 px-6 text-lg font-medium hover:bg-teal-700 active:bg-teal-800 transition-colors shadow-lg"
            >
              <Camera className="w-6 h-6" />
              Take Photo
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 rounded-2xl py-5 px-6 text-lg font-medium border-2 border-gray-200 hover:border-teal-300 hover:bg-teal-50 active:bg-teal-100 transition-colors"
            >
              <Images className="w-6 h-6" />
              Bulk Upload Photos
            </button>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCameraChange}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              onChange={handleGalleryChange}
              className="hidden"
            />
          </div>
        )}

        {/* UPLOADING - Single photo processing */}
        {state === "uploading" && (
          <div className="text-center space-y-4">
            {preview && (
              <img
                src={preview}
                alt="Receipt preview"
                className="w-full max-h-48 object-contain rounded-xl border border-gray-200"
              />
            )}
            <div className="flex items-center justify-center gap-3 text-teal-600">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-lg">{message}</span>
            </div>
          </div>
        )}

        {/* PURPOSE - After single photo upload (also used for bulk review) */}
        {state === "purpose" && (
          <div className="space-y-5">
            {inBulkReview && (
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">
                  Receipt {bulkReviewIndex + 1} of {bulkReviewQueue.length}
                </span>
                <button
                  onClick={exitBulkReview}
                  className="text-gray-400 hover:text-gray-600 font-medium"
                >
                  Pause review
                </button>
              </div>
            )}

            {preview && (
              <button
                type="button"
                onClick={() => setZoomedImage(preview)}
                className="block w-full"
                aria-label="Enlarge receipt"
              >
                <img
                  src={preview}
                  alt="Receipt preview"
                  className="w-full max-h-36 object-contain rounded-xl border border-gray-200 cursor-zoom-in"
                />
              </button>
            )}

            {/* What Claude detected */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-1">
              {detectedVendor && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Vendor</span>
                  <span className="font-medium text-gray-900">{detectedVendor}</span>
                </div>
              )}
              {detectedDate && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Date</span>
                  <span className="font-medium text-gray-900">{formatDate(detectedDate)}</span>
                </div>
              )}
              {detectedTotal != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total</span>
                  <span className="font-medium text-gray-900">${detectedTotal.toFixed(2)}</span>
                </div>
              )}
              <div>
                <button
                  type="button"
                  onClick={() => setEditingCategory((v) => !v)}
                  className="w-full flex justify-between items-center text-sm -mx-1 px-1 py-0.5 rounded hover:bg-gray-50"
                >
                  <span className="text-gray-500">Category</span>
                  <span className={`font-medium ${detectedCategory ? "text-teal-600" : "text-gray-400"}`}>
                    {detectedCategory || "Tap to set"} <span className="text-gray-400 text-xs ml-1">edit</span>
                  </span>
                </button>
                {editingCategory && (
                  <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-gray-100">
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          if (cat !== detectedCategory) resetPurposeForm();
                          setDetectedCategory(cat);
                          setEditingCategory(false);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          detectedCategory === cat
                            ? "bg-teal-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">
                  Add Purpose <span className="text-gray-400 font-normal text-sm">(optional)</span>
                </h2>
                <button
                  onClick={skipPurpose}
                  className="text-sm text-gray-400 hover:text-gray-600 font-medium"
                >
                  Skip
                </button>
              </div>

              {/* Meals & Entertainment: meal type + people pills */}
              {detectedCategory === "Meals & Entertainment" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {MEAL_TYPES.map((type) => (
                      <button
                        key={type}
                        onClick={() => setMealType(mealType === type ? null : type)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          mealType === type
                            ? "bg-teal-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={customPurpose}
                    onChange={(e) => setCustomPurpose(e.target.value)}
                    placeholder="Or type a custom purpose..."
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-teal-500 focus:ring-teal-500"
                  />
                  <div>
                    <h2 className="font-semibold text-gray-900 mb-2">With whom</h2>
                    <div className="flex flex-wrap gap-2">
                      {COMMON_PEOPLE.map((person) => (
                        <button
                          key={person}
                          onClick={() => toggleInList(people, person, setPeople)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            people.includes(person)
                              ? "bg-teal-600 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {person}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Gift: occasion + recipient pills */}
              {detectedCategory === "Gift" && (
                <div className="space-y-3">
                  <div>
                    <span className="block text-xs text-gray-400 mb-1.5">Occasion</span>
                    <div className="flex flex-wrap gap-2">
                      {GIFT_OCCASIONS.map((occasion) => (
                        <button
                          key={occasion}
                          onClick={() => setGiftOccasion(giftOccasion === occasion ? null : occasion)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            giftOccasion === occasion
                              ? "bg-teal-600 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {occasion}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-400 mb-1.5">For whom</span>
                    <div className="flex flex-wrap gap-2">
                      {GIFT_RECIPIENTS.map((recipient) => (
                        <button
                          key={recipient}
                          onClick={() => toggleInList(giftRecipients, recipient, setGiftRecipients)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            giftRecipients.includes(recipient)
                              ? "bg-teal-600 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {recipient}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Custom text - for non-meals categories */}
              {detectedCategory !== "Meals & Entertainment" && (
                <input
                  type="text"
                  value={customPurpose}
                  onChange={(e) => setCustomPurpose(e.target.value)}
                  placeholder={
                    detectedCategory === "Gift"
                      ? "Or type a custom purpose..."
                      : "e.g. Taxi to airport for conference"
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-teal-500 focus:ring-teal-500"
                />
              )}

              {/* Purpose preview */}
              {purposePreview && (
                <div className="bg-teal-50 rounded-xl p-3 text-sm text-teal-800">
                  <span className="text-teal-500 text-xs uppercase tracking-wide block mb-1">
                    Purpose
                  </span>
                  {purposePreview}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={skipPurpose}
                className="flex-1 flex items-center justify-center gap-2 bg-white text-gray-600 rounded-2xl py-4 px-4 font-medium border-2 border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <SkipForward className="w-4 h-4" />
                Skip
              </button>
              <button
                onClick={submitPurpose}
                disabled={!purposePreview && detectedCategory === originalCategory}
                className="flex-[2] flex items-center justify-center gap-2 bg-teal-600 text-white rounded-2xl py-4 px-6 font-medium hover:bg-teal-700 disabled:opacity-40 disabled:hover:bg-teal-600 transition-colors"
              >
                <Send className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        )}

        {/* SUCCESS - Single photo done */}
        {state === "success" && (
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center gap-3 text-green-600">
              <CheckCircle className="w-7 h-7" />
              <span className="text-lg font-medium">{message}</span>
            </div>
            <button
              onClick={reset}
              className="w-full bg-teal-600 text-white rounded-2xl py-4 px-6 text-lg font-medium hover:bg-teal-700 active:bg-teal-800 transition-colors"
            >
              Upload Another Receipt
            </button>
          </div>
        )}

        {/* BULK - Multi-file upload progress */}
        {state === "bulk" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-gray-900">
                  {bulkUploads.length} receipt{bulkUploads.length !== 1 ? "s" : ""}
                </span>
                {bulkUploading > 0 ? (
                  <span className="flex items-center gap-2 text-sm text-teal-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing {bulkUploading}...
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    {bulkDone} done{bulkError > 0 ? `, ${bulkError} failed` : ""}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2">
                {bulkUploads.map((upload, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                    <img
                      src={upload.preview}
                      alt={`Receipt ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className={`absolute inset-0 flex items-center justify-center ${
                      upload.state === "uploading" ? "bg-black/30" :
                      upload.state === "error" ? "bg-red-500/30" :
                      "bg-green-500/20"
                    }`}>
                      {upload.state === "uploading" && <Loader2 className="w-5 h-5 text-white animate-spin" />}
                      {upload.state === "done" && <CheckCircle className="w-5 h-5 text-white" />}
                      {upload.state === "error" && <AlertCircle className="w-5 h-5 text-white" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {bulkUploading === 0 && (
              <div className="space-y-3">
                {bulkDone > 0 ? (
                  <>
                    <button
                      onClick={startBulkReview}
                      className="w-full bg-teal-600 text-white rounded-2xl py-4 px-6 text-lg font-medium hover:bg-teal-700 transition-colors"
                    >
                      Review {bulkDone} Receipt{bulkDone !== 1 ? "s" : ""}
                    </button>
                    <button
                      onClick={reset}
                      className="w-full bg-white text-gray-600 rounded-2xl py-3 px-6 font-medium border-2 border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      Skip for now
                    </button>
                    <p className="text-xs text-center text-gray-400">
                      Unreviewed receipts will be flagged in the dashboard.
                    </p>
                  </>
                ) : (
                  <button
                    onClick={reset}
                    className="w-full bg-teal-600 text-white rounded-2xl py-4 px-6 text-lg font-medium hover:bg-teal-700 transition-colors"
                  >
                    Upload More
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ERROR */}
        {state === "error" && (
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center gap-3 text-red-600">
              <AlertCircle className="w-7 h-7" />
              <span className="text-lg">{message}</span>
            </div>
            <button
              onClick={reset}
              className="w-full bg-teal-600 text-white rounded-2xl py-4 px-6 text-lg font-medium hover:bg-teal-700 active:bg-teal-800 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        <div className="mt-12 text-center">
          <Link
            href="/login"
            className="text-sm text-gray-400 hover:text-teal-600 transition-colors"
          >
            Log in to dashboard
          </Link>
        </div>
      </div>

      {zoomedImage && (
        <ZoomableImage src={zoomedImage} onClose={() => setZoomedImage(null)} />
      )}
    </div>
  );
}

function ZoomableImage({ src, onClose }: { src: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastDistance = useRef(0);
  const lastTapAt = useRef(0);
  const scaleRef = useRef(1);

  function updateScale(next: number) {
    const clamped = Math.min(Math.max(next, 1), 5);
    scaleRef.current = clamped;
    setScale(clamped);
    if (clamped === 1) setTranslate({ x: 0, y: 0 });
  }

  function pointerDistance() {
    const pts = Array.from(pointers.current.values());
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  function onPointerDown(e: React.PointerEvent<HTMLImageElement>) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 1) {
      const now = Date.now();
      if (now - lastTapAt.current < 300) {
        updateScale(scaleRef.current > 1 ? 1 : 2.5);
      }
      lastTapAt.current = now;
    } else if (pointers.current.size === 2) {
      lastDistance.current = pointerDistance();
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLImageElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const dist = pointerDistance();
      if (lastDistance.current > 0) {
        updateScale(scaleRef.current * (dist / lastDistance.current));
      }
      lastDistance.current = dist;
    } else if (pointers.current.size === 1 && scaleRef.current > 1) {
      setTranslate((t) => ({
        x: t.x + (e.clientX - prev.x),
        y: t.y + (e.clientY - prev.y),
      }));
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLImageElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) lastDistance.current = 0;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center overflow-hidden"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 text-white bg-white/10 hover:bg-white/20 rounded-full p-2"
        aria-label="Close"
      >
        <X className="w-6 h-6" />
      </button>
      <img
        src={src}
        alt="Receipt"
        className="max-w-full max-h-full select-none"
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          touchAction: "none",
          transition: pointers.current.size === 0 ? "transform 0.15s" : "none",
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        draggable={false}
      />
    </div>
  );
}
