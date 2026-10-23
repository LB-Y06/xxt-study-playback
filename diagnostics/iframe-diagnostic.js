// 诊断脚本：查看 iframe 和目录结构
(function() {
    console.log('===== 诊断 iframe 和目录 =====');
    
    // 1. 顶层页面结构
    console.log('顶层 document.body 子元素:');
    for (var i = 0; i < document.body.children.length; i++) {
        var el = document.body.children[i];
        console.log('  [' + i + '] ' + el.tagName + (el.id ? '#' + el.id : '') + (el.className ? '.' + el.className.split(' ')[0] : ''));
    }
    
    // 2. 查找所有 iframe
    var iframes = document.querySelectorAll('iframe');
    console.log('\n找到 ' + iframes.length + ' 个 iframe:');
    for (var i = 0; i < iframes.length; i++) {
        var iframe = iframes[i];
        console.log('  iframe[' + i + ']:');
        console.log('    id: ' + (iframe.id || '无'));
        console.log('    src(前100): ' + (iframe.src || '').substring(0, 100));
        console.log('    width: ' + (iframe.width || '无'));
        console.log('    height: ' + (iframe.height || '无'));
    }
    
    // 3. 查找目录容器
    var catalogContainers = document.querySelectorAll('*[id*="catalog"], *[id*="Catalog"], *[id*="menu"], *[id*="nav"]');
    console.log('\n找到 ' + catalogContainers.length + ' 个可能的目录容器:');
    for (var i = 0; i < Math.min(3, catalogContainers.length); i++) {
        console.log('  [' + i + '] ' + catalogContainers[i].tagName + '#' + catalogContainers[i].id + ' 子元素数: ' + catalogContainers[i].children.length);
    }
    
    // 4. 查找包含 posCatalog_select 的元素
    var selectItems = document.querySelectorAll('.posCatalog_select');
    console.log('\n顶层 .posCatalog_select 数量: ' + selectItems.length);
    if (selectItems.length > 0) {
        for (var i = 0; i < Math.min(2, selectItems.length); i++) {
            console.log('  item[' + i + '] id=' + selectItems[i].id + ' 文本=' + selectItems[i].textContent.trim().substring(0, 30));
        }
    }
    
    console.log('\n===== 诊断结束 =====');
})();
