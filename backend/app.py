from flask import Flask, request, jsonify, render_template, send_from_directory, send_file
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import frida
import json
import os
import subprocess
import logging
from io import BytesIO

# 获取当前文件的目录
current_dir = os.path.dirname(os.path.abspath(__file__))

project_root = os.path.dirname(current_dir)

# 构建到 frontend/dist 和 user_scripts 的路径
frontend_dist_dir = os.path.join(current_dir, '..', 'frontend', 'dist')
user_scripts_dir = os.path.join(project_root, 'user_scripts')

# 确保user_scripts目录存在
os.makedirs(user_scripts_dir, exist_ok=True)

app = Flask(__name__, static_folder=frontend_dist_dir, static_url_path='')
CORS(app, resources={r"/*": {"origins": "*"}})

# 添加以下代码来配置日志
class SocketIOFilter(logging.Filter):
    def filter(self, record):
        return 'GET /socket.io/' not in record.getMessage()

logging.getLogger('werkzeug').addFilter(SocketIOFilter())

socketio = SocketIO(app, cors_allowed_origins="*")

# 全局变量来存储设备和会话
device = None
sessions = {}

# 存储脚本执行的日志
script_logs = {}

def get_device():
    global device
    if device is None:
        device = frida.get_usb_device()
    return device

@app.route('/processes', methods=['GET'])
def get_processes():
    try:
        device = get_device()
        processes = device.enumerate_processes()
        return jsonify([{'pid': p.pid, 'name': p.name} for p in processes])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/')
