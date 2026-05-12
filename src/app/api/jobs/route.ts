import { NextRequest, NextResponse } from "next/server";

/**
 * Jobs API — CRUD for job postings
 * In demo mode, the client-side store handles state.
 * In production, this would interact with Supabase.
 */

export async function GET() {
  // In production, fetch from Supabase
  return NextResponse.json({ ok: true, data: [], message: "Use client-side store in demo mode" });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, department, location, jobType, experienceLevel, description, requirements, responsibilities, openings } = body;

    if (!title || !department) {
      return NextResponse.json({ ok: false, error: "Title and department are required" }, { status: 400 });
    }

    // In production, insert into Supabase
    return NextResponse.json({
      ok: true,
      data: { id: crypto.randomUUID(), title, department, location, jobType, experienceLevel, description, requirements, responsibilities, openings, status: "draft", createdAt: new Date().toISOString() },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: "Job ID is required" }, { status: 400 });
    }

    // In production, update in Supabase
    return NextResponse.json({ ok: true, data: { id, ...updates, updatedAt: new Date().toISOString() } });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ ok: false, error: "Job ID is required" }, { status: 400 });
  }

  // In production, delete from Supabase
  return NextResponse.json({ ok: true, message: "Job deleted" });
}
