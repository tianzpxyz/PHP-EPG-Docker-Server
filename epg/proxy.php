<?php
/**
 * @file proxy.php
 * @brief IPTV 流媒体代理脚本
 *
 * 该脚本根据传入的 token 和 url 参数，对 IPTV 流媒体请求进行代理转发。
 *
 * 作者: Tak
 * GitHub: https://github.com/taksssss/iptv-tool
 */

require_once 'public.php';

// 只传加密后的 URL
$encUrl = $_GET['url'] ?? '';
if (!$encUrl) {
    http_response_code(403);
    exit('Forbidden');
}

// 解密 URL
$url = decryptUrl($encUrl, $Config['token']);
if ($url === false) {
    http_response_code(403);
    exit('Forbidden');
}

set_time_limit(0);
if (ob_get_level()) ob_end_clean();

// 判断是否为 M3U8 文件
$isM3U8 = stripos($url, '.m3u8') !== false;

// 设置输出类型
header('Content-Type: ' . ($isM3U8 ? 'application/vnd.apple.mpegurl' : 'video/MP2T'));

// 收集客户端请求头
$clientHeaders = [];
foreach (getallheaders() as $key => $value) {
    // 跳过 Host，避免覆盖目标站
    if (strtolower($key) === 'host') continue;
    $clientHeaders[] = "$key: $value";
}

// 初始化请求
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_FOLLOWLOCATION => true,   // 跟随重定向
    CURLOPT_RETURNTRANSFER => $isM3U8, // M3U8 需要一次性取回
    CURLOPT_SSL_VERIFYPEER => false,  // 忽略证书验证
    CURLOPT_SSL_VERIFYHOST => false,
    CURLOPT_HTTPHEADER     => $clientHeaders, // 透传请求头
    CURLOPT_TIMEOUT        => 0,
]);

if ($isM3U8) {
    // 拉取并处理 M3U8
    $data = curl_exec($ch);

    if ($data === false) {
        http_response_code(502);
        curl_close($ch);
        exit('Bad Gateway');
    }

    // 获取最终有效地址（考虑重定向）
    $finalUrl = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
    curl_close($ch);

    // 计算基础路径（M3U8 所在目录）
    $base = preg_replace('/\/[^\/]*$/', '/', $finalUrl);
    $proxy = '/proxy.php?url=';

    // 替换 M3U8 中的 TS / 子 M3U8 地址为代理地址
    echo preg_replace_callback(
        '/^(?!#)(.+\.(ts|m3u8).*?)$/mi',
        function ($m) use ($base, $proxy, $Config) {
            $link = trim($m[1]);
            // 如果是相对路径，补全为绝对 URL
            if (!preg_match('/^[a-zA-Z]+:\/\//', $link)) {
                $link = $base . $link;
            }
            // 用 token 加密链接
            $encLink = encryptUrl($link, $Config['token']);
            return $proxy . urlencode($encLink);
        },
        $data
    );
} else {
    // TS/其他流：实时透传，同时保留源站响应头
    curl_setopt($ch, CURLOPT_HEADERFUNCTION, function ($ch, $header) {
        $len = strlen($header);
        $header = trim($header);
        if ($header && stripos($header, 'Transfer-Encoding') === false) {
            header($header, false);
        }
        return $len;
    });

    curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($c, $data) {
        echo $data;
        flush();
        return strlen($data);
    });

    curl_exec($ch);
    curl_close($ch);
}