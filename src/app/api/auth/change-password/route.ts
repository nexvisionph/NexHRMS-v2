import { NextResponse } from "next/server";
import { changeMyPassword } from "@/services/auth.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { newPassword } = body;

    if (!newPassword || typeof newPassword !== "string") {
      return NextResponse.json({ error: "New password is required" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const result = await changeMyPassword(newPassword);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[API] change-password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
