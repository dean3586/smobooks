import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { receiptId } = await request.json();

    if (!receiptId) {
      return NextResponse.json({ error: "Missing receiptId" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get the receipt to find the image path
    const { data: receipt } = await supabase
      .from("receipts")
      .select("image_path")
      .eq("id", receiptId)
      .single();

    // Delete the image from storage
    if (receipt?.image_path) {
      await supabase.storage.from("receipts").remove([receipt.image_path]);
    }

    // Delete the receipt record
    const { error } = await supabase
      .from("receipts")
      .delete()
      .eq("id", receiptId);

    if (error) {
      console.error("Delete error:", error);
      return NextResponse.json({ error: "Failed to delete receipt" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete handler error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
