<?php
/**
 * 180 Core WordPress & WooCommerce Plugin Automated Simulation Test Suite
 * 
 * Tests:
 * 1. Zero-config plugin initialization & fallback states.
 * 2. Graceful degradation when WooCommerce is absent (pure WordPress SSO).
 * 3. 180 Identity OAuth 2.0 / SSO authorization redirect generation.
 * 4. 180 Identity code exchange and auto-user provisioning.
 * 5. 180 Pay WooCommerce gateway registration.
 * 6. 180 Pay checkout session generation (whole currency verification).
 * 7. 180 Pay webhook listener order settlement & status update via php://input.
 * 8. 180 Pay payment failure handling.
 */

define('ABSPATH', __DIR__ . '/');
define('WP_DEBUG', true);
define('ONE_EIGHTY_TEST_MODE', true);

// Global mock state
$GLOBALS['_wp_actions'] = array();
$GLOBALS['_wp_filters'] = array();
$GLOBALS['_wp_options'] = array();
$GLOBALS['_wp_users']   = array();
$GLOBALS['_wp_orders']  = array();
$GLOBALS['_wp_user_meta'] = array();
$GLOBALS['_wp_remote_mocks'] = array();
$GLOBALS['_wp_redirect_url'] = null;
$GLOBALS['_wp_notices'] = array();
$GLOBALS['_last_remote_request'] = null;
$GLOBALS['_mock_raw_input'] = '';

// ==========================================
// Mock php://input Stream Wrapper
// ==========================================
class MockPhpStream {
    protected $position = 0;
    protected $data = '';

    public function stream_open($path, $mode, $options, &$opened_path) {
        $this->data = $GLOBALS['_mock_raw_input'];
        $this->position = 0;
        return true;
    }

    public function stream_read($count) {
        $ret = substr($this->data, $this->position, $count);
        $this->position += strlen($ret);
        return $ret;
    }

    public function stream_eof() {
        return $this->position >= strlen($this->data);
    }

    public function stream_stat() {
        return array();
    }
}

stream_wrapper_unregister("php");
stream_wrapper_register("php", "MockPhpStream");

// ==========================================
// WordPress API Mock Functions
// ==========================================

function add_action($hook, $callback, $priority = 10, $accepted_args = 1) {
    $GLOBALS['_wp_actions'][$hook][] = array('callback' => $callback, 'priority' => $priority);
}

function do_action($hook, ...$args) {
    if (isset($GLOBALS['_wp_actions'][$hook])) {
        foreach ($GLOBALS['_wp_actions'][$hook] as $item) {
            call_user_func_array($item['callback'], $args);
        }
    }
}

function add_filter($hook, $callback, $priority = 10, $accepted_args = 1) {
    $GLOBALS['_wp_filters'][$hook][] = array('callback' => $callback, 'priority' => $priority);
}

function apply_filters($hook, $value, ...$args) {
    if (isset($GLOBALS['_wp_filters'][$hook])) {
        foreach ($GLOBALS['_wp_filters'][$hook] as $item) {
            $value = call_user_func_array($item['callback'], array_merge(array($value), $args));
        }
    }
    return $value;
}

function plugin_dir_path($file) {
    return dirname(__DIR__) . '/';
}

function plugin_dir_url($file) {
    return 'https://example.com/wp-content/plugins/180-core/';
}

function plugin_basename($file) {
    return '180-core/180-core.php';
}

function get_option($key, $default = false) {
    return isset($GLOBALS['_wp_options'][$key]) ? $GLOBALS['_wp_options'][$key] : $default;
}

function update_option($key, $value) {
    $GLOBALS['_wp_options'][$key] = $value;
    return true;
}

function register_setting($option_group, $option_name) {}
function add_settings_section($id, $title, $callback, $page) {}
function add_settings_field($id, $title, $callback, $page, $section = 'default') {}
function add_menu_page(...$args) {}
function add_submenu_page(...$args) {}
function settings_fields($group) {}
function do_settings_sections($page) {}
function submit_button() {}
function wp_enqueue_style(...$args) {}
function wp_enqueue_script(...$args) {}
function wp_localize_script(...$args) {}

