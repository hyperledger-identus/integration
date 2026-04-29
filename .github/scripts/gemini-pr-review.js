const fs = require('fs');

const MAX_DIFF_LENGTH = 20000;
// Soft cap to prevent excessive API usage and runtime overhead for extremely large PRs
const MAX_FILES_TO_PROCESS = 300; 
const BOT_SIGNATURE = '## 🤖 Gemini PR Review (Advisory Only)';
const DISCLAIMER = '\n\n---\n*This is an AI-generated review. It does not block merging and should be validated by maintainers.*';
const FETCH_TIMEOUT = 15000;

async function fetchWithTimeout(url, options = {}) {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT);
  return await fetch(url, { ...options, signal });
}

async function getPRFilesAndDiff(repo, prNumber, token) {
  let allFiles = [];
  let page = 1;
  const perPage = 100;

  // 1. Pagination Handling
  console.log(`Fetching files for PR #${prNumber}...`);
  while (true) {
    const response = await fetchWithTimeout(`https://api.github.com/repos/${repo}/pulls/${prNumber}/files?per_page=${perPage}&page=${page}`, {
      headers: { Authorization: `token ${token}` },
    });
    if (!response.ok) throw new Error(`Failed to fetch PR files (page ${page}): ${response.statusText}`);
    
    const files = await response.json();
    if (!files.length) break;
    
    allFiles = allFiles.concat(files);
    if (files.length < perPage || allFiles.length >= MAX_FILES_TO_PROCESS) break;
    page++;
  }

  console.log(`Total files found in PR: ${allFiles.length}`);

  let diffText = '';
  let processedCount = 0;
  let filteredCount = 0;
  let patchMissingCount = 0;

  for (const file of allFiles) {
    const filename = file.filename;
    const isIgnored = filename.endsWith('.md') || 
                      filename.endsWith('.txt') || 
                      filename.startsWith('.github/workflows/') ||
                      filename.startsWith('.github/dependabot.yml');

    if (isIgnored) {
      filteredCount++;
      continue;
    }

    if (file.patch) {
      diffText += `File: ${filename}\n${file.patch}\n\n`;
      processedCount++;
    } else {
      patchMissingCount++;
    }
  }

  // 4. Improved Logging
  console.log(`File Processing Results:
  - Processed: ${processedCount}
  - Filtered (docs/config): ${filteredCount}
  - Skipped (binary / no patch files): ${patchMissingCount}
  - Total Fetched: ${allFiles.length}`);

  if (diffText.length > MAX_DIFF_LENGTH) {
    console.log(`Diff too large (${diffText.length} chars). Truncating to ${MAX_DIFF_LENGTH}.`);
    diffText = diffText.substring(0, MAX_DIFF_LENGTH) + '\n\n... (diff truncated for size limits)';
  }

  return diffText;
}

async function callGemini(prompt, apiKey, retryCount = 2) {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  for (let i = 0; i <= retryCount; i++) {
    try {
      const response = await fetchWithTimeout(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, topP: 0.95 }
        }),
      });

      if (!response.ok) throw new Error(`Gemini API Error: ${response.status}`);
      
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty Gemini response');
      return text;
    } catch (err) {
      console.warn(`Gemini attempt ${i + 1} failed: ${err.message}`);
      if (i === retryCount) throw err;
      await new Promise(res => setTimeout(res, 2000 * (i + 1)));
    }
  }
}

async function postReview(repo, prNumber, token, body) {
  const commentBody = `${BOT_SIGNATURE}\n\n${body}${DISCLAIMER}`;
  console.log('Upserting advisory review comment...');
  await postFallbackComment(repo, prNumber, token, commentBody);
}

async function postFallbackComment(repo, prNumber, token, body) {
  const listResp = await fetchWithTimeout(`https://api.github.com/repos/${repo}/issues/${prNumber}/comments`, {
    headers: { Authorization: `token ${token}` },
  });
  if (!listResp.ok) return;

  const comments = await listResp.json();
  const existing = comments.find(c => c.body.includes(BOT_SIGNATURE));

  const url = existing ? `https://api.github.com/repos/${repo}/issues/comments/${existing.id}` : `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`;
  const method = existing ? 'PATCH' : 'POST';

  await fetchWithTimeout(url, {
    method,
    headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
}

async function run() {
  const { GITHUB_TOKEN, GEMINI_API_KEY, GITHUB_REPOSITORY: REPO, GITHUB_EVENT_PATH, GITHUB_EVENT_NAME } = process.env;

  if (!GITHUB_TOKEN || !REPO || !GITHUB_EVENT_PATH) {
    console.error('Required environment variables are missing.');
    process.exit(1);
  }

  if (!GEMINI_API_KEY) {
    console.log('Skipping Gemini PR review: GEMINI_API_KEY is not available in this context.');
    process.exit(0);
  }

  const event = JSON.parse(fs.readFileSync(GITHUB_EVENT_PATH, 'utf8'));
  let prNumber;
  let triggerSource = '';

  if (GITHUB_EVENT_NAME === 'pull_request') {
    prNumber = event.pull_request.number;
    const labels = event.pull_request.labels || [];
    triggerSource = labels.some(l => l.name === 'ai-review') ? 'Label: ai-review' : 'Default: pull_request event';
  } else if (GITHUB_EVENT_NAME === 'issue_comment') {
    if (!event.issue.pull_request) return;
    
    // Authorization Check: Only allow repo owners, members, or collaborators
    const allowedAssociations = ['OWNER', 'MEMBER', 'COLLABORATOR'];
    if (!allowedAssociations.includes(event.comment.author_association)) {
      console.log(`Skipping: User ${event.comment.user.login} (${event.comment.author_association}) is not authorized.`);
      return;
    }

    prNumber = event.issue.number;
    const commentBody = event.comment.body || '';
    if (commentBody.includes('/gemini-review')) {
      triggerSource = 'Comment: /gemini-review';
    } else {
      return; 
    }
  }

  console.log(`🚀 Starting lightweight Gemini Review (Advisory) for PR #${prNumber}`);
  console.log(`Trigger: ${triggerSource}`);

  try {
    const diff = await getPRFilesAndDiff(REPO, prNumber, GITHUB_TOKEN);
    
    // 2. Empty Diff Case -> Post Feedback
    if (!diff || !diff.trim()) {
      console.log('No relevant code changes found after filtering.');
      await postReview(REPO, prNumber, GITHUB_TOKEN, '🔎 No relevant code changes found to review after filtering out documentation and configuration files.');
      return;
    }

    // 3. Improved Prompt
    const prompt = `You are a senior software engineer. Review the following code changes.
Structure your response as follows:
1. **Summary**: A concise summary of changes.
2. **Analysis**: Bug reports, security risks, or performance concerns.
3. **Best Practices**: Suggestions for better code quality.

Guidelines:
- Focus on actionable feedback and avoid vague statements.
- Be concise and use bullet points.
- If you find a potential issue, prefix it with "⚠️ Potential issue (not blocking):".
- Do not repeat the diff content.

DIFF CONTENT:
${diff}`;

    const reviewText = await callGemini(prompt, GEMINI_API_KEY);
    await postReview(REPO, prNumber, GITHUB_TOKEN, reviewText);
    console.log('Review process completed.');
  } catch (err) {
    console.error('Workflow failed gracefully:', err.message);
    await postReview(REPO, prNumber, GITHUB_TOKEN, '⚠️ **Gemini review currently unavailable.** Please check the workflow logs for details.');
  }
}

run().catch(console.error);
