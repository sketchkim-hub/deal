// Reads and writes content/db.json in the GitHub repository with the admin's own token.
// Every save is a commit; the Pages workflow then rebuilds the public site.

const API = 'https://api.github.com';

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export class GitHubError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export class Repo {
  constructor({ repo, branch = 'main', dataPath = 'content/db.json', token }) {
    this.repo = repo;
    this.branch = branch;
    this.dataPath = dataPath;
    this.token = token;
  }

  async req(path, { method = 'GET', body } = {}) {
    const res = await fetch(`${API}${path}`, {
      method,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new GitHubError(res.status, j.message || `GitHub 오류 ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
  }

  // Can this token write to the repository?
  async check() {
    const r = await this.req(`/repos/${this.repo}`);
    if (!r.permissions?.push) throw new GitHubError(403, '이 토큰에는 저장소 쓰기 권한이 없습니다. Contents: Read and write 로 다시 만들어 주세요.');
    return r;
  }

  async readDb() {
    let meta;
    try {
      meta = await this.req(`/repos/${this.repo}/contents/${this.dataPath}?ref=${encodeURIComponent(this.branch)}`);
    } catch (e) {
      if (e.status === 404) return { db: null, sha: null };
      throw e;
    }
    // Files over 1MB come back without content; fetch the blob instead.
    let b64 = meta.content;
    if (!b64) b64 = (await this.req(`/repos/${this.repo}/git/blobs/${meta.sha}`)).content;
    return { db: JSON.parse(fromBase64(b64)), sha: meta.sha };
  }

  async writeDb(db, sha, message) {
    const r = await this.req(`/repos/${this.repo}/contents/${this.dataPath}`, {
      method: 'PUT',
      body: { message, content: toBase64(`${JSON.stringify(db)}\n`), sha: sha || undefined, branch: this.branch },
    });
    return r.content.sha;
  }

  // Read → change → write, retrying if someone else saved in between (e.g. another tab).
  async update(mutate, message, emptyDb) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const { db, sha } = await this.readDb();
      const data = db || emptyDb();
      const result = mutate(data);
      try {
        await this.writeDb(data, sha, message);
        return { db: data, result };
      } catch (e) {
        if (e.status !== 409 && e.status !== 422) throw e;
      }
    }
    throw new Error('다른 곳에서 동시에 저장하고 있어요. 잠시 후 다시 시도해 주세요.');
  }

  // Latest run of the workflow that publishes the site.
  async latestPublish(workflow = 'pages.yml') {
    const r = await this.req(`/repos/${this.repo}/actions/workflows/${workflow}/runs?per_page=1`);
    return r.workflow_runs?.[0] || null;
  }
}
