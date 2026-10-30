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

test('custom job history uses guarded explicit read-only SQL and exact normalized phone equality', () => {
  const guard = section('ddd_ai_dispatch_history_table_exists');
  assert.match(guard, /\^\[A-Za-z0-9_\]\+\$/);
  assert.match(guard, /SHOW TABLES LIKE %s/);
  assert.match(guard, /esc_like\(\$table\)/);
  const code = section('ddd_ai_dispatch_find_customer_jobs');
  assert.match(code, /\$wpdb->prefix \. 'ddd_jobs'/);
  assert.match(code, /!ddd_ai_dispatch_history_table_exists\(\$table\)/);
  assert.match(code, /SELECT job_uuid, customer_name, customer_phone, service_type, vehicle, service_address, notes, status, assigned_tech_id, assigned_tech_label, created_at, updated_at, completed_at FROM/);
  assert.match(code, /WHERE \{\$phone_sql\} IN \(%s, %s\)/);
  assert.match(code, /strlen\(\$digits\) !== 11 \|\| strpos\(\$digits, '1'\) !== 0/);
  assert.match(code, /\$national_digits = substr\(\$digits, 1\)/);
  assert.match(code, /\$digits, \$national_digits, \$limit/);
  assert.doesNotMatch(code, /substr\(\$phone, 2\)|RIGHT\(|LIKE.*phone/i);
  assert.match(code, /ORDER BY created_at DESC, job_uuid DESC LIMIT %d/);
  assert.match(code, /ddd_ai_dispatch_normalize_phone\(\$row\['customer_phone'\]\) !== \$phone/);
  assert.match(code, /min\(50,/);
  assert.doesNotMatch(code, /SELECT\s*\*|token_hash|\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\b/i);
  assert.match(section('ddd_ai_dispatch_find_customer_records'), /ddd_ai_dispatch_find_customer_jobs\(\$phone, \$limit\)/);
});

test('job UUID, status and technician namespaces follow actual platform fields without inferred external IDs', () => {
  const code = section('ddd_ai_dispatch_find_customer_jobs');
  for (const field of ['id', 'job', 'jobId', 'job_uuid']) assert.ok(code.includes(`'${field}' => $job_id`), field);
  for (const field of ['status', 'jobStatus']) assert.ok(code.includes(`'${field}' => (string) $row['status']`), field);
  assert.match(code, /'assignedTechId' => \(string\) \$row\['assigned_tech_id'\]/);
  assert.match(code, /'assignedTechName' => \(string\) \$row\['assigned_tech_label'\]/);
  assert.match(code, /'assignee' => \(string\) \$row\['assigned_tech_label'\]/);
  assert.doesNotMatch(code, /external_booking_id|post_status|completed_at.*=>.*status/);
});

test('preferred time is read only from the confirmed lead table with exact UUID, latest bounded one', () => {
  const code = section('ddd_ai_dispatch_find_customer_jobs');
  assert.match(code, /\$lead_table = \$wpdb->prefix \. 'ddd_business_leads'/);
  assert.match(code, /\$has_leads = ddd_ai_dispatch_history_table_exists\(\$lead_table\)/);
  assert.match(code, /if \(\$has_leads\)/);
  assert.match(code, /SELECT lead_uuid, job_uuid, preferred_time, created_at, updated_at FROM/);
  assert.match(code, /WHERE job_uuid = %s ORDER BY updated_at DESC, created_at DESC, lead_uuid DESC LIMIT 1/);
  assert.match(code, /\(string\) \$lead\['job_uuid'\] === \$job_id/);
  assert.match(code, /\['serviceTime'\] = ddd_ai_dispatch_history_datetime\(\$preferred_time, \$legacy_gmt\) \?: \$preferred_time/);
  const date = section('ddd_ai_dispatch_history_datetime');
  assert.match(date, /new DateTimeZone\('UTC'\) : wp_timezone\(\)/);
  assert.match(date, /createFromFormat\('!Y-m-d H:i:s'/);
  assert.match(date, /warning_count/);
  assert.match(date, /format\(DATE_ATOM\)/);
  assert.match(code, /strpos\(\$job_id, 'DDD-FORM'\) === 0/);
});
