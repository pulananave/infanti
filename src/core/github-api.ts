/**
 * GitHub API client for pushing files directly to the repository.
 * Uses the GitHub REST API v3 (no extra dependencies needed).
 */

const GITHUB_API = 'https://api.github.com';

// Stored in localStorage for security
const TOKEN_KEY = 'infanti_github_token';
const REPO_KEY = 'infanti_github_repo';

export function setGithubToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getGithubToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setGithubRepo(owner: string, repo: string): void {
  localStorage.setItem(REPO_KEY, `${owner}/${repo}`);
}

export function getGithubRepo(): { owner: string; repo: string } | null {
  const val = localStorage.getItem(REPO_KEY);
  if (!val) return null;
  const [owner, repo] = val.split('/');
  return { owner, repo };
}

// ============================================================
// API CALLS
// ============================================================

async function ghFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = getGithubToken();
  if (!token) throw new Error('GitHub token not configured');

  const resp = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`GitHub API ${resp.status}: ${err.message || resp.statusText}`);
  }

  return resp.json();
}

/**
 * Get the SHA of the latest commit on a branch.
 */
export async function getHeadSha(branch: string = 'main'): Promise<string> {
  const repo = getGithubRepo();
  if (!repo) throw new Error('GitHub repo not configured');
  const data = await ghFetch(`/repos/${repo.owner}/${repo.repo}/git/ref/heads/${branch}`);
  return data.object.sha;
}

/**
 * Get the tree SHA of a commit.
 */
export async function getCommitTreeSha(commitSha: string): Promise<string> {
  const repo = getGithubRepo();
  if (!repo) throw new Error('GitHub repo not configured');
  const data = await ghFetch(`/repos/${repo.owner}/${repo.repo}/git/commits/${commitSha}`);
  return data.tree.sha;
}

/**
 * Create a blob from content (text or base64 binary).
 */
export async function createBlob(content: string, encoding: 'utf-8' | 'base64' = 'utf-8'): Promise<string> {
  const repo = getGithubRepo();
  if (!repo) throw new Error('GitHub repo not configured');
  const data = await ghFetch(`/repos/${repo.owner}/${repo.repo}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content, encoding }),
  });
  return data.sha;
}

/**
 * Create a tree with file changes.
 */
export async function createTree(
  baseTreeSha: string,
  files: Array<{ path: string; sha: string; mode?: string }>
): Promise<string> {
  const repo = getGithubRepo();
  if (!repo) throw new Error('GitHub repo not configured');

  const tree = files.map(f => ({
    path: f.path,
    mode: f.mode || '100644',
    type: 'blob',
    sha: f.sha,
  }));

  const data = await ghFetch(`/repos/${repo.owner}/${repo.repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTreeSha, tree }),
  });
  return data.sha;
}

/**
 * Create a commit.
 */
export async function createCommit(
  message: string,
  treeSha: string,
  parentSha: string
): Promise<string> {
  const repo = getGithubRepo();
  if (!repo) throw new Error('GitHub repo not configured');
  const data = await ghFetch(`/repos/${repo.owner}/${repo.repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: treeSha,
      parents: [parentSha],
    }),
  });
  return data.sha;
}

/**
 * Update branch HEAD to point to a new commit.
 */
export async function updateRef(branch: string, commitSha: string): Promise<void> {
  const repo = getGithubRepo();
  if (!repo) throw new Error('GitHub repo not configured');
  await ghFetch(`/repos/${repo.owner}/${repo.repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commitSha, force: false }),
  });
}

/**
 * Get current file content (to check if it exists and get its SHA for updates).
 */
export async function getFile(path: string): Promise<{ sha: string; content: string } | null> {
  const repo = getGithubRepo();
  if (!repo) return null;
  try {
    const data = await ghFetch(`/repos/${repo.owner}/${repo.repo}/contents/${path}`);
    return {
      sha: data.sha,
      content: atob(data.content.replace(/\n/g, '')),
    };
  } catch {
    return null;
  }
}

// ============================================================
// HIGH-LEVEL: PUSH FILES
// ============================================================

export interface FileChange {
  path: string;
  content: string;        // UTF-8 text content
  binary?: boolean;       // If true, content is base64
  delete?: boolean;       // If true, delete the file
}

/**
 * Push multiple files in a single commit.
 */
export async function pushFiles(
  message: string,
  files: FileChange[],
  branch: string = 'main'
): Promise<string> {
  // 1. Get current HEAD
  const headSha = await getHeadSha(branch);
  const treeSha = await getCommitTreeSha(headSha);

  // 2. Create blobs for each file
  const treeEntries: Array<{ path: string; sha: string; mode?: string }> = [];

  for (const file of files) {
    if (file.delete) {
      // To delete, set sha to null in the tree
      treeEntries.push({ path: file.path, sha: '' as any, mode: '100644' });
      continue;
    }

    const encoding = file.binary ? 'base64' : 'utf-8';
    const blobSha = await createBlob(file.content, encoding);
    treeEntries.push({ path: file.path, sha: blobSha, mode: '100644' });
  }

  // 3. Create new tree
  const newTreeSha = await createTree(treeSha, treeEntries);

  // 4. Create commit
  const commitSha = await createCommit(message, newTreeSha, headSha);

  // 5. Update branch
  await updateRef(branch, commitSha);

  return commitSha;
}

/**
 * Convert a File object to base64.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Initialize GitHub config from the token the user provided.
 * Called once on app start.
 */
export function initGithubFromUrl(): void {
  // Set default repo
  if (!getGithubRepo()) {
    setGithubRepo('pulananave', 'infanti');
  }
}