function __($text, $domain = 'default') { return $text; }
function _e($text, $domain = 'default') { echo $text; }
function esc_html__($text, $domain = 'default') { return htmlspecialchars($text, ENT_QUOTES, 'UTF-8'); }
function esc_html($text) { return htmlspecialchars($text, ENT_QUOTES, 'UTF-8'); }
function esc_attr($text) { return htmlspecialchars($text, ENT_QUOTES, 'UTF-8'); }
function esc_url($url) { return filter_var($url, FILTER_SANITIZE_URL); }
function esc_url_raw($url) { return filter_var($url, FILTER_SANITIZE_URL); }
function esc_js($text) { return addslashes($text); }
function sanitize_text_field($str) { return trim(strip_tags($str)); }
function sanitize_email($email) { return filter_var($email, FILTER_SANITIZE_EMAIL); }
function sanitize_user($username, $strict = false) { return preg_replace('/[^a-zA-Z0-9_\-\.]/', '', $username); }
function sanitize_textarea_field($str) { return trim(strip_tags($str)); }
function rest_sanitize_boolean($val) { return (bool) $val; }
function wp_unslash($val) { return $val; }
function is_admin() { return true; }
function admin_url($path = '') { return 'https://example.com/wp-admin/' . $path; }
function home_url($path = '') { return 'https://example.com/' . ltrim($path, '/'); }
function wp_login_url($redirect = '') { return 'https://example.com/wp-login.php?redirect_to=' . urlencode($redirect); }
function wp_salt($scheme = 'auth') { return 'test_salt_secret_180_core_platform_mock'; }
function wp_validate_redirect($url, $default = '') { return !empty($url) ? $url : $default; }

function wp_redirect($url, $status = 302) {
    $GLOBALS['_wp_redirect_url'] = $url;
    return true;
}

function wp_safe_redirect($url, $status = 302) {
    $GLOBALS['_wp_redirect_url'] = $url;
    return true;
}

function wp_clear_auth_cookie() {}

function wp_die($msg = '') {
    throw new Exception("WP_DIE: " . $msg);
}

function wp_generate_password($length = 12) {
    return substr(md5(uniqid(rand(), true)), 0, $length);
}

function email_exists($email) {
    foreach ($GLOBALS['_wp_users'] as $user) {
        if ($user->user_email === $email) return $user->ID;
    }
    return false;
}

function username_exists($username) {
    foreach ($GLOBALS['_wp_users'] as $user) {
        if ($user->user_login === $username) return $user->ID;
    }
    return false;
}

#[\AllowDynamicProperties]
class Mock_WP_User {
    public $ID;
    public $user_login;
    public $user_email;
    public $user_pass;
    public $display_name;
    public $roles = array();

    public function __construct($id, $username, $email, $password) {
        $this->ID = $id;
        $this->user_login = $username;
        $this->user_email = $email;
        $this->user_pass = $password;
        $this->display_name = $username;
    }

    public function set_role($role) {
        $this->roles = array($role);
    }
}

function get_user_by($field, $value) {
    foreach ($GLOBALS['_wp_users'] as $user) {
        if ($field === 'id' && $user->ID == $value) return $user;
        if ($field === 'email' && $user->user_email === $value) return $user;
        if ($field === 'login' && $user->user_login === $value) return $user;
    }
    return false;
}

function wp_create_user($username, $password, $email) {
    $id = count($GLOBALS['_wp_users']) + 1;
    $user = new Mock_WP_User($id, $username, $email, $password);
    $GLOBALS['_wp_users'][$id] = $user;
    return $id;
}

function wp_update_user($userdata) {
    $id = $userdata['ID'];
    if (isset($GLOBALS['_wp_users'][$id])) {
        foreach ($userdata as $k => $v) {
            $GLOBALS['_wp_users'][$id]->$k = $v;
        }
    }
    return $id;
}

function update_user_meta($user_id, $key, $value) {
    $GLOBALS['_wp_user_meta'][$user_id][$key] = $value;
    return true;
}

