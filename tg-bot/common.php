<?php
declare(strict_types=1);

function botToken(): string {
    $token = getenv('TELEGRAM_BOT_TOKEN');
    if (!$token) throw new RuntimeException('TELEGRAM_BOT_TOKEN is required');
    return $token;
}

function webhookSecret(): string {
    $secret = getenv('TELEGRAM_WEBHOOK_SECRET') ?: '';
    if (!preg_match('/^[A-Za-z0-9_-]{1,256}$/D', $secret)) {
        throw new RuntimeException('Invalid TELEGRAM_WEBHOOK_SECRET');
    }
    return $secret;
}

function telegram(string $token, string $method, array $body): mixed {
    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\n",
        'content' => json_encode((object) $body, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
        'timeout' => 15,
        'ignore_errors' => true,
    ]]);
    $response = @file_get_contents("https://api.telegram.org/bot{$token}/{$method}", false, $context);
    if ($response === false) throw new RuntimeException("Telegram request failed: {$method}");
    $result = json_decode($response, true, 512, JSON_THROW_ON_ERROR);
    if (!($result['ok'] ?? false)) throw new RuntimeException("Telegram rejected {$method}");
    return $result['result'] ?? null;
}

function saveUser(string $file, array $user): void {
    $directory = dirname($file);
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new RuntimeException('Cannot create data directory');
    }
    $lock = fopen($file . '.lock', 'c');
    if ($lock === false) throw new RuntimeException('Cannot open wishlist lock');
    $tmp = null;
    try {
        if (!flock($lock, LOCK_EX)) throw new RuntimeException('Cannot lock wishlist');
        $users = [];
        if (is_file($file)) {
            $raw = file_get_contents($file);
            if ($raw === false) throw new RuntimeException('Cannot read wishlist');
            $decoded = json_decode($raw, false, 512, JSON_THROW_ON_ERROR);
            if (!is_array($decoded)) throw new RuntimeException('Invalid wishlist');
            $users = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
            foreach ($users as $item) {
                if (!is_array($item) || !isset($item['telegramId'])) throw new RuntimeException('Invalid wishlist user');
            }
        }
        $now = gmdate('c');
        $fields = [
            'telegramId' => (int) $user['id'],
            'username' => $user['username'] ?? null,
            'firstName' => $user['first_name'] ?? null,
            'lastName' => $user['last_name'] ?? null,
            'lastStartAt' => $now,
        ];
        $found = false;
        foreach ($users as &$item) {
            if ((int) $item['telegramId'] === (int) $user['id']) {
                $item = array_replace($item, $fields);
                $found = true;
                break;
            }
        }
        unset($item);
        if (!$found) $users[] = $fields + ['createdAt' => $now];
        $json = json_encode($users, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL;
        $tmp = tempnam($directory, '.wishlist-');
        if ($tmp === false || file_put_contents($tmp, $json) !== strlen($json) || !rename($tmp, $file)) {
            throw new RuntimeException('Cannot save wishlist');
        }
        $tmp = null;
    } finally {
        if ($tmp !== null && is_file($tmp)) unlink($tmp);
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function handleUpdate(array $update, string $token): void {
    $message = $update['message'] ?? null;
    if (!is_array($message) || !is_array($message['from'] ?? null)
        || !is_string($message['text'] ?? null)
        || !preg_match('~^/start(?:@[A-Za-z0-9_]+)?(?:\\s|$)~', $message['text'])) return;
    if (!is_int($message['from']['id'] ?? null) || !isset($message['chat']['id'])) {
        throw new RuntimeException('Invalid message');
    }
    saveUser(getenv('WISHLIST_FILE') ?: __DIR__ . '/data/wishlist.json', $message['from']);
    telegram($token, 'sendMessage', [
        'chat_id' => $message['chat']['id'],
        'text' => 'Здравствуйте, мы ещё не запустили наше приложение, но Вы добавлены в wishlist! Мы будем держать Вас в курсе!',
    ]);
}
