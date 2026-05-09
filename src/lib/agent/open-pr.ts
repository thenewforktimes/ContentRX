/**
 * Draft-PR opener for the weekly review agent (Phase G3 follow-up).
 *
 * Strategy: the agent never edits customer strings. To open a draft
 * pull request without touching code, we create a tiny "marker" file
 * on a fresh branch (`.contentrx/agent-runs/<run-at>.md` carrying
 * the digest itself), then open a draft PR with the same digest as
 * the PR body. Customers see the digest twice — once in the PR
 * description, once in the file diff — which is the desired
 * redundancy: the PR description is the inbox-readable version and
 * the file gives them a permanent reference inside the repo.
 *
 * Failure modes are returned, never thrown — the cron iterates
 * across multiple teams and one team's broken installation should
 * not stop the run for the rest.
 */

import { installationRequest } from "./github-app";

export type OpenPrInput = {
  installationId: number;
  owner: string;
  repo: string;
  branch: string;
  /** The digest markdown rendered by renderDigest(). Goes into both
   * the marker file and the PR body. */
  digestMarkdown: string;
  /** ISO timestamp the agent run was generated at — used in the
   * branch name + the marker filename so multiple runs don't
   * collide on the same branch. */
  runAtIso: string;
};

export type OpenPrResult =
  | {
      ok: true;
      number: number;
      htmlUrl: string;
      branchName: string;
    }
  | {
      ok: false;
      reason:
        | "no_default_branch"
        | "branch_create_failed"
        | "file_create_failed"
        | "pr_create_failed"
        | "config_missing";
      message: string;
    };

/**
 * Open a draft PR with the digest. Steps:
 *   1. GET /repos/:owner/:repo to read the default branch SHA.
 *   2. POST /repos/:owner/:repo/git/refs to create a fresh branch
 *      off the default branch.
 *   3. PUT /repos/:owner/:repo/contents/<path> to create the marker
 *      file on the new branch with the digest as the contents.
 *   4. POST /repos/:owner/:repo/pulls to open a draft PR. The body
 *      is the digest markdown.
 *
 * Idempotency: branch names embed the run-at timestamp, so a
 * re-run for the same minute would collide. The branch creation
 * step returns 422 in that case — we don't retry blindly; we
 * surface as `branch_create_failed` and the cron logs it.
 */
export async function openPrForDigest(
  input: OpenPrInput,
): Promise<OpenPrResult> {
  let request: ReturnType<typeof installationRequest>;
  try {
    request = installationRequest(input.installationId);
  } catch {
    return {
      ok: false,
      reason: "config_missing",
      message: "GitHub App env vars are not set",
    };
  }

  const { owner, repo, digestMarkdown, runAtIso, branch } = input;

  // 1. Default-branch SHA. The branch we open the PR against is the
  //    customer's chosen target_branch (defaults to "main"); the
  //    branch we BASE the new branch on is the same.
  let baseSha: string;
  try {
    const refResp = await request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    baseSha = refResp.data.object.sha;
  } catch (err) {
    return {
      ok: false,
      reason: "no_default_branch",
      message:
        err instanceof Error ? err.message : "Couldn't read base ref",
    };
  }

  // 2. Create the new branch.
  const slug = runAtIso.replace(/[:.]/g, "-").replace(/Z$/, "Z");
  const branchName = `contentrx-agent/run-${slug}`;
  try {
    await request("POST /repos/{owner}/{repo}/git/refs", {
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });
  } catch (err) {
    return {
      ok: false,
      reason: "branch_create_failed",
      message:
        err instanceof Error ? err.message : "Couldn't create branch",
    };
  }

  // 3. Create the marker file with the digest as the contents.
  const filePath = `.contentrx/agent-runs/${slug}.md`;
  try {
    await request(
      "PUT /repos/{owner}/{repo}/contents/{path}",
      {
        owner,
        repo,
        path: filePath,
        message: `chore(contentrx): weekly review digest ${slug}`,
        content: Buffer.from(digestMarkdown, "utf-8").toString("base64"),
        branch: branchName,
      },
    );
  } catch (err) {
    return {
      ok: false,
      reason: "file_create_failed",
      message:
        err instanceof Error ? err.message : "Couldn't create marker file",
    };
  }

  // 4. Open the draft PR.
  try {
    const prResp = await request("POST /repos/{owner}/{repo}/pulls", {
      owner,
      repo,
      title: `ContentRX weekly review · ${slug}`,
      head: branchName,
      base: branch,
      body: digestMarkdown,
      draft: true,
    });
    return {
      ok: true,
      number: prResp.data.number,
      htmlUrl: prResp.data.html_url,
      branchName,
    };
  } catch (err) {
    return {
      ok: false,
      reason: "pr_create_failed",
      message:
        err instanceof Error ? err.message : "Couldn't open draft PR",
    };
  }
}
