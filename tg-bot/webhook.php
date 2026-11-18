<?php
declare(strict_types=1);
require __DIR__ . '/common.php';

function reply(int $status, string $body): never {
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    echo $body;
    exit;
}

try {
    $token = botToken();
    $secret = webhookSecret();
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if ($method === 'GET' && $path === '/health') reply(200, 'ok');
    if ($method !== 'POST' || $path !== '/webhook') reply(404, 'not found');
    if (!hash_equals($secret, $_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '')) reply(403, 'forbidden');
    $body = file_get_contents('php://input', false, null, 0, 65537);
    if ($body === false) throw new RuntimeException('Cannot read request');
    if (strlen($body) > 65536) reply(413, 'too large');
    try {
        $update = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        reply(400, 'invalid JSON');
    }
    if (!is_array($update) || !is_int($update['update_id'] ?? null)) reply(400, 'invalid update');
    handleUpdate($update, $token);
    reply(200, 'ok');
} catch (Throwable) {
    error_log('Webhook processing failed; Telegram may retry');
    reply(500, 'processing failed');
}