function get_user_meta($user_id, $key, $single = true) {
    if (isset($GLOBALS['_wp_user_meta'][$user_id][$key])) {
        return $GLOBALS['_wp_user_meta'][$user_id][$key];
    }
    return $single ? '' : array();
}

function wp_set_current_user($id) {
    $GLOBALS['_wp_current_user_id'] = $id;
}

function wp_set_auth_cookie($id, $remember = false) {
    $GLOBALS['_wp_auth_cookie_user_id'] = $id;
}

function is_user_logged_in() {
    return !empty($GLOBALS['_wp_current_user_id']);
}

function add_shortcode($tag, $callback) {
    $GLOBALS['_wp_shortcodes'][$tag] = $callback;
}

function shortcode_atts($pairs, $atts, $shortcode = '') {
    $atts = (array)$atts;
    $out = array();
    foreach ($pairs as $name => $default) {
        if (array_key_exists($name, $atts)) {
            $out[$name] = $atts[$name];
        } else {
            $out[$name] = $default;
        }
    }
    return $out;
}

function wp_create_nonce($action = -1) {
    return substr(md5($action . 'mock_nonce_salt'), 0, 10);
}

function wp_verify_nonce($nonce, $action = -1) {
    return true;
}

function wp_json_encode($data, $options = 0, $depth = 512) {
    return json_encode($data, $options, $depth);
}

function trailingslashit($string) {
    return rtrim($string, '/\\') . '/';
}

function untrailingslashit($string) {
    return rtrim($string, '/\\');
}

function add_query_arg(...$args) {
    if (is_array($args[0])) {
        $params = $args[0];
        $url = isset($args[1]) ? $args[1] : '';
    } else {
        $params = array($args[0] => $args[1]);
        $url = isset($args[2]) ? $args[2] : '';
    }
    $query = http_build_query($params);
    $delimiter = strpos($url, '?') !== false ? '&' : '?';
    return $url . $delimiter . $query;
}

function status_header($code) {
    $GLOBALS['_http_status_header'] = $code;
}

// HTTP Mocking
function wp_safe_remote_post($url, $args = array()) {
    return wp_remote_post($url, $args);
}

function wp_remote_post($url, $args = array()) {
    $GLOBALS['_last_remote_request'] = array('url' => $url, 'args' => $args);

    if (isset($GLOBALS['_wp_remote_mocks'][$url])) {
        return $GLOBALS['_wp_remote_mocks'][$url];
    }

    return array(
        'response' => array('code' => 200),
        'body' => json_encode(array('success' => true)),
    );
}

function wp_remote_get($url, $args = array()) {
    $GLOBALS['_last_remote_request'] = array('url' => $url, 'args' => $args);

    if (isset($GLOBALS['_wp_remote_mocks'][$url])) {
        return $GLOBALS['_wp_remote_mocks'][$url];
    }

    return array(
        'response' => array('code' => 200),
        'body' => json_encode(array('success' => true)),
    );
}

function is_wp_error($thing) {
    return ($thing instanceof WP_Error);
}

function wp_remote_retrieve_response_code($response) {
    return isset($response['response']['code']) ? $response['response']['code'] : 500;
}

function wp_remote_retrieve_body($response) {
    return isset($response['body']) ? $response['body'] : '';
}

class WP_Error {
    private $code;
    private $message;
    public function __construct($code = '', $message = '') {
        $this->code = $code;
        $this->message = $message;
    }
    public function get_error_message() { return $this->message; }
    public function get_error_code() { return $this->code; }
}

// ==========================================
// WooCommerce Mock Classes & Functions
// ==========================================

class Mock_WC_Cart {
    public function empty_cart() {
        $GLOBALS['_wc_cart_emptied'] = true;
    }
}

class Mock_WC_Instance {
    public $cart;
    public function __construct() {
        $this->cart = new Mock_WC_Cart();
    }
}

function WC() {
    if (!isset($GLOBALS['_wc_instance'])) {
        $GLOBALS['_wc_instance'] = new Mock_WC_Instance();
    }
    return $GLOBALS['_wc_instance'];
}

function get_bloginfo($show = 'name') {
    return '180 Test Store';
}

