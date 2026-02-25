"use client";

import { useState, useRef } from "react";
import { Camera, Upload, CheckCircle, Loader2, AlertCircle, Images } from "lucide-react";

type UploadStatus = {
  file: File;
  preview: string;
  state: "uploading" | "done" | "error";
  error?: string;
};

export default function UploadPage() {
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File, index: number) {
    const formData = new FormData();
    formData.append("receipt", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setUploads((prev) =>
        prev.map((u, i) => (i === index ? { ...u, state: "done" as const } : u))
      );
    } catch (error) {
      setUploads((prev) =>
        prev.map((u, i) =>
          i === index
            ? { ...u, state: "error" as const, error: error instanceof Error ? error.message : "Failed" }
            : u
        )
      );
    }
  }

  async function handleFiles(files: FileList) {
    const newUploads: UploadStatus[] = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      state: "uploading" as const,
    }));

    const startIndex = uploads.length;
    setUploads((prev) => [...prev, ...newUploads]);
    setIsUploading(true);

    // Upload all in parallel
    await Promise.all(
      newUploads.map((u, i) => uploadFile(u.file, startIndex + i))
    );

    setIsUploading(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) handleFiles(files);
    e.target.value = "";
  }

  function reset() {
    uploads.forEach((u) => URL.revokeObjectURL(u.preview));
    setUploads([]);
    setIsUploading(false);
  }

  const doneCount = uploads.filter((u) => u.state === "done").length;
  const errorCount = uploads.filter((u) => u.state === "error").length;
  const uploadingCount = uploads.filter((u) => u.state === "uploading").length;
  const hasUploads = uploads.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white flex flex-col items-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 mt-12">
          <h1 className="text-3xl font-bold text-gray-900">SmoBooks</h1>
          <p className="text-gray-500 mt-2">Snap receipts to log expenses</p>
        </div>

        {/* Upload buttons - always visible */}
        <div className="space-y-3 mb-6">
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={isUploading}
            className="w-full flex items-center justify-center gap-3 bg-teal-600 text-white rounded-2xl py-5 px-6 text-lg font-medium hover:bg-teal-700 active:bg-teal-800 disabled:opacity-60 transition-colors shadow-lg"
          >
            <Camera className="w-6 h-6" />
            Take Photo
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 rounded-2xl py-5 px-6 text-lg font-medium border-2 border-gray-200 hover:border-teal-300 hover:bg-teal-50 active:bg-teal-100 disabled:opacity-60 transition-colors"
          >
            <Images className="w-6 h-6" />
            Upload Photos
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
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Upload status summary */}
        {hasUploads && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-gray-900">
                  {uploads.length} receipt{uploads.length !== 1 ? "s" : ""}
                </span>
                {uploadingCount > 0 && (
                  <span className="flex items-center gap-2 text-sm text-teal-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading {uploadingCount}...
                  </span>
                )}
                {uploadingCount === 0 && (
                  <span className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    {doneCount} uploaded{errorCount > 0 ? `, ${errorCount} failed` : ""}
                  </span>
                )}
              </div>

              {/* Thumbnail grid */}
              <div className="grid grid-cols-4 gap-2">
                {uploads.map((upload, i) => (
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
                      {upload.state === "uploading" && (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      )}
                      {upload.state === "done" && (
                        <CheckCircle className="w-5 h-5 text-white" />
                      )}
                      {upload.state === "error" && (
                        <AlertCircle className="w-5 h-5 text-white" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Done message */}
            {uploadingCount === 0 && (
              <div className="text-center space-y-3">
                <p className="text-sm text-gray-500">
                  Claude is extracting details in the background. You can keep uploading or you&apos;re done!
                </p>
                <button
                  onClick={reset}
                  className="text-sm text-teal-600 font-medium hover:text-teal-700"
                >
                  Clear & Start Over
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
