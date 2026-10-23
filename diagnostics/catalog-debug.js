// 诊断脚本：检查目录结构
(function() {
    console.log('===== 目录诊断 =====');
    
    // 1. 检查章节选择器
    var items = document.querySelectorAll('.posCatalog_select');
    console.log('.posCatalog_select 数量:', items.length);
    
    // 2. 检查激活项
    var active = document.querySelector('.posCatalog_active');
    console.log('激活项:', active ? active.textContent.trim().substring(0, 30) : '无');
    
    // 3. 打印所有项的 chapterId
    console.log('\n所有章节项:');
    for (var i = 0; i < Math.min(items.length, 10); i++) {
        var it = items[i];
        var a = it.querySelector('a');
        var href = a ? a.getAttribute('href') : '';
        var m = href.match(/chapterId=(\d+)/);
        var id = m ? m[1] : '无';
        var isActive = it.classList.contains('posCatalog_active');
        console.log('  [' + i + '] ' + id + ' | 激活:' + isActive + ' | ' + (it.textContent || '').trim().substring(0, 30));
    }
    
    // 4. 尝试其他选择器
    var allLinks = document.querySelectorAll('.posCatalog_name a');
    console.log('\n.posCatalog_name a 数量:', allLinks.length);
    
    var posItems = document.querySelectorAll('[class*="posCatalog"]');
    console.log('[class*="posCatalog"] 数量:', posItems.length);
    
    // 5. 打印当前 URL 参数
    console.log('\n当前 URL 参数:');
    var p = new URLSearchParams(location.search);
    console.log('  chapterId:', p.get('chapterId'));
    console.log('  courseId:', p.get('courseId'));
    
    console.log('\n===== 诊断结束 =====');
})();
