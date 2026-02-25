"use client";

import { useState, useRef } from "react";
import { Camera, Upload, CheckCircle, Loader2, AlertCircle, SkipForward, Send } from "lucide-react";
import {
  MEAL_TYPES,
  COMMON_PEOPLE,
  GIFT_RECIPIENTS,
  GIFT_OCCASIONS,
  buildMealPurpose,
  buildGiftPurpose,
  type PurposeMode,
} from "@/lib/purposes";

type UploadState = "idle" | "uploading" | "purpose" | "success" | "error";

export default function UploadPage() {
  const [state, setState] = useState<UploadState>("idle");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Purpose state
  const [purposeMode, setPurposeMode] = useState<PurposeMode>("meal");
  const [selectedMealType, setSelectedMealType] = useState<string | null>(null);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [selectedGiftOccasion, setSelectedGiftOccasion] = useState<string | null>(null);
  const [selectedGiftRecipients, setSelectedGiftRecipients] = useState<string[]>([]);
  const [customPurpose, setCustomPurpose] = useState("");

  function getPurposePreview(): string {
    if (purposeMode === "custom") return customPurpose.trim();
    if (purposeMode === "meal") return buildMealPurpose(selectedMealType, selectedPeople);
    if (purposeMode === "gift") return buildGiftPurpose(selectedGiftOccasion, selectedGiftRecipients);
    return "";
  }

  const purposePreview = getPurposePreview();

  async function handleFile(file: File) {
    setPreview(URL.createObjectURL(file));
    setState("uploading");
    setMessage("Uploading receipt...");

    try {
      const formData = new FormData();
      formData.append("receipt", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setReceiptId(data.receiptId);
      setState("purpose");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
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
      // Don't block on purpose update failure
    }

    setState("success");
    setMessage("Receipt uploaded with purpose!");
  }

  function skipPurpose() {
    setState("success");
    setMessage("Receipt uploaded successfully!");
  }

  function reset() {
    setState("idle");
    setMessage("");
    setPreview(null);
    setReceiptId(null);
    setPurposeMode("meal");
    setSelectedMealType(null);
    setSelectedPeople([]);
    setSelectedGiftOccasion(null);
    setSelectedGiftRecipients([]);
    setCustomPurpose("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SmoBooks</h1>
          <p className="text-gray-500 mt-2">Snap a receipt to log an expense</p>
        </div>

        {/* IDLE - Upload buttons */}
        {state === "idle" && (
          <div className="space-y-4">
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
              <Upload className="w-6 h-6" />
              Upload from Gallery
            </button>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

        {/* UPLOADING */}
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

        {/* PURPOSE - Add purpose after upload */}
        {state === "purpose" && (
          <div className="space-y-5">
            {preview && (
              <img
                src={preview}
                alt="Receipt preview"
                className="w-full max-h-36 object-contain rounded-xl border border-gray-200"
              />
            )}

            <div className="flex items-center justify-center gap-3 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Photo uploaded - Claude is processing it</span>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
              <h2 className="font-semibold text-gray-900">
                Add Purpose <span className="text-gray-400 font-normal text-sm">(optional)</span>
              </h2>

              {/* Mode tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {([
                  ["meal", "Meal"],
                  ["gift", "Gift"],
                  ["custom", "Custom"],
                ] as [PurposeMode, string][]).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => setPurposeMode(mode)}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                      purposeMode === mode
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* MEAL MODE */}
              {purposeMode === "meal" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wide">
                      Type of meal / event
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {MEAL_TYPES.map((type) => (
                        <button
                          key={type}
                          onClick={() => setSelectedMealType(selectedMealType === type ? null : type)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            selectedMealType === type
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
                    <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wide">
                      With whom
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COMMON_PEOPLE.map((person) => (
                        <button
                          key={person}
                          onClick={() => toggleInList(selectedPeople, person, setSelectedPeople)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            selectedPeople.includes(person)
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

              {/* GIFT MODE */}
              {purposeMode === "gift" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wide">
                      Occasion
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {GIFT_OCCASIONS.map((occasion) => (
                        <button
                          key={occasion}
                          onClick={() =>
                            setSelectedGiftOccasion(selectedGiftOccasion === occasion ? null : occasion)
                          }
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            selectedGiftOccasion === occasion
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
                    <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wide">
                      For whom
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {GIFT_RECIPIENTS.map((recipient) => (
                        <button
                          key={recipient}
                          onClick={() =>
                            toggleInList(selectedGiftRecipients, recipient, setSelectedGiftRecipients)
                          }
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            selectedGiftRecipients.includes(recipient)
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

              {/* CUSTOM MODE */}
              {purposeMode === "custom" && (
                <input
                  type="text"
                  value={customPurpose}
                  onChange={(e) => setCustomPurpose(e.target.value)}
                  placeholder="e.g. Career planning dinner with Dr. Smith"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-teal-500 focus:ring-teal-500"
                />
              )}

              {/* Purpose preview */}
              {purposePreview && (
                <div className="bg-teal-50 rounded-xl p-3 text-sm text-teal-800">
                  <span className="text-teal-500 text-xs uppercase tracking-wide block mb-1">
                    Purpose preview
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

        {/* SUCCESS */}
        {state === "success" && (
          <div className="text-center space-y-6">
            {preview && (
              <img
                src={preview}
                alt="Receipt preview"
                className="w-full max-h-48 object-contain rounded-xl border border-gray-200"
              />
            )}
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
