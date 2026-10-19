import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Boots the real managed editor for the browser smoke: an EditorHostController
// on a loopback HTTP server, one launch grant, and the daemon-spawned native
// op-host-web-server whose page the browser then loads. Mirrors the boot half
// of scripts/test-host.mjs (which checks the same surface over fetch).
const state = globalThis;

export default async function globalSetup() {
  const { EDITOR_ROUTE_PREFIX, EditorHostController } = await import('../../lib/editor-host.js');
  const sourceBytes = Buffer.from('{\n  "version": "1.0.0",\n  "children": []\n}\n');
  const root = await mkdtemp(join(tmpdir(), 'dsh-openpencil-e2e-'));
  process.env.DSH_HOME = join(root, 'dsh-home');
  const sourcePath = join(root, 'design.op');
  await writeFile(sourcePath, sourceBytes);
  const sourceHash = createHash('sha256').update(sourceBytes).digest('hex');

  const editorHost = new EditorHostController(Buffer.alloc(32, 11));
  if (!editorHost.available) throw new Error('OpenPencil editor runtime is unavailable; stage npm/<platform>/ first');
  const detachRoute = editorHost.attachRoute();
  const grant = editorHost.grantFor(sourcePath, sourceHash);
  if (!grant) throw new Error('editor grant could not be minted');

  const server = createServer((req, res) => {
    if ((req.url ?? '').startsWith(EDITOR_ROUTE_PREFIX)) void editorHost.handle(req, res);
    else { res.statusCode = 404; res.end(); }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no server address');
  const origin = `http://127.0.0.1:${address.port}`;

  const launchResponse = await fetch(`${origin}${grant.launchUrl}`, {
    method: 'POST',
    headers: { origin },
  });
  const launchText = await launchResponse.text();
  if (!launchResponse.ok) throw new Error(`editor launch failed (${launchResponse.status}): ${launchText}`);
  const launch = JSON.parse(launchText);
  if (typeof launch.iframeUrl !== 'string') throw new Error(`editor launch returned no iframeUrl: ${launchText}`);

  state.__openpencilSmoke = { server, editorHost, detachRoute };
  process.env.OPENPENCIL_SMOKE_EDITOR_URL = launch.iframeUrl;
  await readFile(sourcePath); // keep the temp root referenced until teardown runs
}
