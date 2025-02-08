// 这是一个示例脚本，展示如何使用Frida Helper库
// helper库已经由后端自动加载，可以直接使用$f对象

// 监控 open 函数调用
$f.hook.exportFunction(null, 'open', {
    onEnter: (args) => {
        const path = args[0].readUtf8String();
        return [path];  // 返回参数数组，会自动记录到日志中
    },
    onLeave: (retval) => {
        return retval.toInt32();  // 返回值会自动记录到日志中
    }
});
$f.hook.exportFunction
// 监控第一个模块的内存访问
const firstModule = $f.module.getAll()[0];
$f.memory.watch(firstModule.base, 0x1000, {
    onAccess: (args) => {
        return `访问模块 ${firstModule.name} 的基址`;
    }
});

// 获取并记录所有模块的信息
const modules = $f.module.getAll();
$f.log.info('已加载的模块列表', modules.map(m => ({
    name: m.name,
    base: m.base,
    size: m.size,
    path: m.path
})));

// 监控指定模块的导出函数
const targetModule = 'libc.so';
const exports = $f.module.getExports(targetModule);
if (exports.length > 0) {
    $f.log.info(`${targetModule} 的导出函数列表`, exports);
    
    // 监控第一个导出函数
    const firstExport = exports[0];
    $f.hook.address(firstExport.address, firstExport.name, {
        onEnter: (args) => {
            return ['监控到函数调用'];
        }
    });
} else {
    $f.log.warn(`未找到模块 ${targetModule}`);
}

// 发送初始化完成消息
$f.log.info('示例脚本已加载并开始运行');