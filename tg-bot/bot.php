<?php
declare(strict_types=1);
require __DIR__ . '/common.php';

$token = botToken();
$offset = 0;
fwrite(STDOUT, "Telegram wishlist bot started (polling)\n");
while (true) {
    try {
        $updates = telegram($token, 'getUpdates', ['offset' => $offset, 'timeout' => 10]);
        foreach ($updates as $update) {
            handleUpdate($update, $token);
            $offset = ((int) $update['update_id']) + 1;
        }
    } catch (Throwable) {
        fwrite(STDERR, "Polling failed; retrying in 3 seconds\n");
        sleep(3);
    }
}
