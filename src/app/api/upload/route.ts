import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/services/supabase-server";

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

    // Validate file type for image uploads
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only images are allowed." },
        { status: 400 }
      );
    }

    // Max file size: 5MB
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = file.name.split(".").pop();
    const timestamp = Date.now();
    const fileName = folder 
      ? `${folder}/${timestamp}.${ext}`
      : `${timestamp}.${ext}`;

    // Convert File to ArrayBuffer (Supabase Storage expects this)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error: uploadError } = await supabase.storage
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
    const { data: { publicUrl } } = supabase.storage
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
