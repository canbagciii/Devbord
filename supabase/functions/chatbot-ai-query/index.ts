import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.52.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  categoryId: string;
  question: string;
  openaiApiKey?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('Chatbot AI Query function called');
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: RequestBody = await req.json();
    const { categoryId, question, openaiApiKey } = body;
    
    console.log('Request body:', { categoryId, question, hasApiKey: !!openaiApiKey });

    // If OpenAI API key is provided, use AI to answer from document content
    if (openaiApiKey) {
      console.log('Using AI mode with OpenAI');
      
      // Get documents with content from this category
      const { data: documents, error: searchError } = await supabase
        .from("chatbot_documents")
        .select("*")
        .eq("category_id", categoryId)
        .eq("is_active", true)
        .not("content", "is", null)
        .limit(10);

      console.log('Documents found:', documents?.length, 'Error:', searchError);

      if (searchError) {
        console.error("Document search error:", searchError);
      } else if (documents && documents.length > 0) {
        // Use OpenAI to generate answer based on document content
        const context = documents
          .map((doc: any) => `Document: ${doc.title}\n${doc.content}`)
          .join("\n\n");

        console.log('Sending request to OpenAI with context length:', context.length);

        const completionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: "Sen bir yardımcı asistansın. Sana verilen dökümanlar içerisinden kullanıcının sorusuna en uygun cevabı bul ve Türkçe olarak yanıtla. Cevabını döküman içeriğine dayandır. Eğer cevap döküman içinde yoksa, bunu açıkça belirt.",
              },
              {
                role: "user",
                content: `Dökümanlar:\n${context}\n\nSoru: ${question}`,
              },
            ],
            temperature: 0.3,
            max_tokens: 800,
          }),
        });

        console.log('OpenAI response status:', completionResponse.status);

        if (!completionResponse.ok) {
          const errorText = await completionResponse.text();
          console.error('OpenAI error:', errorText);
          throw new Error(`Failed to generate answer: ${errorText}`);
        }

        const completionData = await completionResponse.json();
        const answer = completionData.choices[0].message.content;
        
        console.log('OpenAI answer received, length:', answer.length);

        return new Response(
          JSON.stringify({
            success: true,
            answer,
            documents: documents,
            method: "ai",
          }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    console.log('Falling back to keyword search');

    // Fallback to keyword search
    const { data: documents, error: keywordError } = await supabase
      .from("chatbot_documents")
      .select("*")
      .eq("category_id", categoryId)
      .or(`title.ilike.%${question}%,description.ilike.%${question}%,keywords.cs.{${question}}`);

    if (keywordError) {
      throw keywordError;
    }

    const results = documents?.map((doc) => {
      const titleMatch = doc.title.toLowerCase().includes(question.toLowerCase());
      const descMatch = doc.description?.toLowerCase().includes(question.toLowerCase());
      const keywordMatch = doc.keywords?.some((k: string) => 
        k.toLowerCase().includes(question.toLowerCase())
      );

      return {
        document: doc,
        matchedKeywords: keywordMatch ? doc.keywords.filter((k: string) => 
          k.toLowerCase().includes(question.toLowerCase())
        ) : [],
        similarity: (titleMatch ? 0.5 : 0) + (descMatch ? 0.3 : 0) + (keywordMatch ? 0.2 : 0),
      };
    }) || [];

    const sortedResults = results.sort((a, b) => b.similarity - a.similarity);

    const answer = sortedResults.length > 0
      ? `${sortedResults.length} döküman bulundu. İlgili dökümanları aşağıda görebilirsiniz.`
      : "Aramanızla eşleşen döküman bulunamadı. Lütfen farklı anahtar kelimeler deneyin.";

    return new Response(
      JSON.stringify({
        success: true,
        answer,
        documents: sortedResults,
        method: "keyword",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error processing query:", error);
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