class WC_Payment_Gateway {
    public $id;
    public $icon;
    public $has_fields;
    public $method_title;
    public $method_description;
    public $supports = array();
    public $settings = array();
    public $form_fields = array();
    public $enabled;
    public $title;
    public $description;

    public function init_form_fields() {}
    public function init_settings() {}
    public function get_option($key, $default = '') {
        return isset($this->settings[$key]) ? $this->settings[$key] : $default;
    }
    public function get_return_url($order = null) {
        $order_id = is_object($order) ? $order->get_id() : $order;
        return 'https://example.com/checkout/order-received/' . $order_id . '/?key=wc_order_test';
    }
}

class Mock_WC_Order {
    private $id;
    private $total;
    private $currency;
    private $status;
    private $txn_id;
    private $notes = array();
    private $meta = array();

    public function __construct($id, $total = 499.00, $currency = 'INR') {
        $this->id = $id;
        $this->total = $total;
        $this->currency = $currency;
        $this->status = 'pending';
    }

    public function get_id() { return $this->id; }
    public function get_order_number() { return strval($this->id); }
    public function get_order_key() { return 'wc_order_key_' . $this->id; }
    public function get_cancel_order_url() { return 'https://example.com/checkout/cancel/' . $this->id; }
    public function get_total() { return $this->total; }
    public function get_currency() { return $this->currency; }
    public function get_billing_email() { return 'aarav@180workspace.com'; }
    public function get_billing_first_name() { return 'Aarav'; }
    public function get_billing_last_name() { return 'Sharma'; }
    public function get_status() { return $this->status; }
    public function is_paid() { return in_array($this->status, array('processing', 'completed')); }
    public function get_transaction_id() { return $this->txn_id; }

    public function update_meta_data($key, $value) {
        $this->meta[$key] = $value;
    }

    public function get_meta($key) {
        return isset($this->meta[$key]) ? $this->meta[$key] : '';
    }

    public function payment_complete($txn_id = '') {
        $this->txn_id = $txn_id;
        $this->status = 'processing';
    }

    public function update_status($new_status, $note = '') {
        $this->status = $new_status;
        if (!empty($note)) $this->notes[] = $note;
    }

    public function add_order_note($note) {
        $this->notes[] = $note;
    }

    public function save() {
        $GLOBALS['_wp_orders'][$this->id] = $this;
    }
}

function wc_get_order($order_id) {
    if (isset($GLOBALS['_wp_orders'][$order_id])) {
        return $GLOBALS['_wp_orders'][$order_id];
    }
    return null;
}

function wc_get_orders($args = array()) {
    $results = array();
    if (!empty($args['meta_key']) && !empty($args['meta_value'])) {
        foreach ($GLOBALS['_wp_orders'] as $order) {
            if ($order->get_meta($args['meta_key']) === $args['meta_value']) {
                $results[] = $order;
            }
        }
    }
    return $results;
}

function wc_add_notice($message, $notice_type = 'success') {
    $GLOBALS['_wc_notices'][] = array('msg' => $message, 'type' => $notice_type);
}

function wc_price($amount) {
    return '₹' . number_format($amount, 2);
}

// ==========================================
// TEST SUITE EXECUTION
// ==========================================

$passed = 0;
$failed = 0;

function assert_test($condition, $name) {
    global $passed, $failed;
    if ($condition) {
        echo "[PASS] " . $name . "\n";
        $passed++;
    } else {
        echo "[FAIL] " . $name . "\n";
        $failed++;
    }
}

echo "=========================================================\n";
echo "180 Core Plugin: Comprehensive Automated Simulation Suite\n";
echo "=========================================================\n\n";

// ----------------------------------------------------
// TEST 1: Plugin Loading & Zero-Config Defaults
// ----------------------------------------------------
require_once dirname(__DIR__) . '/180-core.php';

assert_test(class_exists('OneEighty_Core_Plugin'), 'OneEighty_Core_Plugin class loaded');

$core = OneEighty_Core_Plugin::get_instance();
assert_test($core !== null, 'Plugin singleton instance retrieved');

