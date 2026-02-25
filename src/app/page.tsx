"use client";

import { useState, useRef } from "react";
import {
  Camera,
  CheckCircle,
  Loader2,
  AlertCircle,
  Images,
  Send,
  SkipForward,
} from "lucide-react";
import {
  MEAL_TYPES,
  COMMON_PEOPLE,
  GIFT_RECIPIENTS,
  GIFT_OCCASIONS,
  buildMealPurpose,
  buildGiftPurpose,
} from "@/lib/purposes";

type PageState = "idle" | "uploading" | "purpose" | "success" | "error" | "bulk";

type BulkUpload = {
  file: File;
  preview: string;
  state: "uploading" | "done" | "error";
  error?: string;
};

export default function UploadPage() {
  const [state, setState] = useState<PageState>("idle");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [detectedCategory, setDetectedCategory] = useState<string | null>(null);
  const [detectedVendor, setDetectedVendor] = useState<string | null>(null);
  const [detectedTotal, setDetectedTotal] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Bulk upload state
  const [bulkUploads, setBulkUploads] = useState<BulkUpload[]>([]);

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
      setDetectedVendor(data.vendor);
      setDetectedTotal(data.total);
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
            prev.map((item, idx) => (idx === i ? { ...item, state: "done" as const } : item))
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

  async function submitPurpose() {
    if (!receiptId || !purposePreview) {
      skipPurpose();
      return;
    }

    try {
      await fetch("/api/purpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptId, purpose: purposePreview }),
      });
    } catch {
      // Don't block
    }

    setState("success");
    setMessage("Receipt saved with purpose!");
  }

  function skipPurpose() {
    setState("success");
    setMessage("Receipt saved!");
  }

  function reset() {
    setState("idle");
    setMessage("");
    setPreview(null);
    setReceiptId(null);
    setDetectedCategory(null);
    setDetectedVendor(null);
    setDetectedTotal(null);
    setMealType(null);
    setPeople([]);
    setGiftOccasion(null);
    setGiftRecipients([]);
    setCustomPurpose("");
    bulkUploads.forEach((u) => URL.revokeObjectURL(u.preview));
    setBulkUploads([]);
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

        {/* PURPOSE - After single photo upload */}
        {state === "purpose" && (
          <div className="space-y-5">
            {preview && (
              <img
                src={preview}
                alt="Receipt preview"
                className="w-full max-h-36 object-contain rounded-xl border border-gray-200"
              />
            )}

            {/* What Claude detected */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-1">
              {detectedVendor && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Vendor</span>
                  <span className="font-medium text-gray-900">{detectedVendor}</span>
                </div>
              )}
              {detectedTotal != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total</span>
                  <span className="font-medium text-gray-900">${detectedTotal.toFixed(2)}</span>
                </div>
              )}
              {detectedCategory && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Category</span>
                  <span className="font-medium text-teal-600">{detectedCategory}</span>
                </div>
              )}
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
                <div className="space-y-3">
                  <div>
                    <span className="block text-xs text-gray-400 mb-1.5">Type</span>
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
                  </div>
                  <div>
                    <span className="block text-xs text-gray-400 mb-1.5">With whom</span>
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

              {/* Custom text - always available */}
              <input
                type="text"
                value={customPurpose}
                onChange={(e) => setCustomPurpose(e.target.value)}
                placeholder={
                  detectedCategory === "Meals & Entertainment" || detectedCategory === "Gift"
                    ? "Or type a custom purpose..."
                    : "e.g. Taxi to airport for conference"
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-teal-500 focus:ring-teal-500"
              />

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
                disabled={!purposePreview}
                className="flex-[2] flex items-center justify-center gap-2 bg-teal-600 text-white rounded-2xl py-4 px-6 font-medium hover:bg-teal-700 disabled:opacity-40 disabled:hover:bg-teal-600 transition-colors"
              >
                <Send className="w-4 h-4" />
                Save Purpose
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
              <div className="text-center space-y-3">
                <p className="text-sm text-gray-500">
                  All done! Add purposes from the dashboard.
                </p>
                <button
                  onClick={reset}
                  className="w-full bg-teal-600 text-white rounded-2xl py-4 px-6 text-lg font-medium hover:bg-teal-700 transition-colors"
                >
                  Upload More
                </button>
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
      </div>
    </div>
  );
}
