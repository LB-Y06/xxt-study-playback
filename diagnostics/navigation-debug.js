// 调试跳转问题
(function() {
    var VIDEO_URLS = [
        // 在这里填入你有权访问的课程页面地址，并用逗号分隔。
    ];
    
    console.log('===== 调试跳转 =====');
    console.log('当前 chapterId:', new URLSearchParams(location.search).get('chapterId'));
    
    for (var i = 0; i < VIDEO_URLS.length; i++) {
        try {
            var url = VIDEO_URLS[i];
            var urlCid = new URL(url).searchParams.get('chapterId');
            console.log('VIDEO_URLS[' + i + '] chapterId:', urlCid);
        } catch(e) {
            console.log('VIDEO_URLS[' + i + '] 解析失败:', e.message);
        }
    }
    
    console.log('\n测试 getNextUrl 函数:');
    var cid = new URLSearchParams(location.search).get('chapterId') || '';
    for (var i = 0; i < VIDEO_URLS.length; i++) {
        var url = VIDEO_URLS[i];
        var urlCid = new URL(url).searchParams.get('chapterId');
        if (urlCid === cid) {
            console.log('匹配到当前 URL，下一个索引:', i + 1);
            console.log('下一个 URL:', VIDEO_URLS[i + 1] || '无');
            break;
        }
    }
    
    console.log('\n===== 调试结束 =====');
})();
