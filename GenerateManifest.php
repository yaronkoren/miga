<?php
// 
$appName = $_REQUEST['appDirectory'];
$listCache = $_REQUEST['listCache'];
$sentinelCommentBegin = "# MANIFEST>: " . $appName . "\nCACHE:\n";
$sentinelCommentEnd = "# <MANIFEST: " . $appName . "\n";

$manifestCandidate = $sentinelCommentBegin;
$manifestCandidate .= $listCache."\n";
$manifestCandidate .= $sentinelCommentEnd;

$existingManifest = file_get_contents("offline/cache.manifest");

$sentinelPos = strpos($existingManifest, $sentinelCommentBegin);
if ($sentinelPos === FALSE) {
    file_put_contents("offline/cache.manifest", $existingManifest . $manifestCandidate);
} else {
    $oldAppManifest = substr($existingManifest, $sentinelPos, strlen($manifestCandidate));
    if (strcmp($oldAppManifest, $manifestCandidate) != 0) {
        $sentinelPosEnd = strpos($existingManifest, $sentinelCommentEnd, $sentinelPos); 
        $new_manifest = substr($existingManifest, 0, $sentinelPos) . $manifestCandidate . substr($existingManifest, $sentinelPosEnd + strlen($sentinelCommentEnd));
        
        file_put_contents("offline/cache.manifest", $new_manifest);
    }
}

?>
