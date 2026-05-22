"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Upload, X, FileText, Image as ImageIcon, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.pdf";
const MAX_FILES = 3;
const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB total

export interface UploadedFile {
    file: File;
    preview?: string; // object URL for images
}

interface DocumentFileUploadProps {
    files: UploadedFile[];
    onChange: (files: UploadedFile[]) => void;
    disabled?: boolean;
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ type }: { type: string }) {
    if (type === "application/pdf") return <FileText className="h-4 w-4 text-red-500 shrink-0" />;
    return <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />;
}

export function DocumentFileUpload({ files, onChange, disabled }: DocumentFileUploadProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);

    const totalSize = files.reduce((sum, f) => sum + f.file.size, 0);

    const handleFiles = useCallback((incoming: FileList | File[]) => {
        const newFiles: UploadedFile[] = [];
        const fileArray = Array.from(incoming);

        for (const file of fileArray) {
            // Check type
            if (!ACCEPTED_TYPES.includes(file.type)) {
                toast.error(`"${file.name}" is not a supported file type. Use JPG, PNG, or PDF.`);
                continue;
            }

            // Check count
            if (files.length + newFiles.length >= MAX_FILES) {
                toast.error(`Maximum ${MAX_FILES} files allowed.`);
                break;
            }

            // Check total size
            const newTotal = totalSize + newFiles.reduce((s, f) => s + f.file.size, 0) + file.size;
            if (newTotal > MAX_TOTAL_SIZE) {
                toast.error("Total file size exceeds 10MB limit.");
                break;
            }

            const preview = file.type.startsWith("image/")
                ? URL.createObjectURL(file)
                : undefined;

            newFiles.push({ file, preview });
        }

        if (newFiles.length > 0) {
            onChange([...files, ...newFiles]);
        }
    }, [files, onChange, totalSize]);

    const removeFile = useCallback((index: number) => {
        const removed = files[index];
        if (removed.preview) URL.revokeObjectURL(removed.preview);
        onChange(files.filter((_, i) => i !== index));
    }, [files, onChange]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (disabled) return;
        handleFiles(e.dataTransfer.files);
    }, [handleFiles, disabled]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
    }, []);

    return (
        <div className="space-y-2">
            {/* Drop zone */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => !disabled && inputRef.current?.click()}
                className={`
                    border-2 border-dashed rounded-lg p-4 text-center cursor-pointer
                    transition-colors hover:border-primary/50 hover:bg-muted/30
                    ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                    ${files.length >= MAX_FILES ? "opacity-50 cursor-not-allowed" : ""}
                `}
            >
                <Upload className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                    {files.length >= MAX_FILES
                        ? "Maximum files reached"
                        : "Drop files here or click to browse"}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                    JPG, PNG, or PDF • Max {MAX_FILES} files • 10MB total
                </p>
            </div>

            <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                multiple
                className="hidden"
                disabled={disabled || files.length >= MAX_FILES}
                onChange={(e) => {
                    if (e.target.files) handleFiles(e.target.files);
                    e.target.value = ""; // reset so same file can be re-selected
                }}
            />

            {/* File list */}
            {files.length > 0 && (
                <div className="space-y-1.5">
                    {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                            <FileIcon type={f.file.type} />
                            <span className="truncate flex-1 text-xs">{f.file.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{formatSize(f.file.size)}</span>
                            <button
                                type="button"
                                onClick={() => setPreviewFile(f)}
                                className="text-muted-foreground hover:text-primary shrink-0"
                                title="Preview"
                            >
                                <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => removeFile(i)}
                                disabled={disabled}
                                className="text-muted-foreground hover:text-destructive shrink-0"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                        {files.length}/{MAX_FILES} files • {formatSize(totalSize)}/10MB
                    </p>
                </div>
            )}

            {/* Preview modal */}
            <Dialog open={!!previewFile} onOpenChange={(o) => !o && setPreviewFile(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh]">
                    {previewFile && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <FileIcon type={previewFile.file.type} />
                                    <span className="truncate">{previewFile.file.name}</span>
                                    <span className="text-xs text-muted-foreground font-normal ml-auto shrink-0">
                                        {formatSize(previewFile.file.size)}
                                    </span>
                                </DialogTitle>
                            </DialogHeader>
                            <div className="border rounded-lg bg-muted/30 flex items-center justify-center min-h-[400px] overflow-auto">
                                {previewFile.file.type.startsWith("image/") && previewFile.preview ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={previewFile.preview}
                                        alt={previewFile.file.name}
                                        className="max-w-full max-h-[60vh] object-contain rounded"
                                    />
                                ) : previewFile.file.type === "application/pdf" ? (
                                    <iframe
                                        src={URL.createObjectURL(previewFile.file)}
                                        className="w-full h-[60vh] rounded"
                                        title={previewFile.file.name}
                                    />
                                ) : (
                                    <div className="text-center py-12">
                                        <FileText className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                                        <p className="text-sm text-muted-foreground">Preview not available</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

/** Upload files to Supabase Storage via the /api/upload endpoint */
export async function uploadDocumentFiles(
    files: UploadedFile[],
    employeeId: string,
): Promise<{ paths: string[]; totalSize: number; fileType: string } | null> {
    if (files.length === 0) return null;

    const paths: string[] = [];
    let totalSize = 0;

    for (const { file } of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("bucket", "employee-documents");
        formData.append("folder", employeeId);

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Upload failed" }));
            throw new Error(err.error || "Upload failed");
        }

        const data = await res.json();
        paths.push(data.path);
        totalSize += file.size;
    }

    // Return the first file's type as the primary type
    const fileType = files[0].file.type;
    return { paths, totalSize, fileType };
}
