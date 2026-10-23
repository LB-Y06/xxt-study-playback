// 详细诊断目录元素结构
(function() {
    console.log('===== 详细诊断目录结构 =====');
    
    var items = document.querySelectorAll('.posCatalog_select');
    console.log('共 ' + items.length + ' 个目录项');
    
    // 检查前3个目录项的HTML结构
    for (var i = 0; i < Math.min(3, items.length); i++) {
        var it = items[i];
        console.log('\n--- 目录项[' + i + '] 完整HTML ---');
        console.log(it.outerHTML.substring(0, 500));
        
        console.log('  classList:', Array.from(it.classList).join(', '));
        console.log('  子元素数量:', it.children.length);
        
        // 遍历所有子元素
        for (var j = 0; j < it.children.length; j++) {
            var child = it.children[j];
            console.log('  子元素[' + j + ']:', child.tagName, child.className);
        }
    }
    
    // 检查是否有 posCatalog_active 类在任何元素上
    var activeItems = document.querySelectorAll('.posCatalog_active');
    console.log('\n.posCatalog_active 数量: ' + activeItems.length);
    if (activeItems.length > 0) {
        console.log('激活项文本: ' + (activeItems[0].textContent || '').trim().substring(0, 30));
        console.log('激活项id: ' + (activeItems[0].id || '无'));
    }
    
    // 查找所有可能的active相关类
    var allClasses = {};
    for (var i = 0; i < items.length; i++) {
        var classes = items[i].className.split(' ');
        for (var j = 0; j < classes.length; j++) {
            if (classes[j].indexOf('active') >= 0 || classes[j].indexOf('cur') >= 0 || classes[j].indexOf('select') >= 0) {
                allClasses[classes[j]] = (allClasses[classes[j]] || 0) + 1;
            }
        }
    }
    console.log('\n活跃/当前相关类统计:', allClasses);
    
    console.log('\n===== 诊断结束 =====');
})();
