<?php
/**
 * Plugin Name: 180 Core — Universal Identity & 180 Pay
 * Plugin URI:  https://180core.cloud
 * Description: The official unified 180 Core plugin for WordPress & WooCommerce. Provides 1-Click Universal Authentication (WhatsApp 1-Tap OTP, Google SSO, Passkeys) and Sovereign 180 Pay WooCommerce Gateway (UPI, QR, Cards, NetBanking, 180 Wallet).
 * Version:     1.0.0
 * Author:      180 Core Platform
 * Author URI:  https://180core.cloud
 * License:     GPL-2.0+
 * Text Domain: 180-core
 * Domain Path: /languages
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

define('ONE_EIGHTY_CORE_VERSION', '1.0.0');
define('ONE_EIGHTY_CORE_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('ONE_EIGHTY_CORE_PLUGIN_URL', plugin_dir_url(__FILE__));

class OneEighty_Core_Plugin {
    private static $instance = null;

    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->load_dependencies();
        $this->init_hooks();
    }

    private function load_dependencies() {
        require_once ONE_EIGHTY_CORE_PLUGIN_DIR . 'includes/class-180-identity.php';
        require_once ONE_EIGHTY_CORE_PLUGIN_DIR . 'includes/class-180-pay-gateway.php';
    }

    private function init_hooks() {
        // Enqueue styles
        add_action('wp_enqueue_scripts', array($this, 'enqueue_frontend_assets'));
        add_action('login_enqueue_scripts', array($this, 'enqueue_frontend_assets'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_assets'));

        // Admin menu
        add_action('admin_menu', array($this, 'register_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));

        // Plugin action links
        add_filter('plugin_action_links_' . plugin_basename(__FILE__), array($this, 'add_action_links'));

        // Initialize sub-modules
        OneEighty_Identity_Module::get_instance();
        OneEighty_Pay_Gateway_Module::get_instance();
    }

    public function enqueue_frontend_assets() {
        wp_enqueue_style(
            '180-core-style',
            ONE_EIGHTY_CORE_PLUGIN_URL . 'assets/180-core.css',
            array(),
            ONE_EIGHTY_CORE_VERSION
        );

        wp_enqueue_script(
            '180-core-sdk',
            ONE_EIGHTY_CORE_PLUGIN_URL . 'assets/js/180-core-sdk.js',
            array(),
            ONE_EIGHTY_CORE_VERSION,
            true
        );

        wp_enqueue_script(
            '180-core-wp-bridge',
            ONE_EIGHTY_CORE_PLUGIN_URL . 'assets/js/180-core-wordpress.js',
            array('180-core-sdk'),
            ONE_EIGHTY_CORE_VERSION,
            true
        );

        $client_id = get_option('180_core_client_id', '');
        $api_base = get_option('180_core_api_base', 'https://api.180core.cloud');
        $profile_base = get_option('180_core_profile_base', 'https://profile.180core.cloud');

        wp_localize_script('180-core-sdk', 'oneEightyCoreConfig', array(
            'clientId'      => $client_id,
            'apiServerUrl'  => $api_base,
            'authServerUrl' => $profile_base,
            'payServerUrl'  => $profile_base,
            'uxMode'        => 'bottom_sheet',
        ));
    }

    public function enqueue_admin_assets($hook) {
        if (strpos($hook, '180-core') !== false) {
            wp_enqueue_style(
                '180-core-admin-style',
                ONE_EIGHTY_CORE_PLUGIN_URL . 'assets/180-core-admin.css',
                array(),
                ONE_EIGHTY_CORE_VERSION
            );
        }
    }

    public function register_admin_menu() {
        add_menu_page(
            __('180 Core Settings', '180-core'),
            __('180 Core', '180-core'),
            'manage_options',
            '180-core',
            array($this, 'render_admin_page'),
            'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>'),
            56
        );
    }

    public function register_settings() {
        // General options with strict validation & sanitization
        register_setting('180_core_general_group', '180_core_client_id', array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
        ));
        register_setting('180_core_general_group', '180_core_client_secret', array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
        ));
        register_setting('180_core_general_group', '180_core_api_base', array(
            'type'              => 'string',
            'sanitize_callback' => 'esc_url_raw',
            'default'           => 'https://api.180core.cloud',
        ));
        register_setting('180_core_general_group', '180_core_profile_base', array(
            'type'              => 'string',
            'sanitize_callback' => 'esc_url_raw',
            'default'           => 'https://profile.180core.cloud',
        ));

        // Identity options with input sanitization
        register_setting('180_core_identity_group', '180_identity_enabled', array('type' => 'boolean', 'sanitize_callback' => 'rest_sanitize_boolean'));
        register_setting('180_core_identity_group', '180_identity_button_text', array('type' => 'string', 'sanitize_callback' => 'sanitize_text_field'));
        register_setting('180_core_identity_group', '180_identity_auto_register', array('type' => 'boolean', 'sanitize_callback' => 'rest_sanitize_boolean'));
        register_setting('180_core_identity_group', '180_identity_default_role', array('type' => 'string', 'sanitize_callback' => array($this, 'sanitize_role')));
        register_setting('180_core_identity_group', '180_identity_show_on_wp_login', array('type' => 'boolean', 'sanitize_callback' => 'rest_sanitize_boolean'));
        register_setting('180_core_identity_group', '180_identity_show_on_wc_login', array('type' => 'boolean', 'sanitize_callback' => 'rest_sanitize_boolean'));

        // Pay options with input sanitization
        register_setting('180_core_pay_group', '180_pay_enabled', array('type' => 'boolean', 'sanitize_callback' => 'rest_sanitize_boolean'));
        register_setting('180_core_pay_group', '180_pay_title', array('type' => 'string', 'sanitize_callback' => 'sanitize_text_field'));
        register_setting('180_core_pay_group', '180_pay_description', array('type' => 'string', 'sanitize_callback' => 'sanitize_textarea_field'));
    }

    public function sanitize_role($role) {
        $role = sanitize_text_field($role);
        $forbidden = array('administrator', 'editor', 'author');
        if (in_array(strtolower($role), $forbidden, true)) {
            return 'customer';
        }
        return $role;
    }

    public function add_action_links($links) {
        $settings_link = '<a href="' . admin_url('admin.php?page=180-core') . '">' . __('Settings', '180-core') . '</a>';
        $docs_link = '<a href="https://180core.cloud/docs/products/180-core" target="_blank">' . __('Documentation', '180-core') . '</a>';
        array_unshift($links, $settings_link, $docs_link);
        return $links;
    }

    public function render_admin_page() {
        $active_tab = isset($_GET['tab']) ? sanitize_text_field($_GET['tab']) : 'general';
        ?>
        <div class="wrap one-eighty-core-admin">
            <div class="one-eighty-header">
                <div class="one-eighty-logo-badge">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                    </svg>
                    <h1>180 Core Platform</h1>
                </div>
                <div class="one-eighty-header-meta">
                    <span class="badge">v<?php echo esc_html(ONE_EIGHTY_CORE_VERSION); ?></span>
                    <a href="https://developer.180core.cloud" target="_blank" class="button button-secondary">
                        <?php _e('Developer Console', '180-core'); ?> &rarr;
                    </a>
                </div>
            </div>

            <nav class="nav-tab-wrapper">
                <a href="?page=180-core&tab=general" class="nav-tab <?php echo $active_tab === 'general' ? 'nav-tab-active' : ''; ?>">
                    <?php _e('Credentials & API', '180-core'); ?>
                </a>
                <a href="?page=180-core&tab=identity" class="nav-tab <?php echo $active_tab === 'identity' ? 'nav-tab-active' : ''; ?>">
                    <?php _e('180 Identity (SSO Login)', '180-core'); ?>
                </a>
                <a href="?page=180-core&tab=pay" class="nav-tab <?php echo $active_tab === 'pay' ? 'nav-tab-active' : ''; ?>">
                    <?php _e('180 Pay (WooCommerce Gateway)', '180-core'); ?>
                </a>
                <a href="?page=180-core&tab=help" class="nav-tab <?php echo $active_tab === 'help' ? 'nav-tab-active' : ''; ?>">
                    <?php _e('Guide & Shortcodes', '180-core'); ?>
                </a>
            </nav>

            <div class="one-eighty-tab-content">
                <?php
                if ($active_tab === 'general') {
                    $this->render_general_tab();
                } elseif ($active_tab === 'identity') {
                    $this->render_identity_tab();
                } elseif ($active_tab === 'pay') {
                    $this->render_pay_tab();
                } else {
                    $this->render_help_tab();
                }
                ?>
            </div>
        </div>
        <?php
    }

    private function render_general_tab() {
        $callback_url = home_url('/?180core_auth=callback');
        $webhook_url = home_url('/?wc-api=wc_180pay_gateway');
        ?>
        <div class="one-eighty-card">
            <h2><?php _e('180 Core Application Credentials', '180-core'); ?></h2>
            <p class="description">
                <?php _e('Enter your project credentials from the 180 Developer Console. Both 180 Identity and 180 Pay share this single credential set.', '180-core'); ?>
            </p>

            <form method="post" action="options.php">
                <?php settings_fields('180_core_general_group'); ?>
                <table class="form-table">
                    <tr>
                        <th scope="row"><label for="180_core_client_id"><?php _e('Client ID', '180-core'); ?></label></th>
                        <td>
                            <input type="text" id="180_core_client_id" name="180_core_client_id" value="<?php echo esc_attr(get_option('180_core_client_id')); ?>" class="regular-text" placeholder="180_client_..." />
                            <p class="description"><?php _e('Found under Project Overview in your 180 Developer Console.', '180-core'); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="180_core_client_secret"><?php _e('Client Secret', '180-core'); ?></label></th>
                        <td>
                            <input type="password" id="180_core_client_secret" name="180_core_client_secret" value="<?php echo esc_attr(get_option('180_core_client_secret')); ?>" class="regular-text" placeholder="••••••••••••••••" />
                            <p class="description"><?php _e('Required for server-side token exchange and WooCommerce checkout session creation.', '180-core'); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="180_core_api_base"><?php _e('API Server Endpoint', '180-core'); ?></label></th>
                        <td>
                            <input type="text" id="180_core_api_base" name="180_core_api_base" value="<?php echo esc_attr(get_option('180_core_api_base', 'https://api.180core.cloud')); ?>" class="regular-text" />
                            <p class="description"><?php _e('Default: https://api.180core.cloud', '180-core'); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="180_core_profile_base"><?php _e('Auth / Checkout Host', '180-core'); ?></label></th>
                        <td>
                            <input type="text" id="180_core_profile_base" name="180_core_profile_base" value="<?php echo esc_attr(get_option('180_core_profile_base', 'https://profile.180core.cloud')); ?>" class="regular-text" />
                            <p class="description"><?php _e('Default: https://profile.180core.cloud', '180-core'); ?></p>
                        </td>
                    </tr>
                </table>

                <div class="one-eighty-notice-box">
                    <h3>✅ <?php _e('Universal Bottom-Sheet (Zero-Config)', '180-core'); ?></h3>
                    <p><?php _e('180 Identity and 180 Pay run in-context via the sovereign bottom-sheet and automatically authenticate your store without manual redirect URI configuration.', '180-core'); ?></p>
                    <details style="margin-top: 8px;">
                        <summary style="cursor: pointer; color: #6366f1; font-weight: 600; font-size: 12px;"><?php _e('View OAuth Callback URL (Optional / Legacy Full-Page Redirect)', '180-core'); ?></summary>
                        <div class="copy-field" style="margin-top: 6px;">
                            <code><?php echo esc_html($callback_url); ?></code>
                        </div>
                    </details>

                    <h3 style="margin-top: 16px;">🔔 <?php _e('Webhook Listener URL (WooCommerce 180 Pay)', '180-core'); ?></h3>
                    <p><?php _e('Copy this URL and add it to <strong>"Webhook URL"</strong> in your 180 Developer Console app settings:', '180-core'); ?></p>
                    <div class="copy-field">
                        <code><?php echo esc_html($webhook_url); ?></code>
                    </div>
                </div>

                <?php submit_button(__('Save Credentials', '180-core')); ?>
            </form>
        </div>
        <?php
    }

    private function render_identity_tab() {
        ?>
        <div class="one-eighty-card">
            <h2><?php _e('180 Identity — Universal Authentication & SSO', '180-core'); ?></h2>
            <p class="description">
                <?php _e('Allow users to sign up and log in using WhatsApp 1-Tap OTP, Google SSO, Passkeys, and universal @usernames.', '180-core'); ?>
            </p>

            <form method="post" action="options.php">
                <?php settings_fields('180_core_identity_group'); ?>
                <table class="form-table">
                    <tr>
                        <th scope="row"><?php _e('Enable 180 Identity', '180-core'); ?></th>
                        <td>
                            <label>
                                <input type="checkbox" name="180_identity_enabled" value="1" <?php checked(1, get_option('180_identity_enabled', 1)); ?> />
                                <?php _e('Enable 1-Click login with 180 Core', '180-core'); ?>
                            </label>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="180_identity_button_text"><?php _e('Button Label', '180-core'); ?></label></th>
                        <td>
                            <input type="text" id="180_identity_button_text" name="180_identity_button_text" value="<?php echo esc_attr(get_option('180_identity_button_text', 'Continue with 180 Core')); ?>" class="regular-text" />
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><?php _e('Display Locations', '180-core'); ?></th>
                        <td>
                            <label>
                                <input type="checkbox" name="180_identity_show_on_wp_login" value="1" <?php checked(1, get_option('180_identity_show_on_wp_login', 1)); ?> />
                                <?php _e('Show on standard WordPress login screen (wp-login.php)', '180-core'); ?>
                            </label><br />
                            <label>
                                <input type="checkbox" name="180_identity_show_on_wc_login" value="1" <?php checked(1, get_option('180_identity_show_on_wc_login', 1)); ?> />
                                <?php _e('Show on WooCommerce "My Account" and checkout login forms', '180-core'); ?>
                            </label>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><?php _e('Auto-Register New Users', '180-core'); ?></th>
                        <td>
                            <label>
                                <input type="checkbox" name="180_identity_auto_register" value="1" <?php checked(1, get_option('180_identity_auto_register', 1)); ?> />
                                <?php _e('Automatically create a new WordPress account if user email does not exist', '180-core'); ?>
                            </label>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="180_identity_default_role"><?php _e('Default User Role', '180-core'); ?></label></th>
                        <td>
                            <select id="180_identity_default_role" name="180_identity_default_role">
                                <?php wp_dropdown_roles(get_option('180_identity_default_role', 'customer')); ?>
                            </select>
                            <p class="description"><?php _e('Role assigned to newly created WordPress users.', '180-core'); ?></p>
                        </td>
                    </tr>
                </table>
                <?php submit_button(__('Save Identity Settings', '180-core')); ?>
            </form>
        </div>
        <?php
    }

    private function render_pay_tab() {
        $wc_active = in_array('woocommerce/woocommerce.php', apply_filters('active_plugins', get_option('active_plugins')));
        ?>
        <div class="one-eighty-card">
            <h2><?php _e('180 Pay — Sovereign WooCommerce Payment Gateway', '180-core'); ?></h2>
            <p class="description">
                <?php _e('Accept UPI, QR, Credit/Debit Cards, NetBanking, and Instant 180 Wallet with automatic order fulfillment.', '180-core'); ?>
            </p>

            <?php if (!$wc_active): ?>
                <div class="notice notice-info inline" style="border-left-color: #6366f1; padding: 12px 16px;">
                    <p style="margin: 0 0 6px 0;"><strong><?php _e('Standalone Payments Active (No WooCommerce Required):', '180-core'); ?></strong></p>
                    <p style="margin: 0; color: #4b5563; line-height: 1.5;">
                        <?php _e('You can accept payments for <strong>bookings, seat reservations, consulting fees, event tickets, or donations</strong> anywhere on your WordPress site using the universal <code>[180_pay]</code> shortcode!', '180-core'); ?><br />
                        <?php _e('Example:', '180-core'); ?> <code>[180_pay amount="499" currency="INR" title="Book Consultation" redirect="/booking-confirmed"]</code>
                    </p>
                </div>
            <?php else: ?>
                <div class="notice notice-success inline">
                    <p><strong><?php _e('WooCommerce Detected:', '180-core'); ?></strong> <?php _e('180 Pay is active as a WooCommerce checkout gateway and also available via standalone <code>[180_pay]</code> buttons for bookings and services.', '180-core'); ?></p>
                </div>
            <?php endif; ?>

            <form method="post" action="options.php">
                <?php settings_fields('180_core_pay_group'); ?>
                <table class="form-table">
                    <tr>
                        <th scope="row"><?php _e('Enable 180 Pay', '180-core'); ?></th>
                        <td>
                            <label>
                                <input type="checkbox" name="180_pay_enabled" value="1" <?php checked(1, get_option('180_pay_enabled', 1)); ?> />
                                <?php _e('Enable 180 Pay at WooCommerce checkout', '180-core'); ?>
                            </label>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="180_pay_title"><?php _e('Gateway Title', '180-core'); ?></label></th>
                        <td>
                            <input type="text" id="180_pay_title" name="180_pay_title" value="<?php echo esc_attr(get_option('180_pay_title', '180 Pay (UPI, Cards, NetBanking, 180 Wallet)')); ?>" class="regular-text" />
                            <p class="description"><?php _e('Displayed to customers during checkout.', '180-core'); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="180_pay_description"><?php _e('Description', '180-core'); ?></label></th>
                        <td>
                            <textarea id="180_pay_description" name="180_pay_description" class="large-text" rows="3"><?php echo esc_textarea(get_option('180_pay_description', 'Pay securely using Instant UPI, QR, Credit/Debit Cards, NetBanking, or your 180 Sovereign Wallet.')); ?></textarea>
                        </td>
                    </tr>
                </table>
                <?php submit_button(__('Save 180 Pay Settings', '180-core')); ?>
            </form>
        </div>
        <?php
    }

    private function render_help_tab() {
        ?>
        <div class="one-eighty-card">
            <h2><?php _e('Guide & Shortcodes', '180-core'); ?></h2>
            
            <h3>1. <?php _e('Login Shortcode', '180-core'); ?></h3>
            <p><?php _e('Place a "Log in with 180 Core" button anywhere on your site using this shortcode:', '180-core'); ?></p>
            <code>[180_login text="Log in with 180 Core" redirect="/dashboard"]</code>

            <h3 style="margin-top: 24px;">2. <?php _e('WooCommerce Integration', '180-core'); ?></h3>
            <p><?php _e('When 180 Pay is enabled, customers will see 180 Pay alongside other payment methods. When clicked, an encrypted session is created on 180 Core, and the customer completes the payment on the hosted checkout page. The order is automatically marked as "Processing" via instant webhook.', '180-core'); ?></p>

            <h3 style="margin-top: 24px;">3. <?php _e('Need Help?', '180-core'); ?></h3>
            <p><?php _e('Visit the official 180 Core Documentation portal:', '180-core'); ?> <a href="https://180core.cloud/docs" target="_blank">https://180core.cloud/docs</a></p>
        </div>
        <?php
    }
}

// Boot plugin
OneEighty_Core_Plugin::get_instance();
