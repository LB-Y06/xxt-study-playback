// 诊断脚本：查看目录项的真实HTML结构
(function() {
    console.log('===== 目录项诊断 =====');
    
    // 1. 查找目录项
    var items = document.querySelectorAll('.posCatalog_select');
    console.log('找到 ' + items.length + ' 个目录项');
    
    // 2. 打印前5个目录项的详细结构
    for (var i = 0; i < Math.min(5, items.length); i++) {
        var it = items[i];
        console.log('\n--- 目录项 ' + i + ' ---');
        console.log('  outerHTML(前300字符): ' + it.outerHTML.substring(0, 300));
        console.log('  textContent: ' + (it.textContent || '').trim().substring(0, 40));
        
        // 查找所有属性
        var a = it.querySelector('a');
        if (a) {
            console.log('  <a>标签存在');
            console.log('    href: ' + a.getAttribute('href'));
            console.log('    onclick: ' + (a.getAttribute('onclick') || '无'));
            console.log('    data-*属性:');
            for (var j = 0; j < a.attributes.length; j++) {
                var attr = a.attributes[j];
                if (attr.name.indexOf('data-') === 0 || attr.name.indexOf('chapter') >= 0) {
                    console.log('      ' + attr.name + ' = ' + attr.value);
                }
            }
        } else {
            console.log('  <a>标签不存在');
        }
        
        // 检查元素自身的id和data属性
        console.log('  元素id: ' + it.id);
        if (it.id && it.id.indexOf('cur') === 0) {
            console.log('  从id提取chapterId: ' + it.id.substring(3));
        }
    }
    
    // 3. 查找可能的chapterId存储位置
    console.log('\n===== 查找chapterId =====');
    
    // 检查URL参数
    var p = new URLSearchParams(location.search);
    console.log('URL chapterId: ' + p.get('chapterId'));
    
    // 检查隐藏字段
    var hidden = document.querySelectorAll('input[type=hidden]');
    console.log('隐藏字段数量: ' + hidden.length);
    
    // 检查所有包含chapterId的元素
    var allEls = document.querySelectorAll('*[id*="chapter"], *[data-chapter], *[class*="chapter"]');
    console.log('包含chapter的元素: ' + allEls.length);
    
    // 4. 检查onclick事件
    var firstItem = items[0];
    if (firstItem) {
        console.log('\n===== 第一个目录项的事件 =====');
        var a = firstItem.querySelector('a');
        if (a) {
            console.log('onclick属性: ' + a.getAttribute('onclick'));
            // 检查是否有getTeacherAjax调用
            var onclick = a.getAttribute('onclick') || '';
            if (onclick.indexOf('getTeacherAjax') >= 0) {
                console.log('>>> 发现getTeacherAjax调用!');
                // 提取参数
                var match = onclick.match(/getTeacherAjax\(([^)]+)\)/);
                if (match) {
                    console.log('参数: ' + match[1]);
                }
            }
        }
    }
    
    console.log('\n===== 诊断结束 =====');
})();
