import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.52.0";
import * as zip from "https://deno.land/x/zipjs@v2.7.34/index.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  documentId: string;
  fileUrl: string;
  fileType: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: RequestBody = await req.json();
    const { documentId, fileUrl, fileType } = body;

    // Download the file
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error("Failed to download file");
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    let extractedText = "";

    // Extract text based on file type
    if (fileType.includes("pdf")) {
      // For PDF files, we'll use a simple text extraction
      const uint8Array = new Uint8Array(fileBuffer);
      const textDecoder = new TextDecoder("utf-8");
      extractedText = textDecoder.decode(uint8Array);

      // Basic cleanup - extract readable text between common PDF markers
      const textMatches = extractedText.match(/[\x20-\x7E\u00A0-\uFFFF]+/g);
      if (textMatches) {
        extractedText = textMatches.join(" ").replace(/\s+/g, " ").trim();
      }
    } else if (fileType.includes("word") || fileType.includes("document") || fileType.includes("officedocument")) {
      // For Word documents (.docx), extract text from document.xml
      try {
        const blob = new Blob([fileBuffer]);
        const reader = new zip.BlobReader(blob);
        const zipReader = new zip.ZipReader(reader);
        const entries = await zipReader.getEntries();

        // Find document.xml which contains the main content
        const documentXml = entries.find(entry => entry.filename === "word/document.xml");

        if (documentXml && documentXml.getData) {
          const textWriter = new zip.TextWriter();
          const xmlContent = await documentXml.getData(textWriter);

          // Extract text from XML tags
          const textMatches = xmlContent.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
          if (textMatches) {
            extractedText = textMatches
              .map(match => match.replace(/<[^>]+>/g, ""))
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();
          }
        }

        await zipReader.close();
      } catch (error) {
        console.error("Error extracting Word document:", error);
        // Fallback to basic extraction
        const uint8Array = new Uint8Array(fileBuffer);
        const textDecoder = new TextDecoder("utf-8", { fatal: false });
        extractedText = textDecoder.decode(uint8Array);
        extractedText = extractedText.replace(/[\x00-\x1F\x7F-\x9F]/g, " ").replace(/\s+/g, " ").trim();
      }
    } else {
      // For text-based files
      const textDecoder = new TextDecoder("utf-8");
      extractedText = textDecoder.decode(fileBuffer);
    }

    // Limit content to reasonable size (first 10000 characters)
    extractedText = extractedText.substring(0, 10000);

    // Update the document with extracted content
    const { error: updateError } = await supabase
      .from("chatbot_documents")
      .update({
        content: extractedText,
        content_extracted: true,
      })
      .eq("id", documentId);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        contentLength: extractedText.length,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error extracting document content:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
