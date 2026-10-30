import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const source = readFileSync(new URL('../wordpress/ddd-ai-dispatch-bridge.php', import.meta.url), 'utf8');
// Optional temporary dev tool: npm install --prefix /private/tmp/ddd-wp-tools php-parser
const require = createRequire(import.meta.url);
let Parser;
try { Parser = require(process.env.DDD_PHP_PARSER || '/private/tmp/ddd-wp-tools/node_modules/php-parser'); } catch {}
const section = (name) => source.slice(source.indexOf(`function ${name}(`)).split('\nfunction ')[0];

test('entire bridge parses as PHP (not a PHP runtime test)', { skip: !Parser && 'Install php-parser in the temporary tools directory' }, () => {
  const ast = new Parser({ parser: { suppressErrors: false } }).parseCode(source);
  assert.ok(ast.children.some(n => n.kind === 'function' && n.name.name === 'ddd_ai_dispatch_lifecycle'));
});

test('lifecycle exports only stored values, with explicit dispatch precedence and no completion inference', () => {
  const code = section('ddd_ai_dispatch_lifecycle');
  for (const field of ['external_booking_id', 'jobId', 'status', 'dispatchStatus', 'assignedTo', 'assignee', 'serviceTime', 'updatedAt']) {
    assert.ok(code.includes(`'${field}' =>`), field);
  }
  assert.match(code, /\['dispatch_status', 'dispatchStatus', 'job_status', 'status'\]/);
  assert.match(code, /is_scalar\(\$value\)/);
  assert.match(code, /return '';/);
  for (const forbidden of ['post_status', 'get_status(', 'completed', 'publish', 'private']) {
    assert.ok(!code.includes(forbidden), forbidden);
  }
  for (const name of ['ddd_ai_dispatch_record_from_post', 'ddd_ai_dispatch_find_customer_records']) {
    assert.match(section(name), /ddd_ai_dispatch_lifecycle\(function/);
  }
});

test('request limit is bounded, sources sorted together, stable IDs retained', () => {
  const endpoint = section('ddd_ai_dispatch_customer_history');
  assert.match(endpoint, /get_param\('limit'\)/);
  assert.match(endpoint, /min\(50,/);
  assert.match(endpoint, /find_customer_records\(\$phone, \$limit\)/);
  const query = section('ddd_ai_dispatch_find_customer_records');
  assert.match(query, /'posts_per_page' => \$limit/);
  assert.match(query, /'limit' => \$limit/);
  assert.match(query, /'orderby' => \['date' => 'DESC', 'ID' => 'DESC'\]/);
  assert.match(query, /usort\(\$records,/);
  assert.match(query, /strnatcmp\(\$b\['id'\], \$a\['id'\]\)/);
  assert.match(query, /array_slice\(.*0, \$limit\)/);
  assert.match(query, /'id' => \(string\) \$order->get_id\(\)/);
  assert.match(section('ddd_ai_dispatch_record_from_post'), /'id' => \(string\) \$post->ID/);
});

test('history route retains authentication and credentials still require verification', () => {
  assert.match(section('ddd_ai_dispatch_register_routes'), /'\/customer-history', \[\s*'methods' => 'GET',\s*'permission_callback' => 'ddd_ai_dispatch_auth'/);
  const auth = section('ddd_ai_dispatch_auth');
  assert.match(auth, /hash_equals/);
  assert.match(auth, /ddd_ai_dispatch_platform_token_is_valid/);
  assert.match(auth, /'rest_forbidden'.*\['status' => 401\]/);
});
