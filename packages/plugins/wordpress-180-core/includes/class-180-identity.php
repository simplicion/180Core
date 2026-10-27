<?php
/**
 * 180 Identity Module
 * Universal Authentication (WhatsApp 1-Tap OTP, Google SSO, Passkeys, Universal @usernames)
 */

if (!defined('ABSPATH')) {
    exit;
}

class OneEighty_Identity_Module {
    private static $instance = null;

    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        if (!get_option('180_identity_enabled', 1)) {
            return;
        }

        // Render buttons
        if (get_option('180_identity_show_on_wp_login', 1)) {
            add_action('login_form', array($this, 'render_login_button'));
        }
        if (get_option('180_identity_show_on_wc_login', 1)) {
            add_action('woocommerce_login_form', array($this, 'render_login_button'));
            add_action('woocommerce_before_checkout_form', array($this, 'render_checkout_login_notice'));
        }

        // Shortcode
        add_shortcode('180_login', array($this, 'shortcode_login_button'));

        // Handle OAuth Callback
        add_action('init', array($this, 'handle_auth_callback'));
    }

    public function render_login_button() {
        $client_id = get_option('180_core_client_id');
        if (empty($client_id)) {
            return;
        }

        $button_text = get_option('180_identity_button_text', 'Continue with 180 Core');
        $auth_url = $this->get_authorization_url();
        ?>
        <div class="one-eighty-login-container">
            <div class="one-eighty-divider">
                <span><?php _e('OR', '180-core'); ?></span>
            </div>
            <a href="<?php echo esc_url($auth_url); ?>" 
               class="one-eighty-sso-button" 
               id="one-eighty-sso-btn"
               data-180-auth-trigger="true"
               data-180-client-id="<?php echo esc_attr($client_id); ?>"
               data-180-redirect-uri="<?php echo esc_url(home_url('/?180core_auth=callback')); ?>">
                <span class="one-eighty-btn-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                </span>
                <span class="one-eighty-btn-text"><?php echo esc_html($button_text); ?></span>
                <span class="one-eighty-btn-badge"><?php _e('Universal SSO', '180-core'); ?></span>
            </a>
        </div>
        <?php
    }

    public function render_checkout_login_notice() {
        if (is_user_logged_in() || !get_option('180_core_client_id')) {
            return;
        }
        $client_id = get_option('180_core_client_id');
        $auth_url = $this->get_authorization_url(wc_get_checkout_url());
        ?>
        <div class="woocommerce-info one-eighty-checkout-login-banner">
            <span><?php _e('Have a 180 Core or 180 Wallet account?', '180-core'); ?></span>
            <a href="<?php echo esc_url($auth_url); ?>" 
               class="button one-eighty-btn-sm"
               data-180-auth-trigger="true"
               data-180-client-id="<?php echo esc_attr($client_id); ?>"
               data-180-redirect-uri="<?php echo esc_url(home_url('/?180core_auth=callback')); ?>">
                <?php _e('1-Click Sign In', '180-core'); ?>
            </a>
        </div>
        <?php
    }

    public function shortcode_login_button($atts) {
        if (is_user_logged_in()) {
            return '';
        }

        $atts = shortcode_atts(array(
            'text'     => get_option('180_identity_button_text', 'Continue with 180 Core'),
            'redirect' => '',
            'class'    => '',
        ), $atts, '180_login');

        $client_id = get_option('180_core_client_id');
        $auth_url = $this->get_authorization_url($atts['redirect']);
        
        ob_start();
        ?>
        <div class="one-eighty-shortcode-wrapper <?php echo esc_attr($atts['class']); ?>">
            <a href="<?php echo esc_url($auth_url); ?>" 
               class="one-eighty-sso-button"
               data-180-auth-trigger="true"
               data-180-client-id="<?php echo esc_attr($client_id); ?>"
               data-180-redirect-uri="<?php echo esc_url(home_url('/?180core_auth=callback')); ?>">
                <span class="one-eighty-btn-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                </span>
                <span class="one-eighty-btn-text"><?php echo esc_html($atts['text']); ?></span>
            </a>
        </div>
        <?php
        return ob_get_clean();
    }

    public function get_authorization_url($redirect_to = '') {
        $client_id = get_option('180_core_client_id');
        $profile_base = get_option('180_core_profile_base', 'https://profile.180core.cloud');
        $callback_url = home_url('/?180core_auth=callback');

        if (empty($redirect_to)) {
            $redirect_to = isset($_REQUEST['redirect_to']) ? esc_url_raw($_REQUEST['redirect_to']) : home_url();
        }

        $redirect_to = wp_validate_redirect($redirect_to, home_url());
        $nonce = wp_create_nonce('180_auth_nonce');
        $ts = time();
        $salt = function_exists('wp_salt') ? wp_salt('auth') : '180_core_salt_auth';
        $sig = hash_hmac('sha256', $ts . '.' . $nonce . '.' . $redirect_to, $salt);

        $state_data = array(
            'ts'          => $ts,
            'nonce'       => $nonce,
            'redirect_to' => $redirect_to,
            'sig'         => $sig,
        );
        $state = base64_encode(wp_json_encode($state_data));

        $query = http_build_query(array(
            'client_id'     => $client_id,
            'redirect_uri'  => $callback_url,
            'response_type' => 'code',
            'scope'         => 'openid profile email',
            'state'         => $state,
        ));

        return trailingslashit($profile_base) . 'auth/login?' . $query;
    }

    public function handle_auth_callback() {
        if (!isset($_GET['180core_auth']) || $_GET['180core_auth'] !== 'callback') {
            return;
        }

        if (isset($_GET['error'])) {
            $error_desc = isset($_GET['error_description']) ? sanitize_text_field($_GET['error_description']) : sanitize_text_field($_GET['error']);
            wp_die(__('180 Core Authentication Failed: ', '180-core') . esc_html($error_desc));
        }

        $code = isset($_GET['code']) ? sanitize_text_field($_GET['code']) : '';
        $raw_state = isset($_GET['state']) ? sanitize_text_field($_GET['state']) : '';

        if (empty($code)) {
            wp_die(__('Authorization code not provided.', '180-core'));
        }

        // Validate state cryptographically to prevent CSRF and parameter tampering
        $state = json_decode(base64_decode($raw_state), true);
        if (!$state || !is_array($state) || empty($state['sig']) || empty($state['ts']) || empty($state['nonce'])) {
            wp_die(__('Security Error: Invalid or tampered OAuth state parameter.', '180-core'));
        }

        // Check 15-minute replay window
        if (abs(time() - intval($state['ts'])) > 900) {
            wp_die(__('Authentication session expired. Please return and try logging in again.', '180-core'));
        }

        $salt = function_exists('wp_salt') ? wp_salt('auth') : '180_core_salt_auth';
        $expected_sig = hash_hmac('sha256', $state['ts'] . '.' . $state['nonce'] . '.' . (isset($state['redirect_to']) ? $state['redirect_to'] : ''), $salt);
        if (!hash_equals($expected_sig, $state['sig'])) {
            wp_die(__('Security Error: OAuth cryptographic signature mismatch.', '180-core'));
        }

        $redirect_to = !empty($state['redirect_to']) ? wp_validate_redirect($state['redirect_to'], home_url()) : home_url();

        // Exchange code for user details
        $user_info = $this->exchange_code_for_user($code);
        if (is_wp_error($user_info)) {
            wp_die($user_info->get_error_message());
        }

        // Login or register user
        $wp_user = $this->get_or_create_user($user_info);
        if (is_wp_error($wp_user)) {
            wp_die($wp_user->get_error_message());
        }

        // Set session
        wp_clear_auth_cookie();
        wp_set_current_user($wp_user->ID);
        wp_set_auth_cookie($wp_user->ID, true);

        // Redirect
        wp_safe_redirect($redirect_to);
        if (!defined('ONE_EIGHTY_TEST_MODE')) {
            exit;
        }
    }

    private function exchange_code_for_user($code) {
        $client_id = get_option('180_core_client_id');
        $client_secret = get_option('180_core_client_secret');
        $api_base = get_option('180_core_api_base', 'https://api.180core.cloud');
        $callback_url = home_url('/?180core_auth=callback');

        // Step 1: Exchange code for access token
        $token_response = wp_remote_post(trailingslashit($api_base) . 'api/oauth/token', array(
            'headers' => array(
                'Content-Type' => 'application/x-www-form-urlencoded',
            ),
            'body' => array(
                'grant_type'    => 'authorization_code',
                'code'          => $code,
                'redirect_uri'  => $callback_url,
                'client_id'     => $client_id,
                'client_secret' => $client_secret,
            ),
            'timeout' => 15,
        ));

        if (is_wp_error($token_response)) {
            return new WP_Error('token_error', __('Could not connect to 180 Core Auth server.', '180-core'));
        }

        $token_body = json_decode(wp_remote_retrieve_body($token_response), true);
        $access_token = isset($token_body['access_token']) ? $token_body['access_token'] : '';

        if (empty($access_token)) {
            $err_msg = isset($token_body['error']) ? $token_body['error'] : __('Failed to exchange token.', '180-core');
            return new WP_Error('token_error', $err_msg);
        }

        // Step 2: Fetch user profile
        $user_response = wp_remote_get(trailingslashit($api_base) . 'api/oauth/userinfo', array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $access_token,
            ),
            'timeout' => 15,
        ));

        if (is_wp_error($user_response)) {
            return new WP_Error('userinfo_error', __('Could not fetch user profile from 180 Core.', '180-core'));
        }

        $user_data = json_decode(wp_remote_retrieve_body($user_response), true);
        if (empty($user_data['email'])) {
            return new WP_Error('userinfo_error', __('No verified email returned by 180 Core.', '180-core'));
        }

        return $user_data;
    }

    private function get_or_create_user($user_data) {
        $email = sanitize_email($user_data['email']);
        $existing_user = get_user_by('email', $email);

        if ($existing_user) {
            // Update 180 Core user ID metadata
            if (!empty($user_data['sub'])) {
                update_user_meta($existing_user->ID, '180_core_user_id', sanitize_text_field($user_data['sub']));
            }
            return $existing_user;
        }

        // Check if registration allowed
        if (!get_option('180_identity_auto_register', 1)) {
            return new WP_Error('registration_disabled', __('Account does not exist and registration is disabled.', '180-core'));
        }

        // Generate username
        $username = !empty($user_data['username']) ? sanitize_user($user_data['username'], true) : '';
        if (empty($username)) {
            $parts = explode('@', $email);
            $username = sanitize_user($parts[0], true);
        }

        $base_username = $username;
        $suffix = 1;
        while (username_exists($username)) {
            $username = $base_username . $suffix;
            $suffix++;
        }

        $random_password = wp_generate_password(24, true);
        $role = get_option('180_identity_default_role', 'customer');
        $forbidden_roles = array('administrator', 'editor', 'author');
        if (in_array(strtolower($role), $forbidden_roles, true)) {
            $role = 'customer';
        }

        $user_id = wp_create_user($username, $random_password, $email);
        if (is_wp_error($user_id)) {
            return $user_id;
        }

        $wp_user = get_user_by('id', $user_id);
        $wp_user->set_role($role);

        // Update Name & Meta
        $name = !empty($user_data['name']) ? sanitize_text_field($user_data['name']) : '';
        if (!empty($name)) {
            $name_parts = explode(' ', $name, 2);
            wp_update_user(array(
                'ID'           => $user_id,
                'first_name'   => $name_parts[0],
                'last_name'    => isset($name_parts[1]) ? $name_parts[1] : '',
                'display_name' => $name,
            ));
        }

        if (!empty($user_data['sub'])) {
            update_user_meta($user_id, '180_core_user_id', sanitize_text_field($user_data['sub']));
        }

        return $wp_user;
    }
}
