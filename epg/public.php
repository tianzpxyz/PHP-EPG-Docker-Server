<?php
/**
 * @file public.php
 * @brief 公共脚本
 *
 * 该脚本包含公共设置、公共函数。
 *
 * 作者: Tak
 * GitHub: https://github.com/taksssss/EPG-Server
 */

require 'assets/opencc/vendor/autoload.php'; // 引入 Composer 自动加载器
use Overtrue\PHPOpenCC\OpenCC; // 使用 OpenCC 库

// 检查并解析配置文件和图标列表文件
@mkdir(__DIR__ . '/data', 0755, true);
$iconDir = __DIR__ . '/data/icon/'; @mkdir($iconDir, 0755, true);
$liveDir = __DIR__ . '/data/live/'; @mkdir($liveDir, 0755, true);
$liveFileDir = __DIR__ . '/data/live/file/'; @mkdir($liveFileDir, 0755, true);
file_exists($configPath = __DIR__ . '/data/config.json') || copy(__DIR__ . '/assets/defaultConfig.json', $configPath);
file_exists($iconListPath = __DIR__ . '/data/iconList.json') || file_put_contents($iconListPath, json_encode(new stdClass(), JSON_PRETTY_PRINT));
($iconList = json_decode(file_get_contents($iconListPath), true)) !== null || die("图标列表文件解析失败: " . json_last_error_msg());
$iconListDefault = json_decode(file_get_contents(__DIR__ . '/assets/defaultIconList.json'), true) or die("默认图标列表文件解析失败: " . json_last_error_msg());
$iconListMerged = array_merge($iconListDefault, $iconList); // 同一个键，以 iconList 的为准
$Config = json_decode(file_get_contents($configPath), true) or die("配置文件解析失败: " . json_last_error_msg());

// 获取 serverUrl
$protocol = ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? (($_SERVER['HTTPS'] ?? '') === 'on' ? 'https' : 'http'));
$host = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? '';
$uri = rtrim(strtok(dirname($_SERVER['HTTP_X_ORIGINAL_URI'] ?? @$_SERVER['REQUEST_URI']) ?? '', '?'), '/');
$serverUrl = $protocol . '://' . $host . $uri;

// 建立 xmltv 软链接
if ($Config['gen_xml'] && file_exists($xmlFilePath = __DIR__ . '/data/t.xml')
    && !file_exists($xmlLinkPath = __DIR__ . '/t.xml')) {
    symlink($xmlFilePath, $xmlLinkPath);
    symlink($xmlFilePath . '.gz', $xmlLinkPath . '.gz');
}

// 设置时区为亚洲/上海
date_default_timezone_set("Asia/Shanghai");

// 创建或打开数据库
try {
    // 检测数据库类型
    $is_sqlite = $Config['db_type'] === 'sqlite';

    $dsn = $is_sqlite ? 'sqlite:' . __DIR__ . '/data/data.db'
        : "mysql:host={$Config['mysql']['host']};dbname={$Config['mysql']['dbname']};charset=utf8mb4";

    $db = new PDO($dsn, $Config['mysql']['username'] ?? null, $Config['mysql']['password'] ?? null);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo '数据库连接失败: ' . $e->getMessage();
    exit();
}

// 初始化数据库表
function initialDB() {
    global $db;
    global $is_sqlite;
    $tables = [
        "CREATE TABLE IF NOT EXISTS epg_data (
            date " . ($is_sqlite ? 'TEXT' : 'VARCHAR(255)') . " NOT NULL,
            channel " . ($is_sqlite ? 'TEXT' : 'VARCHAR(255)') . " NOT NULL,
            epg_diyp TEXT,
            PRIMARY KEY (date, channel)
        )",
        "CREATE TABLE IF NOT EXISTS gen_list (
            id " . ($is_sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT PRIMARY KEY AUTO_INCREMENT') . ",
            channel " . ($is_sqlite ? 'TEXT' : 'VARCHAR(255)') . " NOT NULL
        )",
        "CREATE TABLE IF NOT EXISTS update_log (
            id " . ($is_sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT PRIMARY KEY AUTO_INCREMENT') . ",
            timestamp " . ($is_sqlite ? 'DATETIME DEFAULT CURRENT_TIMESTAMP' : 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP') . ",
            log_message TEXT NOT NULL
        )",
        "CREATE TABLE IF NOT EXISTS cron_log (
            id " . ($is_sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT PRIMARY KEY AUTO_INCREMENT') . ",
            timestamp " . ($is_sqlite ? 'DATETIME DEFAULT CURRENT_TIMESTAMP' : 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP') . ",
            log_message TEXT NOT NULL
        )"
    ];

    foreach ($tables as $table) {
        $db->exec($table);
    }
}