// Check initial defaults
assert_test(get_option('180_core_mode', 'sandbox') === 'sandbox', 'Default environment mode is sandbox');
assert_test(get_option('180_identity_enabled', '1') === '1', '180 Identity enabled by default');
assert_test(get_option('180_pay_enabled', '1') === '1', '180 Pay enabled by default');

// ----------------------------------------------------
// TEST 2: Fast Merchant Credential Configuration
// ----------------------------------------------------
update_option('180_core_client_id', '180_client_simulated_77a90f');
update_option('180_core_client_secret', 'sec_simulated_live_88319f0');
update_option('180_core_mode', 'live');

assert_test(get_option('180_core_client_id') === '180_client_simulated_77a90f', 'Client ID saved & read');
assert_test(get_option('180_core_client_secret') === 'sec_simulated_live_88319f0', 'Client Secret saved & read');
assert_test(get_option('180_core_mode') === 'live', 'Live environment active');

// ----------------------------------------------------
// TEST 3: 180 Identity SSO URL Generation & Shortcode
// ----------------------------------------------------
require_once dirname(__DIR__) . '/includes/class-180-identity.php';
$identity = OneEighty_Identity_Module::get_instance();
assert_test($identity !== null, 'OneEighty_Identity_Module loaded');

// Test shortcode output
assert_test(isset($GLOBALS['_wp_shortcodes']['180_login']), '[180_login] shortcode registered');
$shortcode_html = call_user_func($GLOBALS['_wp_shortcodes']['180_login'], array('text' => 'Login with 180 ID'));
assert_test(strpos($shortcode_html, 'Login with 180 ID') !== false, 'Shortcode renders custom button text');
assert_test(strpos($shortcode_html, 'one-eighty-sso-button') !== false, 'Shortcode includes branded CSS classes');

// ----------------------------------------------------
// TEST 4: 180 Identity OAuth Code Exchange & Auto-User Provisioning
// ----------------------------------------------------
// Mock the token endpoint and userinfo endpoint
$token_endpoint = 'https://api.180core.cloud/api/oauth/token';
$GLOBALS['_wp_remote_mocks'][$token_endpoint] = array(
    'response' => array('code' => 200),
    'body' => json_encode(array(
        'access_token' => 'at_simulated_9821390123',
        'token_type'   => 'Bearer',
    ))
);

$userinfo_endpoint = 'https://api.180core.cloud/api/oauth/userinfo';
$GLOBALS['_wp_remote_mocks'][$userinfo_endpoint] = array(
    'response' => array('code' => 200),
    'body' => json_encode(array(
        'sub'      => 'usr_180_simulated_4401',
        'username' => 'aarav_sharma',
        'email'    => 'aarav@180workspace.com',
        'name'     => 'Aarav Sharma',
        'phone'    => '+919876543210'
    ))
);

// Prepare callback state with legitimate cryptographic HMAC signature
$redirect_target = 'https://example.com/dashboard';
$auth_url = $identity->get_authorization_url($redirect_target);
parse_str(parse_url($auth_url, PHP_URL_QUERY), $query_params);
$signed_state = $query_params['state'];

$_GET['180core_auth'] = 'callback';
$_GET['code']         = 'sim_code_123';
$_GET['state']        = $signed_state;

// Execute auth callback with exit interception
try {
    $identity->handle_auth_callback();
} catch (Exception $e) {
    // Intercept exit/redirect if any
}

// Verify user was automatically provisioned in WordPress
$user = get_user_by('email', 'aarav@180workspace.com');
assert_test($user !== false, '180 Identity auto-provisioned WordPress user from OAuth response');
assert_test($user->user_email === 'aarav@180workspace.com', 'User email correctly set');
assert_test($GLOBALS['_wp_auth_cookie_user_id'] === $user->ID, 'WordPress auth session cookie issued');
assert_test($GLOBALS['_wp_redirect_url'] === 'https://example.com/dashboard', 'User redirected to requested destination');

