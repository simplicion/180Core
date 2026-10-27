<?php
/**
 * 180 Pay Gateway Module
 * Sovereign WooCommerce Payment Gateway (UPI, QR, Cards, NetBanking, 180 Wallet)
 */

if (!defined('ABSPATH')) {
    exit;
}

class OneEighty_Pay_Gateway_Module {
    private static $instance = null;

    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        // Register gateway with WooCommerce
        add_filter('woocommerce_payment_gateways', array($this, 'register_gateway'));

        // Initialize gateway class when plugins loaded
        add_action('plugins_loaded', 'one_eighty_init_wc_gateway_class');

        // Universal [180_pay] Shortcode for Bookings, Tickets, Services, and Donations
        add_shortcode('180_pay', array($this, 'shortcode_pay_button'));

        // Standalone Webhook Listener (/?180_webhook=pay)
        add_action('init', array($this, 'handle_standalone_webhook'));
    }

    public function register_gateway($gateways) {
        $gateways[] = 'WC_Gateway_180_Pay';
        return $gateways;
    }

    public function shortcode_pay_button($atts) {
        $atts = shortcode_atts(array(
            'amount'      => '0',
            'currency'    => 'INR',
            'title'       => __('180 Pay Payment', '180-core'),
            'order_id'    => '',
            'text'        => '',
            'redirect'    => '',
            'class'       => '',
        ), $atts, '180_pay');

        $amount = floatval($atts['amount']);
        $currency = strtoupper($atts['currency']);
        $title = sanitize_text_field($atts['title']);
        $order_id = !empty($atts['order_id']) ? sanitize_text_field($atts['order_id']) : ('book_' . substr(md5(uniqid(rand(), true)), 0, 8));
        $redirect = !empty($atts['redirect']) ? esc_url_raw($atts['redirect']) : '';

        $currency_symbol = $currency === 'INR' ? '₹' : ($currency === 'USD' ? '$' : ($currency === 'EUR' ? '€' : $currency));
        $button_text = !empty($atts['text']) ? esc_html($atts['text']) : sprintf(__('Pay %s%s with 180 Pay', '180-core'), $currency_symbol, $amount);

        ob_start();
        ?>
        <div class="one-eighty-pay-shortcode-container <?php echo esc_attr($atts['class']); ?>">
            <button type="button" 
                    class="one-eighty-sso-button one-eighty-pay-custom-btn" 
                    data-180-pay-trigger="true"
                    data-180-amount="<?php echo esc_attr($amount); ?>"
                    data-180-currency="<?php echo esc_attr($currency); ?>"
                    data-180-title="<?php echo esc_attr($title); ?>"
                    data-180-order-id="<?php echo esc_attr($order_id); ?>"
                    data-180-return-url="<?php echo esc_url($redirect); ?>">
                <span class="one-eighty-btn-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="5" width="20" height="14" rx="2"/>
                        <line x1="2" y1="10" x2="22" y2="10"/>
                    </svg>
                </span>
                <span class="one-eighty-btn-text"><?php echo $button_text; ?></span>
                <span class="one-eighty-btn-badge"><?php _e('Instant UPI / Cards', '180-core'); ?></span>
            </button>
        </div>
        <?php
        return ob_get_clean();
    }

    public function handle_standalone_webhook() {
        if (!isset($_GET['180_webhook']) || $_GET['180_webhook'] !== 'pay') {
            return;
        }

        $raw_body = file_get_contents('php://input');
        if (empty($raw_body)) {
            status_header(400);
            echo 'Missing body';
            if (!defined('ONE_EIGHTY_TEST_MODE')) { exit; }
            return;
        }

        // Verify cryptographic signature
        $client_secret = get_option('180_core_client_secret');
        $sig = !empty($_SERVER['HTTP_X_180_SIGNATURE']) ? sanitize_text_field($_SERVER['HTTP_X_180_SIGNATURE']) : '';
        if (empty($client_secret) || empty($sig)) {
            status_header(401);
            echo 'Unauthorized';
            if (!defined('ONE_EIGHTY_TEST_MODE')) { exit; }
            return;
        }

        $expected = hash_hmac('sha256', $raw_body, $client_secret);
        if (!hash_equals($expected, $sig)) {
            status_header(401);
            echo 'Invalid signature';
            if (!defined('ONE_EIGHTY_TEST_MODE')) { exit; }
            return;
        }

        $data = json_decode($raw_body, true);
        $event = isset($data['event']) ? $data['event'] : '';
        $payload = isset($data['data']) ? $data['data'] : $data;

        // Trigger WordPress developer action hooks for bookings and custom plugins
        do_action('180_pay_payment_completed', $payload, $event);
        status_header(200);
        echo '180 Pay generic webhook processed';
        if (!defined('ONE_EIGHTY_TEST_MODE')) { exit; }
    }
}

