import test from 'node:test';
import assert from 'node:assert/strict';
import { mountReplyPolish } from '../src/reply-polish.js';
function setup(generate = async request => ({ output_text: request.input })) {
  let handler, request, options, count = 0;
  const authenticate = () => {};
  mountReplyPolish({ post(path, parser, auth, route) { assert.equal(path, '/api/sms/polish'); assert.equal(auth, authenticate); handler = route; } }, {
    express: { json: () => null }, authenticate, model: () => 'test-model',
    client: () => ({ responses: { create: async (body, config) => { count++; request = body; options = config; return generate(body); } } })
  });
  return { async run(draft, role = 'tech') { const res = { locals: { staff: { role } }, statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; await handler({ body: { draft } }, res); return res; }, get request() { return request; }, get options() { return options; }, get count() { return count; } };
}
test('polish preserves exact links, prices and numbers without retaining responses', async () => {
  const app = setup(async ({ input }) => ({ output_text: input.replace('we r', 'We are') }));
  const draft = 'we r quoting $55 at 3pm. Book https://dddcincy.com/book-service/ or call 513-409-1342';
  assert.equal((await app.run(draft)).body.text, draft.replace('we r', 'We are'));
  assert.equal(app.request.store, false); assert.equal(app.options.timeout, 12000); assert.equal(app.options.maxRetries, 0);
  assert.equal(app.request.tools, undefined);
});
test('reviewers and invalid drafts cannot incur a model call', async () => {
  const app = setup();
  assert.equal((await app.run('hello', 'reviewer')).statusCode, 403);
  for (const draft of ['', ' ', null, {}, 'x'.repeat(1001)]) assert.equal((await app.run(draft)).statusCode, 400);
  assert.equal(app.count, 0);
});
test('changed or duplicated concrete details reject the rewrite', async () => {
  for (const output_text of ['It costs $70', '__DDD_FACT_0__ __DDD_FACT_0__', '__DDD_FACT_1__ __DDD_FACT_0__']) {
    const app = setup(async () => ({ output_text }));
    assert.equal((await app.run('Price $55 at 3pm')).statusCode, 503);
  }
});
test('provider errors and empty responses leave draft with clear recoverable error', async () => {
  for (const generate of [async () => { throw new Error('private provider detail'); }, async () => ({ output_text: '' })]) {
    const result = await setup(generate).run('Please call us');
    assert.equal(result.statusCode, 503); assert.match(result.body.error, /original draft is unchanged/); assert.doesNotMatch(result.body.error, /private/);
  }
});
