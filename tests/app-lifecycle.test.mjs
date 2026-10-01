import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {preserveTestDraft} from '../app/app-lifecycle.js';

test('backgrounding an active test keeps the round and saves its unfinished answers', async () => {
  const store = {doc:{session:{id:'round-1',cursor:2,answers:['old'],feedback:null}},async update(change){this.doc=change(structuredClone(this.doc));}};
  assert.equal(await preserveTestDraft(store,'test',['draft answer','second field']),true);
  assert.equal(store.doc.session.id,'round-1');
  assert.equal(store.doc.session.cursor,2);
  assert.deepEqual(store.doc.session.answers,['draft answer','second field']);
});

test('backgrounding outside an unanswered test does not change saved state', async () => {
  const store = {doc:{session:{id:'round-1',answers:['saved'],feedback:null}},async update(change){this.doc=change(structuredClone(this.doc));}};
  assert.equal(await preserveTestDraft(store,'learn',['ignored']),false);
  assert.deepEqual(store.doc.session.answers,['saved']);
  store.doc.session.feedback={grade:'full'};
  assert.equal(await preserveTestDraft(store,'test',['ignored']),false);
  assert.deepEqual(store.doc.session.answers,['saved']);
});

test('English answer feedback uses learning colors while the English theme stays red', async () => {
  const css = await readFile(new URL('../app/style.css', import.meta.url), 'utf8');
  assert.match(css, /:root\[data-subject=english\] \.graded-answer\.correct\{border-color:#59b923;background:#f0f9e9;color:#398812\}/);
  assert.match(css, /:root\[data-subject=english\] \.feedback\.full\{background:#f0f9e9;color:#398812\}/);
  assert.match(css, /:root\[data-subject=english\]\{--green:#d64b54/);
});
