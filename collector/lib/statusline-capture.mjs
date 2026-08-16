export async function captureAndPublishStatusLine({ input, writeCache, publish }) {
  try {
    const event = JSON.parse(input);
    await writeCache(event);
    await publish();
    return true;
  } catch {
    return false;
  }
}
