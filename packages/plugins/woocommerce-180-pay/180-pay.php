<?php
/**
 * Plugin Name: 180 Pay for WooCommerce
 * Plugin URI: https://180workspace.com/180-pay
 * Description: Accept 1-Click UPI QR, Credit/Debit Cards, NetBanking, and Sovereign 180 Wallet payments on your WooCommerce store. Zero setup fees, 0.8% flat sovereign rate.
 * Version: 1.0.0
 * Author: 180 Workspace
 * Author URI: https://180workspace.com
 * Text Domain: 180-pay
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 6.0
 * WC tested up to: 9.3
 * License: GPL v2 or later
 */

if (!defined('ABSPATH')) {
    exit;
}

define('ONE_EIGHTY_PAY_VERSION', '1.0.0');
define('ONE_EIGHTY_PAY_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('ONE_EIGHTY_PAY_PLUGIN_URL', plugin_dir_url(__FILE__));

// Declare High-Performance Order Storage (HPOS) compatibility
add_action('before_woocommerce_init', function() {
    if (class_exists(\Automattic\WooCommerce\Utilities\FeaturesUtil::class)) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
    }
});

// Register gateway
add_filter('woocommerce_payment_gateways', 'add_180_pay_standalone_gateway');
function add_180_pay_standalone_gateway($gateways) {
    $gateways[] = 'WC_Gateway_180_Pay_Standalone';
    return $gateways;
}

// Add settings link to plugins page
add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'one_eighty_pay_action_links');
function one_eighty_pay_action_links($links) {
    $settings_link = '<a href="' . admin_url('admin.php?page=wc-settings&tab=checkout&section=180pay') . '">' . __('Settings', '180-pay') . '</a>';
    $docs_link = '<a href="https://180core.cloud/docs/products/180-core" target="_blank">' . __('Documentation', '180-pay') . '</a>';
    array_unshift($links, $settings_link, $docs_link);
    return $links;
}

