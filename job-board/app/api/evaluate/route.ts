import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServiceClient } from "@/lib/supabase";
import type { EvaluateRequest, EvaluateResponse } from "@/lib/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as EvaluateRequest;
    const { jobId, description, deliverable } = body;

    if (!jobId || !description || !deliverable) {
      return NextResponse.json(
        { error: "jobId, description, and deliverable are required" },
        { status: 400 }
      );
    }

    const prompt = `You are evaluating a completed job on Arc Network, a stablecoin-native blockchain.

Job Description:
${description}

Submitted Deliverable:
${deliverable}

Evaluate whether the deliverable satisfactorily completes the job as described.

Respond with a JSON object in exactly this format:
{
  "decision": "approve" or "reject",
  "reasoning": "2-4 sentences explaining your decision",
  "confidence": a number between 0 and 1
}

Be strict but fair. Only approve if the deliverable clearly addresses the job requirements. If the deliverable is incomplete, off-topic, or missing key elements, reject it.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Claude did not return valid JSON");
    }

    const result = JSON.parse(jsonMatch[0]) as EvaluateResponse;

    // Persist evaluation to Supabase
    try {
      const db = getServiceClient();
      const { data: job } = await db
        .from("jobs")
        .select("id")
        .eq("chain_job_id", jobId)
        .single();

      if (job) {
        await db.from("evaluations").insert({
          job_id: job.id,
          chain_job_id: jobId,
          decision: result.decision,
          reasoning: result.reasoning,
          confidence: result.confidence,
          evaluator: "claude-sonnet-4-6",
        });
      }
    } catch (dbErr) {
      // DB write failure should not block the response
      console.error("Failed to persist evaluation:", dbErr);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Evaluation error:", err);
    return NextResponse.json(
      { error: "Evaluation failed. Please try again." },
      { status: 500 }
    );
  }
}
