// 诊断脚本：找出目录元素在哪里
(function() {
    console.log('===== 诊断目录位置 =====');
    
    // 1. 顶层查找
    var topItems = document.querySelectorAll('.posCatalog_select');
    console.log('顶层 .posCatalog_select 数量: ' + topItems.length);
    
    // 2. 检查所有 iframe
    var iframes = document.querySelectorAll('iframe');
    console.log('找到 ' + iframes.length + ' 个 iframe');
    
    for (var i = 0; i < iframes.length; i++) {
        var iframe = iframes[i];
        console.log('\n--- iframe[' + i + '] ---');
        console.log('  id: ' + (iframe.id || '无'));
        console.log('  src(前80): ' + (iframe.src || '').substring(0, 80));
        
        try {
            // 尝试访问 iframe 内容
            var doc = iframe.contentDocument || iframe.contentWindow.document;
            if (doc) {
                var items = doc.querySelectorAll('.posCatalog_select');
                console.log('  .posCatalog_select 数量: ' + items.length);
                if (items.length > 0) {
                    console.log('  >>> 目录在这个 iframe 里！');
                    console.log('  第一个目录项文本: ' + (items[0].textContent || '').trim().substring(0, 30));
                    console.log('  第一个目录项id: ' + (items[0].id || '无'));
                }
            } else {
                console.log('  无法访问内容（跨域）');
            }
        } catch (e) {
            console.log('  访问失败: ' + e.message);
        }
    }
    
    // 3. 尝试通过 window.frames 访问
    console.log('\nwindow.frames 数量: ' + window.frames.length);
    for (var i = 0; i < window.frames.length; i++) {
        try {
            var frameDoc = window.frames[i].document;
            var items = frameDoc.querySelectorAll('.posCatalog_select');
            console.log('frame[' + i + '] .posCatalog_select: ' + items.length);
        } catch (e) {}
    }
    
    console.log('\n===== 诊断结束 =====');
})();