// 获取处理后的频道名：$t2s参数表示繁简转换，默认false
function cleanChannelName($channel, $t2s = false) {
    global $Config;
    $channel_ori = $channel;
    
    // 默认忽略 - 跟 空格
    $channel_replacements = ['-', ' '];
    $channel = str_replace($channel_replacements, '', $channel);

    // 频道映射，优先级最高，支持正则表达式和多对一映射
    foreach ($Config['channel_mappings'] as $replace => $search) {
        if (strpos($search, 'regex:') === 0) {
            $pattern = substr($search, 6);
            if (preg_match($pattern, $channel_ori)) {
                return strtoupper(preg_replace($pattern, $replace, $channel_ori));
            }
        } else {
            // 普通映射，可能为多对一
            $channels = array_map('trim', explode(',', $search));
            foreach ($channels as $singleChannel) {
                if (strcasecmp($channel, str_replace($channel_replacements, '', $singleChannel)) === 0) {
                    return strtoupper($replace);
                }
            }
        }
    }

    // 默认不进行繁简转换
    if ($t2s) {
        $channel = t2s($channel);
    }
    return strtoupper($channel);
}

// 繁体转简体
function t2s($channel) {
    return OpenCC::convert($channel, 'TRADITIONAL_TO_SIMPLIFIED');
}

// 台标模糊匹配
function iconUrlMatch($originalChannel, $getDefault = true) {
    global $Config, $iconListMerged;

    // 精确匹配
    if (isset($iconListMerged[$originalChannel])) {
        return $iconListMerged[$originalChannel];
    }

    $bestMatch = null;
    $iconUrl = null;

    // 正向模糊匹配（原始频道名包含在列表中的频道名中）
    foreach ($iconListMerged as $channelName => $icon) {
        if (stripos($channelName, $originalChannel) !== false) {
            if ($bestMatch === null || strlen($channelName) < strlen($bestMatch)) {
                $bestMatch = $channelName;
                $iconUrl = $icon;
            }
        }
    }

    // 反向模糊匹配（列表中的频道名包含在原始频道名中）
    if (!$iconUrl) {
        foreach ($iconListMerged as $channelName => $icon) {
            if (stripos($originalChannel, $channelName) !== false) {
                if ($bestMatch === null || strlen($channelName) > strlen($bestMatch)) {
                    $bestMatch = $channelName;
                    $iconUrl = $icon;
                }
            }
        }
    }

    // 如果没有找到匹配的图标，使用默认图标（如果配置中存在）
    return $iconUrl ?: ($getDefault && !empty($Config['default_icon']) ? $Config['default_icon'] : null);
}

// 下载文件
function downloadData($url, $userAgent = '', $timeout = 30, $connectTimeout = 10, $retry = 3) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_SSL_VERIFYPEER => 0,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_RETURNTRANSFER => 1,
        CURLOPT_FOLLOWLOCATION => 1,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => $connectTimeout,
        CURLOPT_HTTPHEADER => [
            'User-Agent: ' . $userAgent ?: 
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36',
            'Accept: */*',
            'Connection: keep-alive'
        ]
    ]);
    while ($retry--) {
        $data = curl_exec($ch);
        if (!curl_errno($ch)) break;
    }
    curl_close($ch);
    return $data ?: false;
}

// 日志记录函数
function logMessage(&$log_messages, $message) {
    $log_messages[] = date("[y-m-d H:i:s]") . " " . $message;
    echo date("[y-m-d H:i:s]") . " " . $message . "<br>";
}

// 下载 JSON 数据并存入数据库
function downloadJSONData($data_source, $data_str, $db, &$log_messages, $replaceFlag = true) {
    $db->beginTransaction();
    try {
        processJsonData($data_source, $data_str, $db, $log_messages, $replaceFlag);
        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        logMessage($log_messages, "【{$data_source}】 " . $e->getMessage());
    }
    echo "<br>";
}