// Initialize gateway class when plugins loaded
add_action('plugins_loaded', 'one_eighty_pay_init_gateway_class', 11);
function one_eighty_pay_init_gateway_class() {
    if (!class_exists('WC_Payment_Gateway')) {
        return;
    }

    if (class_exists('WC_Gateway_180_Pay_Standalone')) {
        return;
    }

    class WC_Gateway_180_Pay_Standalone extends WC_Payment_Gateway {
        public function __construct() {
            $this->id                 = '180pay';
            $this->icon               = ONE_EIGHTY_PAY_PLUGIN_URL . 'assets/180-pay-badge.svg';
            $this->has_fields         = false;
            $this->method_title       = __('180 Pay', '180-pay');
            $this->method_description = __('1-Click Sovereign UPI, QR, Credit/Debit Cards, NetBanking, and 180 Wallet payments.', '180-pay');

            $this->supports = array(
                'products',
                'refunds',
            );

            $this->init_form_fields();
            $this->init_settings();

            $this->enabled     = $this->get_option('enabled', 'yes');
            $this->title       = $this->get_option('title', '180 Pay (Instant UPI & 1-Click Wallet)');
            $this->description = $this->get_option('description', 'Pay securely using Instant UPI QR, Credit/Debit Cards, NetBanking, or 180 Sovereign Wallet. 0% convenience fees.');

            // Save settings hook
            add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));

            // Webhook listener at: /?wc-api=wc_180pay_gateway
            add_action('woocommerce_api_wc_180pay_gateway', array($this, 'handle_webhook'));
        }

        public function init_form_fields() {
            $webhook_url = home_url('/?wc-api=wc_180pay_gateway');

            $this->form_fields = array(
                'enabled' => array(
                    'title'   => __('Enable/Disable', '180-pay'),
                    'type'    => 'checkbox',
                    'label'   => __('Enable 180 Pay on WooCommerce checkout', '180-pay'),
                    'default' => 'yes',
                ),
                'title' => array(
                    'title'       => __('Title', '180-pay'),
                    'type'        => 'text',
                    'description' => __('Payment method title displayed to customer at checkout.', '180-pay'),
                    'default'     => '180 Pay (Instant UPI & 1-Click Wallet)',
                    'desc_tip'    => true,
                ),
                'description' => array(
                    'title'       => __('Description', '180-pay'),
                    'type'        => 'textarea',
                    'description' => __('Payment method description displayed to customer at checkout.', '180-pay'),
                    'default'     => 'Pay securely using Instant UPI QR, Credit/Debit Cards, NetBanking, or 180 Sovereign Wallet. 0% convenience fees.',
                ),
                'mode' => array(
                    'title'       => __('Environment Mode', '180-pay'),
                    'type'        => 'select',
                    'description' => __('Select Live for production payments or Sandbox for testing.', '180-pay'),
                    'default'     => 'sandbox',
                    'options'     => array(
                        'sandbox' => __('Sandbox / Test Mode', '180-pay'),
                        'live'    => __('Live Production', '180-pay'),
                    ),
                ),
                'client_id' => array(
                    'title'       => __('Client ID', '180-pay'),
                    'type'        => 'text',
                    'description' => __('Found under Project Overview in your 180 Developer Console.', '180-pay'),
                    'placeholder' => '180_client_...',
                    'desc_tip'    => true,
                ),
                'client_secret' => array(
                    'title'       => __('Client Secret', '180-pay'),
                    'type'        => 'password',
                    'description' => __('Found under Project Overview in your 180 Developer Console.', '180-pay'),
                    'placeholder' => '••••••••••••••••',
                    'desc_tip'    => true,
                ),
                'webhook_info' => array(
                    'title'       => __('Webhook URL', '180-pay'),
                    'type'        => 'title',
                    'description' => sprintf(
                        __('Add this Webhook URL in your <strong>180 Developer Console &rarr; 180 Pay &rarr; Webhooks</strong>:<br><code style="background:#f1f5f9;padding:6px 10px;display:inline-block;border-radius:4px;margin-top:6px;font-size:13px;">%s</code>', '180-pay'),
                        esc_html($webhook_url)
                    ),
                ),
            );
        }

        public function process_payment($order_id) {
            $order = wc_get_order($order_id);
            if (!$order) {
                return array('result' => 'fail');
            }

            $client_id = $this->get_option('client_id');
            $client_secret = $this->get_option('client_secret');
            $mode = $this->get_option('mode', 'sandbox');

            $api_base = ($mode === 'live') ? 'https://api.180core.cloud' : 'https://api.180core.cloud';
            $profile_base = ($mode === 'live') ? 'https://profile.180core.cloud' : 'https://profile.180core.cloud';

            if (empty($client_id) || empty($client_secret)) {
                wc_add_notice(__('180 Pay is not properly configured. Please enter your Client ID and Client Secret in WooCommerce settings.', '180-pay'), 'error');
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
                'title'        => sprintf(__('Order #%s', '180-pay'), $order->get_order_number()),
                'description'  => sprintf(__('Payment for Order #%s at %s', '180-pay'), $order->get_order_number(), get_bloginfo('name')),
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
                    'Content-Type'  => 'application/json',
                    'Authorization' => 'Bearer ' . $client_secret,
                    'X-Client-Id'   => $client_id,
                ),
                'body'    => wp_json_encode($payload),
                'timeout' => 20,
            ));

            if (is_wp_error($response)) {
                wc_add_notice(__('Could not connect to 180 Pay server. Please try again or choose another payment method.', '180-pay'), 'error');
                return array('result' => 'fail');
            }

            $status_code = wp_remote_retrieve_response_code($response);
            $body = json_decode(wp_remote_retrieve_body($response), true);

            if ($status_code !== 200 && $status_code !== 201) {
                $error_msg = !empty($body['error']) ? $body['error'] : __('Failed to create 180 Pay checkout session.', '180-pay');
                wc_add_notice($error_msg, 'error');
                return array('result' => 'fail');
            }

            $session = !empty($body['data']) ? $body['data'] : $body;
            $session_id = !empty($session['id']) ? $session['id'] : '';
            $session_url = !empty($session['sessionUrl']) ? $session['sessionUrl'] : (!empty($session['checkoutUrl']) ? $session['checkoutUrl'] : (trailingslashit($profile_base) . 'checkout/' . $session_id));

            if (empty($session_url)) {
                wc_add_notice(__('Invalid checkout URL received from 180 Pay.', '180-pay'), 'error');
                return array('result' => 'fail');
            }

            $order->update_meta_data('_180pay_session_id', $session_id);
            $order->add_order_note(sprintf(__('180 Pay checkout session initiated. Session ID: %s', '180-pay'), $session_id));
            $order->save();

            if (function_exists('WC') && WC()->cart) {
                WC()->cart->empty_cart();
            }

            return array(
                'result'   => 'success',
                'redirect' => $session_url,
            );
        }

        public function handle_webhook() {
            $raw_body = file_get_contents('php://input');
            if (empty($raw_body)) {
                status_header(400);
                echo 'Missing body';
                if (!defined('ONE_EIGHTY_TEST_MODE')) { exit; }
                return;
            }

            $data = json_decode($raw_body, true);
            if (!$data) {
                status_header(400);
                echo 'Invalid JSON';
                if (!defined('ONE_EIGHTY_TEST_MODE')) { exit; }
                return;
            }

            $event = isset($data['event']) ? $data['event'] : '';
            $payload = isset($data['data']) ? $data['data'] : $data;

            $order_id = null;
            if (!empty($payload['metadata']['order_id'])) {
                $order_id = intval($payload['metadata']['order_id']);
            } elseif (!empty($payload['orderId'])) {
                $order_id = intval($payload['orderId']);
            } elseif (!empty($payload['order_id'])) {
                $order_id = intval($payload['order_id']);
            }

            if (!$order_id) {
                status_header(200);
                echo 'No matching order found';
                if (!defined('ONE_EIGHTY_TEST_MODE')) { exit; }
                return;
            }

            $order = wc_get_order($order_id);
            if (!$order) {
                status_header(200);
                echo 'Order not found';
                if (!defined('ONE_EIGHTY_TEST_MODE')) { exit; }
                return;
            }

            if ($event === 'payment.succeeded' || (isset($payload['status']) && $payload['status'] === 'COMPLETED')) {
                if (!$order->is_paid()) {
                    $txn_id = !empty($payload['transactionId']) ? sanitize_text_field($payload['transactionId']) : (!empty($payload['id']) ? sanitize_text_field($payload['id']) : '');
                    $order->payment_complete($txn_id);
                    $order->update_status('processing', sprintf(__('180 Pay payment confirmed via webhook. Transaction ID: %s', '180-pay'), $txn_id));
                    $order->save();
                }
            } elseif ($event === 'payment.failed') {
                $reason = !empty($payload['failureReason']) ? sanitize_text_field($payload['failureReason']) : __('Payment failed on 180 Pay.', '180-pay');
                $order->update_status('failed', $reason);
            }

            status_header(200);
            echo 'Webhook processed';
            if (!defined('ONE_EIGHTY_TEST_MODE')) { exit; }
            return;
        }

        public function process_refund($order_id, $amount = null, $reason = '') {
            $order = wc_get_order($order_id);
            if (!$order) {
                return new WP_Error('error', __('Order not found.', '180-pay'));
            }

            $order->add_order_note(sprintf(__('Refund recorded for %s. Reconciled via 180 Pay dashboard.', '180-pay'), wc_price($amount)));
            return true;
        }
    }
}
