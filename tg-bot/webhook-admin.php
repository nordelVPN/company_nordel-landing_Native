<?php
declare(strict_types=1);
require __DIR__ . '/common.php';

try {
    $action = $argv[1] ?? '';
    $methods = ['set' => 'setWebhook', 'info' => 'getWebhookInfo', 'delete' => 'deleteWebhook'];
    if (!isset($methods[$action])) throw new InvalidArgumentException('Usage: php webhook-admin.php set <https-url> | info | delete');
    $body = [];
    if ($action === 'set') {
        $url = parse_url($argv[2] ?? '');
        if ($url === false || ($url['scheme'] ?? '') !== 'https' || empty($url['host'])
            || isset($url['user']) || isset($url['pass']) || isset($url['query']) || isset($url['fragment'])
            || !filter_var($argv[2] ?? '', FILTER_VALIDATE_URL)) {
            throw new InvalidArgumentException('Use a plain HTTPS ngrok URL');
        }
        $body = [
            'url' => 'https://' . $url['host'] . (isset($url['port']) ? ':' . $url['port'] : '') . '/webhook',
            'secret_token' => webhookSecret(),
            'allowed_updates' => ['message'],
            'max_connections' => 1,
        ];
    }
    $result = telegram(botToken(), $methods[$action], $body);
    if ($action === 'info') {
        echo json_encode(array_intersect_key($result, array_flip([
            'url', 'pending_update_count', 'last_error_date', 'last_error_message',
        ])), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
    } else {
        echo $methods[$action] . ': ok' . PHP_EOL;
    }
} catch (InvalidArgumentException $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
} catch (Throwable) {
    fwrite(STDERR, "Telegram request failed; check token, connectivity, URL and secret\n");
    exit(1);
}
