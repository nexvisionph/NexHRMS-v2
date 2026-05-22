import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB for avatars
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB for 201 documents

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
const ALLOWED_DOCUMENT_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;

const ALLOWED_BUCKETS = {
  avatars: {
    public: true,
    roles: null,
    maxSize: MAX_IMAGE_SIZE,
    allowedTypes: ALLOWED_IMAGE_TYPES as readonly string[],
    typeError: "Invalid file type. Please upload a JPG, PNG, GIF, or WebP image.",
  },
  "payment-proofs": {
    public: true,
    roles: ["admin", "finance", "payroll_admin"],
    maxSize: MAX_IMAGE_SIZE,
    allowedTypes: ALLOWED_IMAGE_TYPES as readonly string[],
    typeError: "Invalid file type. Please upload a JPG, PNG, GIF, or WebP image.",
  },
  "employee-documents": {
    public: false,
    roles: null, // All authenticated users can upload (RLS on storage handles folder-level access)
    maxSize: MAX_DOCUMENT_SIZE,
    allowedTypes: ALLOWED_DOCUMENT_TYPES as readonly string[],
    typeError: "Invalid file type. Please upload a JPG, PNG, or PDF file.",
  },
} as const;

type AllowedBucket = keyof typeof ALLOWED_BUCKETS;

function isAllowedBucket(bucket: string): bucket is AllowedBucket {
  return bucket in ALLOWED_BUCKETS;
}

function safePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
}

function extensionFor(file: File) {
  const byType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "application/pdf": "pdf",
  };
  return byType[file.type] ?? "bin";
}

async function ensureBucket(bucket: AllowedBucket) {
  const admin = await createAdminSupabaseClient();
  const config = ALLOWED_BUCKETS[bucket];
  const { error: getError } = await admin.storage.getBucket(bucket);

  if (!getError) return admin;

  const { error: createError } = await admin.storage.createBucket(bucket, {
    public: config.public,
    fileSizeLimit: config.maxSize,
    allowedMimeTypes: [...config.allowedTypes],
  });

  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    throw new Error(`Could not prepare "${bucket}" storage bucket: ${createError.message}`);
  }

  return admin;
}

/**
 * POST /api/upload
 * Uploads a file to Supabase Storage.
 * Body: FormData with { file, bucket, folder? }
 * Auth: Requires valid Supabase session.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const bucket = formData.get("bucket") as string;
    const folder = formData.get("folder") as string | null;

    if (!file || !bucket) {
      return NextResponse.json(
        { error: "Missing file or bucket name" },
        { status: 400 }
      );
    }

    if (!isAllowedBucket(bucket)) {
      return NextResponse.json(
        { error: "Invalid upload destination" },
        { status: 400 }
      );
    }

    const bucketConfig = ALLOWED_BUCKETS[bucket];

    // Role-based access check
    if (bucketConfig.roles) {
      const admin = await createAdminSupabaseClient();
      const { data: profile, error: profileError } = await admin
        .from("employees")
        .select("role")
        .eq("profile_id", user.id)
        .single();

      if (profileError || !profile || !bucketConfig.roles.includes(profile.role)) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        );
      }
    }

    // Validate file type
    if (!bucketConfig.allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: bucketConfig.typeError },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > bucketConfig.maxSize) {
      const maxMB = Math.round(bucketConfig.maxSize / (1024 * 1024));
      return NextResponse.json(
        { error: `File too large. Maximum size is ${maxMB}MB.` },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = extensionFor(file);
    const timestamp = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 60);
    const fileName = folder 
      ? `${safePathSegment(folder)}/${timestamp}-${safeName}`
      : `${timestamp}-${safeName}`;

    // Convert File to ArrayBuffer (Supabase Storage expects this)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const storageClient = await ensureBucket(bucket);

    const { data, error: uploadError } = await storageClient.storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[api/upload] Storage error:", uploadError);
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // For public buckets, return the public URL
    // For private buckets, return the storage path (signed URLs generated on demand)
    if (bucketConfig.public) {
      const { data: { publicUrl } } = storageClient.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return NextResponse.json({
        url: publicUrl,
        path: data.path,
        size: file.size,
        type: file.type,
      });
    }

    // Private bucket — return path only (client will use signed URLs for viewing)
    return NextResponse.json({
      url: null,
      path: data.path,
      size: file.size,
      type: file.type,
    });
  } catch (err) {
    console.error("[api/upload] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