// 处理 JSON 数据并存入数据库
function processJsonData($data_source, $data_str, $db, &$log_messages, $replaceFlag) {
    $processFunction = ($data_source === 'tvmao') ? 'processTvmaoJsonData' : 
                       ($data_source === 'cntv' ? 'processCntvJsonData' : null);
    if ($processFunction) {
        $allChannelProgrammes = $processFunction($data_str);
        foreach ($allChannelProgrammes as $channelId => $channelProgrammes) {
            $processCount = $channelProgrammes['process_count'];
            if ($processCount) {
                insertDataToDatabase([$channelId => $channelProgrammes], $db, $data_source, $replaceFlag);
            }
            logMessage($log_messages, "【{$data_source}】 {$channelProgrammes['channel_name']} " . 
                        ($processCount ? "更新成功，共 {$processCount} 条" : "下载失败！！！"));
        }
    }
}

// 处理 tvmao 数据
function processTvmaoJsonData($data_str) {
    $tvmaostr = str_ireplace('tvmao,', '', $data_str);
    
    $channelProgrammes = [];
    foreach (explode(',', $tvmaostr) as $tvmao_info) {
        list($channelName, $channelId) = array_map('trim', explode(':', trim($tvmao_info)) + [null, $tvmao_info]);
        $channelProgrammes[$channelId]['channel_name'] = cleanChannelName($channelName);

        $json_url = "https://sp0.baidu.com/8aQDcjqpAAV3otqbppnN2DJv/api.php?query={$channelId}&resource_id=12520&format=json";
        $json_data = downloadData($json_url);
        $json_data = mb_convert_encoding($json_data, 'UTF-8', 'GBK');
        $data = json_decode($json_data, true);
        if (empty($data['data'])) {
            $channelProgrammes[$channelId]['process_count'] = 0;
            continue;
        }
        $data = $data['data'][0]['data'];
        $skipTime = null;
        foreach ($data as $epg) {
            if ($time_str = $epg['times'] ?? '') {
                $starttime = DateTime::createFromFormat('Y/m/d H:i', $time_str);
                $date = $starttime->format('Y-m-d');
                // 如果第一条数据早于今天 02:00，则认为今天的数据是齐全的
                if (is_null($skipTime)) {
                    $skipTime = $starttime < new DateTime("today 02:00") ? 
                                new DateTime("today 00:00") : new DateTime("tomorrow 00:00");
                }
                if ($starttime < $skipTime) continue;
                $channelProgrammes[$channelId]['diyp_data'][$date][] = [
                    'start' => $starttime->format('H:i'),
                    'end' => '',  // 初始为空
                    'title' => trim($epg['title']),
                    'desc' => ''
                ];
            }
        }
        // 填充 'end' 字段
        foreach ($channelProgrammes[$channelId]['diyp_data'] as $date => &$programmes) {
            foreach ($programmes as $i => &$programme) {
                $nextStart = $programmes[$i + 1]['start'] ?? '00:00';  // 下一个节目开始时间或 00:00
                $programme['end'] = $nextStart;  // 填充下一个节目的 'start'
                if ($nextStart === '00:00') {
                    // 尝试获取第二天数据并补充
                    $nextDate = (new DateTime($date))->modify('+1 day')->format('Y-m-d');
                    $nextDayProgrammes = $channelProgrammes[$channelId]['diyp_data'][$nextDate] ?? [];
                    if (!empty($nextDayProgrammes) && $nextDayProgrammes[0]['start'] !== '00:00') {
                        array_unshift($channelProgrammes[$channelId]['diyp_data'][$nextDate], [
                            'start' => '00:00',
                            'end' => '',
                            'title' => $programme['title'],
                            'desc' => ''
                        ]);
                    }
                }
            }
        }
        $channelProgrammes[$channelId]['process_count'] = count($data);
    }
    return $channelProgrammes;
}

