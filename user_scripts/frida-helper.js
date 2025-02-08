// Frida Helper Library
// 提供简单易用的API来帮助用户编写脚本

const FridaHelper = {
    // 获取当前时间
    _getTime() {
        return new Date().toLocaleTimeString();
    },

    // 发送日志
    _sendLog(logData) {
        send(JSON.stringify({
            ...logData,
            timestamp: this._getTime()
        }));
    },

    // Hook相关函数
    hook: {
        // Hook导出函数
        exportFunction(moduleName, functionName, options = {}) {
            const targetPtr = Module.findExportByName(moduleName, functionName);
            if (!targetPtr) {
                this.log.error(`找不到函数: ${moduleName ? moduleName + '.' : ''}${functionName}`);
                return;
            }

            Interceptor.attach(targetPtr, {
                onEnter: function(args) {
                    if (options.onEnter) {
                        const params = options.onEnter(args);
                        if (params) {
                            FridaHelper._sendLog({
                                title: `${functionName}() 调用`,
                                type: 'function_call',
                                message: `调用 ${functionName}`,
                                args: params,
                                stackTrace: Thread.backtrace(this.context, Backtracer.ACCURATE)
                                    .map(DebugSymbol.fromAddress).join('\n')
                            });
                        }
                    }
                },
                onLeave: function(retval) {
                    if (options.onLeave) {
                        const result = options.onLeave(retval);
                        if (result !== undefined) {
                            FridaHelper._sendLog({
                                title: `${functionName}() 返回`,
                                type: 'function_return',
                                returnValue: result
                            });
                        }
                    }
                }
            });
        },
        
        // Hook指定地址
        address(address, name = `未命名函数_${address}`, options = {}) {
            Interceptor.attach(address, {
                onEnter: function(args) {
                    if (options.onEnter) {
                        const params = options.onEnter(args);
                        if (params) {
                            FridaHelper._sendLog({
                                title: `${name} 调用`,
                                type: 'function_call',
                                message: `调用 ${name}`,
                                args: params,
                                stackTrace: Thread.backtrace(this.context, Backtracer.ACCURATE)
                                    .map(DebugSymbol.fromAddress).join('\n')
                            });
                        }
                    }
                },
                onLeave: function(retval) {
                    if (options.onLeave) {
                        const result = options.onLeave(retval);
                        if (result !== undefined) {
                            FridaHelper._sendLog({
                                title: `${name} 返回`,
                                type: 'function_return',
                                returnValue: result
                            });
                        }
                    }
                }
            });
        }
    },

    // 内存相关函数
    memory: {
        // 监控内存访问
        watch(address, size, options = {}) {
            Memory.protect(address, size, 'rw-');
            
            Interceptor.attach(address, {
                onEnter: function(args) {
                    const info = options.onAccess ? options.onAccess(args) : null;
                    FridaHelper._sendLog({
                        title: '内存访问',
                        type: 'memory_access',
                        message: info || `访问地址: ${address}`,
                        stackTrace: Thread.backtrace(this.context, Backtracer.ACCURATE)
                            .map(DebugSymbol.fromAddress).join('\n')
                    });
                }
            });
        },

        // 读取内存
        read(address, size) {
            return Memory.readByteArray(address, size);
        },

        // 写入内存
        write(address, data) {
            Memory.writeByteArray(address, data);
        }
    },

    // 模块相关函数
    module: {
        // 获取所有模块
        getAll() {
            return Process.enumerateModules();
        },

        // 获取模块基址
        getBase(moduleName) {
            const module = Process.findModuleByName(moduleName);
            return module ? module.base : null;
        },

        // 获取模块导出函数
        getExports(moduleName) {
            const module = Process.findModuleByName(moduleName);
            return module ? module.enumerateExports() : [];
        },

        // 获取模块导入函数
        getImports(moduleName) {
            const module = Process.findModuleByName(moduleName);
            return module ? module.enumerateImports() : [];
        }
    },

    // 日志相关函数
    log: {
        // 普通信息
        info(message, data = null) {
            FridaHelper._sendLog({
                title: '信息',
                type: 'info',
                message: message,
                data: data
            });
        },

        // 警告信息
        warn(message, data = null) {
            FridaHelper._sendLog({
                title: '警告',
                type: 'warning',
                message: message,
                data: data
            });
        },

        // 错误信息
        error(message, error = null) {
            FridaHelper._sendLog({
                title: '错误',
                type: 'error',
                message: message,
                error: error ? error.toString() : null
            });
        },

        // 调试信息
        debug(message, data = null) {
            FridaHelper._sendLog({
                title: '调试',
                type: 'debug',
                message: message,
                data: data
            });
        }
    }
};

// 导出全局变量
globalThis.$f = FridaHelper;