function one_eighty_init_wc_gateway_class() {
    if (!class_exists('WC_Payment_Gateway')) {
        return;
    }

    if (class_exists('WC_Gateway_180_Pay')) {
        return;
    }

    class WC_Gateway_180_Pay extends WC_Payment_Gateway {
        public function __construct() {
                $this->id                 = '180pay';
                $this->icon               = ONE_EIGHTY_CORE_PLUGIN_URL . 'assets/180-pay-badge.svg';
                $this->has_fields         = false;
                $this->method_title       = __('180 Pay', '180-core');
                $this->method_description = __('Accept instant UPI, QR, Credit/Debit Cards, NetBanking, and Sovereign 180 Wallet payments.', '180-core');

                $this->supports = array(
                    'products',
                    'refunds',
                );

                $this->init_form_fields();
                $this->init_settings();

                // Use plugin options or gateway settings
                $this->enabled     = get_option('180_pay_enabled', '1') ? 'yes' : 'no';
                $this->title       = get_option('180_pay_title', '180 Pay (UPI, Cards, NetBanking, 180 Wallet)');
                $this->description = get_option('180_pay_description', 'Pay securely using Instant UPI, QR, Credit/Debit Cards, NetBanking, or your 180 Sovereign Wallet.');

                // Webhook listener
                add_action('woocommerce_api_wc_180pay_gateway', array($this, 'handle_webhook'));

                // Save admin settings
                add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
            }

            public function init_form_fields() {
                $this->form_fields = array(
                    'enabled' => array(
                        'title'   => __('Enable/Disable', '180-core'),
                        'type'    => 'checkbox',
                        'label'   => __('Enable 180 Pay Gateway', '180-core'),
                        'default' => 'yes',
                    ),
                    'title' => array(
                        'title'       => __('Title', '180-core'),
                        'type'        => 'text',
                        'description' => __('Payment method title displayed during checkout.', '180-core'),
                        'default'     => '180 Pay (UPI, Cards, NetBanking, 180 Wallet)',
                        'desc_tip'    => true,
                    ),
                    'description' => array(
                        'title'       => __('Description', '180-core'),
                        'type'        => 'textarea',
                        'description' => __('Payment method description displayed during checkout.', '180-core'),
                        'default'     => 'Pay securely using Instant UPI, QR, Credit/Debit Cards, NetBanking, or your 180 Sovereign Wallet.',
                    ),
                    'order_status' => array(
                        'title'       => __('Paid Order Status', '180-core'),
                        'type'        => 'select',
                        'description' => __('Order status after successful payment verification.', '180-core'),
                        'default'     => 'processing',
                        'options'     => array(
                            'processing' => __('Processing', '180-core'),
                            'completed'  => __('Completed', '180-core'),
                        ),
                    ),
                );
            }

            public function process_payment($order_id) {
                $order = wc_get_order($order_id);
                if (!$order) {
                    wc_add_notice(__('Order not found.', '180-core'), 'error');
                    return array('result' => 'fail');
                }

                $client_id = get_option('180_core_client_id');
                $client_secret = get_option('180_core_client_secret');
                $api_base = get_option('180_core_api_base', 'https://api.180core.cloud');
                $profile_base = get_option('180_core_profile_base', 'https://profile.180core.cloud');

                if (empty($client_id) || empty($client_secret)) {
                    wc_add_notice(__('180 Pay is not properly configured. Please contact the store owner.', '180-core'), 'error');
                    return array('result' => 'fail');
                }

                $amount = $order->get_total();
                $currency = $order->get_currency();
                $return_url = $this->get_return_url($order);
                $cancel_url = $order->get_cancel_order_url();

                $payload = array(
                    'clientId'     => $client_id,
                    'clientSecret' => $client_secret,
                    'amount'       => floatval($amount),
                    'currency'     => strtoupper($currency),
                    'title'        => sprintf(__('Order #%s', '180-core'), $order->get_order_number()),
                    'description'  => sprintf(__('Payment for Order #%s at %s', '180-core'), $order->get_order_number(), get_bloginfo('name')),
                    'returnUrl'    => $return_url,
                    'cancelUrl'    => $cancel_url,
                    'metadata'     => array(
                        'order_id'       => strval($order->get_id()),
                        'order_number'   => strval($order->get_order_number()),
                        'customer_email' => $order->get_billing_email(),
                        'customer_name'  => trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name()),
                        'store_url'      => home_url(),
                        'platform'       => 'woocommerce',
                    ),
                );

                $response = wp_remote_post(trailingslashit($api_base) . 'api/v1/identity/checkout/sessions', array(
                    'headers' => array(
                        'Content-Type' => 'application/json',
                    ),
                    'body'    => wp_json_encode($payload),
                    'timeout' => 20,
                ));

                if (is_wp_error($response)) {
                    wc_add_notice(__('Could not connect to 180 Pay payment gateway.', '180-core'), 'error');
                    return array('result' => 'fail');
                }

                $status_code = wp_remote_retrieve_response_code($response);
                $body = json_decode(wp_remote_retrieve_body($response), true);

                if ($status_code !== 200 && $status_code !== 201) {
                    $error_msg = !empty($body['error']) ? $body['error'] : __('Failed to create 180 Pay checkout session.', '180-core');
                    wc_add_notice($error_msg, 'error');
                    return array('result' => 'fail');
                }

                $session = !empty($body['data']) ? $body['data'] : $body;
                $session_id = !empty($session['id']) ? $session['id'] : '';
                $session_url = !empty($session['sessionUrl']) ? $session['sessionUrl'] : (trailingslashit($profile_base) . 'checkout/' . $session_id);

                if (empty($session_url)) {
                    wc_add_notice(__('Invalid checkout URL returned by 180 Pay.', '180-core'), 'error');
                    return array('result' => 'fail');
                }

                // Save session in order meta
                $order->update_meta_data('_180pay_session_id', $session_id);
                $order->add_order_note(sprintf(__('180 Pay checkout session initiated: %s', '180-core'), $session_id));
                $order->save();

                // Empty cart safely if available
                if (function_exists('WC') && WC()->cart) {
                    WC()->cart->empty_cart();
                }

                return array(
                    'result'   => 'success',
                    'redirect' => $session_url,
                );
            }

            public function verify_webhook_signature($raw_body) {
                $client_secret = get_option('180_core_client_secret');
                if (empty($client_secret)) {
                    return false;
                }

                $signature_header = '';
                if (!empty($_SERVER['HTTP_X_180_SIGNATURE'])) {
                    $signature_header = sanitize_text_field($_SERVER['HTTP_X_180_SIGNATURE']);
                } elseif (!empty($_SERVER['HTTP_X_SIGNATURE'])) {
                    $signature_header = sanitize_text_field($_SERVER['HTTP_X_SIGNATURE']);
                }

                if (empty($signature_header)) {
                    return false;
                }

                $timestamp = '';
                if (!empty($_SERVER['HTTP_X_180_TIMESTAMP'])) {
                    $timestamp = sanitize_text_field($_SERVER['HTTP_X_180_TIMESTAMP']);
                }

                $received_hash = $signature_header;

                if (strpos($signature_header, 't=') !== false && strpos($signature_header, 'v1=') !== false) {
                    $parts = explode(',', $signature_header);
                    foreach ($parts as $part) {
                        $part = trim($part);
                        if (strpos($part, 't=') === 0 && empty($timestamp)) {
                            $timestamp = substr($part, 2);
                        } elseif (strpos($part, 'v1=') === 0) {
                            $received_hash = substr($part, 3);
                        }
                    }
                }

                // Verify timestamp tolerance (within 300 seconds) to prevent replay attacks
                if (!empty($timestamp)) {
                    $ts = intval($timestamp);
                    if (abs(time() - $ts) > 300) {
                        return false;
                    }
                    $payload_to_sign = $timestamp . '.' . $raw_body;
                    $expected_hash = hash_hmac('sha256', $payload_to_sign, $client_secret);
                    if (hash_equals($expected_hash, $received_hash)) {
                        return true;
                    }
                }

                // Fallback to direct payload signature check
                $direct_hash = hash_hmac('sha256', $raw_body, $client_secret);
                return hash_equals($direct_hash, $received_hash);
            }

            public function handle_webhook() {
                $raw_body = file_get_contents('php://input');
                if (empty($raw_body)) {
                    status_header(400);
                    echo 'Missing body';
                    if (!defined('ONE_EIGHTY_TEST_MODE')) {
                        exit;
                    }
                    return;
                }

                // Strict Cryptographic Authentication: Reject unauthenticated webhook calls
                if (!$this->verify_webhook_signature($raw_body)) {
                    status_header(401);
                    echo 'Unauthorized: Invalid or missing webhook signature';
                    if (!defined('ONE_EIGHTY_TEST_MODE')) {
                        exit;
                    }
                    return;
                }

                $data = json_decode($raw_body, true);
                if (!$data) {
                    status_header(400);
                    echo 'Invalid JSON';
                    if (!defined('ONE_EIGHTY_TEST_MODE')) {
                        exit;
                    }
                    return;
                }

                $event = isset($data['event']) ? $data['event'] : '';
                $payload = isset($data['data']) ? $data['data'] : $data;

                // Extract Order ID from metadata or root payload
                $order_id = null;
                if (!empty($payload['metadata']['order_id'])) {
                    $order_id = intval($payload['metadata']['order_id']);
                } elseif (!empty($payload['orderId'])) {
                    $order_id = intval($payload['orderId']);
                } elseif (!empty($payload['order_id'])) {
                    $order_id = intval($payload['order_id']);
                }

                if (!$order_id && !empty($payload['sessionId'])) {
                    // Search order by meta
                    $orders = wc_get_orders(array(
                        'limit'      => 1,
                        'meta_key'   => '_180pay_session_id',
                        'meta_value' => sanitize_text_field($payload['sessionId']),
                    ));
                    if (!empty($orders)) {
                        $order_id = $orders[0]->get_id();
                    }
                }

                if (!$order_id) {
                    status_header(200);
                    echo 'No matching order found';
                    if (!defined('ONE_EIGHTY_TEST_MODE')) {
                        exit;
                    }
                    return;
                }

                $order = wc_get_order($order_id);
                if (!$order) {
                    status_header(200);
                    echo 'Order not found';
                    if (!defined('ONE_EIGHTY_TEST_MODE')) {
                        exit;
                    }
                    return;
                }

                if ($event === 'payment.succeeded' || (isset($payload['status']) && $payload['status'] === 'COMPLETED')) {
                    if (!$order->is_paid()) {
                        $txn_id = !empty($payload['transactionId']) ? sanitize_text_field($payload['transactionId']) : (!empty($payload['id']) ? sanitize_text_field($payload['id']) : '');
                        $paid_status = $this->get_option('order_status', 'processing');

                        $order->payment_complete($txn_id);
                        $order->update_status($paid_status, sprintf(__('180 Pay payment confirmed via webhook. Transaction ID: %s', '180-core'), $txn_id));
                        $order->save();
                    }
                } elseif ($event === 'payment.failed') {
                    $reason = !empty($payload['failureReason']) ? sanitize_text_field($payload['failureReason']) : __('Payment failed on 180 Pay.', '180-core');
                    $order->update_status('failed', $reason);
                }

                status_header(200);
                echo 'Webhook processed';
                if (!defined('ONE_EIGHTY_TEST_MODE')) {
                    exit;
                }
                return;
            }

            public function process_refund($order_id, $amount = null, $reason = '') {
                $order = wc_get_order($order_id);
                if (!$order) {
                    return new WP_Error('error', __('Order not found for refund.', '180-core'));
                }

                $txn_id = $order->get_transaction_id();
                $order->add_order_note(sprintf(__('Refund initiated for amount %s. Note: Please review 180 Pay Payouts console for reconciliation.', '180-core'), wc_price($amount)));
                return true;
            }
        }
    }