// 处理 cntv 数据
function processCntvJsonData($data_str) {
    $date_range = 1;
    if (preg_match('/^cntv:(\d+),\s*(.*)$/i', $data_str, $matches)) {
        $date_range = $matches[1]; // 提取日期范围
        $cntvstr = $matches[2]; // 提取频道字符串
    } else {
        $cntvstr = str_ireplace('cntv,', '', $data_str); // 没有日期范围时去除 'cntv,'
    }
    $need_dates = array_map(function($i) { return (new DateTime())->modify("+$i day")->format('Ymd'); }, range(0, $date_range - 1));

    $channelProgrammes = [];
    foreach (explode(',', $cntvstr) as $cntv_info) {
        list($channelName, $channelId) = array_map('trim', explode(':', trim($cntv_info)) + [null, $cntv_info]);
        $channelId = strtolower($channelId);
        $channelProgrammes[$channelId]['channel_name'] = cleanChannelName($channelName);

        $processCount = 0;
        foreach ($need_dates as $need_date) {
            $json_url = "https://api.cntv.cn/epg/getEpgInfoByChannelNew?c={$channelId}&serviceId=tvcctv&d={$need_date}";
            $json_data = downloadData($json_url);
            $data = json_decode($json_data, true);
            if (!isset($data['data'][$channelId]['list'])) {
                continue;
            }
            $data = $data['data'][$channelId]['list'];
            foreach ($data as $epg) {
                $starttime = (new DateTime())->setTimestamp($epg['startTime']);
                $endtime = (new DateTime())->setTimestamp($epg['endTime']);
                $date = $starttime->format('Y-m-d');
                $channelProgrammes[$channelId]['diyp_data'][$date][] = [
                    'start' => $starttime->format('H:i'),
                    'end' => $endtime->format('H:i'),
                    'title' => trim($epg['title']),
                    'desc' => ''
                ];
            }
            $processCount += count($data);
        }
        $channelProgrammes[$channelId]['process_count'] = $processCount;
    }

    return $channelProgrammes;
}

// 插入数据到数据库
function insertDataToDatabase($channelsData, $db, $sourceUrl, $replaceFlag = true) {
    global $processedRecords;
    global $Config;

    foreach ($channelsData as $channelId => $channelData) {
        $channelName = $channelData['channel_name'];
        foreach ($channelData['diyp_data'] as $date => $diypProgrammes) {
            // 检查是否全天只有一个节目
            if (count($title = array_unique(array_column($diypProgrammes, 'title'))) === 1 
                && preg_match('/节目|節目/u', $title[0])) {
                continue; // 跳过后续处理
            }
            
            // 生成 epg_diyp 数据内容
            $diypContent = json_encode([
                'channel_name' => $channelName,
                'date' => $date,
                'url' => 'https://github.com/taksssss/EPG-Server',
                'source' => $sourceUrl,
                'epg_data' => $diypProgrammes
            ], JSON_UNESCAPED_UNICODE);

            // 当天及未来数据覆盖，其他日期数据忽略
            $action = $date >= date('Y-m-d') && $replaceFlag ? 'REPLACE' : 'IGNORE';

            // 根据数据库类型选择 SQL 语句
            if ($Config['db_type'] === 'sqlite') {
                $sql = "INSERT OR $action INTO epg_data (date, channel, epg_diyp) VALUES (:date, :channel, :epg_diyp)";
            } else {
                $sql = ($action === 'REPLACE')
                    ? "REPLACE INTO epg_data (date, channel, epg_diyp) VALUES (:date, :channel, :epg_diyp)"
                    : "INSERT IGNORE INTO epg_data (date, channel, epg_diyp) VALUES (:date, :channel, :epg_diyp)";
            }

            // 准备并执行 SQL 语句
            $stmt = $db->prepare($sql);
            $stmt->bindValue(':date', $date, PDO::PARAM_STR);
            $stmt->bindValue(':channel', $channelName, PDO::PARAM_STR);
            $stmt->bindValue(':epg_diyp', $diypContent, PDO::PARAM_STR);
            $stmt->execute();
            if ($stmt->rowCount() > 0) {
                $recordKey = $channelName . '-' . $date;
                $processedRecords[$recordKey] = true;
            }
        }
    }
}

// 读取 modifications.csv 文件，获取已存在的数据
function getExistingData() {
    global $liveDir;

    $existingData = [];
    $modificationsFilePath = $liveDir . 'modifications.csv';
    if (file_exists($modificationsFilePath)) {
        $modificationsFile = fopen($modificationsFilePath, 'r');
        $header = fgetcsv($modificationsFile); // 读取表头
        while ($row = fgetcsv($modificationsFile)) {
            if (empty(array_filter($row))) continue; // 跳过空行
            $rowData = array_combine($header, $row);
            $existingData[$rowData['tag']] = $rowData; // 使用 tag 作为映射的键
        }
        fclose($modificationsFile);
    }
    return $existingData;
}

