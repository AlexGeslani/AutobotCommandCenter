export async function captureAndPublishStatusLine({ input, writeCache, publish = null }) {
  try {
    const event = JSON.parse(input);
    await writeCache(event);
    if (publish) await publish();
    return true;
  } catch {
    return false;
  }
}
