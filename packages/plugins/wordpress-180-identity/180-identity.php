<?php
/**
 * Plugin Name: 180 Identity for WordPress (Universal SSO)
 * Plugin URI: https://180workspace.com
 * Description: Universal OAuth 2.0 / OIDC authentication for WordPress. Log in with WhatsApp 1-Tap OTP, Google One-Tap, and unified @username credentials. Eliminates password friction and auto-provisions WordPress users.
 * Version: 1.0.0
 * Author: 180 Workspace
 * Author URI: https://180workspace.com
 * Text Domain: 180-identity
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * License: GPL v2 or later
 */

if (!defined('ABSPATH')) {
    exit;
}

define('ONE_EIGHTY_IDENTITY_VERSION', '1.0.0');
define('ONE_EIGHTY_IDENTITY_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('ONE_EIGHTY_IDENTITY_PLUGIN_URL', plugin_dir_url(__FILE__));

class OneEighty_Identity_Standalone {
    private static $instance = null;

    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_filter('plugin_action_links_' . plugin_basename(__FILE__), array($this, 'add_action_links'));

        add_action('login_form', array($this, 'render_wp_login_button'));
        add_shortcode('180_login', array($this, 'shortcode_login_button'));
        add_action('init', array($this, 'handle_auth_callback'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_assets'));
        add_action('login_enqueue_scripts', array($this, 'enqueue_assets'));
    }

    public function enqueue_assets() {
        wp_enqueue_style(
            '180-identity-style',
            ONE_EIGHTY_IDENTITY_PLUGIN_URL . 'assets/180-identity.css',
            array(),
            ONE_EIGHTY_IDENTITY_VERSION
        );
    }

    public function add_admin_menu() {
        add_options_page(
            __('180 Identity SSO', '180-identity'),
            __('180 Identity', '180-identity'),
            'manage_options',
            '180-identity',
            array($this, 'render_admin_page')
        );
    }

    public function register_settings() {
        register_setting('180_identity_options', '180_identity_client_id');
        register_setting('180_identity_options', '180_identity_client_secret');
        register_setting('180_identity_options', '180_identity_button_text');
        register_setting('180_identity_options', '180_identity_auto_register');
        register_setting('180_identity_options', '180_identity_default_role');
    }

    public function add_action_links($links) {
        $settings_link = '<a href="' . admin_url('options-general.php?page=180-identity') . '">' . __('Settings', '180-identity') . '</a>';
        array_unshift($links, $settings_link);
        return $links;
    }

    public function render_admin_page() {
        $callback_url = home_url('/?180core_auth=callback');
        ?>
        <div class="wrap">
            <h1><?php _e('180 Identity Universal SSO Configuration', '180-identity'); ?></h1>
            <p><?php _e('Configure 1-tap WhatsApp OTP and Google authentication for your WordPress site users.', '180-identity'); ?></p>

            <form method="post" action="options.php">
                <?php settings_fields('180_identity_options'); ?>
                <table class="form-table">
                    <tr>
                        <th scope="row"><label for="180_identity_client_id"><?php _e('Client ID', '180-identity'); ?></label></th>
                        <td>
                            <input type="text" id="180_identity_client_id" name="180_identity_client_id" value="<?php echo esc_attr(get_option('180_identity_client_id')); ?>" class="regular-text" placeholder="180_client_..." />
                            <p class="description"><?php _e('From your 180 Developer Console project overview.', '180-identity'); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="180_identity_client_secret"><?php _e('Client Secret', '180-identity'); ?></label></th>
                        <td>
                            <input type="password" id="180_identity_client_secret" name="180_identity_client_secret" value="<?php echo esc_attr(get_option('180_identity_client_secret')); ?>" class="regular-text" placeholder="••••••••••••••••" />
                            <p class="description"><?php _e('Required to securely exchange authentication authorization codes.', '180-identity'); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="180_identity_button_text"><?php _e('Button Label', '180-identity'); ?></label></th>
                        <td>
                            <input type="text" id="180_identity_button_text" name="180_identity_button_text" value="<?php echo esc_attr(get_option('180_identity_button_text', 'Continue with 180 Identity')); ?>" class="regular-text" />
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><?php _e('Auto-Register New Users', '180-identity'); ?></th>
                        <td>
                            <label>
                                <input type="checkbox" name="180_identity_auto_register" value="1" <?php checked(get_option('180_identity_auto_register', 1), 1); ?> />
                                <?php _e('Automatically create WordPress user account on first login', '180-identity'); ?>
                            </label>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="180_identity_default_role"><?php _e('New User Role', '180-identity'); ?></label></th>
                        <td>
                            <select id="180_identity_default_role" name="180_identity_default_role">
                                <option value="subscriber" <?php selected(get_option('180_identity_default_role', 'subscriber'), 'subscriber'); ?>><?php _e('Subscriber', '180-identity'); ?></option>
                                <option value="customer" <?php selected(get_option('180_identity_default_role'), 'customer'); ?>><?php _e('Customer', '180-identity'); ?></option>
                                <option value="contributor" <?php selected(get_option('180_identity_default_role'), 'contributor'); ?>><?php _e('Contributor', '180-identity'); ?></option>
                            </select>
                        </td>
                    </tr>
                </table>

                <div style="background:#f8fafc;border-left:4px solid #6366f1;padding:14px 18px;margin:20px 0;border-radius:4px;">
                    <h3 style="margin:0 0 6px 0;"><?php _e('Required: Allowed Redirect URI', '180-identity'); ?></h3>
                    <p style="margin:0 0 8px 0;"><?php _e('Add this exact URL to your 180 Developer Console project under <strong>Project Settings &rarr; Allowed Redirect URIs</strong>:', '180-identity'); ?></p>
                    <code style="background:#fff;padding:6px 12px;border:1px solid #e2e8f0;border-radius:4px;display:inline-block;font-size:13px;"><?php echo esc_html($callback_url); ?></code>
                </div>

                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }

    public function render_wp_login_button() {
        $client_id = get_option('180_identity_client_id');
        if (empty($client_id)) {
            return;
        }

        $auth_url = $this->get_authorization_url();
        $button_text = get_option('180_identity_button_text', 'Continue with 180 Identity');
        ?>
        <div style="margin:16px 0 10px 0;text-align:center;">
            <div style="display:flex;align-items:center;margin-bottom:12px;">
                <hr style="flex:1;border:0;border-top:1px solid #cbd5e1;" />
                <span style="padding:0 8px;color:#64748b;font-size:12px;text-transform:uppercase;"><?php _e('OR', '180-identity'); ?></span>
                <hr style="flex:1;border:0;border-top:1px solid #cbd5e1;" />
            </div>
            <a href="<?php echo esc_url($auth_url); ?>" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;box-sizing:border-box;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600;font-size:14px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span><?php echo esc_html($button_text); ?></span>
            </a>
        </div>
        <?php
    }

    public function shortcode_login_button($atts) {
        if (is_user_logged_in()) {
            return '';
        }

        $atts = shortcode_atts(array(
            'text'     => get_option('180_identity_button_text', 'Continue with 180 Identity'),
            'redirect' => '',
            'class'    => '',
        ), $atts, '180_login');

        $auth_url = $this->get_authorization_url($atts['redirect']);
        
        ob_start();
        ?>
        <div class="one-eighty-shortcode-wrapper <?php echo esc_attr($atts['class']); ?>">
            <a href="<?php echo esc_url($auth_url); ?>" class="one-eighty-sso-button" style="display:inline-flex;align-items:center;gap:8px;background:#0f172a;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:600;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span><?php echo esc_html($atts['text']); ?></span>
            </a>
        </div>
        <?php
        return ob_get_clean();
    }

    public function get_authorization_url($redirect_to = '') {
        $client_id = get_option('180_identity_client_id');
        $callback_url = home_url('/?180core_auth=callback');

        if (empty($redirect_to)) {
            $redirect_to = isset($_REQUEST['redirect_to']) ? esc_url_raw($_REQUEST['redirect_to']) : home_url();
        }

        $state_data = array(
            'nonce'       => wp_create_nonce('180_auth_nonce'),
            'redirect_to' => $redirect_to,
        );
        $state = base64_encode(wp_json_encode($state_data));

        $query = http_build_query(array(
            'client_id'     => $client_id,
            'redirect_uri'  => $callback_url,
            'response_type' => 'code',
            'scope'         => 'openid profile email',
            'state'         => $state,
        ));

        return 'https://profile.180core.cloud/auth/login?' . $query;
    }

    public function handle_auth_callback() {
        if (!isset($_GET['180core_auth']) || $_GET['180core_auth'] !== 'callback') {
            return;
        }

        if (isset($_GET['error'])) {
            wp_die(__('180 Identity Authentication Error: ', '180-identity') . esc_html($_GET['error']));
        }

        $code = isset($_GET['code']) ? sanitize_text_field($_GET['code']) : '';
        $raw_state = isset($_GET['state']) ? sanitize_text_field($_GET['state']) : '';

        if (empty($code)) {
            wp_die(__('Authorization code not provided.', '180-identity'));
        }

        $state = json_decode(base64_decode($raw_state), true);
        $redirect_to = !empty($state['redirect_to']) ? esc_url_raw($state['redirect_to']) : home_url();

        $client_id = get_option('180_identity_client_id');
        $client_secret = get_option('180_identity_client_secret');
        $callback_url = home_url('/?180core_auth=callback');

        // Exchange code for token
        $token_response = wp_remote_post('https://api.180core.cloud/api/oauth/token', array(
            'headers' => array('Content-Type' => 'application/x-www-form-urlencoded'),
            'body'    => array(
                'grant_type'    => 'authorization_code',
                'code'          => $code,
                'redirect_uri'  => $callback_url,
                'client_id'     => $client_id,
                'client_secret' => $client_secret,
            ),
            'timeout' => 15,
        ));

        if (is_wp_error($token_response)) {
            wp_die(__('Failed connecting to 180 Identity server.', '180-identity'));
        }

        $token_body = json_decode(wp_remote_retrieve_body($token_response), true);
        $access_token = isset($token_body['access_token']) ? $token_body['access_token'] : '';

        if (empty($access_token)) {
            wp_die(__('Token exchange failed.', '180-identity'));
        }

        // Fetch user info
        $user_response = wp_remote_get('https://api.180core.cloud/api/oauth/userinfo', array(
            'headers' => array('Authorization' => 'Bearer ' . $access_token),
            'timeout' => 15,
        ));

        if (is_wp_error($user_response)) {
            wp_die(__('Could not fetch user profile.', '180-identity'));
        }

        $user_data = json_decode(wp_remote_retrieve_body($user_response), true);
        if (empty($user_data['email'])) {
            wp_die(__('No verified email returned from 180 Identity.', '180-identity'));
        }

        $email = sanitize_email($user_data['email']);
        $existing_user = get_user_by('email', $email);

        if ($existing_user) {
            $wp_user = $existing_user;
        } else {
            if (!get_option('180_identity_auto_register', 1)) {
                wp_die(__('User account not found and auto-registration is disabled.', '180-identity'));
            }

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
            $role = get_option('180_identity_default_role', 'subscriber');
            $user_id = wp_create_user($username, $random_password, $email);

            if (is_wp_error($user_id)) {
                wp_die($user_id->get_error_message());
            }

            $wp_user = get_user_by('id', $user_id);
            $wp_user->set_role($role);

            if (!empty($user_data['name'])) {
                $name_parts = explode(' ', sanitize_text_field($user_data['name']), 2);
                wp_update_user(array(
                    'ID'           => $user_id,
                    'first_name'   => $name_parts[0],
                    'last_name'    => isset($name_parts[1]) ? $name_parts[1] : '',
                    'display_name' => sanitize_text_field($user_data['name']),
                ));
            }
        }

        wp_clear_auth_cookie();
        wp_set_current_user($wp_user->ID);
        wp_set_auth_cookie($wp_user->ID, true);

        wp_safe_redirect($redirect_to);
        if (!defined('ONE_EIGHTY_TEST_MODE')) {
            exit;
        }
    }
}

OneEighty_Identity_Standalone::get_instance();
