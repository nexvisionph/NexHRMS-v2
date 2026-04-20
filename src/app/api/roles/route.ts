import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/services/supabase-server";

// ─── GET /api/roles — Fetch all roles + their dashboard layouts ──────────────
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch roles
  const { data: roles, error: rolesErr } = await supabase
    .from("roles_custom")
    .select("id, name, slug, color, icon, is_system, permissions, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (rolesErr) return NextResponse.json({ error: rolesErr.message }, { status: 500 });

  // Fetch dashboard layouts
  const { data: layouts } = await supabase
    .from("dashboard_layouts")
    .select("role_id, widgets, updated_at");

  const layoutMap = new Map((layouts ?? []).map((l) => [l.role_id, l.widgets]));

  const mapped = (roles ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    color: r.color,
    icon: r.icon,
    isSystem: r.is_system,
    permissions: r.permissions ?? [],
    dashboardLayout: layoutMap.has(r.id)
      ? { roleId: r.id, widgets: layoutMap.get(r.id) }
      : undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return NextResponse.json(mapped);
}

// ─── POST /api/roles — Create a new custom role ─────────────────────────────
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check caller is admin
  const { data: emp } = await supabase
    .from("employees")
    .select("role")
    .eq("profile_id", user.id)
    .single();
  if (!emp || emp.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { id, name, slug, color, icon, permissions, dashboardLayout } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
  }

  // Validate slug format
  if (!/^[a-z0-9_]+$/.test(slug)) {
    return NextResponse.json({ error: "Slug must contain only lowercase letters, numbers, and underscores" }, { status: 400 });
  }

  const { data: role, error } = await supabase
    .from("roles_custom")
    .insert({
      id: id || undefined,
      name,
      slug,
      color: color || "#6366f1",
      icon: icon || "Users",
      is_system: false,
      permissions: permissions || [],
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A role with that slug already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Optionally save dashboard layout
  if (dashboardLayout?.widgets && role) {
    await supabase.from("dashboard_layouts").upsert({
      role_id: role.id,
      widgets: dashboardLayout.widgets,
      updated_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    id: role.id,
    name: role.name,
    slug: role.slug,
    color: role.color,
    icon: role.icon,
    isSystem: role.is_system,
    permissions: role.permissions ?? [],
    dashboardLayout: dashboardLayout || undefined,
    createdAt: role.created_at,
    updatedAt: role.updated_at,
  }, { status: 201 });
}

// ─── PUT /api/roles — Update an existing role ────────────────────────────────
export async function PUT(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: emp } = await supabase
    .from("employees")
    .select("role")
    .eq("profile_id", user.id)
    .single();
  if (!emp || emp.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { id, name, color, icon, permissions, dashboardLayout } = body;

  if (!id) return NextResponse.json({ error: "Role id is required" }, { status: 400 });

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updatePayload.name = name;
  if (color !== undefined) updatePayload.color = color;
  if (icon !== undefined) updatePayload.icon = icon;
  if (permissions !== undefined) updatePayload.permissions = permissions;

  const { data: role, error } = await supabase
    .from("roles_custom")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Upsert dashboard layout
  if (dashboardLayout?.widgets) {
    await supabase.from("dashboard_layouts").upsert({
      role_id: id,
      widgets: dashboardLayout.widgets,
      updated_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    id: role.id,
    name: role.name,
    slug: role.slug,
    color: role.color,
    icon: role.icon,
    isSystem: role.is_system,
    permissions: role.permissions ?? [],
    dashboardLayout: dashboardLayout || undefined,
    createdAt: role.created_at,
    updatedAt: role.updated_at,
  });
}

// ─── DELETE /api/roles — Delete a custom role ────────────────────────────────
export async function DELETE(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: emp } = await supabase
    .from("employees")
    .select("role")
    .eq("profile_id", user.id)
    .single();
  if (!emp || emp.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Role id is required" }, { status: 400 });

  // Don't allow deleting system roles
  const { data: existing } = await supabase
    .from("roles_custom")
    .select("is_system")
    .eq("id", id)
    .single();

  if (existing?.is_system) {
    return NextResponse.json({ error: "Cannot delete system roles" }, { status: 403 });
  }

  // Delete dashboard layout first (FK constraint)
  await supabase.from("dashboard_layouts").delete().eq("role_id", id);

  const { error } = await supabase.from("roles_custom").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
