/** Save unfinished test fields when the browser backgrounds the app. */
export async function preserveTestDraft(store, screen, answers) {
  const session = store?.doc?.session;
  if (screen !== 'test' || !session || session.feedback) return false;
  const sessionId = session.id;
  const draft = [...answers];
  await store.update(doc => {
    if (doc.session?.id === sessionId && !doc.session.feedback) {
      doc.session.answers = draft;
    }
    return doc;
  });
  return true;
}
