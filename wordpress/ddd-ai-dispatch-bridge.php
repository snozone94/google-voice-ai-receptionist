<?php
/**
 * Plugin Name: DDD AI Dispatch Bridge
 * Description: Adds DDD-branded AI Dispatch photo upload, photo sync, and returning-customer history endpoints.
 * Version: 0.1.0
 * Author: DDD Roadside Assistance
 */

if (!defined('ABSPATH')) {
    exit;
}

const DDD_AI_DISPATCH_RENDER_BASE = 'https://google-voice-ai-receptionist.onrender.com';
const DDD_AI_DISPATCH_ROLE_OPTION = 'ddd_ai_dispatch_staff_roles';

add_action('init', 'ddd_ai_dispatch_ensure_photo_page');
add_action('rest_api_init', 'ddd_ai_dispatch_register_routes');
add_action('admin_menu', 'ddd_ai_dispatch_register_admin_page');
add_action('admin_post_ddd_ai_dispatch_save_roles', 'ddd_ai_dispatch_save_roles');
add_shortcode('ddd_ai_dispatch_photo_upload', 'ddd_ai_dispatch_photo_upload_shortcode');

function ddd_ai_dispatch_ensure_photo_page() {
    if (get_option('ddd_ai_dispatch_photo_page_id')) {
        return;
    }

    $existing = get_page_by_path('customer-photo-upload');
    if ($existing) {
        update_option('ddd_ai_dispatch_photo_page_id', (int) $existing->ID);
        return;
    }

    $page_id = wp_insert_post([
        'post_type' => 'page',
        'post_status' => 'publish',
        'post_title' => 'DDD Customer Photo Upload',
        'post_name' => 'customer-photo-upload',
        'post_content' => '[ddd_ai_dispatch_photo_upload]',
    ]);

    if (!is_wp_error($page_id)) {
        update_option('ddd_ai_dispatch_photo_page_id', (int) $page_id);
    }
}

