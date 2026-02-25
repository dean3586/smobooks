import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";
import { EXPENSE_CATEGORIES } from "@/lib/categories";
import sharp from "sharp";

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("receipt") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Accept common image types including HEIC from iPhones
    const allowedTypes = [
      "image/jpeg", "image/png", "image/webp",
      "image/heic", "image/heif",
      "image/gif", "image/tiff", "image/bmp",
    ];
    if (!allowedTypes.includes(file.type) && !file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload an image." },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Normalize image: convert to JPEG, auto-rotate based on EXIF, and resize if huge
    let normalizedBuffer: Buffer;
    try {
      normalizedBuffer = await sharp(inputBuffer)
        .rotate() // Auto-rotate based on EXIF orientation
        .jpeg({ quality: 85 })
        .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
        .toBuffer();
    } catch (e) {
      console.error("Image processing error:", e);
      return NextResponse.json(
        { error: "Could not process this image. Try taking the photo again." },
        { status: 400 }
      );
    }

    // Upload the normalized JPEG to Supabase Storage
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;
    const filePath = `uploads/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(filePath, normalizedBuffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("receipts")
      .getPublicUrl(filePath);

    const imageUrl = urlData.publicUrl;

    // Create receipt record with 'processing' status
    const { data: receipt, error: insertError } = await supabase
      .from("receipts")
      .insert({
        image_url: imageUrl,
        image_path: filePath,
        status: "processing",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json({ error: "Failed to create receipt record" }, { status: 500 });
    }

    // Process with Claude before responding (must await in serverless)
    const extracted = await processReceipt(receipt.id, normalizedBuffer);

    return NextResponse.json({
      success: true,
      receiptId: receipt.id,
      category: extracted?.category || null,
      vendor: extracted?.vendor || null,
      total: extracted?.total || null,
      message: "Receipt uploaded and processed!",
    });
  } catch (error) {
    console.error("Upload handler error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function processReceipt(
  receiptId: string,
  imageBuffer: Buffer
): Promise<Record<string, unknown> | null> {
  const supabase = createServiceClient();

  try {
    const base64Image = imageBuffer.toString("base64");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64Image,
              },
            },
            {
              type: "text",
              text: `You are a receipt data extraction assistant for a medical practice. The image may be rotated, upside down, or at an angle — read it in whatever orientation makes the text legible.

Extract the following information from this receipt image and return it as JSON only (no markdown, no code fences, just raw JSON):

{
  "vendor": "Store/business name",
  "receipt_date": "YYYY-MM-DD format",
  "total": 0.00,
  "tax": 0.00,
  "subtotal": 0.00,
  "payment_method": "cash/credit/debit/other",
  "category": "one of the categories below",
  "description": "Brief 1-line description of the purchase"
}

Categories (pick the best match):
${EXPENSE_CATEGORIES.join(", ")}

Rules:
- If you can't read a field clearly, set it to null
- For the date, use the date printed on the receipt
- For category, choose the single best match from the list above
- The total should be the final amount paid (including tax)
- Return ONLY valid JSON, nothing else`,
            },
          ],
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    const extracted = JSON.parse(textContent.text);

    await supabase
      .from("receipts")
      .update({
        vendor: extracted.vendor,
        receipt_date: extracted.receipt_date,
        total: extracted.total,
        tax: extracted.tax,
        subtotal: extracted.subtotal,
        payment_method: extracted.payment_method,
        category: extracted.category,
        description: extracted.description,
        raw_extraction: extracted,
        status: "completed",
      })
      .eq("id", receiptId);

    return extracted;
  } catch (error) {
    console.error("Processing error:", error);

    await supabase
      .from("receipts")
      .update({
        status: "failed",
        notes: `Processing error: ${error instanceof Error ? error.message : "Unknown error"}`,
      })
      .eq("id", receiptId);

    return null;
  }
}
