// 诊断脚本：检查章节ID提取
(function() {
    console.log('===== 检查章节ID提取 =====');
    
    var items = document.querySelectorAll('.posCatalog_select');
    console.log('共 ' + items.length + ' 个目录项');
    
    // 当前章节ID
    var curId = new URLSearchParams(location.search).get('chapterId') || '';
    console.log('当前 chapterId (URL): ' + curId);
    
    // 检查前10个目录项
    for (var i = 0; i < Math.min(10, items.length); i++) {
        var it = items[i];
        console.log('\n--- 目录项[' + i + '] ---');
        console.log('  元素id: ' + (it.id || '无'));
        console.log('  是否激活: ' + it.classList.contains('posCatalog_active'));
        console.log('  文本: ' + (it.textContent || '').trim().substring(0, 30));
        
        // 提取chapterId方法1: 从元素id
        var rawId = it.id || '';
        var id1 = (rawId.indexOf('cur') === 0) ? rawId.substring(3) : '';
        console.log('  方法1(从id): ' + (id1 || '提取失败'));
        
        // 提取chapterId方法2: 从onclick
        var a = it.querySelector('a');
        if (a) {
            var onclick = a.getAttribute('onclick') || '';
            var m = onclick.match(/getTeacherAjax\([^,]+,[^,]+,(\d+)/);
            var id2 = m ? m[1] : '';
            console.log('  方法2(从onclick): ' + (id2 || '提取失败'));
            console.log('  onclick内容: ' + onclick.substring(0, 60));
            
            // 提取chapterId方法3: 从href
            var href = a.getAttribute('href') || '';
            var m2 = href.match(/chapterId=(\d+)/);
            var id3 = m2 ? m2[1] : '';
            console.log('  方法3(从href): ' + (id3 || '提取失败'));
        } else {
            console.log('  <a>标签不存在');
        }
    }
    
    console.log('\n===== 诊断结束 =====');
})();
