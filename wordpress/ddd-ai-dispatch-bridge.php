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

add_action('init', 'ddd_ai_dispatch_ensure_photo_page');
add_action('rest_api_init', 'ddd_ai_dispatch_register_routes');
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

    return new WP_Error('rest_forbidden', 'DDD AI Dispatch bridge access denied.', ['status' => 401]);
}

function ddd_ai_dispatch_customer_history(WP_REST_Request $request) {
    $phone = ddd_ai_dispatch_normalize_phone($request->get_param('phone'));
    if (!$phone) {
        return new WP_REST_Response(['ok' => false, 'error' => 'Phone is required.'], 400);
    }

    $records = ddd_ai_dispatch_find_customer_records($phone);
    return [
        'ok' => true,
        'phone' => $phone,
        'returningCustomer' => count($records) > 0,
        'bookings' => array_slice($records, 0, 12),
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

function ddd_ai_dispatch_find_customer_records($phone) {
    $digits = preg_replace('/\D+/', '', $phone);
    $variants = array_unique([$phone, $digits, substr($digits, -10)]);
    $records = [];

    $query = new WP_Query([
        'post_type' => 'any',
        'post_status' => ['publish', 'private', 'draft'],
        'posts_per_page' => 20,
        'meta_query' => [
            'relation' => 'OR',
            ['key' => 'customer_phone', 'value' => $variants, 'compare' => 'IN'],
            ['key' => 'phone', 'value' => $variants, 'compare' => 'IN'],
            ['key' => '_billing_phone', 'value' => $variants, 'compare' => 'IN'],
        ],
    ]);

    foreach ($query->posts as $post) {
        $records[] = ddd_ai_dispatch_record_from_post($post);
    }

    if (function_exists('wc_get_orders')) {
        $orders = wc_get_orders([
            'limit' => 10,
            'billing_phone' => substr($digits, -10),
            'orderby' => 'date',
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
            ];
        }
    }

    return array_values(array_unique($records, SORT_REGULAR));
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