// 解析 txt、m3u 直播源，并生成直播列表（包含分组、地址等信息）
function doParseSourceInfo($urlLine = null) {
    // 获取当前的最大执行时间，临时设置超时时间为 20 分钟
    $original_time_limit = ini_get('max_execution_time');
    set_time_limit(20*60);

    global $liveDir, $liveFileDir, $Config;

    $liveChannelNameProcess = $Config['live_channel_name_process'] ?? false; // 标记是否处理频道名
    
    // 频道数据模糊匹配函数
    function dbChannelNameMatch($channelName) {
        global $db;
        $concat = $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? "CONCAT('%', channel, '%')" : "'%' || channel || '%'";
        $stmt = $db->prepare("
            SELECT channel FROM epg_data WHERE (channel = :channel OR channel LIKE :like_channel OR :channel LIKE $concat)
            ORDER BY CASE WHEN channel = :channel THEN 1 WHEN channel LIKE :like_channel THEN 2 ELSE 3 END, LENGTH(channel) DESC
            LIMIT 1
        ");
        $stmt->execute([':channel' => $channelName, ':like_channel' => $channelName . '%']);
        return $stmt->fetchColumn();
    }

    // 获取 modifications.csv 数据
    $existingData = getExistingData();

    // 读取 source.txt 内容，处理每行 URL
    $errorLog = '';
    $sourceContent = file_get_contents($liveDir . 'source.txt');
    $lines = $urlLine ? [$urlLine] : array_filter(array_map('ltrim', explode("\n", $sourceContent)));
    $allChannelData = [];
    foreach ($lines as $line) {
        if (empty($line) || $line[0] === '#') continue;
    
        // 解析 URL 和分组前缀
        list($url, $groupPrefix, $userAgent) = explode('#', $line) + [1 => '', 2 => ''];
        $url = trim($url);
        $groupPrefix = ltrim($groupPrefix);
        $userAgent = trim($userAgent);
    
        // 获取 URL 内容
        $urlContent = (stripos($url, '/data/live/file/') === 0) 
            ? @file_get_contents(__DIR__ . $url) 
            : downloadData($url, $userAgent, 5);
        $fileName = md5(urlencode($url));  // 用 MD5 对 URL 进行命名
        $localFilePath = $liveFileDir . '/' . $fileName . '.m3u';
        
        if (!$urlContent || stripos($urlContent, 'not found') !== false) {
            $urlContent = file_exists($localFilePath) ? file_get_contents($localFilePath) : '';
            if (!$urlContent) { $errorLog .= "$url 解析失败<br>"; continue; }
            else { $errorLog .= "$url 使用本地缓存<br>"; }
        }
        
        $encoding = mb_detect_encoding($urlContent, ['UTF-8', 'GBK', 'CP936'], true);
        if ($encoding === 'GBK' || $encoding === 'CP936') {
            $urlContent = mb_convert_encoding($urlContent, 'UTF-8', 'GBK');
        }
        $urlContentLines = explode("\n", $urlContent);
        $urlChannelData = [];

        // 处理 M3U 格式的直播源
        if (strpos($urlContent, '#EXTM3U') !== false) {
            foreach ($urlContentLines as $i => $urlContentLine) {
                $urlContentLine = trim($urlContentLine);
    
                // 跳过空行和 M3U 头部
                if (empty($urlContentLine) || strpos($urlContentLine, '#EXTM3U') === 0) continue;
    
                if (strpos($urlContentLine, '#EXTINF') === 0 && isset($urlContentLines[$i + 1])) {
                    // 处理 `#EXTINF` 行，提取频道信息
                    if (preg_match('/#EXTINF:-?\d+(.*),(.+)/', $urlContentLine, $matches)) {
                        $channelInfo = $matches[1];
                        $groupTitle = preg_match('/group-title="([^"]+)"/', $channelInfo, $match) ? trim($match[1]) : '';
                        $originalChannelName = trim($matches[2]);
                        $streamUrl = trim($urlContentLines[$i + 1]);
                        $tag = md5($url . $groupTitle . $originalChannelName . $streamUrl);

                        $rowData = [
                            'groupTitle' => $groupPrefix . $groupTitle,
                            'channelName' => $originalChannelName,
                            'chsChannelName' => '',
                            'streamUrl' => $streamUrl,
                            'iconUrl' => preg_match('/tvg-logo="([^"]+)"/', $channelInfo, $match) ? $match[1] : '',
                            'tvgId' => preg_match('/tvg-id="([^"]+)"/', $channelInfo, $match) ? $match[1] : '',
                            'tvgName' => preg_match('/tvg-name="([^"]+)"/', $channelInfo, $match) ? $match[1] : '',
                            'disable' => 0,
                            'modified' => 0,
                            'source' => $url,
                            'tag' => $tag,
                        ];

                        $urlChannelData[] = $rowData;
                    }
                }
            }
        } else {
            // 处理 TXT 格式的直播源
            $groupTitle = '';
            foreach ($urlContentLines as $urlContentLine) {
                $urlContentLine = trim($urlContentLine);
                $parts = explode(',', $urlContentLine);
            
                if (count($parts) >= 2) {
                    if ($parts[1] === '#genre#') {
                        $groupTitle = trim($parts[0]); // 更新 group-title
                        continue;
                    }
            
                    $originalChannelName = trim($parts[0]);
                    $streamUrl = trim($parts[1]);
                    $tag = md5($url . $groupTitle . $originalChannelName . $streamUrl);

                    $rowData = [
                        'groupTitle' => $groupPrefix . $groupTitle,
                        'channelName' => $originalChannelName,
                        'chsChannelName' => '',
                        'streamUrl' => $streamUrl,
                        'iconUrl' => '',
                        'tvgId' => '',
                        'tvgName' => '',
                        'disable' => 0,
                        'modified' => 0,
                        'source' => $url,
                        'tag' => $tag,
                    ];
            
                    $urlChannelData[] = $rowData;
                }
            }
        }

        // 将所有 channelName 整合到一起，统一调用 t2s 进行繁简转换
        $channelNames = array_column($urlChannelData, 'channelName'); // 提取所有 channelName
        $chsChannelNames = explode("\n", t2s(implode("\n", $channelNames))); // 繁简转换

        // 将转换后的信息写回 urlChannelData
        foreach ($urlChannelData as $index => &$row) {
            // 检查该行是否已经修改
            if (isset($existingData[$row['tag']])) {
                $row = $existingData[$row['tag']];
                continue;
            }

            // 更新部分信息
            $chsChannelName = $chsChannelNames[$index];
            $cleanChannelName = cleanChannelName($chsChannelName);
            $dbChannelName = dbChannelNameMatch($cleanChannelName);
            $finalChannelName = $dbChannelName ?: $cleanChannelName;
            $row['channelName'] = $liveChannelNameProcess ? $finalChannelName : $row['channelName'];
            $row['chsChannelName'] = $chsChannelName;
            $row['iconUrl'] = iconUrlMatch($finalChannelName) ?? $row['iconUrl'];
            $row['tvgName'] = $dbChannelName ?? $row['tvgName'];
        }

        generateLiveFiles($urlChannelData, "file/{$fileName}"); // 单独直播源文件
        $allChannelData = array_merge($allChannelData, $urlChannelData); // 写入 allChannelData
    }
    
    if (!$urlLine) {
        generateLiveFiles($allChannelData, 'tv'); // 总直播源文件
    }

    // 恢复原始超时时间
    set_time_limit($original_time_limit);
    
    return $errorLog ?: true;
}

// 生成 M3U 和 TXT 文件
function generateLiveFiles($channelData, $fileName, $saveOnly = false) {
    global $Config, $liveDir;

    // 获取配置
    $fuzzyMatchingEnable = $Config['live_fuzzy_match'] ?? 1;
    $commentEnabled = $Config['live_url_comment'] ?? 0;
    $txtCommentEnabled = $Config['live_url_comment'] === 1 || $Config['live_url_comment'] === 3 ?? 0;
    $m3uCommentEnabled = $Config['live_url_comment'] === 2 || $Config['live_url_comment'] === 3 ?? 0;

    // 读取 template.txt 文件内容
    $templateFilePath = $liveDir . 'template.txt';
    $templateExist = file_exists($templateFilePath) && !empty($templateContent = file_get_contents($templateFilePath));
    
    $m3uContent = "#EXTM3U x-tvg-url=\"\"\n";
    $groups = [];
    $liveTvgIdEnable = $Config['live_tvg_id_enable'] ?? 1;
    $liveTvgNameEnable = $Config['live_tvg_name_enable'] ?? 1;
    $liveTvgLogoEnable = $Config['live_tvg_logo_enable'] ?? 1;
    if ($fileName === 'tv' && ($Config['live_template_enable'] ?? 1) && $templateExist && !$saveOnly) {
        // 处理有模板且开启的情况
        $templateGroups = [];

        // 解析 template.txt 内容
        $currentGroup = '未分组';
        foreach (explode("\n", $templateContent) as $line) {
            $line = trim($line, " ,");
            if (empty($line)) continue;            
            if (strpos($line, '#') === 0) {
                $groupParts = array_map('trim', explode(',', substr($line, 1)));
                $currentGroup = $groupParts[0];  // 提取分组名
                $currentGroupSources = array_slice($groupParts, 1);  // 提取分组源（多个值）
                $templateGroups[$currentGroup]['source'] = $currentGroupSources; // 存储为数组
            } else {
                $channels = array_map('trim', explode(',', $line));
                foreach ($channels as $channel) {
                    $templateGroups[$currentGroup]['channels'][] = $channel;
                }
            }
        }

        // 处理每个分组
        $newChannelData = [];
        foreach ($templateGroups as $templateGroupTitle => $groupInfo) {
            // 如果没有指定频道，直接检查来源、分组标题是否匹配
            if (empty($groupInfo['channels'])) {
                foreach ($channelData as $row) {
                    list($groupTitle, $channelName, , $streamUrl, $iconUrl, $tvgId, $tvgName, $disable, , $source) = array_values($row);

                    if ((!empty($groupInfo['source']) && !in_array($source, $groupInfo['source'])) || ($templateGroupTitle !== 'default' && 
                        stripos($groupTitle, $templateGroupTitle) === false && stripos($templateGroupTitle, $groupTitle) === false)) {
                        continue;
                    }

                    // 更新信息
                    $txtStreamUrl = $streamUrl . (($txtCommentEnabled && strpos($streamUrl, '$') === false) ? "\${$groupTitle}" : "");
                    $m3uStreamUrl = $streamUrl . (($m3uCommentEnabled && strpos($streamUrl, '$') === false) ? "\${$groupTitle}" : "");
                    $rowGroupTitle = $templateGroupTitle === 'default' ? $groupTitle : $templateGroupTitle;
                    $row['groupTitle'] = $rowGroupTitle;
                    $row['streamUrl'] = $streamUrl . (($commentEnabled && strpos($streamUrl, '$') === false) ? "\${$groupTitle}" : "");
                    $newChannelData[] = $row;

                    if ($disable) continue;

                    // 生成 M3U 内容
                    $extInfLine = "#EXTINF:-1" . 
                        ($tvgId && $liveTvgIdEnable ? " tvg-id=\"$tvgId\"" : "") . 
                        ($tvgName && $liveTvgNameEnable ? " tvg-name=\"$tvgName\"" : "") . 
                        ($iconUrl && $liveTvgLogoEnable ? " tvg-logo=\"$iconUrl\"" : "") . 
                        " group-title=\"$rowGroupTitle\"," . 
                        "$channelName";

                    $m3uContent .= $extInfLine . "\n" . $m3uStreamUrl . "\n";
                    $groups[$rowGroupTitle][] = "$channelName,$txtStreamUrl";
                }
            } else {
                // 获取繁简转换后的模板频道名称
                $groupChannels = $groupInfo['channels'];
                $cleanChsGroupChannelNames = explode("\n", t2s(implode("\n", array_map('cleanChannelName', $groupChannels))));

                // 如果指定了频道，先遍历 $groupChannels，保证顺序不变
                foreach ($groupChannels as $index => $groupChannelName) {
                    $cleanChsGroupChannelName = $cleanChsGroupChannelNames[$index];
                    foreach ($channelData as $row) {
                        list($groupTitle, $channelName, $chsChannelName, $streamUrl, $iconUrl, $tvgId, $tvgName, $disable, , $source) = array_values($row);

                        // 检查来源匹配
                        if (!empty($groupInfo['source']) && !in_array($source, $groupInfo['source'])) {
                            continue;
                        }

                        // 检查频道名称是否匹配
                        $cleanChsChannelName = cleanChannelName($chsChannelName);

                        // CGTN 和 CCTV 不进行模糊匹配
                        if ($channelName === $groupChannelName || 
                            ($fuzzyMatchingEnable && ($cleanChsChannelName === $cleanChsGroupChannelName || 
                            stripos($cleanChsGroupChannelName, 'CGTN') === false && stripos($cleanChsGroupChannelName, 'CCTV') === false &&
                            (stripos($cleanChsChannelName, $cleanChsGroupChannelName) !== false || stripos($cleanChsGroupChannelName, $cleanChsChannelName) !== false)))) {
                            // 更新信息
                            $txtStreamUrl = $streamUrl . (($txtCommentEnabled && strpos($streamUrl, '$') === false) ? "\${$groupTitle}" : "");
                            $m3uStreamUrl = $streamUrl . (($m3uCommentEnabled && strpos($streamUrl, '$') === false) ? "\${$groupTitle}" : "");
                            $rowGroupTitle = $templateGroupTitle === 'default' ? $groupTitle : $templateGroupTitle;
                            $row['groupTitle'] = $rowGroupTitle;
                            $row['channelName'] = $groupChannelName; // 使用 $groupChannels 中的名称
                            $row['streamUrl'] = $streamUrl . (($commentEnabled && strpos($streamUrl, '$') === false) ? "\${$groupTitle}" : "");
                            $newChannelData[] = $row;

                            if ($disable) continue;

                            // 生成 M3U 内容
                            $extInfLine = "#EXTINF:-1" . 
                                ($tvgId && $liveTvgIdEnable ? " tvg-id=\"$tvgId\"" : "") . 
                                ($tvgName && $liveTvgNameEnable ? " tvg-name=\"$tvgName\"" : "") . 
                                ($iconUrl && $liveTvgLogoEnable ? " tvg-logo=\"$iconUrl\"" : "") . 
                                " group-title=\"$rowGroupTitle\"," . 
                                "$groupChannelName"; // 使用 $groupChannels 中的名称

                            $m3uContent .= $extInfLine . "\n" . $m3uStreamUrl . "\n";
                            $groups[$rowGroupTitle][] = "$groupChannelName,$txtStreamUrl";
                        }
                    }
                }
            }
        }
        $channelData = $newChannelData;
    } else {
        // 处理没有模板及仅保存修改信息的情况
        foreach ($channelData as $row) {
            list($groupTitle, $channelName, , $streamUrl, $iconUrl, $tvgId, $tvgName, $disable) = array_values($row);
            if ($disable) continue;
    
            // 生成 M3U 内容
            $extInfLine = "#EXTINF:-1" . 
                ($tvgId && $liveTvgIdEnable ? " tvg-id=\"$tvgId\"" : "") . 
                ($tvgName && $liveTvgNameEnable ? " tvg-name=\"$tvgName\"" : "") . 
                ($iconUrl && $liveTvgLogoEnable ? " tvg-logo=\"$iconUrl\"" : "") . 
                ($groupTitle ? " group-title=\"$groupTitle\"" : "") . 
                ",$channelName";
    
            $m3uContent .= $extInfLine . "\n" . $streamUrl . "\n";
            $groups[$groupTitle ?: "未分组"][] = "$channelName,$streamUrl";
        }
    }

    // 写入 M3U 文件
    file_put_contents("{$liveDir}{$fileName}.m3u", $m3uContent);

    // 写入 TXT 文件
    $txtContent = "";
    foreach ($groups as $group => $channels) {
        $txtContent .= "$group,#genre#\n" . implode("\n", $channels) . "\n\n";
    }
    file_put_contents("{$liveDir}{$fileName}.txt", trim($txtContent));

    if ($fileName === 'tv') {
        // 获取 modifications.csv 数据
        $existingData = getExistingData();
        
        // 打开 CSV 文件写入新数据
        $channelsFilePath = $liveDir . 'channels.csv';
        $channelsFile = fopen($channelsFilePath, 'w');
        $modificationsFilePath = $liveDir . 'modifications.csv';
        $modificationsFile = fopen($modificationsFilePath, 'w');

        $title = ['groupTitle', 'channelName', 'chsChannelName', 'streamUrl', 'iconUrl', 'tvgId', 'tvgName', 'disable', 'modified', 'source', 'tag'];
        fputcsv($channelsFile, $title); // 写入表头
        fputcsv($modificationsFile, $title); // 写入表头

        foreach ($channelData as $row) {
            fputcsv($channelsFile, $row);

            // 处理 existingData
            if (isset($existingData[$row['tag']])) { // 如果 tag 已存在，移除
                unset($existingData[$row['tag']]);
            }
            if ($row['modified'] == 1) { // 如果 modified 为 1，保存至 existingData
                $existingData[$row['tag']] = $row;
            }
        }
        
        // 将 existingData 写入 modifications.csv
        foreach ($existingData as $tag => $row) {
            fputcsv($modificationsFile, $row);
        }

        fclose($channelsFile);
        fclose($modificationsFile);
    }
}
?>