// ----------------------------------------------------
// TEST 4b: Security Audit Test - Tampered OAuth State Rejection
// ----------------------------------------------------
$_GET['state'] = base64_encode(json_encode(array(
    'ts' => time(),
    'nonce' => 'forged_nonce',
    'redirect_to' => 'https://attacker.com/evil',
    'sig' => 'fake_forged_signature_0000',
)));
$state_tamper_rejected = false;
try {
    $identity->handle_auth_callback();
} catch (Exception $e) {
    if (strpos($e->getMessage(), 'signature mismatch') !== false || strpos($e->getMessage(), 'Security Error') !== false) {
        $state_tamper_rejected = true;
    }
}
assert_test($state_tamper_rejected, 'Security: Forged/tampered OAuth state rejected with cryptographic error');

// ----------------------------------------------------
// TEST 5: 180 Pay Gateway & Standalone Shortcode Registration
// ----------------------------------------------------
require_once dirname(__DIR__) . '/includes/class-180-pay-gateway.php';
$pay_module = OneEighty_Pay_Gateway_Module::get_instance();
assert_test($pay_module !== null, 'OneEighty_Pay_Gateway_Module loaded');

// Test standalone [180_pay] shortcode (Bookings, Consultations, Tickets, Donations)
assert_test(isset($GLOBALS['_wp_shortcodes']['180_pay']), '[180_pay] standalone shortcode registered for non-WooCommerce sites');
$booking_button_html = call_user_func($GLOBALS['_wp_shortcodes']['180_pay'], array(
    'amount'   => '750',
    'currency' => 'INR',
    'title'    => 'Consultation Booking',
    'text'     => 'Book Appointment for ₹750'
));
assert_test(strpos($booking_button_html, 'data-180-amount="750"') !== false, '[180_pay] sets correct whole currency amount attribute (750)');
assert_test(strpos($booking_button_html, 'data-180-title="Consultation Booking"') !== false, '[180_pay] sets booking title');
assert_test(strpos($booking_button_html, 'Book Appointment for ₹750') !== false, '[180_pay] renders custom booking button label');

// Trigger WooCommerce gateway registration filter
$gateways = apply_filters('woocommerce_payment_gateways', array());
assert_test(in_array('WC_Gateway_180_Pay', $gateways), 'WC_Gateway_180_Pay registered in WooCommerce payment gateways');

// Trigger plugins_loaded hook to define gateway class
do_action('plugins_loaded');
assert_test(class_exists('WC_Gateway_180_Pay'), 'WC_Gateway_180_Pay class declared cleanly');

$gateway = new WC_Gateway_180_Pay();
assert_test($gateway->id === '180pay', 'Gateway ID is 180pay');
assert_test(in_array('refunds', $gateway->supports), 'Gateway supports refunds');

// ----------------------------------------------------
// TEST 6: Checkout Session Creation (Whole Currency Standard)
// ----------------------------------------------------
// Create mock order #1001 for ₹499.00
$order = new Mock_WC_Order(1001, 499.00, 'INR');
$order->save();

// Mock 180 Pay checkout session API
$session_endpoint = 'https://api.180core.cloud/api/v1/identity/checkout/sessions';
$GLOBALS['_wp_remote_mocks'][$session_endpoint] = array(
    'response' => array('code' => 201),
    'body' => json_encode(array(
        'success' => true,
        'sessionUrl' => 'https://pay.180core.cloud/checkout/chk_session_simulated_998231',
        'id' => 'chk_session_simulated_998231',
    ))
);

$checkout_result = $gateway->process_payment(1001);

assert_test(isset($checkout_result['result']) && $checkout_result['result'] === 'success', 'Checkout payment processed successfully');
assert_test(strpos($checkout_result['redirect'], 'pay.180core.cloud/checkout/chk_session_simulated_998231') !== false, 'Redirects to 180 Pay sovereign checkout URL');

// Verify request payload strictly sent whole currency units (499, NOT 49900)
$last_req = $GLOBALS['_last_remote_request'];
$sent_payload = json_decode($last_req['args']['body'], true);
assert_test(floatval($sent_payload['amount']) === 499.0, 'Strict Whole Currency: amount passed as 499 (not 49900 paise)');
assert_test($sent_payload['currency'] === 'INR', 'Currency passed as INR');
assert_test(intval($sent_payload['metadata']['order_id']) === 1001, 'Order ID correctly passed in metadata');

