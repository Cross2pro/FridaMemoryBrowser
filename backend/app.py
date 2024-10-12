from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import frida
import json
import os
import subprocess
import logging

# 获取当前文件的目录
current_dir = os.path.dirname(os.path.abspath(__file__))

project_root = os.path.dirname(current_dir)

# 构建到 frontend/dist 的路径
frontend_dist_dir = os.path.join(current_dir, '..', 'frontend', 'dist')

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
        
        result = script.exports.read_memory(address, size)
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
        
        base_address = script.exports.get_base_address()
        socketio.emit('base_address', {'success': True, 'pid': pid, 'address': base_address})
    except Exception as e:
        socketio.emit('base_address', {'success': False, 'pid': pid, 'error': str(e)})

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