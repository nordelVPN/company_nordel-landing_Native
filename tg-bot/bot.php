<?php
declare(strict_types=1);

$token = getenv('TELEGRAM_BOT_TOKEN');
$dataFile = getenv('WISHLIST_FILE') ?: __DIR__ . '/data/wishlist.json';
$welcomeMessage = 'Здравствуйте, мы ещё не запустили наше приложение, но Вы добавлены в wishlist! Мы будем держать Вас в курсе!';

if (!$token) throw new RuntimeException('TELEGRAM_BOT_TOKEN is required');

function telegram(string $token, string $method, array $body): array {
    $url = "https://api.telegram.org/bot{$token}/{$method}";
    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\n",
        'content' => json_encode($body, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
        'timeout' => 40,
    ]]);
    $response = file_get_contents($url, false, $context);
    if ($response === false) throw new RuntimeException("Telegram API request failed: {$method}");
    $result = json_decode($response, true, 512, JSON_THROW_ON_ERROR);
    if (!($result['ok'] ?? false)) throw new RuntimeException('Telegram API error: ' . ($result['description'] ?? 'unknown error'));
    return $result['result'] ?? [];
}

function loadUsers(string $file): array {
    if (!is_file($file)) return [];
    return json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
}

function saveUser(string $file, array $user): void {
    $users = loadUsers($file);
    $now = gmdate('c');
    $found = false;
    foreach ($users as &$item) {
        if ((int) $item['telegramId'] === (int) $user['id']) {
            $item['username'] = $user['username'] ?? null;
            $item['firstName'] = $user['first_name'] ?? null;
            $item['lastName'] = $user['last_name'] ?? null;
            $item['lastStartAt'] = $now;
            $found = true;
            break;
        }
    }
    unset($item);
    if (!$found) $users[] = [
        'telegramId' => (int) $user['id'],
        'username' => $user['username'] ?? null,
        'firstName' => $user['first_name'] ?? null,
        'lastName' => $user['last_name'] ?? null,
        'createdAt' => $now,
        'lastStartAt' => $now,
    ];
    $directory = dirname($file);
    if (!is_dir($directory)) mkdir($directory, 0775, true);
    file_put_contents($file, json_encode($users, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL, LOCK_EX);
}

$offset = 0;
fwrite(STDOUT, "Telegram wishlist bot started\n");
while (true) {
    $updates = telegram($token, 'getUpdates', ['offset' => $offset, 'timeout' => 30]);
    foreach ($updates as $update) {
        $offset = ((int) $update['update_id']) + 1;
        $message = $update['message'] ?? null;
        $text = $message['text'] ?? '';
        if (!$message || !isset($message['from']) || !str_starts_with($text, '/start')) continue;
        saveUser($dataFile, $message['from']);
        telegram($token, 'sendMessage', ['chat_id' => $message['chat']['id'], 'text' => $welcomeMessage]);
    }
}