function ddd_ai_dispatch_photo_upload_shortcode() {
    $booking = isset($_GET['booking']) ? sanitize_text_field(wp_unslash($_GET['booking'])) : '';
    $token = isset($_GET['token']) ? sanitize_text_field(wp_unslash($_GET['token'])) : '';
    $target = '';

    if ($booking && $token) {
        $target = DDD_AI_DISPATCH_RENDER_BASE . '/api/bookings/' . rawurlencode($booking) . '/photos?token=' . rawurlencode($token);
    }

    ob_start();
    ?>
    <div class="ddd-ai-upload-shell">
      <style>
        .ddd-ai-upload-shell{min-height:70vh;padding:22px;background:linear-gradient(135deg,#fff7fb,#f5fffb 45%,#f7f4ff);font-family:Arial,sans-serif;color:#171827}
        .ddd-ai-upload-card{max-width:860px;margin:0 auto;overflow:hidden;border:1px solid rgba(118,87,255,.24);border-radius:14px;background:rgba(255,255,255,.95);box-shadow:0 18px 46px rgba(35,38,69,.12)}
        .ddd-ai-upload-card:before{content:"";display:block;height:8px;background:linear-gradient(90deg,#ff3ea5,#ff7a3d,#ffc83d,#23c779,#16b8ff,#7657ff)}
        .ddd-ai-upload-inner{display:grid;gap:14px;padding:22px}
        .ddd-ai-upload-eyebrow{margin:0;color:#a81586;font-size:12px;font-weight:900;letter-spacing:.05em;text-transform:uppercase}
        .ddd-ai-upload-inner h1{margin:0;font-size:clamp(30px,8vw,48px);line-height:1.04}
        .ddd-ai-upload-inner p{margin:0;color:#5f6477;line-height:1.45}
        .ddd-ai-upload-frame{width:100%;min-height:690px;border:0;border-radius:12px;background:white}
        .ddd-ai-upload-button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;border-radius:9px;padding:0 18px;background:linear-gradient(90deg,#7657ff,#ff3ea5,#ff7a3d);color:white!important;font-weight:900;text-decoration:none}
        .ddd-ai-upload-note{font-weight:800;color:#171827}
        @media (max-width:600px){.ddd-ai-upload-shell{padding:12px}.ddd-ai-upload-inner{padding:16px}.ddd-ai-upload-frame{min-height:720px}}
      </style>
      <section class="ddd-ai-upload-card">
        <div class="ddd-ai-upload-inner">
          <p class="ddd-ai-upload-eyebrow">DDD secure upload</p>
          <h1>Add photos to your request</h1>
          <p>Upload pictures from your phone so DDD can attach them to your service request without paid picture texting.</p>
          <?php if ($target) : ?>
            <a class="ddd-ai-upload-button" href="<?php echo esc_url($target); ?>" target="_blank" rel="noopener">Open secure upload</a>
            <iframe class="ddd-ai-upload-frame" src="<?php echo esc_url($target); ?>" title="DDD secure photo upload"></iframe>
          <?php else : ?>
            <p class="ddd-ai-upload-note">This upload link is missing booking details. Please text DDD and ask for a fresh photo link.</p>
          <?php endif; ?>
        </div>
      </section>
    </div>
    <?php
    return ob_get_clean();
}

function ddd_ai_dispatch_register_routes() {
    register_rest_route('ddd/v1', '/customer-history', [
        'methods' => 'GET',
        'permission_callback' => 'ddd_ai_dispatch_auth',
        'callback' => 'ddd_ai_dispatch_customer_history',
    ]);

    register_rest_route('ddd/v1', '/ai-booking-photos', [
        'methods' => 'POST',
        'permission_callback' => 'ddd_ai_dispatch_auth',
        'callback' => 'ddd_ai_dispatch_booking_photos',
    ]);

    register_rest_route('ddd/v1', '/ai-dispatch-roles', [
        'methods' => 'GET',
        'permission_callback' => 'ddd_ai_dispatch_auth',
        'callback' => 'ddd_ai_dispatch_roles',
    ]);
}

function ddd_ai_dispatch_register_admin_page() {
    add_management_page(
        'DDD AI Dispatch Roles',
        'DDD AI Dispatch Roles',
        'manage_options',
        'ddd-ai-dispatch-roles',
        'ddd_ai_dispatch_roles_page'
    );
}

function ddd_ai_dispatch_roles_page() {
    if (!current_user_can('manage_options')) {
        wp_die(esc_html__('You do not have permission to manage DDD AI Dispatch roles.', 'ddd-ai-dispatch'));
    }

    $roles = ddd_ai_dispatch_get_role_rows();
    $message = isset($_GET['ddd_ai_saved']) ? 'Roles saved. DDD AI Dispatch will pick this up on the next login/refresh.' : '';
    ?>
    <div class="wrap">
      <h1>DDD AI Dispatch Roles</h1>
      <p>Use this screen to tell DDD AI Dispatch who is an admin, dispatcher, tech, or read-only user. Current DDD techs/users are listed automatically; saved role choices follow each person and update DDD AI on the next refresh/login.</p>
      <?php if ($message) : ?>
        <div class="notice notice-success is-dismissible"><p><?php echo esc_html($message); ?></p></div>
      <?php endif; ?>
      <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
        <?php wp_nonce_field('ddd_ai_dispatch_save_roles'); ?>
        <input type="hidden" name="action" value="ddd_ai_dispatch_save_roles" />
        <table class="widefat striped" style="max-width:1100px">
          <thead>
            <tr>
              <th>Tech/user</th>
              <th>Match value</th>
              <th>Role</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody id="ddd-ai-role-rows">
            <?php
            $rows = array_pad($roles, max(6, count($roles) + 2), []);
            foreach ($rows as $index => $role) :
                $selected = $role['role'] ?? 'tech';
                ?>
                <tr>
                  <td>
                    <input type="text" name="roles[<?php echo esc_attr($index); ?>][label]" value="<?php echo esc_attr($role['label'] ?? ''); ?>" placeholder="Brianna" style="width:100%" />
                    <input type="hidden" name="roles[<?php echo esc_attr($index); ?>][source]" value="<?php echo esc_attr($role['source'] ?? 'manual'); ?>" />
                    <input type="hidden" name="roles[<?php echo esc_attr($index); ?>][source_id]" value="<?php echo esc_attr($role['source_id'] ?? ''); ?>" />
                    <?php if (!empty($role['source']) && $role['source'] !== 'manual') : ?>
                      <p class="description"><?php echo esc_html(ucfirst(str_replace('_', ' ', $role['source']))); ?><?php echo !empty($role['phone']) ? ' · ' . esc_html($role['phone']) : ''; ?><?php echo !empty($role['email']) ? ' · ' . esc_html($role['email']) : ''; ?></p>
                    <?php endif; ?>
                  </td>
                  <td><input type="text" name="roles[<?php echo esc_attr($index); ?>][identifier]" value="<?php echo esc_attr($role['identifier'] ?? ''); ?>" placeholder="code, phone, email, user ID, or exact name" style="width:100%" /></td>
                  <td>
                    <select name="roles[<?php echo esc_attr($index); ?>][role]">
                      <?php foreach (ddd_ai_dispatch_allowed_roles() as $value => $label) : ?>
                        <option value="<?php echo esc_attr($value); ?>" <?php selected($selected, $value); ?>><?php echo esc_html($label); ?></option>
                      <?php endforeach; ?>
                    </select>
                  </td>
                  <td><label><input type="checkbox" name="roles[<?php echo esc_attr($index); ?>][active]" value="1" <?php checked(($role['active'] ?? true), true); ?> /> Active</label></td>
                </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
        <p class="description">Recommended: set Bria/Brianna/Rich to <strong>Admin</strong>. Regular technicians should stay <strong>Tech</strong>. If a tech is added or removed in the DDD platform, this list refreshes from that roster and keeps the saved role when the same tech/code/phone/email is found.</p>
        <?php submit_button('Save DDD AI roles'); ?>
      </form>
    </div>
    <?php
}

function ddd_ai_dispatch_save_roles() {
    if (!current_user_can('manage_options')) {
        wp_die(esc_html__('You do not have permission to manage DDD AI Dispatch roles.', 'ddd-ai-dispatch'));
    }
    check_admin_referer('ddd_ai_dispatch_save_roles');

    $incoming = isset($_POST['roles']) && is_array($_POST['roles']) ? wp_unslash($_POST['roles']) : [];
    $roles = [];
    foreach ($incoming as $row) {
        $label = sanitize_text_field($row['label'] ?? '');
        $identifier = ddd_ai_dispatch_role_identifier($row['identifier'] ?? '');
        $role = sanitize_key($row['role'] ?? 'tech');
        if (!$identifier || !array_key_exists($role, ddd_ai_dispatch_allowed_roles())) {
            continue;
        }
        $roles[] = [
            'label' => $label ?: $identifier,
            'identifier' => $identifier,
            'role' => $role,
            'active' => !empty($row['active']),
            'source' => sanitize_key($row['source'] ?? 'manual') ?: 'manual',
            'source_id' => sanitize_text_field($row['source_id'] ?? ''),
        ];
    }

    update_option(DDD_AI_DISPATCH_ROLE_OPTION, $roles, false);
    wp_safe_redirect(add_query_arg('ddd_ai_saved', '1', admin_url('tools.php?page=ddd-ai-dispatch-roles')));
    exit;
}

function ddd_ai_dispatch_roles(WP_REST_Request $request) {
    return [
        'ok' => true,
        'roles' => ddd_ai_dispatch_get_role_rows(true),
    ];
}

function ddd_ai_dispatch_get_roles() {
    $roles = get_option(DDD_AI_DISPATCH_ROLE_OPTION, []);
    return is_array($roles) ? array_values(array_filter(array_map('ddd_ai_dispatch_clean_role', $roles))) : [];
}

function ddd_ai_dispatch_get_role_rows($active_only = false) {
    $saved_roles = ddd_ai_dispatch_get_roles();
    $roster = ddd_ai_dispatch_get_current_staff_roster();
    $rows = [];
    $used_saved = [];

    foreach ($roster as $member) {
        $match = ddd_ai_dispatch_find_saved_role_for_member($member, $saved_roles);
        if ($match['index'] !== null) {
            $used_saved[$match['index']] = true;
        }
        $saved = $match['role'] ?: [];
        $role_name = $saved['role'] ?? ($member['role'] ?? 'tech');
        $row = [
            'label' => $saved['label'] ?? $member['label'],
            'identifier' => $saved['identifier'] ?? $member['identifier'],
            'role' => array_key_exists($role_name, ddd_ai_dispatch_allowed_roles()) ? $role_name : 'tech',
            'active' => array_key_exists('active', $saved) ? (bool) $saved['active'] : true,
            'source' => $member['source'],
            'source_id' => $member['source_id'],
            'phone' => $member['phone'] ?? '',
            'email' => $member['email'] ?? '',
        ];
        if (!$active_only || !empty($row['active'])) {
            $rows[] = $row;
        }
    }

    foreach ($saved_roles as $index => $saved) {
        $source = $saved['source'] ?? 'manual';
        if (!empty($used_saved[$index]) || ($source !== 'manual' && $roster)) {
            continue;
        }
        if (!$active_only || !empty($saved['active'])) {
            $rows[] = $saved + ['source' => 'manual', 'source_id' => ''];
        }
    }

    return array_values($rows);
}

function ddd_ai_dispatch_clean_role($role) {
    if (!is_array($role)) {
        return null;
    }
    $identifier = ddd_ai_dispatch_role_identifier($role['identifier'] ?? '');
    $role_name = sanitize_key($role['role'] ?? 'tech');
    if (!$identifier || !array_key_exists($role_name, ddd_ai_dispatch_allowed_roles())) {
        return null;
    }
    return [
        'label' => sanitize_text_field($role['label'] ?? $identifier),
        'identifier' => $identifier,
        'role' => $role_name,
        'active' => !empty($role['active']),
        'source' => sanitize_key($role['source'] ?? 'manual') ?: 'manual',
        'source_id' => sanitize_text_field($role['source_id'] ?? ''),
    ];
}

function ddd_ai_dispatch_get_current_staff_roster() {
    $members = array_merge(
        ddd_ai_dispatch_get_platform_tech_roster(),
        ddd_ai_dispatch_get_wp_staff_roster()
    );
    $seen = [];
    $clean = [];

    foreach ($members as $member) {
        $member = ddd_ai_dispatch_clean_roster_member($member);
        if (!$member) {
            continue;
        }
        $key = $member['source'] . ':' . ($member['source_id'] ?: $member['identifier']);
        if (isset($seen[$key])) {
            continue;
        }
        $seen[$key] = true;
        $clean[] = $member;
    }

    usort($clean, function ($a, $b) {
        return strcasecmp($a['label'], $b['label']);
    });

    return $clean;
}

function ddd_ai_dispatch_get_platform_tech_roster() {
    $request = new WP_REST_Request('GET', '/ddd/v1/techs');
    $team_token = defined('DDD_TECH_TEAM_TOKEN') ? DDD_TECH_TEAM_TOKEN : getenv('DDD_TECH_TEAM_TOKEN');
    if ($team_token) {
        $request->set_header('x-ddd-tech-token', (string) $team_token);
    }

    $response = rest_do_request($request);
    if (is_wp_error($response) || !is_object($response) || !method_exists($response, 'get_status') || (int) $response->get_status() >= 400) {
        return [];
    }

    $data = $response->get_data();
    $items = [];
    if (isset($data['techs']) && is_array($data['techs'])) {
        $items = $data['techs'];
    } elseif (isset($data['staff']) && is_array($data['staff'])) {
        $items = $data['staff'];
    } elseif (isset($data['team']) && is_array($data['team'])) {
        $items = $data['team'];
    } elseif (is_array($data)) {
        $items = array_values($data);
    }

    return array_map(function ($item) {
        return is_array($item) ? ($item + ['source' => 'ddd_platform']) : null;
    }, $items);
}

function ddd_ai_dispatch_get_wp_staff_roster() {
    $users = get_users([
        'role__in' => ['administrator', 'shop_manager', 'editor', 'author'],
        'fields' => ['ID', 'display_name', 'user_email', 'user_login'],
        'number' => 200,
    ]);

    return array_map(function ($user) {
        $user_id = isset($user->ID) ? (int) $user->ID : 0;
        return [
            'source' => 'wp_user',
            'source_id' => (string) $user_id,
            'id' => (string) $user_id,
            'label' => $user->display_name ?: $user->user_login,
            'name' => $user->display_name ?: $user->user_login,
            'email' => $user->user_email,
            'identifier' => (string) $user_id,
            'role' => $user_id && user_can($user_id, 'manage_options') ? 'admin' : 'tech',
        ];
    }, $users);
}

function ddd_ai_dispatch_clean_roster_member($member) {
    if (!is_array($member)) {
        return null;
    }

    $source = sanitize_key($member['source'] ?? 'ddd_platform') ?: 'ddd_platform';
    $source_id = sanitize_text_field((string) ($member['source_id'] ?? $member['id'] ?? $member['user_id'] ?? $member['code'] ?? ''));
    $label = sanitize_text_field((string) ($member['label'] ?? $member['name'] ?? $member['display_name'] ?? $member['user_login'] ?? $member['email'] ?? $member['phone'] ?? ''));
    $identifier = ddd_ai_dispatch_role_identifier($member['identifier'] ?? $member['code'] ?? $member['access_code'] ?? $member['email'] ?? $member['phone'] ?? $member['mobile_phone'] ?? $source_id ?? $label);

    if (!$label || !$identifier) {
        return null;
    }

    return [
        'source' => $source,
        'source_id' => $source_id,
        'label' => $label,
        'identifier' => $identifier,
        'role' => sanitize_key($member['role'] ?? 'tech'),
        'phone' => sanitize_text_field((string) ($member['phone'] ?? $member['mobile_phone'] ?? $member['phone_number'] ?? '')),
        'email' => sanitize_email((string) ($member['email'] ?? $member['user_email'] ?? '')),
        'match_keys' => array_values(array_unique(array_filter([
            $source_id ? ddd_ai_dispatch_role_identifier($source_id) : '',
            $identifier,
            ddd_ai_dispatch_role_identifier($label),
            ddd_ai_dispatch_role_identifier($member['code'] ?? ''),
            ddd_ai_dispatch_role_identifier($member['access_code'] ?? ''),
            ddd_ai_dispatch_role_identifier($member['email'] ?? $member['user_email'] ?? ''),
            ddd_ai_dispatch_role_identifier($member['phone'] ?? $member['mobile_phone'] ?? $member['phone_number'] ?? ''),
        ]))),
    ];
}

function ddd_ai_dispatch_find_saved_role_for_member($member, $saved_roles) {
    $member_keys = $member['match_keys'] ?? [];
    foreach ($saved_roles as $index => $saved) {
        $saved_keys = array_values(array_unique(array_filter([
            ddd_ai_dispatch_role_identifier($saved['identifier'] ?? ''),
            ddd_ai_dispatch_role_identifier($saved['label'] ?? ''),
            ddd_ai_dispatch_role_identifier($saved['source_id'] ?? ''),
        ])));
        if (array_intersect($member_keys, $saved_keys)) {
            return ['index' => $index, 'role' => $saved];
        }
    }
    return ['index' => null, 'role' => null];
}

function ddd_ai_dispatch_role_identifier($value) {
    return strtolower(trim(preg_replace('/\s+/', ' ', sanitize_text_field((string) $value))));
}

function ddd_ai_dispatch_allowed_roles() {
    return [
        'admin' => 'Admin',
        'dispatcher' => 'Dispatcher',
        'manager' => 'Manager',
        'tech' => 'Tech',
        'read_only' => 'Read-only',
    ];
}

function ddd_ai_dispatch_auth(WP_REST_Request $request) {
    $expected = defined('DDD_AI_DISPATCH_SECRET') ? DDD_AI_DISPATCH_SECRET : getenv('DDD_AI_DISPATCH_SECRET');
    $team_token = defined('DDD_TECH_TEAM_TOKEN') ? DDD_TECH_TEAM_TOKEN : getenv('DDD_TECH_TEAM_TOKEN');
    $provided_secret = $request->get_header('x-ddd-ai-booking-secret') ?: $request->get_header('x-ddd-customer-lookup-secret') ?: $request->get_param('secret');
    $provided_token = $request->get_header('x-ddd-tech-token');

    if ($expected && hash_equals((string) $expected, (string) $provided_secret)) {
        return true;
    }
    if ($team_token && hash_equals((string) $team_token, (string) $provided_token)) {
        return true;
    }
    if ($provided_token && ddd_ai_dispatch_platform_token_is_valid($provided_token)) {
        return true;
    }

    return new WP_Error('rest_forbidden', 'DDD AI Dispatch bridge access denied.', ['status' => 401]);
}

function ddd_ai_dispatch_platform_token_is_valid($token) {
    $request = new WP_REST_Request('GET', '/ddd/v1/techs');
    $request->set_header('x-ddd-tech-token', (string) $token);
    $response = rest_do_request($request);

    if (is_wp_error($response) || !is_object($response) || !method_exists($response, 'get_status')) {
        return false;
    }

    return (int) $response->get_status() < 400;
}

function ddd_ai_dispatch_customer_history(WP_REST_Request $request) {
    $phone = ddd_ai_dispatch_normalize_phone($request->get_param('phone'));
    if (!$phone) {
        return new WP_REST_Response(['ok' => false, 'error' => 'Phone is required.'], 400);
    }

    $requested_limit = $request->get_param('limit');
    $limit = $requested_limit === null ? 12 : max(1, min(50, (int) $requested_limit));
    $records = ddd_ai_dispatch_find_customer_records($phone, $limit);
    return [
        'ok' => true,
        'phone' => $phone,
        'returningCustomer' => count($records) > 0,
        'bookings' => $records,
    ];
}

function ddd_ai_dispatch_booking_photos(WP_REST_Request $request) {
    $payload = $request->get_json_params();
    $booking_id = sanitize_text_field($payload['external_booking_id'] ?? '');
    $job_id = sanitize_text_field($payload['platform_job_id'] ?? '');
    $phone = ddd_ai_dispatch_normalize_phone($payload['customer_phone'] ?? '');
    $photos = is_array($payload['photos'] ?? null) ? $payload['photos'] : [];
    $target_id = ddd_ai_dispatch_find_target_post_id($job_id, $booking_id, $phone);

    $clean_photos = array_values(array_filter(array_map('ddd_ai_dispatch_clean_photo', $photos)));
    $record = [
        'received_at' => current_time('mysql'),
        'source' => 'DDD AI Dispatch',
        'external_booking_id' => $booking_id,
        'platform_job_id' => $job_id,
        'customer_phone' => $phone,
        'photos' => $clean_photos,
    ];

    if ($target_id) {
        $existing = get_post_meta($target_id, '_ddd_ai_dispatch_photos', true);
        $existing = is_array($existing) ? $existing : [];
        update_post_meta($target_id, '_ddd_ai_dispatch_photos', array_merge($existing, [$record]));
    }

    $queue = get_option('ddd_ai_dispatch_photo_sync_log', []);
    $queue = is_array($queue) ? $queue : [];
    array_unshift($queue, $record + ['target_post_id' => $target_id]);
    update_option('ddd_ai_dispatch_photo_sync_log', array_slice($queue, 0, 100), false);

    return [
        'ok' => true,
        'attached' => (bool) $target_id,
        'target_post_id' => $target_id,
        'photo_count' => count($clean_photos),
    ];
}

function ddd_ai_dispatch_find_customer_records($phone, $limit = 12) {
    $limit = max(1, min(50, (int) $limit));
    $digits = preg_replace('/\D+/', '', $phone);
    $variants = array_unique([$phone, $digits, substr($digits, -10)]);
    $records = [];

    $query = new WP_Query([
        'post_type' => 'any',
        'post_status' => ['publish', 'private', 'draft'],
        'posts_per_page' => $limit,
        'orderby' => ['date' => 'DESC', 'ID' => 'DESC'],
        'meta_query' => [
            'relation' => 'OR',
            ['key' => 'customer_phone', 'value' => $variants, 'compare' => 'IN'],
            ['key' => 'phone', 'value' => $variants, 'compare' => 'IN'],
            ['key' => 'customerphone', 'value' => $variants, 'compare' => 'IN'],
            ['key' => '_billing_phone', 'value' => $variants, 'compare' => 'IN'],
        ],
    ]);

    foreach ($query->posts as $post) {
        // Woo orders are read through Woo so HPOS and legacy storage agree.
        if (function_exists('wc_get_orders') && in_array($post->post_type, ['shop_order', 'shop_order_refund'], true)) {
            continue;
        }
        $records[] = ddd_ai_dispatch_record_from_post($post);
    }

    if (function_exists('wc_get_orders')) {
        $orders = wc_get_orders([
            'limit' => $limit,
            'billing_phone' => substr($digits, -10),
            'orderby' => 'date ID',
            'order' => 'DESC',
        ]);
        foreach ($orders as $order) {
            $records[] = [
                'id' => (string) $order->get_id(),
                'createdAt' => $order->get_date_created() ? $order->get_date_created()->date('c') : '',
                'service' => implode(', ', wp_list_pluck($order->get_items(), 'name')),
                'vehicle' => $order->get_meta('vehicle') ?: $order->get_meta('vehicle_info'),
                'oilType' => $order->get_meta('oil_type'),
                'oilQuantity' => $order->get_meta('oil_quantity'),
                'location' => trim($order->get_billing_address_1() . ' ' . $order->get_billing_city()),
                'notes' => $order->get_customer_note(),
            ] + ddd_ai_dispatch_lifecycle(function ($key) use ($order) {
                return $order->get_meta($key, true);
            }, $order->get_date_modified() ? $order->get_date_modified()->date('c') : '');
        }
    }

    // Merge sources before applying the requested limit; ID breaks timestamp ties.
    usort($records, function ($a, $b) {
        $date_order = (strtotime($b['createdAt']) ?: 0) <=> (strtotime($a['createdAt']) ?: 0);
        return $date_order ?: strnatcmp($b['id'], $a['id']);
    });
    return array_slice(array_values(array_unique($records, SORT_REGULAR)), 0, $limit);
}

function ddd_ai_dispatch_record_from_post(WP_Post $post) {
    return [
        'id' => (string) $post->ID,
        'createdAt' => get_post_time('c', true, $post),
        'service' => get_post_meta($post->ID, 'service_type', true) ?: get_post_meta($post->ID, 'service', true) ?: get_the_title($post),
        'vehicle' => get_post_meta($post->ID, 'vehicle', true) ?: get_post_meta($post->ID, 'vehicle_info', true),
        'oilType' => get_post_meta($post->ID, 'oil_type', true),
        'oilQuantity' => get_post_meta($post->ID, 'oil_quantity', true),
        'location' => get_post_meta($post->ID, 'service_address', true) ?: get_post_meta($post->ID, 'location', true),
        'notes' => wp_strip_all_tags($post->post_excerpt ?: $post->post_content),
    ] + ddd_ai_dispatch_lifecycle(function ($key) use ($post) {
        return get_post_meta($post->ID, $key, true);
    }, get_post_modified_time('c', true, $post));
}

/**
 * Export only stored service lifecycle metadata, never publication/payment status.
 * Alias precedence is left to right; missing values stay empty (no inferred job state).
 * Existing bridge IDs: external_booking_id/booking_id and job_id.
 * Additive aliases cover camelCase clients and common dispatch snippet metadata.
 */
function ddd_ai_dispatch_lifecycle($get_meta, $modified_at) {
    $read = function ($keys) use ($get_meta) {
        foreach ($keys as $key) {
            $value = $get_meta($key);
            if (is_scalar($value) && (string) $value !== '') {
                return (string) $value;
            }
        }
        return '';
    };
    $status = $read(['dispatch_status', 'dispatchStatus', 'job_status', 'status']);
    $assignee = $read(['assignedTo', 'assignee', 'assigned_to', 'assigned_tech', 'assignedtech']);
    return [
        'external_booking_id' => $read(['external_booking_id', 'booking_id']),
        'jobId' => $read(['job_id', 'jobId', 'platform_job_id']),
        'status' => $status,
        'dispatchStatus' => $status,
        'assignedTo' => $assignee,
        'assignee' => $assignee,
        'serviceTime' => $read(['serviceTime', 'service_time', 'scheduled_at', 'service_date']),
        'updatedAt' => $read(['updatedAt', 'updated_at']) ?: $modified_at,
    ];
}

function ddd_ai_dispatch_find_target_post_id($job_id, $booking_id, $phone) {
    foreach ([
        ['key' => 'job_id', 'value' => $job_id],
        ['key' => 'external_booking_id', 'value' => $booking_id],
        ['key' => 'booking_id', 'value' => $booking_id],
        ['key' => 'customer_phone', 'value' => $phone],
        ['key' => 'phone', 'value' => $phone],
    ] as $lookup) {
        if (!$lookup['value']) {
            continue;
        }
        $posts = get_posts([
            'post_type' => 'any',
            'post_status' => ['publish', 'private', 'draft'],
            'posts_per_page' => 1,
            'meta_key' => $lookup['key'],
            'meta_value' => $lookup['value'],
        ]);
        if ($posts) {
            return (int) $posts[0]->ID;
        }
    }
    return 0;
}

function ddd_ai_dispatch_clean_photo($photo) {
    if (!is_array($photo) || empty($photo['url'])) {
        return null;
    }
    return [
        'id' => sanitize_text_field($photo['id'] ?? ''),
        'url' => esc_url_raw($photo['url']),
        'originalName' => sanitize_text_field($photo['originalName'] ?? ''),
        'contentType' => sanitize_text_field($photo['contentType'] ?? ''),
        'sizeBytes' => absint($photo['sizeBytes'] ?? 0),
        'createdAt' => sanitize_text_field($photo['createdAt'] ?? ''),
        'note' => sanitize_textarea_field($photo['note'] ?? ''),
    ];
}

function ddd_ai_dispatch_normalize_phone($phone) {
    $digits = preg_replace('/\D+/', '', (string) $phone);
    if (strlen($digits) === 10) {
        return '+1' . $digits;
    }
    if (strlen($digits) === 11 && strpos($digits, '1') === 0) {
        return '+' . $digits;
    }
    return '';
}
