import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
const ALLOWED_BUCKETS = {
  avatars: {
    public: true,
    roles: null,
  },
  "payment-proofs": {
    public: true,
    roles: ["admin", "finance", "payroll_admin"],
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
  };
  return byType[file.type] ?? "jpg";
}

async function ensureBucket(bucket: AllowedBucket) {
  const admin = await createAdminSupabaseClient();
  const config = ALLOWED_BUCKETS[bucket];
  const { error: getError } = await admin.storage.getBucket(bucket);

  if (!getError) return admin;

  const { error: createError } = await admin.storage.createBucket(bucket, {
    public: config.public,
    fileSizeLimit: MAX_FILE_SIZE,
    allowedMimeTypes: [...ALLOWED_IMAGE_TYPES],
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

    // Validate file type for image uploads
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a JPG, PNG, GIF, or WebP image." },
        { status: 400 }
      );
    }

    // Max file size: 5MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = extensionFor(file);
    const timestamp = `${Date.now()}-${crypto.randomUUID()}`;
    const fileName = folder 
      ? `${safePathSegment(folder)}/${timestamp}.${ext}`
      : `${timestamp}.${ext}`;

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

    // Get public URL
    const { data: { publicUrl } } = storageClient.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return NextResponse.json({
      url: publicUrl,
      path: data.path,
    });
  } catch (err) {
    console.error("[api/upload] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
