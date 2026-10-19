const state = globalThis;

export default async function globalTeardown() {
  const smoke = state.__openpencilSmoke;
  if (smoke === undefined) return;
  delete state.__openpencilSmoke;
  try {
    await smoke.editorHost.dispose();
  } finally {
    smoke.detachRoute();
    await new Promise((resolve) => { smoke.server.close(resolve); });
  }
}
