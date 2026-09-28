// Uploads dist/ to GitHub Pages or Firebase Hosting.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config, ROOT } from './config.js';
import * as store from './store.js';
import { buildSite } from './build.js';

const run = promisify(execFile);
const WORK = path.join(ROOT, '.publish');

// Never let the token show up in logs or error messages.
const redact = (s) => (config.github.token ? String(s).split(config.github.token).join('***') : String(s));

function remoteWithToken() {
  const url = config.github.remote;
  if (!config.github.token || !/^https:\/\//.test(url)) return url;
  return url.replace(/^https:\/\//, `https://x-access-token:${config.github.token}@`);
}

async function git(args, cwd = WORK) {
  try {
    return await run('git', args, { cwd, maxBuffer: 20 * 1024 * 1024 });
  } catch (e) {
    throw new Error(redact(`git ${args[0]} 실패: ${e.stderr || e.message}`));
  }
}

// Each publish is a single fresh commit force-pushed to the Pages branch,
// so the repository doesn't grow with three site snapshots a day.
async function publishGithub(dist) {
  if (!config.github.remote) throw new Error('.env 에 GITHUB_REPO_URL 을 설정하세요.');
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.cpSync(dist, WORK, { recursive: true });
  await git(['init', '-q']);
  await git(['checkout', '-q', '-b', config.github.branch]);
  await git(['add', '-A']);
  await git(['-c', 'user.name=teukga-bot', '-c', 'user.email=teukga-bot@users.noreply.github.com', 'commit', '-q', '-m', `site update ${new Date().toISOString()}`]);
  await git(['push', '-q', '-f', remoteWithToken(), `HEAD:${config.github.branch}`]);
  fs.rmSync(WORK, { recursive: true, force: true });
}

async function publishFirebase() {
  if (!config.firebase.project) throw new Error('.env 에 FIREBASE_PROJECT 를 설정하세요.');
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  try {
    await run(npx, ['--yes', 'firebase-tools', 'deploy', '--only', 'hosting', '--project', config.firebase.project, '--non-interactive'], {
      cwd: ROOT,
      maxBuffer: 20 * 1024 * 1024,
      shell: process.platform === 'win32',
    });
  } catch (e) {
    throw new Error(`firebase deploy 실패: ${(e.stderr || e.stdout || e.message).slice(-800)}`);
  }
}

let publishing = null;

export async function publish({ log = console.log } = {}) {
  if (publishing) return publishing;
  publishing = (async () => {
    const started = Date.now();
    const result = { at: new Date().toISOString(), target: config.publishTarget };
    try {
      const built = buildSite();
      Object.assign(result, { deals: built.deals, pages: built.pages });
      if (config.publishTarget === 'github') await publishGithub(built.outDir);
      else if (config.publishTarget === 'firebase') await publishFirebase();
      result.ok = true;
      log(`[publish] ${config.publishTarget}: 특가 ${built.deals}개 게시 (${Math.round((Date.now() - started) / 1000)}초)`);
    } catch (e) {
      result.ok = false;
      result.error = e.message;
      log(`[publish] 실패: ${e.message}`);
    }
    store.meta().lastPublish = result;
    store.save();
    return result;
  })().finally(() => {
    publishing = null;
  });
  return publishing;
}

// Admin edits come in bursts; publish once things settle.
let timer = null;
export function schedulePublish(delayMs = 30_000) {
  clearTimeout(timer);
  timer = setTimeout(() => publish(), delayMs);
}