def index():
    return send_from_directory(frontend_dist_dir, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(frontend_dist_dir, path)

@socketio.on('attach')
def handle_attach(data):
    pid = data['pid']
    try:
        device = get_device()
        session = device.attach(pid)
        sessions[pid] = session
        socketio.emit('attach_result', {'success': True, 'pid': pid})
    except Exception as e:
        socketio.emit('attach_result', {'success': False, 'pid': pid, 'error': str(e)})

@socketio.on('inject_script')
def handle_inject_script(data):
    pid = data['pid']
    try:
        session = sessions.get(pid)
        if session is None:
            raise Exception("Session not found for pid: " + str(pid))
        
        # 编译 agent 代码
        compile_agent()
        
        # 读取编译后的 JavaScript 文件
        script_path = os.path.join(current_dir, '..', 'agent', '_fcagent.js')
        with open(script_path, 'r', encoding='utf-8') as file:
            script_content = file.read()
        
        script = session.create_script(script_content)
        script.load()
        sessions[pid] = (session, script)
        socketio.emit('inject_result', {'success': True, 'pid': pid})
    except Exception as e:
        socketio.emit('inject_result', {'success': False, 'pid': pid, 'error': str(e)})

@socketio.on('read_memory')
def handle_read_memory(data):
    pid = data['pid']
    address = data['address']
    size = data['size']
    try:
        _, script = sessions.get(pid, (None, None))
        if script is None:
            raise Exception("Script not found for pid: " + str(pid))
        
        result = script.exports_sync.read_memory(address, size)
        socketio.emit('memory_data', {'success': True, 'pid': pid, 'data': result})
    except Exception as e:
        socketio.emit('memory_data', {'success': False, 'pid': pid, 'error': str(e)})

@socketio.on('get_base_address')
def handle_get_base_address(data):
    pid = data['pid']
    try:
        _, script = sessions.get(pid, (None, None))
        if script is None:
            raise Exception("Script not found for pid: " + str(pid))
        
        base_address = script.exports_sync.get_base_address()
        socketio.emit('base_address', {'success': True, 'pid': pid, 'address': base_address})
    except Exception as e:
        socketio.emit('base_address', {'success': False, 'pid': pid, 'error': str(e)})

@socketio.on('enumerate_modules')
def handle_enumerate_modules(data):
    pid = data['pid']
    try:
        _, script = sessions.get(pid, (None, None))
        if script is None:
            raise Exception("Script not found for pid: " + str(pid))
        
        modules = script.exports_sync.enumerate_modules()
        for module in modules:
            imports = script.exports_sync.get_module_imports(module['name'])
            exports = script.exports_sync.get_module_exports(module['name'])
            module['importCount'] = len(imports)
            module['exportCount'] = len(exports)
        socketio.emit('modules_list', {'success': True, 'pid': pid, 'modules': modules})
    except Exception as e:
        socketio.emit('modules_list', {'success': False, 'pid': pid, 'error': str(e)})

@socketio.on('get_module_info')
def handle_get_module_info(data):
    pid = data['pid']
    module_name = data['module_name']
    try:
        _, script = sessions.get(pid, (None, None))
        if script is None:
            raise Exception("Script not found for pid: " + str(pid))
        
        module_info = script.exports_sync.get_module_info(module_name)
        socketio.emit('module_info', {'success': True, 'pid': pid, 'module_info': module_info})
    except Exception as e:
        socketio.emit('module_info', {'success': False, 'pid': pid, 'error': str(e)})

@socketio.on('get_module_ranges')
def handle_get_module_ranges(data):
    pid = data['pid']
    try:
        _, script = sessions.get(pid, (None, None))
        if script is None:
            raise Exception("Script not found for pid: " + str(pid))
        
        module_ranges = script.exports_sync.get_module_ranges()
        socketio.emit('module_ranges', {'success': True, 'pid': pid, 'module_ranges': module_ranges})
    except Exception as e:
        socketio.emit('module_ranges', {'success': False, 'pid': pid, 'error': str(e)})

@socketio.on('get_process_info')
def handle_get_process_info(data):
    pid = data['pid']
    try:
        _, script = sessions.get(pid, (None, None))
        if script is None:
            raise Exception("Script not found for pid: " + str(pid))
        
        process_id = script.exports_sync.get_process_id()
        process_name = script.exports_sync.get_process_name()
        socketio.emit('process_info', {'success': True, 'pid': pid, 'process_id': process_id, 'process_name': process_name})
    except Exception as e:
        socketio.emit('process_info', {'success': False, 'pid': pid, 'error': str(e)})

@socketio.on('enumerate_threads')
def handle_enumerate_threads(data):
    pid = data['pid']
    try:
        _, script = sessions.get(pid, (None, None))
        if script is None:
            raise Exception("Script not found for pid: " + str(pid))
        
        threads = script.exports.enumerate_threads()
        socketio.emit('threads_list', {'success': True, 'pid': pid, 'threads': threads})
    except Exception as e:
        socketio.emit('threads_list', {'success': False, 'pid': pid, 'error': str(e)})

@socketio.on('search_memory')
def handle_search_memory(data):
    pid = data['pid']
    pattern = data['pattern']
    range_start = data['range_start']
    range_end = data['range_end']
    try:
        _, script = sessions.get(pid, (None, None))
        if script is None:
            raise Exception("Script not found for pid: " + str(pid))
        
        results = script.exports_sync.search_memory(pattern, range_start, range_end)
        socketio.emit('search_results', {'success': True, 'pid': pid, 'results': results})
    except Exception as e:
        socketio.emit('search_results', {'success': False, 'pid': pid, 'error': str(e)})

@socketio.on('write_memory')
def handle_write_memory(data):
    pid = data['pid']
    address = data['address']
    bytes_data = data['data']
    try:
        _, script = sessions.get(pid, (None, None))
        if script is None:
            raise Exception("Script not found for pid: " + str(pid))
        
        script.exports_sync.write_memory(address, bytes_data)
        socketio.emit('write_result', {'success': True, 'pid': pid})
    except Exception as e:
        socketio.emit('write_result', {'success': False, 'pid': pid, 'error': str(e)})

@socketio.on('get_module_details')
def handle_get_module_details(data):
    pid = data['pid']
    module_name = data['moduleName']
    try:
        _, script = sessions.get(pid, (None, None))
        if script is None:
            raise Exception("Script not found for pid: " + str(pid))
        
        imports = script.exports_sync.get_module_imports(module_name)
        exports = script.exports_sync.get_module_exports(module_name)
        socketio.emit('module_details', {'success': True, 'pid': pid, 'imports': imports, 'exports': exports})
    except Exception as e:
        socketio.emit('module_details', {'success': False, 'pid': pid, 'error': str(e)})

@socketio.on('dump_module')
def handle_dump_module(data):
    pid = data['pid']
    module_name = data['moduleName']
    try:
        _, script = sessions.get(pid, (None, None))
        if script is None:
            raise Exception("Script not found for pid: " + str(pid))
        
        dump_data = script.exports_sync.dump_module(module_name)
        file_name = f"{module_name}_{pid}.bin"
        
        # 创建一个内存文件对象
        mem_file = BytesIO(dump_data)
        
        # 发送文件到客户端
        return send_file(
            mem_file,
            as_attachment=True,
            download_name=file_name,
            mimetype='application/octet-stream'
        )
    except Exception as e:
        socketio.emit('module_dumped', {'success': False, 'pid': pid, 'error': str(e)})

@app.route('/dump_module')
def download_module():
    pid = request.args.get('pid')
    module_name = request.args.get('moduleName')
    try:
        _, script = sessions.get(int(pid), (None, None))
        if script is None:
            raise Exception("Script not found for pid: " + str(pid))
        
        dump_data = script.exports_sync.dump_module(module_name)
        file_name = f"{module_name}_{pid}.bin"
        
        # 创建一个内存文件对象
        mem_file = BytesIO(dump_data)
        
        # 发送文件到客户端
        return send_file(
            mem_file,
            as_attachment=True,
            download_name=file_name,
            mimetype='application/octet-stream'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/scripts', methods=['GET'])
def get_scripts():
    try:
        scripts = []
        for file in os.listdir(user_scripts_dir):
            if file.endswith('.js'):
                script_path = os.path.join(user_scripts_dir, file)
                with open(script_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                scripts.append({
                    'name': file,
                    'content': content,
                    'path': script_path
                })
        return jsonify(scripts)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@socketio.on('load_script')
def handle_load_script(data):
    pid = data['pid']
    script_name = data['scriptName']
    try:
        # 先加载helper库
        helper_path = os.path.join(user_scripts_dir, 'frida-helper.js')
        with open(helper_path, 'r', encoding='utf-8') as f:
            helper_content = f.read()
        
        # 再加载用户脚本
        script_path = os.path.join(user_scripts_dir, script_name)
        with open(script_path, 'r', encoding='utf-8') as f:
            script_content = f.read()
        
        # 合并脚本内容
        combined_script = helper_content + '\n' + script_content
        
        session, _ = sessions.get(pid, (None, None))
        if session is None:
            raise Exception("Session not found for pid: " + str(pid))
        
        script = session.create_script(combined_script)
        
        def on_message(message, data):
            if message['type'] == 'send':
                log_data = json.loads(message['payload'])
                if pid not in script_logs:
                    script_logs[pid] = []
                log_data['id'] = len(script_logs[pid]) + 1
                script_logs[pid].append(log_data)
                socketio.emit('script_log', {
                    'pid': pid,
                    'log': log_data
                })
            elif message['type'] == 'error':
                socketio.emit('script_error', {
                    'pid': pid,
                    'error': message['description']
                })
        
        script.on('message', on_message)
        script.load()
        sessions[pid] = (session, script)
        socketio.emit('script_loaded', {'success': True, 'pid': pid, 'scriptName': script_name})
    except Exception as e:
        socketio.emit('script_loaded', {'success': False, 'pid': pid, 'error': str(e)})

@socketio.on('get_script_logs')
def handle_get_script_logs(data):
    pid = data['pid']
    try:
        logs = script_logs.get(pid, [])
        socketio.emit('script_logs', {'success': True, 'pid': pid, 'logs': logs})
    except Exception as e:
        socketio.emit('script_logs', {'success': False, 'pid': pid, 'error': str(e)})

@socketio.on('clear_script_logs')
def handle_clear_script_logs(data):
    pid = data['pid']
    try:
        script_logs[pid] = []
        socketio.emit('script_logs_cleared', {'success': True, 'pid': pid})
    except Exception as e:
        socketio.emit('script_logs_cleared', {'success': False, 'pid': pid, 'error': str(e)})

def compile_agent():
    agent_dir = os.path.join(current_dir, '..', 'agent')
    input_file = os.path.join(agent_dir, 'membrowser.ts')
    output_file = os.path.join(agent_dir, '_fcagent.js')
    
    try:
        subprocess.run(['frida-compile', input_file, '-o', output_file], check=True, cwd=project_root)
        print("Agent compiled successfully")
    except subprocess.CalledProcessError as e:
        print(f"Failed to compile agent: {e}")
        raise

if __name__ == '__main__':
    socketio.run(app, debug=True)
