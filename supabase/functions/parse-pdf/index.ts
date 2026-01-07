import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { base64Content, fileName } = await req.json();

    if (!base64Content || typeof base64Content !== 'string') {
      return new Response(
        JSON.stringify({ error: 'base64Content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing PDF: ${fileName}`);

    // Decode base64 to binary
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Extract text from PDF using basic text extraction
    // PDF files contain text in various formats, we'll extract readable ASCII text
    let extractedText = '';
    
    // Convert to string and extract readable text
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const rawText = decoder.decode(bytes);
    
    // Find text between BT (begin text) and ET (end text) markers in PDF
    const textMatches = rawText.match(/BT[\s\S]*?ET/g) || [];
    
    for (const match of textMatches) {
      // Extract text from Tj and TJ operators
      const tjMatches = match.match(/\((.*?)\)\s*Tj/g) || [];
      const tjArrayMatches = match.match(/\[(.*?)\]\s*TJ/g) || [];
      
      for (const tj of tjMatches) {
        const text = tj.match(/\((.*?)\)/)?.[1] || '';
        extractedText += text + ' ';
      }
      
      for (const tja of tjArrayMatches) {
        const innerMatches = tja.match(/\((.*?)\)/g) || [];
        for (const inner of innerMatches) {
          const text = inner.slice(1, -1);
          extractedText += text;
        }
        extractedText += ' ';
      }
    }

    // Also try to extract plain text content (for simpler PDFs)
    const plainTextMatches = rawText.match(/stream[\s\S]*?endstream/g) || [];
    for (const stream of plainTextMatches) {
      // Extract readable ASCII characters
      const readable = stream.replace(/stream|endstream/g, '')
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (readable.length > 50) {
        extractedText += readable + ' ';
      }
    }

    // Clean up the extracted text
    extractedText = extractedText
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\t/g, ' ')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\s+/g, ' ')
      .trim();

    // If we couldn't extract much text, provide a fallback message
    if (extractedText.length < 50) {
      console.log('Limited text extracted from PDF, may be image-based');
      extractedText = `[PDF file: ${fileName}] This PDF may contain images or scanned content that couldn't be fully extracted. Please paste the text content manually for best results.`;
    }

    // Sanitize: remove null bytes and other problematic characters
    extractedText = extractedText.replace(/\u0000/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

    console.log(`Extracted ${extractedText.length} characters from PDF`);

    return new Response(
      JSON.stringify({ content: extractedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error parsing PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to parse PDF: ' + errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
