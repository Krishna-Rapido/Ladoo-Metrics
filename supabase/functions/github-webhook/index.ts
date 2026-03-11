/**
 * Supabase Edge Function: github-webhook
 *
 * Receives GitHub webhook events (pull_request, check_suite) and posts
 * status updates to the corresponding Slack thread via the slack_github_mappings table.
 *
 * Environment secrets (set in Supabase Dashboard):
 *   SLACK_BOT_TOKEN        — xoxb-... bot token
 *   GITHUB_WEBHOOK_SECRET  — shared HMAC secret for signature verification
 *   SUPABASE_URL           — auto-provided by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — auto-provided by Supabase
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TABLE = "slack_github_mappings";

// --- HMAC Signature Verification ---

async function verifySignature(
  payload: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const computed = `sha256=${Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;

  // Constant-time comparison
  if (computed.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

// --- Slack Messaging ---

async function postToSlack(
  channel: string,
  threadTs: string,
  text: string
): Promise<void> {
  const token = Deno.env.get("SLACK_BOT_TOKEN");
  if (!token) {
    console.error("SLACK_BOT_TOKEN not set");
    return;
  }

  const resp = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, thread_ts: threadTs, text }),
  });

  if (!resp.ok) {
    console.error("Slack API error:", resp.status, await resp.text());
  }
}

// --- Supabase Helpers ---

function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function getMappingByIssue(issueNumber: number) {
  const sb = getSupabaseClient();
  const { data } = await sb
    .from(TABLE)
    .select("*")
    .eq("github_issue_number", issueNumber)
    .limit(1)
    .single();
  return data;
}

async function getMappingByPR(prNumber: number) {
  const sb = getSupabaseClient();
  const { data } = await sb
    .from(TABLE)
    .select("*")
    .eq("github_pr_number", prNumber)
    .limit(1)
    .single();
  return data;
}

async function updateMapping(
  id: string,
  updates: Record<string, unknown>
): Promise<void> {
  const sb = getSupabaseClient();
  await sb.from(TABLE).update(updates).eq("id", id);
}

// --- Extract Issue Number from PR Body ---

function extractIssueNumber(body: string | null): number | null {
  if (!body) return null;
  // Match "Closes #123" or "Fixes #123" patterns
  const match = body.match(/(?:closes|fixes|resolves)\s+#(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

// --- Event Handlers ---

async function handlePullRequestOpened(payload: Record<string, unknown>) {
  const pr = payload.pull_request as Record<string, unknown>;
  const prNumber = pr.number as number;
  const prUrl = pr.html_url as string;
  const prTitle = pr.title as string;
  const body = pr.body as string | null;

  const issueNumber = extractIssueNumber(body);
  if (!issueNumber) {
    console.log("PR body has no Closes #N reference, skipping");
    return;
  }

  const mapping = await getMappingByIssue(issueNumber);
  if (!mapping) {
    console.log(`No mapping found for issue #${issueNumber}`);
    return;
  }

  // Update mapping with PR info
  await updateMapping(mapping.id, {
    github_pr_number: prNumber,
    github_pr_url: prUrl,
    status: "pr_opened",
  });

  await postToSlack(
    mapping.slack_channel,
    mapping.slack_thread_ts,
    `:rocket: *PR created:* <${prUrl}|#${prNumber} — ${prTitle}>\nCI checks are running...`
  );
}

async function handleCheckSuiteCompleted(payload: Record<string, unknown>) {
  const checkSuite = payload.check_suite as Record<string, unknown>;
  const conclusion = checkSuite.conclusion as string;
  const pullRequests = checkSuite.pull_requests as Array<Record<string, unknown>>;

  if (!pullRequests || pullRequests.length === 0) return;

  const prNumber = pullRequests[0].number as number;
  const mapping = await getMappingByPR(prNumber);
  if (!mapping) {
    console.log(`No mapping found for PR #${prNumber}`);
    return;
  }

  if (conclusion === "success") {
    await updateMapping(mapping.id, { status: "tests_passed" });
    await postToSlack(
      mapping.slack_channel,
      mapping.slack_thread_ts,
      `:white_check_mark: All CI checks passed for PR #${prNumber}. Ready for merge.`
    );
  } else if (conclusion === "failure") {
    await updateMapping(mapping.id, { status: "tests_failed" });
    await postToSlack(
      mapping.slack_channel,
      mapping.slack_thread_ts,
      `:x: CI checks failed for PR #${prNumber}. Claude may push a fix.`
    );
  }
}

async function handlePullRequestMerged(payload: Record<string, unknown>) {
  const pr = payload.pull_request as Record<string, unknown>;
  const merged = pr.merged as boolean;
  if (!merged) return;

  const prNumber = pr.number as number;
  const mapping = await getMappingByPR(prNumber);
  if (!mapping) {
    console.log(`No mapping found for PR #${prNumber}`);
    return;
  }

  await updateMapping(mapping.id, { status: "merged" });
  await postToSlack(
    mapping.slack_channel,
    mapping.slack_thread_ts,
    `:tada: *PR #${prNumber} merged!* Changes will be deployed shortly.`
  );
}

// --- Main Handler ---

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const secret = Deno.env.get("GITHUB_WEBHOOK_SECRET");
  if (!secret) {
    console.error("GITHUB_WEBHOOK_SECRET not set");
    return new Response("Server misconfigured", { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!(await verifySignature(body, signature, secret))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = req.headers.get("x-github-event");
  const payload = JSON.parse(body);

  try {
    if (event === "pull_request") {
      const action = payload.action as string;
      if (action === "opened") {
        await handlePullRequestOpened(payload);
      } else if (action === "closed") {
        await handlePullRequestMerged(payload);
      }
    } else if (event === "check_suite") {
      if (payload.action === "completed") {
        await handleCheckSuiteCompleted(payload);
      }
    }
  } catch (err) {
    console.error("Error handling webhook:", err);
    return new Response("Internal error", { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
