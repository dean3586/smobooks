import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { receiptId, purpose, category } = await request.json();

    if (!receiptId) {
      return NextResponse.json({ error: "Missing receiptId" }, { status: 400 });
    }

    if (!purpose && !category) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const update: Record<string, string> = {};
    if (purpose) update.purpose = purpose;
    if (category) update.category = category;

    const { error } = await supabase
      .from("receipts")
      .update(update)
      .eq("id", receiptId);

    if (error) {
      console.error("Purpose update error:", error);
      return NextResponse.json({ error: "Failed to update purpose" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Purpose handler error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
