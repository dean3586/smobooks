import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { receiptId, purpose } = await request.json();

    if (!receiptId || !purpose) {
      return NextResponse.json({ error: "Missing receiptId or purpose" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { error } = await supabase
      .from("receipts")
      .update({ description: purpose })
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
