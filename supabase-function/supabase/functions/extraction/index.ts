import { Anthropic } from "@anthropic-ai/sdk";
import "jsr:@std/dotenv/load";
import { SYSTEM_PROMPT } from "./prompt.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";
import { insertEventIntoDatabase } from "./dbInsert.ts";

// getting secrets
const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
const supabaseBucket = Deno.env.get("BUCKET_NAME") || "";

const anthropic = new Anthropic({ apiKey: anthropicKey });

// Configure CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  console.log("extraction called");

  // setup client and get the user who called
  // Get the session or user object
  const authHeader = req.headers.get("Authorization")!;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    }
  );
  const token = authHeader.replace("Bearer ", "");
  const { data } = await supabase.auth.getUser(token);
  const user = data.user;
  const { pdfUrl, eventName } = await req.json();

  // input validation
  if (!pdfUrl || !eventName) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "error: pdfUrl not in request body",
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }

  // anthropic api call
  const response = await anthropic.messages.create({
    model: "claude-3-7-sonnet-20250219",
    max_tokens: 5000,
    temperature: 1,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "url",
              url: pdfUrl,
            },
          },
        ],
      },
    ],
  });
  //token usage tracking
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  console.log("input tokens: ", inputTokens, "\noutput tokens: ", outputTokens);
  if (response.content[0] && response.content[0].type == "text") {
    const quoteJson = extractJson(response.content[0].text);
    let filepath = `${user?.id}/${eventName}/data.json`;
    // upload JSON to bucket
    const { data, error } = await supabase.storage
      .from(supabaseBucket)
      .upload(filepath, JSON.stringify(quoteJson), {
        contentType: "application/json",
        upsert: true,
      });
    console.log("json upload data: ", data, "\njson upload error: ", error);

    // generate CSV from the first total_quote_options and save
    if (
      quoteJson.total_quote_options &&
      quoteJson.total_quote_options.length > 0
    ) {
      const csvData = createCsvSummary(quoteJson);
      const csvFilepath = `${user?.id}/${eventName}/summary.csv`;

      const { data: csvResponse, error: csvError } = await supabase.storage
        .from(supabaseBucket)
        .upload(csvFilepath, csvData, {
          contentType: "text/csv",
          upsert: true,
        });

      console.log(
        "csv upload response: ",
        csvResponse,
        "\ncsv upload error: ",
        csvError
      );
      const dbInsertResult = await insertEventIntoDatabase(
        supabase,
        user,
        eventName,
        quoteJson
      );
      console.log("Database insertion result:", dbInsertResult);
    } else {
      console.log("No total_quote_options found to convert to CSV");
    }
  } else {
    //TODO: throw error
    console.error("No text content found in Claude response");
  }

  return new Response(
    JSON.stringify({ success: true, message: "Extraction successful" }),
    {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    }
  );
});

// Function to extract JSON from a Claude message
function extractJson(text: string): any {
  // Use regex to find the JSON in Claude's response
  const match = text.match(/<JSON>([\s\S]*?)<\/JSON>/);
  if (match && match[1]) {
    try {
      // Parse the extracted string into a JSON object
      const jsonObject = JSON.parse(match[1]);
      return jsonObject;
    } catch (error) {
      console.error("Error parsing JSON:", error);
      return {};
    }
  }

  return {};
}

// pulls the "best" total quote and other summary information all into one csv
function createCsvSummary(data: any): string {
  if (!data.total_quote_options || data.total_quote_options.length === 0) {
    return "No quote options available";
  }

  // Get the first option
  const option = data.total_quote_options[0];

  // Build CSV headers and rows
  let csvRows = [];

  // Basic quote information
  csvRows.push(["Event Quote Summary"]);
  csvRows.push(["Currency", data.currency || "Not Specified"]);
  csvRows.push(["Start Date", data.start_date || "Not Specified"]);
  csvRows.push(["End Date", data.end_date || "Not Specified"]);
  csvRows.push(["Total Quote", option.total_quote || "Not Specified"]);
  csvRows.push([""]); // Empty row for spacing

  // Features section
  if (option.features) {
    csvRows.push(["Quote Features"]);

    // Helper function to handle both array and string values consistently
    const processFeature = (featureName: string, featureValue: any) => {
      if (!featureValue) return; // Skip if undefined or null

      csvRows.push([featureName]);

      if (Array.isArray(featureValue)) {
        // Handle as array
        featureValue.forEach((item: string) => {
          csvRows.push(["", item]);
        });
      } else {
        // Handle as single string
        csvRows.push(["", featureValue]);
      }

      csvRows.push([""]); // Add spacing after feature
    };

    // Process each feature type
    processFeature("Accommodation", option.features.accommodation);
    processFeature("Meeting", option.features.meeting);
    processFeature("Food & Beverage", option.features.food_beverage);
    processFeature("Extras", option.features.extras);
  }

  // General notes
  if (data.general_notes && data.general_notes.length > 0) {
    csvRows.push(["General Notes"]);
    data.general_notes.forEach((note: string) => {
      csvRows.push(["", note]);
    });
  }

  // Convert rows to CSV string
  const csvContent = csvRows
    .map((row) => {
      return row
        .map((cell) => {
          // Escape any commas or quotes in the cell content
          const escaped = String(cell).replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(",");
    })
    .join("\n");

  return csvContent;
}
