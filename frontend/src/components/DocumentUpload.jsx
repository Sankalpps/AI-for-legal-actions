import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileText, X, Loader2, Sparkles } from "lucide-react";
import clsx from "clsx";
import { uploadFile } from "../api";
import { SAMPLE_DOCUMENTS } from "../sampleData";

/**
 * DocumentUpload — supports drag & drop or click for PDF/TXT files.
 * On upload, extracts text via backend and calls onTextExtracted(text).
 * Also shows the paste-text textarea.
 */
export default function DocumentUpload({
  label = "Document",
  placeholder = "Paste your legal document text here...",
  value,
  onChange,
  showUpload = true,
  minRows = 10,
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [error, setError] = useState(null);

  const onDrop = useCallback(
    async (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setUploading(true);
      setError(null);
      setUploadedFile(null);

      try {
        const result = await uploadFile(file);
        setUploadedFile({ name: file.name, chars: result.char_count });
        onChange(result.extracted_text);
      } catch (err) {
        setError(err.message || "Failed to upload file. Please try again.");
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "text/plain": [".txt"] },
    maxFiles: 1,
    disabled: uploading,
  });

  const clearFile = () => {
    setUploadedFile(null);
    onChange("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="label mb-0">{label}</label>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1 mr-1">
            <Sparkles size={12} className="text-amber-400" /> Samples:
          </span>
          {SAMPLE_DOCUMENTS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => {
                setUploadedFile({ name: `${sample.title}.txt`, chars: sample.text.length });
                onChange(sample.text);
              }}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              title={sample.description}
            >
              {sample.title.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Drag & Drop Zone */}
      {showUpload && (
        <div
          {...getRootProps()}
          className={clsx(
            "border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200",
            isDragActive
              ? "border-primary-500 bg-primary-900/20"
              : "border-slate-700 hover:border-slate-600 hover:bg-slate-800/50",
            uploading && "opacity-50 cursor-not-allowed"
          )}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 text-primary-400 animate-spin" />
              <p className="text-sm text-slate-400">Extracting text...</p>
            </div>
          ) : uploadedFile ? (
            <div className="flex items-center justify-center gap-3">
              <FileText className="h-6 w-6 text-green-400" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">{uploadedFile.name}</p>
                <p className="text-xs text-slate-400">
                  {uploadedFile.chars.toLocaleString()} characters extracted
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); clearFile(); }}
                className="ml-2 p-1 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X size={14} className="text-slate-400" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <UploadCloud className="h-8 w-8 text-slate-500" />
              <p className="text-sm text-slate-400">
                {isDragActive ? "Drop the file here..." : "Drag & drop PDF or TXT, or click to browse"}
              </p>
              <p className="text-xs text-slate-600">Max 10MB</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Divider */}
      {showUpload && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-800" />
          <span className="text-xs text-slate-600 font-medium">OR PASTE TEXT</span>
          <div className="flex-1 h-px bg-slate-800" />
        </div>
      )}

      {/* Textarea */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={minRows}
        className="textarea-field"
      />
      {value && (
        <p className="text-xs text-slate-600 text-right">
          {value.length.toLocaleString()} characters
        </p>
      )}
    </div>
  );
}