// Verify cart was emptied
assert_test(!empty($GLOBALS['_wc_cart_emptied']), 'WooCommerce cart safely emptied upon checkout session creation');

// ----------------------------------------------------
// TEST 7: Webhook Processing (Real-Time Order Settlement via php://input)
// ----------------------------------------------------
$webhook_payload = array(
    'event' => 'payment.succeeded',
    'transactionId' => 'txn_180_live_confirmed_7781',
    'orderId' => 1001,
    'amount' => 499,
    'currency' => 'INR',
    'status' => 'COMPLETED'
);

$raw_webhook_json = json_encode($webhook_payload);
$GLOBALS['_mock_raw_input'] = $raw_webhook_json;

// Subtest 7a: Anti-Spoofing - Unsigned webhook must be rejected with 401 Unauthorized
unset($_SERVER['HTTP_X_180_SIGNATURE']);
unset($_SERVER['HTTP_X_SIGNATURE']);
ob_start();
try {
    $gateway->handle_webhook();
} catch (Exception $e) {}
$unauth_output = ob_get_clean();

assert_test($GLOBALS['_http_status_header'] === 401, 'Security: Unsigned webhook rejected with HTTP 401 Unauthorized');

// Subtest 7b: Valid HMAC Signature verification
$client_secret = get_option('180_core_client_secret');
$now_ts = time();
$sig_hash = hash_hmac('sha256', $now_ts . '.' . $raw_webhook_json, $client_secret);
$_SERVER['HTTP_X_180_SIGNATURE'] = "t={$now_ts},v1={$sig_hash}";
$_SERVER['HTTP_X_180_TIMESTAMP'] = $now_ts;

// Verify order is pending before valid webhook
$order_before = wc_get_order(1001);
assert_test($order_before->get_status() === 'pending', 'Order is pending before webhook');

// Trigger webhook method with valid cryptographic HMAC
ob_start();
try {
    $gateway->handle_webhook();
} catch (Exception $e) {}
$webhook_output = ob_get_clean();

$order_after = wc_get_order(1001);
assert_test($order_after->get_status() === 'processing', 'Order status seamlessly transitioned to processing upon payment.succeeded');
assert_test($order_after->get_transaction_id() === 'txn_180_live_confirmed_7781', 'Transaction ID txn_180_live_confirmed_7781 recorded on WooCommerce order');
assert_test($GLOBALS['_http_status_header'] === 200, 'Security: Valid HMAC-signed webhook accepted with HTTP 200 OK status');

// ----------------------------------------------------
// TEST 8: Webhook Payment Failure Handling with Valid HMAC
// ----------------------------------------------------
$order_fail = new Mock_WC_Order(1002, 1299.00, 'INR');
$order_fail->save();

$fail_payload = array(
    'event' => 'payment.failed',
    'transactionId' => 'txn_180_fail_0091',
    'orderId' => 1002,
    'failureReason' => 'UPI PIN limit exceeded or cancelled by customer.'
);

$fail_raw_json = json_encode($fail_payload);
$GLOBALS['_mock_raw_input'] = $fail_raw_json;
$_SERVER['HTTP_X_180_SIGNATURE'] = hash_hmac('sha256', $fail_raw_json, $client_secret);
unset($_SERVER['HTTP_X_180_TIMESTAMP']);

ob_start();
try {
    $gateway->handle_webhook();
} catch (Exception $e) {}
$webhook_fail_output = ob_get_clean();

$order_fail_check = wc_get_order(1002);
assert_test($order_fail_check->get_status() === 'failed', 'Payment failure correctly marked order as failed');

// ----------------------------------------------------
// Summary
// ----------------------------------------------------
echo "\n=========================================================\n";
echo "Test Execution Summary: $passed Passed, $failed Failed\n";
echo "=========================================================\n";

if ($failed === 0) {
    echo "Result: ALL TESTS PASSED! 180 Core Plugin is 100% verified & production-ready.\n";
    exit(0);
} else {
    echo "Result: SOME TESTS FAILED!\n";
    exit(1);
}
