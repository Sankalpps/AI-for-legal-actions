import { useCallback, useState, useId } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileText, X, Loader2, Sparkles } from "lucide-react";
import clsx from "clsx";
import { uploadFile } from "../api";
import { SAMPLE_DOCUMENTS } from "../sampleData";

/**
 * DocumentUpload — WCAG 2.1 AA accessible file upload and text area component.
 * Features drag & drop, keyboard activation, explicit label binding, and status announcements.
 */
export default function DocumentUpload({
  label = "Document",
  placeholder = "Paste your legal document text here...",
  value,
  onChange,
  showUpload = true,
  minRows = 10,
  id,
}) {
  const generatedId = useId();
  const inputId = id || `doc-textarea-${generatedId}`;
  const dropzoneId = `dropzone-${generatedId}`;

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

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "text/plain": [".txt"] },
    maxFiles: 1,
    disabled: uploading,
    noKeyboard: false,
  });

  const clearFile = () => {
    setUploadedFile(null);
    onChange("");
  };

  const handleDropzoneKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label htmlFor={inputId} className="label mb-0 cursor-pointer font-semibold text-white">
          {label}
        </label>
        <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Sample Documents">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mr-1">
            <Sparkles size={12} className="text-amber-400" aria-hidden="true" /> Load Sample:
          </span>
          {SAMPLE_DOCUMENTS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => {
                setUploadedFile({ name: `${sample.title}.txt`, chars: sample.text.length });
                onChange(sample.text);
              }}
              aria-label={`Load sample document ${sample.title}`}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:outline-none"
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
          id={dropzoneId}
          tabIndex={0}
          role="button"
          aria-label={`Upload document file for ${label}. Drag and drop PDF or TXT, or press Enter to browse.`}
          onKeyDown={handleDropzoneKeyDown}
          className={clsx(
            "border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:outline-none",
            isDragActive
              ? "border-primary-500 bg-primary-900/20"
              : "border-slate-700 hover:border-slate-600 hover:bg-slate-800/50",
            uploading && "opacity-50 cursor-not-allowed"
          )}
        >
          <input {...getInputProps()} aria-label={`File input for ${label}`} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2" role="status" aria-live="polite">
              <Loader2 className="h-8 w-8 text-primary-400 animate-spin" aria-hidden="true" />
              <p className="text-sm text-slate-300 font-medium">Extracting text from file...</p>
            </div>
          ) : uploadedFile ? (
            <div className="flex items-center justify-center gap-3" role="status" aria-live="polite">
              <FileText className="h-6 w-6 text-green-400" aria-hidden="true" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">{uploadedFile.name}</p>
                <p className="text-xs text-slate-300">
                  {uploadedFile.chars.toLocaleString()} characters extracted
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearFile();
                }}
                aria-label={`Remove uploaded file ${uploadedFile.name}`}
                className="ml-2 p-1 hover:bg-slate-700 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:outline-none"
              >
                <X size={14} className="text-slate-400 hover:text-white" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <UploadCloud className="h-8 w-8 text-slate-400" aria-hidden="true" />
              <p className="text-sm text-slate-300">
                {isDragActive ? "Drop the file here..." : "Drag & drop PDF or TXT, or click/press Enter to browse"}
              </p>
              <p className="text-xs text-slate-400">Supported formats: PDF, TXT (Max 10MB)</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div role="alert" aria-live="assertive" className="text-sm text-red-300 bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Divider */}
      {showUpload && (
        <div className="flex items-center gap-3" aria-hidden="true">
          <div className="flex-1 h-px bg-slate-800" />
          <span className="text-xs text-slate-400 font-medium">OR PASTE TEXT</span>
          <div className="flex-1 h-px bg-slate-800" />
        </div>
      )}

      {/* Textarea */}
      <textarea
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={minRows}
        aria-label={`${label} text input`}
        className="textarea-field focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:outline-none"
      />
      {value && (
        <p className="text-xs text-slate-400 text-right" aria-live="polite">
          {value.length.toLocaleString()} characters
        </p>
      )}
    </div>
  );
}
