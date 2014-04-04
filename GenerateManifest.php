<?php
// 
$appName = $_REQUEST['appDirectory'];
$listCache = $_REQUEST['listCache'];
$sentinelCommentBegin = "# MANIFEST>: " . $appName;
$sentinelCommentEnd = "# <MANIFEST: " . $appName;

$body = $sentinelCommentBegin . " - ". date(DATE_RFC2822) . "\n";
$body .= "CACHE:\n";
$body .= $listCache."\n";
$body .= $sentinelCommentEnd . "\n";

$cache_manifest = file_get_contents("offline/cache.manifest");

$sentinelPos = strpos($cache_manifest, $sentinelCommentBegin);
if ($sentinelPos == FALSE) {
    file_put_contents("offline/cache.manifest", $cache_manifest . $body);
} else {
    $new_manifest = substr($cache_manifest, 0, $sentinelPos - 1);
    $sentinelPos2 = strpos($cache_manifest, $sentinelCommentEnd, $sentinelPos);
    $new_manifest .= $body . substr($cache_manifest, $sentinelPos2 + strlen($sentinelCommentEnd));
    
    file_put_contents("offline/cache.manifest", $new_manifest);
}

?>