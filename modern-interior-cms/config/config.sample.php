<?php
/**
 * Modern Interior CMS - Configuration
 * -----------------------------------
 * Copy this file to `config.php` and fill in your Hostinger MySQL details.
 * (The installer at /install.php can create config.php for you automatically.)
 */

return [
    // ---- Database (get these from Hostinger > Databases > MySQL Databases) ----
    'db_host' => 'localhost',
    'db_name' => 'CHANGE_ME_DB_NAME',
    'db_user' => 'CHANGE_ME_DB_USER',
    'db_pass' => 'CHANGE_ME_DB_PASSWORD',
    'db_charset' => 'utf8mb4',

    // ---- Application ----
    'app_name'  => 'Modern Interior CMS',
    // Base URL path where the app lives, e.g. "" if at domain root, or "/cms" if in a subfolder.
    'base_path' => '',
    // Absolute URL of the app (used for image links in exports). No trailing slash.
    'app_url'   => 'https://your-domain.com',

    // ---- Security ----
    // Change this to a long random string. Used for hashing / CSRF salt.
    'app_key'   => 'CHANGE_ME_TO_A_LONG_RANDOM_STRING',

    // ---- Uploads ----
    'upload_dir'        => __DIR__ . '/../uploads',
    'max_upload_mb'     => 15,
    'allowed_image_ext' => ['jpg', 'jpeg', 'png', 'webp', 'avif'],

    // ---- Defaults ----
    'default_product_status' => 'draft',
    'default_product_type'   => 'simple',
    'products_per_page'      => 50,
];
