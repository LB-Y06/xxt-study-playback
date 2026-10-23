/**
 * 学习通自动刷视频 - 调试版
 * 
 * 使用方法：
 * 1. 打开学习通课程页面
 * 2. 按 F12 打开开发者工具
 * 3. 切换到 Console（控制台）标签
 * 4. 复制本文件全部内容，粘贴到控制台，按 Enter 执行
 * 
 * 此版本会输出详细的调试信息，帮助诊断问题
 */

(function() {
    'use strict';

    console.log('%c=== 学习通调试脚本 ===', 'color: red; font-size: 20px; font-weight: bold;');
    console.log('%c开始分析页面结构...', 'color: orange; font-size: 14px;');

    // ========== 1. 分析目录结构 ==========
    console.log('\n%c【1】目录项分析:', 'color: #3A8BFF; font-size: 16px; font-weight: bold;');

    var catalogSelectors = ['.posCatalog_select', '.posCatalog_name', '.ncells', '.catalog_ico', 'li', 'a[href*="chapterId"]'];

    for (var i = 0; i < catalogSelectors.length; i++) {
        var selector = catalogSelectors[i];
        var items = document.querySelectorAll(selector);
        console.log('  选择器 "' + selector + '" 找到 ' + items.length + ' 个元素');

        if (items.length > 0 && items.length <= 5) {
            for (var j = 0; j < items.length; j++) {
                var item = items[j];
                var text = (item.textContent || '').trim().substring(0, 40);
                var href = '';
                var link = item.querySelector('a');
                if (link) {
                    href = link.getAttribute('href') || '';
                } else if (item.tagName === 'A') {
                    href = item.getAttribute('href') || '';
                }
                console.log('    [' + j + '] 文本: "' + text + '"');
                console.log('        href: "' + href.substring(0, 80) + '"');
                console.log('        class: "' + (item.className || '') + '"');
                console.log('        子元素数: ' + item.children.length);
            }
        }
    }

    // ========== 2. 查找视频图标/标记 ==========
    console.log('\n%c【2】视频图标/标记分析:', 'color: #3A8BFF; font-size: 16px; font-weight: bold;');

    var iconSelectors = ['.catalog_ico_video', '.Mca01', '.roundpoint', '.bluebg', '.orangebg', '[class*="video"]', '[class*="ico"]'];

    for (var i = 0; i < iconSelectors.length; i++) {
        var selector = iconSelectors[i];
        var items = document.querySelectorAll(selector);
        console.log('  选择器 "' + selector + '" 找到 ' + items.length + ' 个元素');
        if (items.length > 0) {
            var firstItem = items[0];
            var parent = firstItem.parentElement;
            console.log('    第一个元素的父元素 class: "' + (parent ? parent.className : 'null') + '"');
            console.log('    第一个元素的父元素 tagName: "' + (parent ? parent.tagName : 'null') + '"');
        }
    }

    // ========== 3. 分析当前激活项 ==========
    console.log('\n%c【3】当前激活项分析:', 'color: #3A8BFF; font-size: 16px; font-weight: bold;');

    var activeSelectors = ['.posCatalog_active', '.current', '.active'];
    for (var i = 0; i < activeSelectors.length; i++) {
        var selector = activeSelectors[i];
        var item = document.querySelector(selector);
        console.log('  选择器 "' + selector + '" 找到: ' + (item ? '是' : '否'));
        if (item) {
            console.log('    文本: "' + (item.textContent || '').trim().substring(0, 40) + '"');
            console.log('    class: "' + item.className + '"');
            console.log('    父元素: "' + (item.parentElement ? item.parentElement.tagName : 'null') + '"');
            console.log('    下一个兄弟: "' + (item.nextElementSibling ? item.nextElementSibling.tagName : 'null') + '"');
        }
    }

    // ========== 4. 查找视频元素 ==========
    console.log('\n%c【4】视频元素分析:', 'color: #3A8BFF; font-size: 16px; font-weight: bold;');

    var iframes = document.querySelectorAll('iframe');
    console.log('  页面共有 ' + iframes.length + ' 个 iframe');

    for (var i = 0; i < iframes.length; i++) {
        try {
            var iframe = iframes[i];
            var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (iframeDoc) {
                var video = iframeDoc.querySelector('video');
                console.log('  iframe[' + i + ']:');
                console.log('    src: "' + (iframe.src || '').substring(0, 80) + '"');
                console.log('    找到 video 元素: ' + (video ? '是' : '否'));
                if (video) {
                    console.log('    video.paused: ' + video.paused);
                    console.log('    video.ended: ' + video.ended);
                    console.log('    video.currentTime: ' + video.currentTime);
                    console.log('    video.duration: ' + video.duration);
                    console.log('    video.playbackRate: ' + video.playbackRate);
                }
            }
        } catch (e) {
            console.log('  iframe[' + i + ']: 跨域无法访问');
        }
    }

    // 直接查找 video
    var directVideo = document.querySelector('video');
    console.log('  直接查找 video: ' + (directVideo ? '是' : '否'));

    // ========== 5. 获取 URL 参数 ==========
    console.log('\n%c【5】URL 参数分析:', 'color: #3A8BFF; font-size: 16px; font-weight: bold;');
    console.log('  当前 URL: ' + window.location.href);
    var urlParams = new URLSearchParams(window.location.search);
    console.log('  chapterId: ' + (urlParams.get('chapterId') || '无'));
    console.log('  courseId: ' + (urlParams.get('courseId') || '无'));
    console.log('  clazzid: ' + (urlParams.get('clazzid') || '无'));

    // ========== 6. 测试点击功能 ==========
    console.log('\n%c【6】点击测试:', 'color: #3A8BFF; font-size: 16px; font-weight: bold;');
    console.log('  在控制台输入以下命令测试点击下一个章节:');
    console.log('  var nextItem = document.querySelector(".posCatalog_select:not(.posCatalog_active)");');
    console.log('  console.log("找到下一个: " + nextItem.textContent.trim());');
    console.log('  nextItem.querySelector("a").click();');

    console.log('\n%c=== 调试完成 ===', 'color: green; font-size: 20px; font-weight: bold;');
    console.log('%c请将以上输出截图或复制给我，我来修复脚本', 'color: orange; font-size: 14px;');

})();
